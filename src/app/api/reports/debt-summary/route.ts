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

    // Compute per-year expected breakdown (base quota + each extra charge)
    // We use the first unit as reference for base fee, but since units can have
    // different fees, we compute a "typical" breakdown from the charges themselves.
    // The header shows expected totals summed across all units.

    // Collect unique extra charges with their yearly totals
    const extraChargeMap = new Map<string, { id: string; description: string; yearlyTotals: Record<number, number> }>();

    for (const ec of allExtraCharges) {
      extraChargeMap.set(ec.id, {
        id: ec.id,
        description: ec.description,
        yearlyTotals: {},
      });
      for (const year of years) {
        extraChargeMap.get(ec.id)!.yearlyTotals[year] = 0;
      }
    }

    // Per-year base fee totals (across all units)
    const yearBaseFees: Record<number, number> = {};
    for (const year of years) {
      yearBaseFees[year] = 0;
    }

    const unitData = units.map((unit) => {
      const unitExtraCharges = allExtraCharges.filter(
        (e) => e.unitId === null || e.unitId === unit.id
      ) as ExtraChargeRecord[];

      const unitAllocations = allocations.filter(
        (a) => a.transaction.unitId === unit.id && a.transaction.amount > 0
      );

      const yearlyData: Record<number, { expected: number; paid: number; debt: number }> = {};

      for (const year of years) {
        let expectedForYear = 0;
        let paidForYear = 0;
        let baseFeeForYear = 0;

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
          baseFeeForYear += feeData.baseFee;

          // Accumulate extra charge amounts for header
          for (const extra of feeData.extras) {
            if (extra.id && extraChargeMap.has(extra.id)) {
              extraChargeMap.get(extra.id)!.yearlyTotals[year] += extra.amount;
            }
          }

          paidForYear += unitAllocations
            .filter((a) => a.month === monthStr)
            .reduce((sum, a) => sum + a.amount, 0);
        }

        yearBaseFees[year] += baseFeeForYear;

        const debt = Math.max(0, expectedForYear - paidForYear);
        yearlyData[year] = { expected: expectedForYear, paid: paidForYear, debt };
      }

      const totalDebt = Object.values(yearlyData).reduce((sum, y) => sum + y.debt, 0);
      const totalPaid = Object.values(yearlyData).reduce((sum, y) => sum + y.paid, 0);
      const totalExpected = Object.values(yearlyData).reduce((sum, y) => sum + y.expected, 0);

      const currentOwner = unit.owners?.find((o) => o.endMonth === null);
      const ownerName = currentOwner?.name || unit.owners?.[0]?.name || unit.code;

      return {
        id: unit.id,
        code: unit.code,
        name: ownerName,
        years: yearlyData,
        totalDebt,
        totalPaid,
        totalExpected,
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
    const grandTotalPaid = unitData.reduce((sum, u) => sum + u.totalPaid, 0);
    const grandTotalExpected = unitData.reduce((sum, u) => sum + u.totalExpected, 0);

    // Build expected breakdown for header
    const extraCharges = Array.from(extraChargeMap.values())
      .filter((ec) => {
        // Only include extras that have non-zero totals in at least one year
        return Object.values(ec.yearlyTotals).some((v) => v > 0);
      });

    return NextResponse.json({
      startYear,
      endYear,
      years,
      units: unitData,
      yearTotals,
      yearBaseFees,
      extraCharges,
      grandTotalDebt,
      grandTotalPaid,
      grandTotalExpected,
    });
  } catch (error) {
    console.error('Error fetching debt summary:', error);
    return NextResponse.json({ error: 'Failed to fetch debt summary' }, { status: 500 });
  }
}
