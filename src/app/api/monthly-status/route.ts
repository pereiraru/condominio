import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFeeForMonth } from '@/lib/feeHistory';

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

    // Get current fee and fee history
    let defaultFee = 0;
    let feeHistory: { amount: number; effectiveFrom: string }[] = [];

    if (unitId) {
      const unit = await prisma.unit.findUnique({
        where: { id: unitId },
        include: { feeHistory: { orderBy: { effectiveFrom: 'asc' } } },
      });
      defaultFee = unit?.monthlyFee ?? 0;
      feeHistory = unit?.feeHistory ?? [];
    } else if (creditorId) {
      const creditor = await prisma.creditor.findUnique({
        where: { id: creditorId },
        include: { feeHistory: { orderBy: { effectiveFrom: 'asc' } } },
      });
      defaultFee = creditor?.amountDue ?? 0;
      feeHistory = creditor?.feeHistory ?? [];
    }

    // Query TransactionMonth entries for the year
    const where: Record<string, unknown> = {};
    if (unitId) where.unitId = unitId;
    if (creditorId) where.creditorId = creditorId;

    const allocations = await prisma.transactionMonth.findMany({
      where: {
        transaction: where,
        month: {
          gte: `${year}-01`,
          lte: `${year}-12`,
        },
      },
    });

    // Build month status
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
      const monthAllocs = allocations.filter((a) => a.month === monthStr);
      const paid = monthAllocs.reduce((sum, a) => sum + a.amount, 0);
      const expected = getFeeForMonth(feeHistory, monthStr, defaultFee);

      months.push({
        month: monthStr,
        paid,
        expected,
        isPaid: expected > 0 ? paid >= expected : paid > 0,
      });
    }

    return NextResponse.json({ months });
  } catch (error) {
    console.error('Error fetching monthly status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monthly status' },
      { status: 500 }
    );
  }
}
