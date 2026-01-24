import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions, canAccessUnit } from '@/lib/auth';
import { getTotalFeeForMonth, FeeHistoryRecord, ExtraChargeRecord } from '@/lib/feeHistory';
import { isMonthInOwnerPeriod } from '@/lib/ownerPeriod';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!canAccessUnit(session?.user?.role, session?.user?.unitId, params.id)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    // Get unit with fee history and owners
    const unit = await prisma.unit.findUnique({
      where: { id: params.id },
      include: {
        feeHistory: { orderBy: { effectiveFrom: 'asc' } },
        owners: true,
      },
    });

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    // Determine owner period filter
    const searchParams = request.nextUrl.searchParams;
    let ownerId = searchParams.get('ownerId');
    const isAdmin = session?.user?.role === 'admin';

    // Non-admin: auto-detect ownerId from session
    if (!isAdmin && session?.user?.ownerId) {
      ownerId = session.user.ownerId;
    }

    let ownerStartMonth: string | null = null;
    let ownerEndMonth: string | null = null;

    if (ownerId) {
      const owner = unit.owners.find((o) => o.id === ownerId);
      if (owner) {
        ownerStartMonth = owner.startMonth;
        ownerEndMonth = owner.endMonth;
      }
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

    // Filter allocations to owner period if applicable
    const filteredAllocations = ownerId
      ? allocations.filter((a) => isMonthInOwnerPeriod(a.month, ownerStartMonth, ownerEndMonth))
      : allocations;

    // Find the earliest month with any activity
    const allMonths = filteredAllocations.map((a) => a.month);
    const feeMonths = unit.feeHistory.map((f) => f.effectiveFrom);
    const extraMonths = extraCharges.map((e) => e.effectiveFrom);
    let allDates = [...allMonths, ...feeMonths, ...extraMonths].filter(Boolean);

    // If filtering by owner, use owner's startMonth as the earliest
    if (ownerId && ownerStartMonth) {
      allDates = allDates.filter((d) => isMonthInOwnerPeriod(d, ownerStartMonth, ownerEndMonth));
      if (!allDates.includes(ownerStartMonth)) {
        allDates.push(ownerStartMonth);
      }
    }

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

    // Determine end year/month based on owner period
    let endYear = currentYear;
    let endMonthOfYear = currentMonth;
    if (ownerEndMonth) {
      const [ey, em] = ownerEndMonth.split('-').map(Number);
      if (ey < endYear || (ey === endYear && em < endMonthOfYear)) {
        endYear = ey;
        endMonthOfYear = em;
      }
    }

    // Build month-by-month data
    const payments: Record<string, number> = {};
    const expected: Record<string, number> = {};

    // Group allocations by month
    for (const alloc of filteredAllocations) {
      if (!payments[alloc.month]) {
        payments[alloc.month] = 0;
      }
      payments[alloc.month] += alloc.amount;
    }

    // Calculate expected for each month from start to end
    for (let year = startYear; year <= endYear; year++) {
      const lastMonth = year === endYear ? endMonthOfYear : 12;
      const firstMonth = year === startYear ? parseInt(earliestMonth.split('-')[1]) : 1;

      for (let m = firstMonth; m <= lastMonth; m++) {
        const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
        if (ownerId && !isMonthInOwnerPeriod(monthStr, ownerStartMonth, ownerEndMonth)) {
          continue;
        }
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

    for (let year = startYear; year <= endYear; year++) {
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
