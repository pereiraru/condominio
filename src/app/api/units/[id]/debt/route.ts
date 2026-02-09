import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { getTotalFeeForMonth, FeeHistoryRecord, ExtraChargeRecord, countMonthsInRange } from '@/lib/feeHistory';
import { isMonthInOwnerPeriod } from '@/lib/ownerPeriod';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

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

    const currentYear = new Date().getFullYear();

    // Get all month allocations for this unit's transactions
    const allocations = await prisma.transactionMonth.findMany({
      where: {
        transaction: { unitId: params.id },
      },
      select: { month: true, amount: true },
    });

    // Separate PREV-DEBT allocations
    const prevDebtAllocations = allocations.filter((a) => a.month === 'PREV-DEBT');
    const regularAllocations = allocations.filter((a) => a.month !== 'PREV-DEBT');

    // Filter regular allocations to owner period
    const filteredAllocations = ownerId
      ? regularAllocations.filter((a) => isMonthInOwnerPeriod(a.month, ownerStartMonth, ownerEndMonth))
      : regularAllocations;

    // Derive minYear from earliest fee history record
    const minYear = unit.feeHistory.length > 0
      ? parseInt((unit.feeHistory[0] as FeeHistoryRecord).effectiveFrom.split('-')[0])
      : currentYear;

    // Determine start year from owner period or allocations
    let startYear: number | null = null;
    if (ownerStartMonth) {
      startYear = Math.max(parseInt(ownerStartMonth.split('-')[0]), minYear);
    }

    // Get all unique years from allocations (past years only, from minYear onwards)
    const years = new Set<number>();
    filteredAllocations.forEach((a) => {
      const year = parseInt(a.month.split('-')[0]);
      if (year < currentYear && year >= minYear) {
        years.add(year);
      }
    });

    // Also add years covered by feeHistory (covers years with no payments)
    unit.feeHistory.forEach((fh) => {
      const fhStartYear = Math.max(parseInt(fh.effectiveFrom.split('-')[0]), minYear);
      const fhEndYear = fh.effectiveTo
        ? parseInt(fh.effectiveTo.split('-')[0])
        : currentYear - 1;
      for (let y = fhStartYear; y <= Math.min(fhEndYear, currentYear - 1); y++) {
        years.add(y);
      }
    });

    // If owner has a start year, ensure all years from start are included
    if (startYear && startYear < currentYear) {
      for (let y = startYear; y < currentYear; y++) {
        years.add(y);
      }
    }

    let pastYearsDebt = 0;

    // Sort years so surplus carries forward correctly
    const sortedYears = Array.from(years).sort((a, b) => a - b);

    for (const year of sortedYears) {
      let expectedForYear = 0;
      for (let m = 1; m <= 12; m++) {
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
        expectedForYear += feeData.total;
      }

      const paidForYear = filteredAllocations
        .filter((a) => a.month.startsWith(`${year}-`))
        .reduce((sum, a) => sum + a.amount, 0);

      // Surplus from overpayment reduces previously accumulated debt
      pastYearsDebt = Math.max(0, pastYearsDebt + expectedForYear - paidForYear);
    }

    // Calculate previousDebtRemaining
    let previousDebt = 0;
    if (ownerId) {
      const owner = unit.owners.find((o) => o.id === ownerId);
      if (owner) {
        previousDebt = owner.previousDebt;
      }
    } else {
      previousDebt = unit.owners.reduce((sum, o) => sum + o.previousDebt, 0);
    }
    const previousDebtPaid = prevDebtAllocations.reduce((sum, a) => sum + a.amount, 0);
    const previousDebtRemaining = Math.max(0, previousDebt - previousDebtPaid);

    // Compute outstanding extras summary
    const outstandingExtras: {
      id: string;
      description: string;
      totalExpected: number;
      totalPaid: number;
      remaining: number;
    }[] = [];

    for (const charge of extraCharges) {
      const totalExpected = charge.amount * countMonthsInRange(charge.effectiveFrom, charge.effectiveTo);

      const paidResult = await prisma.transactionMonth.aggregate({
        where: {
          extraChargeId: charge.id,
          transaction: { unitId: params.id },
        },
        _sum: { amount: true },
      });
      const totalPaid = paidResult._sum.amount || 0;
      const remaining = Math.max(0, totalExpected - totalPaid);

      outstandingExtras.push({
        id: charge.id,
        description: charge.description,
        totalExpected,
        totalPaid,
        remaining,
      });
    }

    return NextResponse.json({ pastYearsDebt, previousDebtRemaining, outstandingExtras });
  } catch (error) {
    console.error('Error calculating debt:', error);
    return NextResponse.json(
      { error: 'Failed to calculate debt' },
      { status: 500 }
    );
  }
}
