import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        unitId: params.id,
        referenceMonth: { not: null },
      },
      select: {
        referenceMonth: true,
        amount: true,
      },
    });

    // Group payments by referenceMonth
    const payments: Record<string, number> = {};
    for (const tx of transactions) {
      if (!tx.referenceMonth) continue;
      if (!payments[tx.referenceMonth]) {
        payments[tx.referenceMonth] = 0;
      }
      payments[tx.referenceMonth] += Math.abs(tx.amount);
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
