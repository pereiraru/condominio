import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { getTotalFeeForMonth, FeeHistoryRecord, ExtraChargeRecord } from '@/lib/feeHistory';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  // Only admins can access the full overview report
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const year = parseInt(
      request.nextUrl.searchParams.get('year') ?? new Date().getFullYear().toString()
    );

    // Get all units with owners and fee history
    const units = await prisma.unit.findMany({
      include: {
        owners: true,
        feeHistory: { orderBy: { effectiveFrom: 'asc' } },
      },
      orderBy: { code: 'asc' },
    });

    // Get all creditors with fee history
    const creditors = await prisma.creditor.findMany({
      include: {
        feeHistory: { orderBy: { effectiveFrom: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });

    // Get all extra charges
    const allExtraCharges = await prisma.extraCharge.findMany();

    // Get all TransactionMonth allocations for the year, including transaction data
    const yearAllocations = await prisma.transactionMonth.findMany({
      where: {
        month: {
          gte: `${year}-01`,
          lte: `${year}-12`,
        },
      },
      include: {
        transaction: {
          select: { id: true, unitId: true, creditorId: true, amount: true, date: true, description: true },
        },
      },
    });

    // Get all allocations before the selected year (for past years debt)
    const pastAllocations = await prisma.transactionMonth.findMany({
      where: {
        month: {
          lt: `${year}-01`,
        },
      },
      include: {
        transaction: {
          select: { unitId: true, creditorId: true, amount: true },
        },
      },
    });

    // Calculate past years debt for each entity using year-by-year carry-forward
    const calculatePastYearsDebt = (
      entityId: string,
      entityType: 'unit' | 'creditor',
      feeHistory: FeeHistoryRecord[],
      defaultFee: number,
      extraCharges: ExtraChargeRecord[]
    ) => {
      const entityAllocs = pastAllocations.filter((a) =>
        entityType === 'unit' ? a.transaction.unitId === entityId : a.transaction.creditorId === entityId
      );

      // Collect all relevant years from allocations, feeHistory, and extra charges
      const pastYears = new Set<number>();
      entityAllocs.forEach((a) => {
        const y = parseInt(a.month.split('-')[0]);
        if (y < year) pastYears.add(y);
      });

      feeHistory.forEach((fh) => {
        const startY = parseInt(fh.effectiveFrom.split('-')[0]);
        const endY = fh.effectiveTo
          ? parseInt(fh.effectiveTo.split('-')[0])
          : year - 1;
        for (let y = startY; y <= Math.min(endY, year - 1); y++) {
          pastYears.add(y);
        }
      });

      if (entityType === 'unit') {
        extraCharges.forEach((ec) => {
          const startY = parseInt(ec.effectiveFrom.split('-')[0]);
          const endY = ec.effectiveTo
            ? parseInt(ec.effectiveTo.split('-')[0])
            : year - 1;
          for (let y = startY; y <= Math.min(endY, year - 1); y++) {
            pastYears.add(y);
          }
        });
      }

      if (pastYears.size === 0) return 0;

      let accumulatedDebt = 0;
      const sortedYears = Array.from(pastYears).sort((a, b) => a - b);

      for (const y of sortedYears) {
        let expectedForYear = 0;
        let paidForYear = 0;

        for (let m = 1; m <= 12; m++) {
          const monthStr = `${y}-${m.toString().padStart(2, '0')}`;
          const feeData = getTotalFeeForMonth(
            feeHistory,
            entityType === 'unit' ? extraCharges : [],
            monthStr,
            defaultFee,
            entityType === 'unit' ? entityId : undefined
          );
          expectedForYear += feeData.total;

          paidForYear += entityAllocs
            .filter((a) => a.month === monthStr)
            .reduce((sum, a) => sum + a.amount, 0);
        }

        // Surplus from overpayment reduces previously accumulated debt
        accumulatedDebt = Math.max(0, accumulatedDebt + expectedForYear - paidForYear);
      }

      return accumulatedDebt;
    };

    // Build unit data (receitas)
    const unitData = units.map((unit) => {
      // Filter extra charges for this unit (global + unit-specific)
      const unitExtraCharges = allExtraCharges.filter(
        (e) => e.unitId === null || e.unitId === unit.id
      ) as ExtraChargeRecord[];

      const months: Record<
        string,
        { paid: number; expected: number; baseFee: number; extras: number; transactions: { id: string; amount: number; date: string; description: string }[] }
      > = {};
      let totalPaid = 0;
      let totalExpected = 0;

      for (let m = 1; m <= 12; m++) {
        const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
        const monthAllocs = yearAllocations.filter(
          (a) => a.transaction.unitId === unit.id && a.month === monthStr && a.transaction.amount > 0
        );
        const paid = monthAllocs.reduce((sum, a) => sum + a.amount, 0);
        const feeData = getTotalFeeForMonth(
          unit.feeHistory as FeeHistoryRecord[],
          unitExtraCharges,
          monthStr,
          unit.monthlyFee,
          unit.id
        );

        months[monthStr] = {
          paid,
          expected: feeData.total,
          baseFee: feeData.baseFee,
          extras: feeData.extras.reduce((sum, e) => sum + e.amount, 0),
          transactions: monthAllocs.map((a) => ({
            id: a.transaction.id,
            amount: a.amount,
            date: a.transaction.date.toISOString(),
            description: a.transaction.description,
          })),
        };
        totalPaid += paid;
        totalExpected += feeData.total;
      }

      const pastYearsDebt = calculatePastYearsDebt(
        unit.id,
        'unit',
        unit.feeHistory as FeeHistoryRecord[],
        unit.monthlyFee,
        unitExtraCharges
      );

      const yearDebt = Math.max(0, totalExpected - totalPaid);

      // Current owner = the one with endMonth = null
      const currentOwner = unit.owners?.find((o) => o.endMonth === null);
      const ownerName = currentOwner?.name || unit.owners?.[0]?.name || unit.code;

      return {
        id: unit.id,
        code: unit.code,
        name: ownerName,
        months,
        totalPaid,
        totalExpected,
        yearDebt,
        pastYearsDebt,
        totalDebt: yearDebt + pastYearsDebt,
      };
    });

    // Build creditor data (despesas)
    const creditorData = creditors.map((creditor) => {
      const months: Record<
        string,
        { paid: number; expected: number; transactions: { id: string; amount: number; date: string; description: string }[] }
      > = {};
      let totalPaid = 0;
      let totalExpected = 0;

      for (let m = 1; m <= 12; m++) {
        const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
        const monthAllocs = yearAllocations.filter(
          (a) => a.transaction.creditorId === creditor.id && a.month === monthStr && a.transaction.amount < 0
        );
        const paid = monthAllocs.reduce((sum, a) => sum + a.amount, 0);
        const feeData = getTotalFeeForMonth(
          creditor.feeHistory as FeeHistoryRecord[],
          [], // Creditors don't have extra charges
          monthStr,
          creditor.amountDue ?? 0
        );

        months[monthStr] = {
          paid,
          expected: feeData.total,
          transactions: monthAllocs.map((a) => ({
            id: a.transaction.id,
            amount: a.amount,
            date: a.transaction.date.toISOString(),
            description: a.transaction.description,
          })),
        };
        totalPaid += paid;
        totalExpected += feeData.total;
      }

      const pastYearsDebt = calculatePastYearsDebt(
        creditor.id,
        'creditor',
        creditor.feeHistory as FeeHistoryRecord[],
        creditor.amountDue ?? 0,
        []
      );

      return {
        id: creditor.id,
        code: creditor.name,
        name: creditor.name,
        months,
        totalPaid,
        totalExpected,
        pastYearsDebt,
      };
    });

    // Calculate totals
    const totalReceitas = unitData.reduce((sum, u) => sum + u.totalPaid, 0);
    const totalDespesas = creditorData.reduce((sum, c) => sum + c.totalPaid, 0);
    const totalDebtAllUnits = unitData.reduce((sum, u) => sum + u.totalDebt, 0);

    return NextResponse.json({
      year,
      units: unitData,
      creditors: creditorData,
      totals: {
        receitas: totalReceitas,
        despesas: totalDespesas,
        saldo: totalReceitas - totalDespesas,
        totalDebt: totalDebtAllUnits,
      },
    });
  } catch (error) {
    console.error('Error fetching overview:', error);
    return NextResponse.json({ error: 'Failed to fetch overview' }, { status: 500 });
  }
}
