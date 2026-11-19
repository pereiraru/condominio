import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { getFeeForMonth, FeeHistoryRecord } from '@/lib/feeHistory';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const unit = await prisma.unit.findUnique({
      where: { id: params.id },
      include: {
        feeHistory: { orderBy: { effectiveFrom: 'asc' } },
        owners: { orderBy: { startMonth: 'asc' } },
        transactions: {
          where: { amount: { gt: 0 } },
          orderBy: [{ date: 'asc' }, { id: 'asc' }],
          include: { monthAllocations: true },
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const feeHistory = unit.feeHistory as FeeHistoryRecord[];
    const currentYear = new Date().getFullYear();

    // Separate pure PREV-DEBT transactions from transactions with remaining quota capacity
    const allocatableTxs = unit.transactions
      .map((tx) => {
        const prevDebtPaid = tx.monthAllocations
          .filter((a) => a.month === 'PREV-DEBT')
          .reduce((sum, a) => sum + a.amount, 0);
        const allocatableAmount = Math.round((tx.amount - prevDebtPaid) * 100) / 100;
        return { tx, allocatableAmount };
      })
      .filter((item) => item.allocatableAmount > 0.005);
    const regularTxIds = allocatableTxs.map((item) => item.tx.id);

    const startMonth =
      feeHistory.length > 0 ? feeHistory[0].effectiveFrom : '2024-01';
    const [startY, startM] = startMonth.split('-').map(Number);

    const months: string[] = [];
    for (let y = startY; y <= currentYear + 1; y++) {
      const firstM = y === startY ? startM : 1;
      for (let m = firstM; m <= 12; m++) {
        months.push(`${y}-${m.toString().padStart(2, '0')}`);
      }
    }

    await prisma.$transaction(async (txPrisma) => {
      if (regularTxIds.length > 0) {
        await txPrisma.transactionMonth.deleteMany({
          where: {
            transactionId: { in: regularTxIds },
            month: { not: 'PREV-DEBT' },
          },
        });
      }

      const paidInMonth: Record<string, number> = {};
      let monthIdx = 0;

      for (const { tx, allocatableAmount } of allocatableTxs) {
        const txMonth = tx.date.toISOString().slice(0, 7);
        const expectedTxMonth = getFeeForMonth(feeHistory, txMonth, unit.monthlyFee);

        // Check if all months up to txMonth are already >= expected fee
        const priorHasGap = months.some(
          (m) =>
            m <= txMonth &&
            (paidInMonth[m] || 0) <
              getFeeForMonth(feeHistory, m, unit.monthlyFee) - 0.01
        );

        // If prior months are full and tx has surplus on an unpaid txMonth, keep it on txMonth
        if (!priorHasGap && allocatableAmount > expectedTxMonth + 0.01 && (paidInMonth[txMonth] || 0) < 0.01) {
          await txPrisma.transactionMonth.create({
            data: {
              transactionId: tx.id,
              month: txMonth,
              amount: allocatableAmount,
            },
          });
          paidInMonth[txMonth] = (paidInMonth[txMonth] || 0) + allocatableAmount;
          continue;
        }

        let rem = allocatableAmount;
        while (rem > 0.005 && monthIdx < months.length) {
          const m = months[monthIdx];
          const cap = getFeeForMonth(feeHistory, m, unit.monthlyFee);
          const already = paidInMonth[m] || 0;
          const need = Math.round((cap - already) * 100) / 100;
          if (need <= 0.005) {
            monthIdx++;
            continue;
          }
          const alloc = Math.round(Math.min(need, rem) * 100) / 100;
          await txPrisma.transactionMonth.create({
            data: { transactionId: tx.id, month: m, amount: alloc },
          });
          paidInMonth[m] = Math.round((already + alloc) * 100) / 100;
          rem = Math.round((rem - alloc) * 100) / 100;
        }

        if (rem > 0.005) {
          const fallbackMonth = months[months.length - 1] || txMonth;
          await txPrisma.transactionMonth.create({
            data: { transactionId: tx.id, month: fallbackMonth, amount: rem },
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      reallocatedTransactions: allocatableTxs.length,
    });
  } catch (error) {
    console.error('Error reallocating unit transactions:', error);
    return NextResponse.json(
      { error: 'Failed to reallocate transactions' },
      { status: 500 }
    );
  }
}
