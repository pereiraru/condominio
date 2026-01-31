import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTotalFeeForMonth, countMonthsInRange, FeeHistoryRecord, ExtraChargeRecord } from '@/lib/feeHistory';

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
            monthAllocations: {
              include: {
                extraCharge: true,
              },
            },
          },
        },
      },
    });

    // Extract unique transactions
    const transactions = allocations.map((a) => a.transaction);

    // Get expected breakdown for this month
    const unit = await prisma.unit.findUnique({
      where: { id: params.id },
      include: {
        feeHistory: { orderBy: { effectiveFrom: 'asc' } },
      },
    });

    const extraCharges = await prisma.extraCharge.findMany({
      where: {
        OR: [{ unitId: null }, { unitId: params.id }],
      },
    });

    let expected = null;
    if (unit) {
      const feeData = getTotalFeeForMonth(
        unit.feeHistory as FeeHistoryRecord[],
        extraCharges as ExtraChargeRecord[],
        month,
        unit.monthlyFee,
        params.id
      );
      expected = {
        baseFee: feeData.baseFee,
        extras: feeData.extras.map((e) => ({
          id: e.id || '',
          description: e.description,
          amount: e.amount,
        })),
        total: feeData.total,
      };
    }

    // Compute outstanding balances for ALL extra charges applicable to this unit
    const outstandingExtras: {
      id: string;
      description: string;
      monthlyAmount: number;
      totalExpected: number;
      totalPaid: number;
      remaining: number;
    }[] = [];

    for (const charge of extraCharges) {
      const totalExpected = charge.amount * countMonthsInRange(charge.effectiveFrom, charge.effectiveTo);

      // Sum all TransactionMonth amounts allocated to this extra charge for this unit
      const paidResult = await prisma.transactionMonth.aggregate({
        where: {
          extraChargeId: charge.id,
          transaction: { unitId: params.id },
        },
        _sum: { amount: true },
      });
      const totalPaid = paidResult._sum.amount || 0;
      const remaining = Math.max(0, totalExpected - totalPaid);

      if (remaining > 0) {
        outstandingExtras.push({
          id: charge.id,
          description: charge.description,
          monthlyAmount: charge.amount,
          totalExpected,
          totalPaid,
          remaining,
        });
      }
    }

    return NextResponse.json({ transactions, expected, outstandingExtras });
  } catch (error) {
    console.error('Error fetching month transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
