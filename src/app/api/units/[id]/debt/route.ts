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
        transactions: {
          where: { type: 'payment' },
          select: { amount: true, referenceMonth: true, date: true },
        },
        feeHistory: {
          orderBy: { effectiveFrom: 'asc' },
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const currentYear = new Date().getFullYear();
    const transactions = unit.transactions;

    // Get all unique years from transactions
    const years = new Set<number>();
    transactions.forEach((tx) => {
      if (tx.referenceMonth) {
        const year = parseInt(tx.referenceMonth.split('-')[0]);
        if (year < currentYear) {
          years.add(year);
        }
      } else if (tx.date) {
        const year = new Date(tx.date).getFullYear();
        if (year < currentYear) {
          years.add(year);
        }
      }
    });

    const earliestYear = Math.min(...Array.from(years), currentYear - 1);

    let pastYearsDebt = 0;

    for (let year = earliestYear; year < currentYear; year++) {
      // Calculate expected per month using historical fees
      let expectedForYear = 0;
      for (let m = 1; m <= 12; m++) {
        const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
        expectedForYear += getFeeForMonth(unit.feeHistory, monthStr, unit.monthlyFee);
      }

      // Paid: sum of payments with referenceMonth in that year
      const paidForYear = transactions
        .filter((tx) => {
          if (tx.referenceMonth) {
            return tx.referenceMonth.startsWith(`${year}-`);
          }
          return false;
        })
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

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
