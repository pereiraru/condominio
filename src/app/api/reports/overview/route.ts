import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFeeForMonth } from '@/lib/feeHistory';

export async function GET(request: NextRequest) {
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

    // Calculate past years debt for each entity
    const calculatePastYearsDebt = (
      entityId: string,
      entityType: 'unit' | 'creditor',
      feeHistory: { amount: number; effectiveFrom: string }[],
      defaultFee: number
    ) => {
      const entityAllocs = pastAllocations.filter((a) =>
        entityType === 'unit' ? a.transaction.unitId === entityId : a.transaction.creditorId === entityId
      );

      if (entityAllocs.length === 0) return 0;

      const earliestMonth = entityAllocs.map((a) => a.month).sort()[0];
      if (!earliestMonth) return 0;

      let totalExpected = 0;
      let totalPaid = 0;

      const [earliestYear, earliestM] = earliestMonth.split('-').map(Number);
      const endYear = year - 1;

      for (let y = earliestYear; y <= endYear; y++) {
        const startMonth = y === earliestYear ? earliestM : 1;
        for (let m = startMonth; m <= 12; m++) {
          const monthStr = `${y}-${m.toString().padStart(2, '0')}`;
          const expected = getFeeForMonth(feeHistory, monthStr, defaultFee);
          const paid = entityAllocs
            .filter((a) => a.month === monthStr)
            .reduce((sum, a) => sum + a.amount, 0);

          totalExpected += expected;
          totalPaid += paid;
        }
      }

      return Math.max(0, totalExpected - totalPaid);
    };

    // Build unit data (receitas)
    const unitData = units.map((unit) => {
      const months: Record<
        string,
        { paid: number; expected: number; transactions: { id: string; amount: number; date: string; description: string }[] }
      > = {};
      let totalPaid = 0;
      let totalExpected = 0;

      for (let m = 1; m <= 12; m++) {
        const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
        const monthAllocs = yearAllocations.filter(
          (a) => a.transaction.unitId === unit.id && a.month === monthStr && a.transaction.amount > 0
        );
        const paid = monthAllocs.reduce((sum, a) => sum + a.amount, 0);
        const expected = getFeeForMonth(unit.feeHistory, monthStr, unit.monthlyFee);

        months[monthStr] = {
          paid,
          expected,
          transactions: monthAllocs.map((a) => ({
            id: a.transaction.id,
            amount: a.amount,
            date: a.transaction.date.toISOString(),
            description: a.transaction.description,
          })),
        };
        totalPaid += paid;
        totalExpected += expected;
      }

      const pastYearsDebt = calculatePastYearsDebt(
        unit.id,
        'unit',
        unit.feeHistory,
        unit.monthlyFee
      );

      return {
        id: unit.id,
        code: unit.code,
        name: unit.owners?.[0]?.name || unit.code,
        months,
        totalPaid,
        totalExpected,
        pastYearsDebt,
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
        const expected = getFeeForMonth(creditor.feeHistory, monthStr, creditor.amountDue ?? 0);

        months[monthStr] = {
          paid,
          expected,
          transactions: monthAllocs.map((a) => ({
            id: a.transaction.id,
            amount: a.amount,
            date: a.transaction.date.toISOString(),
            description: a.transaction.description,
          })),
        };
        totalPaid += paid;
        totalExpected += expected;
      }

      const pastYearsDebt = calculatePastYearsDebt(
        creditor.id,
        'creditor',
        creditor.feeHistory,
        creditor.amountDue ?? 0
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

    return NextResponse.json({
      year,
      units: unitData,
      creditors: creditorData,
      totals: {
        receitas: totalReceitas,
        despesas: totalDespesas,
        saldo: totalReceitas - totalDespesas,
      },
    });
  } catch (error) {
    console.error('Error fetching overview:', error);
    return NextResponse.json({ error: 'Failed to fetch overview' }, { status: 500 });
  }
}
