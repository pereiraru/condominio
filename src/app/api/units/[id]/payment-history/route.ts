import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Query TransactionMonth entries for all transactions of this unit
    const allocations = await prisma.transactionMonth.findMany({
      where: {
        transaction: {
          unitId: params.id,
        },
      },
      select: {
        month: true,
        amount: true,
      },
    });

    // Group by month
    const payments: Record<string, number> = {};
    for (const alloc of allocations) {
      if (!payments[alloc.month]) {
        payments[alloc.month] = 0;
      }
      payments[alloc.month] += alloc.amount;
    }

    return NextResponse.json({ payments });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment history' },
      { status: 500 }
    );
  }
}
