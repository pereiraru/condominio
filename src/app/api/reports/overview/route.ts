import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFeeForMonth } from '@/lib/feeHistory';

export async function GET(request: NextRequest) {
  try {
    const year = parseInt(
      request.nextUrl.searchParams.get('year') ?? new Date().getFullYear().toString()
    );

    // Get all units with owners and fee history
    const units = await prisma.unit.findMany({
      include: {
        owners: true,
        feeHistory: { orderBy: { effectiveFrom: 'asc' } },
      },
      orderBy: { code: 'asc' },
    });

    // Get all creditors with fee history
    const creditors = await prisma.creditor.findMany({
      include: {
        feeHistory: { orderBy: { effectiveFrom: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });

    // Get all transactions for the year (with referenceMonth)
    const transactions = await prisma.transaction.findMany({
      where: {
        referenceMonth: {
          gte: `${year}-01`,
          lte: `${year}-12`,
        },
      },
      orderBy: { date: 'desc' },
    });

    // Get all transactions before the selected year (for past years debt calculation)
    const pastTransactions = await prisma.transaction.findMany({
      where: {
        referenceMonth: {
          lt: `${year}-01`,
        },
      },
    });

    // Calculate past years debt for each unit
    const calculatePastYearsDebt = (
      entityId: string,
      entityType: 'unit' | 'creditor',
      feeHistory: { amount: number; effectiveFrom: string }[],
      defaultFee: number
    ) => {
      // Get all unique months from past transactions for this entity
      const entityTxs = pastTransactions.filter((t) =>
        entityType === 'unit' ? t.unitId === entityId : t.creditorId === entityId
      );

      // Get the earliest transaction date to know when to start counting
      const allTxs = [...entityTxs, ...transactions.filter((t) =>
        entityType === 'unit' ? t.unitId === entityId : t.creditorId === entityId
      )];

      if (allTxs.length === 0) return 0;

      // Find the earliest month with any transaction
      const earliestMonth = allTxs
        .filter((t) => t.referenceMonth)
        .map((t) => t.referenceMonth!)
        .sort()[0];

      if (!earliestMonth) return 0;

      // Calculate expected vs paid for all months up to end of previous year
      let totalExpected = 0;
      let totalPaid = 0;

      const [earliestYear, earliestM] = earliestMonth.split('-').map(Number);
      const endYear = year - 1;

      for (let y = earliestYear; y <= endYear; y++) {
        const startMonth = y === earliestYear ? earliestM : 1;
        const endMonth = 12;

        for (let m = startMonth; m <= endMonth; m++) {
          const monthStr = `${y}-${m.toString().padStart(2, '0')}`;
          const expected = getFeeForMonth(feeHistory, monthStr, defaultFee);
          const monthTxs = pastTransactions.filter(
            (t) =>
              (entityType === 'unit' ? t.unitId === entityId : t.creditorId === entityId) &&
              t.referenceMonth === monthStr
          );
          const paid =
            entityType === 'unit'
              ? monthTxs.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
              : Math.abs(monthTxs.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));

          totalExpected += expected;
          totalPaid += paid;
        }
      }

      return Math.max(0, totalExpected - totalPaid);
    };

    // Build unit data (receitas)
    const unitData = units.map((unit) => {
      const months: Record<
        string,
        { paid: number; expected: number; transactions: { id: string; amount: number; date: string; description: string }[] }
      > = {};
      let totalPaid = 0;
      let totalExpected = 0;

      for (let m = 1; m <= 12; m++) {
        const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
        const monthTxs = transactions.filter(
          (t) => t.unitId === unit.id && t.referenceMonth === monthStr && t.amount > 0
        );
        const paid = monthTxs.reduce((sum, t) => sum + t.amount, 0);
        const expected = getFeeForMonth(unit.feeHistory, monthStr, unit.monthlyFee);

        months[monthStr] = {
          paid,
          expected,
          transactions: monthTxs.map((t) => ({
            id: t.id,
            amount: t.amount,
            date: t.date.toISOString(),
            description: t.description,
          })),
        };
        totalPaid += paid;
        totalExpected += expected;
      }

      const pastYearsDebt = calculatePastYearsDebt(
        unit.id,
        'unit',
        unit.feeHistory,
        unit.monthlyFee
      );

      return {
        id: unit.id,
        code: unit.code,
        name: unit.owners?.[0]?.name || unit.code,
        months,
        totalPaid,
        totalExpected,
        pastYearsDebt,
      };
    });

    // Build creditor data (despesas)
    const creditorData = creditors.map((creditor) => {
      const months: Record<
        string,
        { paid: number; expected: number; transactions: { id: string; amount: number; date: string; description: string }[] }
      > = {};
      let totalPaid = 0;
      let totalExpected = 0;

      for (let m = 1; m <= 12; m++) {
        const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
        const monthTxs = transactions.filter(
          (t) => t.creditorId === creditor.id && t.referenceMonth === monthStr && t.amount < 0
        );
        const paid = Math.abs(monthTxs.reduce((sum, t) => sum + t.amount, 0));
        const expected = getFeeForMonth(creditor.feeHistory, monthStr, creditor.amountDue ?? 0);

        months[monthStr] = {
          paid,
          expected,
          transactions: monthTxs.map((t) => ({
            id: t.id,
            amount: Math.abs(t.amount),
            date: t.date.toISOString(),
            description: t.description,
          })),
        };
        totalPaid += paid;
        totalExpected += expected;
      }

      const pastYearsDebt = calculatePastYearsDebt(
        creditor.id,
        'creditor',
        creditor.feeHistory,
        creditor.amountDue ?? 0
      );

      return {
        id: creditor.id,
        code: creditor.name,
        name: creditor.name,
        months,
        totalPaid,
        totalExpected,
        pastYearsDebt,
      };
    });

    // Calculate totals
    const totalReceitas = unitData.reduce((sum, u) => sum + u.totalPaid, 0);
    const totalDespesas = creditorData.reduce((sum, c) => sum + c.totalPaid, 0);

    return NextResponse.json({
      year,
      units: unitData,
      creditors: creditorData,
      totals: {
        receitas: totalReceitas,
        despesas: totalDespesas,
        saldo: totalReceitas - totalDespesas,
      },
    });
  } catch (error) {
    console.error('Error fetching overview:', error);
    return NextResponse.json({ error: 'Failed to fetch overview' }, { status: 500 });
  }
}
