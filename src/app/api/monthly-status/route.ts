import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const unitId = searchParams.get('unitId');
    const creditorId = searchParams.get('creditorId');
    const year = parseInt(searchParams.get('year') ?? new Date().getFullYear().toString());

    if (!unitId && !creditorId) {
      return NextResponse.json(
        { error: 'unitId or creditorId required' },
        { status: 400 }
      );
    }

    // Get expected amount
    let expectedAmount = 0;
    if (unitId) {
      const unit = await prisma.unit.findUnique({ where: { id: unitId } });
      expectedAmount = unit?.monthlyFee ?? 0;
    } else if (creditorId) {
      const creditor = await prisma.creditor.findUnique({ where: { id: creditorId } });
      expectedAmount = creditor?.amountDue ?? 0;
    }

    // Get all transactions for this unit/creditor in the year with referenceMonth
    const where: Record<string, unknown> = {};
    if (unitId) where.unitId = unitId;
    if (creditorId) where.creditorId = creditorId;
    where.referenceMonth = {
      gte: `${year}-01`,
      lte: `${year}-12`,
    };

    const transactions = await prisma.transaction.findMany({ where });

    // Build month status
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
      const monthTxs = transactions.filter((t) => t.referenceMonth === monthStr);
      const paid = monthTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0);

      months.push({
        month: monthStr,
        paid,
        expected: expectedAmount,
        isPaid: expectedAmount > 0 ? paid >= expectedAmount : paid > 0,
      });
    }

    return NextResponse.json({ months, expectedAmount });
  } catch (error) {
    console.error('Error fetching monthly status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monthly status' },
      { status: 500 }
    );
  }
}
