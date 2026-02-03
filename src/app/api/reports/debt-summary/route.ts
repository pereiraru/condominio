import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { getTotalFeeForMonth, FeeHistoryRecord, ExtraChargeRecord } from '@/lib/feeHistory';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const currentYear = new Date().getFullYear();
    const startYear = parseInt(
      request.nextUrl.searchParams.get('startYear') ?? '2021'
    );
    const endYear = parseInt(
      request.nextUrl.searchParams.get('endYear') ?? currentYear.toString()
    );

    const units = await prisma.unit.findMany({
      include: {
        owners: true,
        feeHistory: { orderBy: { effectiveFrom: 'asc' } },
      },
      orderBy: { code: 'asc' },
    });

    const allExtraCharges = await prisma.extraCharge.findMany();

    // Get all TransactionMonth allocations from startYear onwards
    const allocations = await prisma.transactionMonth.findMany({
      where: {
        month: {
          gte: `${startYear}-01`,
          lte: `${endYear}-12`,
        },
      },
      include: {
        transaction: {
          select: { unitId: true, amount: true },
        },
      },
    });

    const years = Array.from(
      { length: endYear - startYear + 1 },
      (_, i) => startYear + i
    );

    const unitData = units.map((unit) => {
      const unitExtraCharges = allExtraCharges.filter(
        (e) => e.unitId === null || e.unitId === unit.id
      ) as ExtraChargeRecord[];

      const unitAllocations = allocations.filter(
        (a) => a.transaction.unitId === unit.id && a.transaction.amount > 0
      );

      // Also get all allocations BEFORE startYear for carry-forward
      // We'll compute this separately below

      const yearlyData: Record<number, { expected: number; paid: number; debt: number }> = {};

      for (const year of years) {
        let expectedForYear = 0;
        let paidForYear = 0;

        for (let m = 1; m <= 12; m++) {
          const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
          const feeData = getTotalFeeForMonth(
            unit.feeHistory as FeeHistoryRecord[],
            unitExtraCharges,
            monthStr,
            unit.monthlyFee,
            unit.id
          );
          expectedForYear += feeData.total;

          paidForYear += unitAllocations
            .filter((a) => a.month === monthStr)
            .reduce((sum, a) => sum + a.amount, 0);
        }

        const debt = Math.max(0, expectedForYear - paidForYear);
        yearlyData[year] = { expected: expectedForYear, paid: paidForYear, debt };
      }

      // Total debt = sum of all yearly debts (simple per-year, no carry-forward between displayed years)
      const totalDebt = Object.values(yearlyData).reduce((sum, y) => sum + y.debt, 0);

      const currentOwner = unit.owners?.find((o) => o.endMonth === null);
      const ownerName = currentOwner?.name || unit.owners?.[0]?.name || unit.code;

      return {
        id: unit.id,
        code: unit.code,
        name: ownerName,
        years: yearlyData,
        totalDebt,
      };
    });

    // Compute totals per year
    const yearTotals: Record<number, { expected: number; paid: number; debt: number }> = {};
    for (const year of years) {
      yearTotals[year] = {
        expected: unitData.reduce((sum, u) => sum + u.years[year].expected, 0),
        paid: unitData.reduce((sum, u) => sum + u.years[year].paid, 0),
        debt: unitData.reduce((sum, u) => sum + u.years[year].debt, 0),
      };
    }

    const grandTotalDebt = unitData.reduce((sum, u) => sum + u.totalDebt, 0);

    return NextResponse.json({
      startYear,
      endYear,
      years,
      units: unitData,
      yearTotals,
      grandTotalDebt,
    });
  } catch (error) {
    console.error('Error fetching debt summary:', error);
    return NextResponse.json({ error: 'Failed to fetch debt summary' }, { status: 500 });
  }
}
