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
    const startYear = 2024;
    const endYear = parseInt(
      request.nextUrl.searchParams.get('endYear') ?? currentYear.toString()
    );

    const units = await prisma.unit.findMany({
      include: {
        owners: { orderBy: { startMonth: 'asc' } },
        feeHistory: { orderBy: { effectiveFrom: 'asc' } },
      },
      orderBy: { code: 'asc' },
    });

    const allExtraCharges = await prisma.extraCharge.findMany();

    // Get all TransactionMonth allocations from 2024 onwards
    const allocations = await prisma.transactionMonth.findMany({
      where: {
        month: {
          gte: `2024-01`,
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

    // Collect unique extra charges with their yearly totals (2024+)
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

    // Per-year base fee totals (across all units, 2024+)
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

      const yearlyData: Record<string | number, { expected: number; paid: number; debt: number }> = {};

      // 1. Handle "Anterior 2024" column
      // This is based on Unit.previousBalance and Owner.previousDebt
      const manualPrevDebt = unit.owners.reduce((sum, o) => sum + o.previousDebt, 0) - unit.previousBalance;
      yearlyData['Anterior 2024'] = {
        expected: manualPrevDebt > 0 ? manualPrevDebt : 0,
        paid: manualPrevDebt < 0 ? Math.abs(manualPrevDebt) : 0,
        debt: manualPrevDebt > 0 ? manualPrevDebt : 0
      };

      // 2. Handle 2024+ years
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

      const totalDebt = Object.keys(yearlyData).reduce((sum, key) => sum + yearlyData[key].debt, 0);
      const totalPaid = Object.keys(yearlyData).reduce((sum, key) => sum + yearlyData[key].paid, 0);
      const totalExpected = Object.keys(yearlyData).reduce((sum, key) => sum + yearlyData[key].expected, 0);

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
    const yearTotals: Record<string | number, { expected: number; paid: number; debt: number }> = {};
    
    // Total for "Anterior 2024"
    yearTotals['Anterior 2024'] = {
        expected: unitData.reduce((sum, u) => sum + u.years['Anterior 2024'].expected, 0),
        paid: unitData.reduce((sum, u) => sum + u.years['Anterior 2024'].paid, 0),
        debt: unitData.reduce((sum, u) => sum + u.years['Anterior 2024'].debt, 0),
    };

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
        return Object.values(ec.yearlyTotals).some((v) => v > 0);
      });

    return NextResponse.json({
      startYear,
      endYear,
      years: ['Anterior 2024', ...years],
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
