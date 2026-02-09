import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { getTotalFeeForMonth, FeeHistoryRecord, ExtraChargeRecord } from '@/lib/feeHistory';

export async function GET() {
  const session = await getServerSession(authOptions);

  // Non-admin users can only see their own unit
  const isAdmin = session?.user?.role === 'admin';
  const userUnitId = session?.user?.unitId;

  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Get all extra charges
    const allExtraCharges = await prisma.extraCharge.findMany();

    const units = await prisma.unit.findMany({
      where: isAdmin ? undefined : { id: userUnitId || 'none' },
      orderBy: { code: 'asc' },
      include: {
        owners: true,
        feeHistory: { orderBy: { effectiveFrom: 'asc' } },
        transactions: {
          where: { type: 'payment' },
          select: {
            id: true,
            amount: true,
            monthAllocations: { select: { month: true, amount: true } },
          },
        },
      },
    });

    const result = units.map((unit) => {
      // Filter extra charges for this unit (global + unit-specific)
      const unitExtraCharges = allExtraCharges.filter(
        (e) => e.unitId === null || e.unitId === unit.id
      ) as ExtraChargeRecord[];

      // Flatten all month allocations for this unit
      const allAllocations = unit.transactions.flatMap((t) => t.monthAllocations);

      // Calculate unallocated payments (income transactions with no month allocations)
      const unallocatedTxs = unit.transactions.filter(
        (t) => t.amount > 0 && t.monthAllocations.length === 0
      );
      const unallocatedPayments = {
        count: unallocatedTxs.length,
        total: unallocatedTxs.reduce((sum, t) => sum + t.amount, 0),
      };

      // Derive minYear from earliest fee history record
      const minYear = unit.feeHistory.length > 0
        ? parseInt((unit.feeHistory[0] as FeeHistoryRecord).effectiveFrom.split('-')[0])
        : currentYear;

      // Calculate expected YTD (current year, up to current month)
      let expectedYTD = 0;
      let expectedUpToLastMonth = 0;
      for (let m = 1; m <= currentMonth; m++) {
        const monthStr = `${currentYear}-${m.toString().padStart(2, '0')}`;
        const feeData = getTotalFeeForMonth(
          unit.feeHistory as FeeHistoryRecord[],
          unitExtraCharges,
          monthStr,
          unit.monthlyFee,
          unit.id
        );
        expectedYTD += feeData.total;
        if (m < currentMonth) {
          expectedUpToLastMonth += feeData.total;
        }
      }

      // Calculate paid YTD (current year)
      const allocationsThisYear = allAllocations.filter((a) => a.month.startsWith(`${currentYear}-`));
      const paidYTD = allocationsThisYear.reduce((sum, a) => sum + a.amount, 0);
      
      const paidUpToLastMonth = allocationsThisYear
        .filter(a => parseInt(a.month.split('-')[1]) < currentMonth)
        .reduce((sum, a) => sum + a.amount, 0);

      // Calculate past years debt (only from minYear onwards)
      const pastYears = new Set<number>();
      allAllocations.forEach((a) => {
        const year = parseInt(a.month.split('-')[0]);
        if (year < currentYear && year >= minYear) pastYears.add(year);
      });

      // Also add years covered by feeHistory (covers years with no payments)
      unit.feeHistory.forEach((fh) => {
        const startYear = Math.max(parseInt(fh.effectiveFrom.split('-')[0]), minYear);
        const endYear = fh.effectiveTo
          ? parseInt(fh.effectiveTo.split('-')[0])
          : currentYear - 1;
        for (let y = startYear; y <= Math.min(endYear, currentYear - 1); y++) {
          pastYears.add(y);
        }
      });

      // Also add years covered by extra charges (from minYear onwards)
      unitExtraCharges.forEach((ec) => {
        const ecStartYear = Math.max(parseInt(ec.effectiveFrom.split('-')[0]), minYear);
        const ecEndYear = ec.effectiveTo
          ? parseInt(ec.effectiveTo.split('-')[0])
          : currentYear - 1;
        for (let y = ecStartYear; y <= Math.min(ecEndYear, currentYear - 1); y++) {
          pastYears.add(y);
        }
      });

      let pastYearsDebt = 0;
      // Sort years so surplus carries forward correctly
      const sortedYears = Array.from(pastYears).sort((a, b) => a - b);
      for (const year of sortedYears) {
        let expectedForYear = 0;
        for (let m = 1; m <= 12; m++) {
          const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
          const feeData = getTotalFeeForMonth(
            unit.feeHistory as FeeHistoryRecord[],
            unitExtraCharges,
            monthStr,
            unit.monthlyFee,
            unit.id
          );
          expectedForYear += feeData.total;
        }
        const paidForYear = allAllocations
          .filter((a) => a.month.startsWith(`${year}-`))
          .reduce((sum, a) => sum + a.amount, 0);
        // Surplus from overpayment reduces previously accumulated debt
        pastYearsDebt = Math.max(0, pastYearsDebt + expectedForYear - paidForYear);
      }

      const yearDebt = Math.max(0, expectedYTD - paidYTD);
      const pastDebtInCurrentYear = Math.max(0, expectedUpToLastMonth - paidUpToLastMonth);
      const totalOwed = yearDebt + pastYearsDebt;
      const pastDebt = pastDebtInCurrentYear + pastYearsDebt;

      return {
        id: unit.id,
        code: unit.code,
        floor: unit.floor,
        description: unit.description,
        monthlyFee: unit.monthlyFee,
        nib: unit.nib,
        telefone: unit.telefone,
        email: unit.email,
        owners: unit.owners,
        totalPaid: paidYTD,
        totalOwed,
        pastDebt,
        unallocatedPayments,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching units:', error);
    return NextResponse.json(
      { error: 'Failed to fetch units' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();

    const unit = await prisma.unit.create({
      data: {
        code: body.code,
        floor: body.floor,
        description: body.description,
        monthlyFee: parseFloat(body.monthlyFee ?? '45'),
        nib: body.nib || null,
        telefone: body.telefone || null,
        email: body.email || null,
        owners: body.owners?.length
          ? {
              create: body.owners.map((name: string) => ({ name })),
            }
          : undefined,
      },
      include: { owners: true },
    });

    return NextResponse.json(unit, { status: 201 });
  } catch (error) {
    console.error('Error creating unit:', error);
    return NextResponse.json(
      { error: 'Failed to create unit' },
      { status: 500 }
    );
  }
}
