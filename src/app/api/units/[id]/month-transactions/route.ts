import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');

  if (!month) {
    return NextResponse.json({ error: 'Month parameter required' }, { status: 400 });
  }

  try {
    // Find transactions that have allocations for this month
    const allocations = await prisma.transactionMonth.findMany({
      where: {
        month,
        transaction: {
          unitId: params.id,
        },
      },
      include: {
        transaction: {
          include: {
            monthAllocations: true,
          },
        },
      },
    });

    // Extract unique transactions
    const transactions = allocations.map((a) => a.transaction);

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Error fetching month transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
