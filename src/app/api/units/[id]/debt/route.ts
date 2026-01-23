import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFeeForMonth } from '@/lib/feeHistory';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const unit = await prisma.unit.findUnique({
      where: { id: params.id },
      include: {
        feeHistory: {
          orderBy: { effectiveFrom: 'asc' },
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const currentYear = new Date().getFullYear();

    // Get all month allocations for this unit's transactions
    const allocations = await prisma.transactionMonth.findMany({
      where: {
        transaction: { unitId: params.id },
      },
      select: { month: true, amount: true },
    });

    // Get all unique years from allocations (past years only)
    const years = new Set<number>();
    allocations.forEach((a) => {
      const year = parseInt(a.month.split('-')[0]);
      if (year < currentYear) {
        years.add(year);
      }
    });

    let pastYearsDebt = 0;

    for (const year of Array.from(years)) {
      let expectedForYear = 0;
      for (let m = 1; m <= 12; m++) {
        const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
        expectedForYear += getFeeForMonth(unit.feeHistory, monthStr, unit.monthlyFee);
      }

      const paidForYear = allocations
        .filter((a) => a.month.startsWith(`${year}-`))
        .reduce((sum, a) => sum + a.amount, 0);

      const yearDebt = Math.max(0, expectedForYear - paidForYear);
      pastYearsDebt += yearDebt;
    }

    return NextResponse.json({ pastYearsDebt });
  } catch (error) {
    console.error('Error calculating debt:', error);
    return NextResponse.json(
      { error: 'Failed to calculate debt' },
      { status: 500 }
    );
  }
}
