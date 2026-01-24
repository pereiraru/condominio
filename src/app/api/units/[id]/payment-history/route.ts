import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions, canAccessUnit } from '@/lib/auth';
import { getTotalFeeForMonth, FeeHistoryRecord, ExtraChargeRecord } from '@/lib/feeHistory';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!canAccessUnit(session?.user?.role, session?.user?.unitId, params.id)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    // Get unit with fee history
    const unit = await prisma.unit.findUnique({
      where: { id: params.id },
      include: { feeHistory: { orderBy: { effectiveFrom: 'asc' } } },
    });

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    // Get extra charges (global + unit-specific)
    const extraCharges = await prisma.extraCharge.findMany({
      where: {
        OR: [{ unitId: null }, { unitId: params.id }],
      },
    });

    // Query TransactionMonth entries for all transactions of this unit
    const allocations = await prisma.transactionMonth.findMany({
      where: {
        transaction: {
          unitId: params.id,
          amount: { gt: 0 }, // Only positive transactions (payments)
        },
      },
      select: {
        month: true,
        amount: true,
      },
    });

    // Find the earliest month with any activity
    const allMonths = allocations.map((a) => a.month);
    const feeMonths = unit.feeHistory.map((f) => f.effectiveFrom);
    const extraMonths = extraCharges.map((e) => e.effectiveFrom);
    const allDates = [...allMonths, ...feeMonths, ...extraMonths].filter(Boolean);

    if (allDates.length === 0) {
      return NextResponse.json({
        payments: {},
        expected: {},
        yearlyData: []
      });
    }

    const earliestMonth = allDates.sort()[0];
    const [startYear] = earliestMonth.split('-').map(Number);
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Build month-by-month data
    const payments: Record<string, number> = {};
    const expected: Record<string, number> = {};

    // Group allocations by month
    for (const alloc of allocations) {
      if (!payments[alloc.month]) {
        payments[alloc.month] = 0;
      }
      payments[alloc.month] += alloc.amount;
    }

    // Calculate expected for each month from start to now
    for (let year = startYear; year <= currentYear; year++) {
      const endMonth = year === currentYear ? currentMonth : 12;
      const startMonth = year === startYear ? parseInt(earliestMonth.split('-')[1]) : 1;

      for (let m = startMonth; m <= endMonth; m++) {
        const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
        const feeData = getTotalFeeForMonth(
          unit.feeHistory as FeeHistoryRecord[],
          extraCharges as ExtraChargeRecord[],
          monthStr,
          unit.monthlyFee,
          params.id
        );
        expected[monthStr] = feeData.total;
      }
    }

    // Calculate yearly data with debt and accumulated
    const yearlyData: {
      year: number;
      paid: number;
      expected: number;
      debt: number;
      accumulatedDebt: number;
    }[] = [];

    let accumulatedDebt = 0;

    for (let year = startYear; year <= currentYear; year++) {
      let yearPaid = 0;
      let yearExpected = 0;

      for (let m = 1; m <= 12; m++) {
        const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
        yearPaid += payments[monthStr] || 0;
        yearExpected += expected[monthStr] || 0;
      }

      const yearDebt = Math.max(0, yearExpected - yearPaid);
      accumulatedDebt += yearDebt;

      yearlyData.push({
        year,
        paid: yearPaid,
        expected: yearExpected,
        debt: yearDebt,
        accumulatedDebt,
      });
    }

    return NextResponse.json({
      payments,
      expected,
      yearlyData,
    });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment history' },
      { status: 500 }
    );
  }
}
