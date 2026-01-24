import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions, canAccessUnit } from '@/lib/auth';
import { getTotalFeeForMonth, FeeHistoryRecord, ExtraChargeRecord } from '@/lib/feeHistory';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === 'admin';

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

    // Non-admin users can only query their own unit (not creditors)
    if (!isAdmin) {
      if (creditorId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      if (unitId && !canAccessUnit(session?.user?.role, session?.user?.unitId, unitId)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    // Get current fee, fee history, and extra charges
    let defaultFee = 0;
    let feeHistory: FeeHistoryRecord[] = [];
    let extraCharges: ExtraChargeRecord[] = [];

    if (unitId) {
      const unit = await prisma.unit.findUnique({
        where: { id: unitId },
        include: { feeHistory: { orderBy: { effectiveFrom: 'asc' } } },
      });
      defaultFee = unit?.monthlyFee ?? 0;
      feeHistory = unit?.feeHistory ?? [];

      // Get extra charges (global + unit-specific)
      const charges = await prisma.extraCharge.findMany({
        where: {
          OR: [{ unitId: null }, { unitId }],
        },
      });
      extraCharges = charges;
    } else if (creditorId) {
      const creditor = await prisma.creditor.findUnique({
        where: { id: creditorId },
        include: { feeHistory: { orderBy: { effectiveFrom: 'asc' } } },
      });
      defaultFee = creditor?.amountDue ?? 0;
      feeHistory = creditor?.feeHistory ?? [];
      // Creditors don't have extra charges
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

      // Calculate expected with extra charges
      const feeData = getTotalFeeForMonth(
        feeHistory,
        extraCharges,
        monthStr,
        defaultFee,
        unitId || undefined
      );

      months.push({
        month: monthStr,
        paid,
        expected: feeData.total,
        baseFee: feeData.baseFee,
        extras: feeData.extras.map((e) => ({
          description: e.description,
          amount: e.amount,
        })),
        isPaid: feeData.total > 0 ? paid >= feeData.total : paid > 0,
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
