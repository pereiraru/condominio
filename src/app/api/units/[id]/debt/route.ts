import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
      },
    });

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const currentYear = new Date().getFullYear();

    // Calculate debt from past years
    // We need to find the earliest transaction or use a reasonable start year
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

    // Also check for years where there should have been payments
    // For simplicity, we'll calculate from the unit creation or earliest transaction
    const earliestYear = Math.min(...Array.from(years), currentYear - 1);

    let pastYearsDebt = 0;

    for (let year = earliestYear; year < currentYear; year++) {
      // Expected: 12 months * monthly fee
      const expectedForYear = unit.monthlyFee * 12;

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
