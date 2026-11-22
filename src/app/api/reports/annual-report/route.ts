import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { getTotalFeeForMonth, FeeHistoryRecord, ExtraChargeRecord } from '@/lib/feeHistory';
import { Owner } from '@prisma/client';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    console.log('[AnnualReport] No session found');
    return NextResponse.json({ error: 'Unauthorized - No Session' }, { status: 403 });
  }

  if (session.user.role !== 'admin') {
    console.log('[AnnualReport] User is not admin:', session.user.email, 'Role:', session.user.role);
    return NextResponse.json({ error: 'Unauthorized - Not Admin' }, { status: 403 });
  }

  try {
    const year = parseInt(
      request.nextUrl.searchParams.get('year') ?? new Date().getFullYear().toString()
    );
    const now = new Date();
    const currentYear = now.getFullYear();
    const maxElapsedMonth = year < currentYear ? 12 : year === currentYear ? now.getMonth() + 1 : 0;

    // --- Fetch all required data ---

    const [units, creditors, allExtraCharges, yearAllocations, pastAllocations, bankAccounts, supplierInvoices, budget] = await Promise.all([
      prisma.unit.findMany({
        include: {
          owners: true,
          feeHistory: { orderBy: { effectiveFrom: 'asc' } },
        },
        orderBy: { code: 'asc' },
      }),
      prisma.creditor.findMany({
        include: {
          feeHistory: { orderBy: { effectiveFrom: 'asc' } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.extraCharge.findMany(),
      prisma.transactionMonth.findMany({
        where: {
          OR: [
            { month: { gte: `${year}-01`, lte: `${year}-12` } },
            {
              month: 'PREV-DEBT',
              transaction: {
                date: {
                  gte: new Date(`${year}-01-01`),
                  lte: new Date(`${year}-12-31T23:59:59`),
                },
              },
            },
          ],
        },
        include: {
          transaction: {
            select: { id: true, unitId: true, creditorId: true, amount: true, date: true, description: true, type: true, category: true },
          },
          extraCharge: true,
        },
      }),
      prisma.transactionMonth.findMany({
        where: {
          OR: [
            { month: { lt: `${year}-01` } },
            {
              month: 'PREV-DEBT',
              transaction: {
                date: { lt: new Date(`${year}-01-01`) },
              },
            },
          ],
        },
        include: {
          transaction: { select: { unitId: true, creditorId: true, amount: true } },
        },
      }),
      prisma.bankAccount.findMany({
        include: {
          snapshots: {
            where: {
              date: {
                lte: new Date(`${year}-12-31T23:59:59`),
              },
            },
            orderBy: { date: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.supplierInvoice.findMany({
        where: {
          date: {
            gte: new Date(`${year}-01-01`),
            lte: new Date(`${year}-12-31T23:59:59`),
          },
        },
        include: {
          creditor: { select: { name: true, category: true } },
        },
        orderBy: [{ category: 'asc' }, { date: 'asc' }],
      }),
      prisma.budget.findFirst({
        where: { year: year + 1 },
        include: {
          lines: { orderBy: { sortOrder: 'asc' } },
        },
      }),
    ]);

    // --- Helper: calculate past years debt for a unit ---
    const calculatePastYearsDebt = (
      unitId: string,
      feeHistory: FeeHistoryRecord[],
      defaultFee: number,
      extraCharges: ExtraChargeRecord[],
      unitOwners: Owner[]
    ): { pastYearsDebt: number; previousDebtRemaining: number } => {
      const entityAllocs = pastAllocations.filter(
        (a) => a.transaction.unitId === unitId && a.transaction.amount > 0
      );

      // 1. Calculate Pre-2024 Debt (Manual)
      const previousDebt = unitOwners.reduce((sum, o) => sum + (o.previousDebt || 0), 0);
      const previousDebtPaid = entityAllocs
        .filter((a) => a.month === 'PREV-DEBT')
        .reduce((sum, a) => sum + a.amount, 0);
      const previousDebtRemaining = Math.max(0, previousDebt - previousDebtPaid);

      // 2. Calculate 2024-Present Past Debt
      const pastYears = new Set<number>();
      entityAllocs.filter(a => a.month !== 'PREV-DEBT').forEach((a) => {
        const y = parseInt(a.month.split('-')[0]);
        if (y < year) pastYears.add(y);
      });

      feeHistory.forEach((fh) => {
        const startY = parseInt(fh.effectiveFrom.split('-')[0]);
        const endY = fh.effectiveTo ? parseInt(fh.effectiveTo.split('-')[0]) : year - 1;
        // Focus on post-2023 for digital records
        for (let y = Math.max(2024, startY); y <= Math.min(endY, year - 1); y++) {
          pastYears.add(y);
        }
      });

      extraCharges.forEach((ec) => {
        const startY = parseInt(ec.effectiveFrom.split('-')[0]);
        const endY = ec.effectiveTo ? parseInt(ec.effectiveTo.split('-')[0]) : year - 1;
        for (let y = Math.max(2024, startY); y <= Math.min(endY, year - 1); y++) {
          pastYears.add(y);
        }
      });

      let accumulatedDebt = 0;
      let netPastDiff = 0;
      if (pastYears.size > 0) {
        const sortedYears = Array.from(pastYears).sort((a, b) => a - b);

        for (const y of sortedYears) {
          let expectedForYear = 0;
          let paidForYear = 0;

          for (let m = 1; m <= 12; m++) {
            const monthStr = `${y}-${m.toString().padStart(2, '0')}`;
            const feeData = getTotalFeeForMonth(feeHistory, extraCharges, monthStr, defaultFee, unitId);
            expectedForYear += feeData.total;
            paidForYear += entityAllocs
              .filter((a) => a.month === monthStr)
              .reduce((sum, a) => sum + a.amount, 0);
          }

          netPastDiff += expectedForYear - paidForYear;
          accumulatedDebt = Math.max(0, accumulatedDebt + expectedForYear - paidForYear);
        }
      }

      const adjustedPreviousDebtRemaining =
        netPastDiff < 0
          ? Math.max(0, previousDebtRemaining + netPastDiff)
          : previousDebtRemaining;

      return { pastYearsDebt: accumulatedDebt, previousDebtRemaining: adjustedPreviousDebtRemaining };
    };

    // --- Helper: calculate past years debt for a fixed creditor ---
    const calculatePastYearsCreditorDebt = (
      creditorId: string,
      feeHistory: FeeHistoryRecord[],
      defaultFee: number
    ): number => {
      const entityAllocs = pastAllocations.filter(
        (a) => a.transaction.creditorId === creditorId
      );

      const pastYears = new Set<number>();
      entityAllocs.forEach((a) => {
        const y = parseInt(a.month.split('-')[0]);
        if (y < year) pastYears.add(y);
      });

      feeHistory.forEach((fh) => {
        const startY = parseInt(fh.effectiveFrom.split('-')[0]);
        const endY = fh.effectiveTo ? parseInt(fh.effectiveTo.split('-')[0]) : year - 1;
        for (let y = Math.max(2024, startY); y <= Math.min(endY, year - 1); y++) {
          pastYears.add(y);
        }
      });

      if (pastYears.size === 0) return 0;

      let accumulatedDebt = 0;
      const sortedYears = Array.from(pastYears).sort((a, b) => a - b);

      for (const y of sortedYears) {
        let expectedForYear = 0;
        let paidForYear = 0;

        for (let m = 1; m <= 12; m++) {
          const monthStr = `${y}-${m.toString().padStart(2, '0')}`;
          const feeData = getTotalFeeForMonth(feeHistory, [], monthStr, defaultFee, creditorId);
          expectedForYear += feeData.total;
          paidForYear += entityAllocs
            .filter((a) => a.month === monthStr)
            .reduce((sum, a) => sum + Math.abs(a.amount), 0);
        }

        accumulatedDebt = Math.max(0, accumulatedDebt + expectedForYear - paidForYear);
      }

      return accumulatedDebt;
    };

    // Revenue: income allocations for the year
    const incomeAllocations = yearAllocations.filter((a) => a.transaction.amount > 0);

    // Calculate opening balance (approximated from earliest bank snapshot of the year or Dec of previous year)
    const openingSnapshots = await prisma.bankAccountSnapshot.findMany({
      where: {
        date: {
          gte: new Date(`${year - 1}-12-01`),
          lte: new Date(`${year}-01-05`),
        },
      },
      orderBy: { date: 'desc' },
    });
    
    // Group snapshots by bank account to get the latest one for each before/at start of year
    const latestOpeningByAccount: Record<string, number> = {};
    openingSnapshots.forEach(s => {
      if (!latestOpeningByAccount[s.bankAccountId]) {
        latestOpeningByAccount[s.bankAccountId] = s.balance;
      }
    });
    const saldoInicialTransitar =
      Math.round(Object.values(latestOpeningByAccount).reduce((sum, b) => sum + b, 0) * 100) / 100;
    const saldosTransitarContas = bankAccounts
      .map((acc) => ({
        id: acc.id,
        name: acc.name,
        accountType: acc.accountType,
        balance: latestOpeningByAccount[acc.id] ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Calculate total expected revenue and breakdown
    let totalBaseFeeExpected = 0;
    let totalExtraChargesExpected = 0;
    const extraChargeBreakdown: Record<string, { description: string; amount: number }> = {};

    for (const unit of units) {
      const unitExtraCharges = allExtraCharges.filter(
        (e) => e.unitId === null || e.unitId === unit.id
      ) as ExtraChargeRecord[];

      for (let m = 1; m <= 12; m++) {
        const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
        const feeData = getTotalFeeForMonth(
          unit.feeHistory as FeeHistoryRecord[],
          unitExtraCharges,
          monthStr,
          unit.monthlyFee,
          unit.id
        );
        totalBaseFeeExpected += feeData.baseFee;
        for (const extra of feeData.extras) {
          const key = extra.id || extra.description;
          if (!extraChargeBreakdown[key]) {
            extraChargeBreakdown[key] = { description: extra.description, amount: 0 };
          }
          extraChargeBreakdown[key].amount += extra.amount;
        }
      }
    }
    totalExtraChargesExpected = Object.values(extraChargeBreakdown).reduce((sum, e) => sum + e.amount, 0);

    // Revenue from previous years (allocations to months before current year in current year transactions)
    const currentYearIncomeTransactions = await prisma.transaction.findMany({
      where: {
        date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59`) },
        amount: { gt: 0 }
      },
      include: { monthAllocations: true }
    });

    let receitasAnosAnteriores = 0;
    for (const tx of currentYearIncomeTransactions) {
      for (const alloc of tx.monthAllocations) {
        if (alloc.month < `${year}-01` || alloc.month === 'PREV-DEBT') {
          receitasAnosAnteriores += alloc.amount;
        }
      }
    }

    // Revenue for THIS year (current year allocations in current year transactions)
    let receitasDesteExercicio = 0;
    for (const tx of currentYearIncomeTransactions) {
      for (const alloc of tx.monthAllocations) {
        if (alloc.month >= `${year}-01` && alloc.month <= `${year}-12`) {
          receitasDesteExercicio += alloc.amount;
        }
      }
    }

    // Expenses by creditor (using month allocations for the year + extra supplier invoices without linked transaction, excluding savings transfers)
    let totalReforcoPoupanca = 0;
    let actualBankOperationalExpenses = 0;

    const currentYearExpenseTransactions = await prisma.transaction.findMany({
      where: {
        date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59`) },
        amount: { lt: 0 }
      }
    });

    // Build a lookup of assigned transactions (with creditorId or category) by date+amount
    // to detect unassigned duplicates from bank extract imports
    const assignedExpenseKeys = new Set<string>();
    for (const tx of currentYearExpenseTransactions) {
      if (tx.creditorId || tx.category) {
        const dateKey = tx.date.toISOString().split('T')[0];
        assignedExpenseKeys.add(`${dateKey}|${tx.amount}`);
      }
    }

    for (const tx of currentYearExpenseTransactions) {
      if (!tx.creditorId && !tx.category) {
        const dateKey = tx.date.toISOString().split('T')[0];
        if (assignedExpenseKeys.has(`${dateKey}|${tx.amount}`)) continue;
      }
      const creditor = creditors.find((c) => c.id === tx.creditorId);
      const category = creditor?.category || tx.category || 'other';
      if (category === 'savings') {
        totalReforcoPoupanca += Math.abs(tx.amount);
      } else {
        actualBankOperationalExpenses += Math.abs(tx.amount);
      }
    }

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    const paidExpensesByCreditor: Record<string, {
      category: string;
      categoryLabel: string;
      months: { month: string; monthLabel: string; amount: number }[];
      categoryTotal: number;
    }> = {};

    const addPaidExpenseEntry = (
      key: string,
      category: string,
      categoryLabel: string,
      monthKey: string,
      monthLabel: string,
      amount: number,
      mergeByMonth: boolean
    ) => {
      if (!paidExpensesByCreditor[key]) {
        paidExpensesByCreditor[key] = { category, categoryLabel, months: [], categoryTotal: 0 };
      }
      const roundedAmt = Math.round(amount * 100) / 100;
      let monthEntry = mergeByMonth
        ? paidExpensesByCreditor[key].months.find((m) => m.month === monthKey)
        : undefined;
      if (!monthEntry) {
        monthEntry = { month: monthKey, monthLabel, amount: 0 };
        paidExpensesByCreditor[key].months.push(monthEntry);
      }
      monthEntry.amount = Math.round((monthEntry.amount + roundedAmt) * 100) / 100;
      paidExpensesByCreditor[key].categoryTotal =
        Math.round((paidExpensesByCreditor[key].categoryTotal + roundedAmt) * 100) / 100;
    };

    const formatMonthLabel = (yyyyMm: string) => {
      const [mYear, mNum] = yyyyMm.split('-');
      const mIdx = parseInt(mNum, 10) - 1;
      return mIdx >= 0 && mIdx < 12 ? `${monthNames[mIdx]} ${mYear}` : yyyyMm;
    };

    // 1. Monthly expense allocations for this year (negative transactions with creditorId)
    for (const alloc of yearAllocations) {
      if (alloc.transaction.amount >= 0 || !alloc.transaction.creditorId) continue;
      const creditor = creditors.find((c) => c.id === alloc.transaction.creditorId);
      if (!creditor) continue;
      const category = creditor.category || 'other';
      if (category === 'savings') continue;

      addPaidExpenseEntry(
        creditor.id,
        category,
        creditor.name,
        alloc.month,
        formatMonthLabel(alloc.month),
        Math.abs(alloc.amount),
        true
      );
    }

    // 2. Extra expenses from SupplierInvoices without a linked bank transaction
    //    (e.g. fixed-contract extras like "Limpeza de vidros" for Luar Limpeza, or manually settled invoices)
    for (const inv of supplierInvoices) {
      if (inv.transactionId) continue;
      const creditor = inv.creditorId ? creditors.find((c) => c.id === inv.creditorId) : undefined;
      if (!creditor?.isFixed && !inv.isPaid) continue;

      const category = creditor?.category || inv.category || 'other';
      if (category === 'savings') continue;

      const invMonth = inv.date.toISOString().substring(0, 7);
      addPaidExpenseEntry(
        creditor?.id || inv.creditorId || inv.category || 'outros',
        category,
        creditor?.name || inv.creditor?.name || inv.category || 'Outros',
        `${invMonth}-extra-${inv.id}`,
        `${inv.description} (${inv.date.toISOString().slice(0, 10)})`,
        inv.amountDue,
        false
      );
    }

    // 3. Expenses without creditorId (unassigned) that are not bank extract duplicates
    for (const tx of currentYearExpenseTransactions) {
      if (tx.creditorId) continue;
      const category = tx.category || 'other';
      if (category === 'savings') continue;

      if (!tx.category) {
        const dateKey = tx.date.toISOString().split('T')[0];
        if (assignedExpenseKeys.has(`${dateKey}|${tx.amount}`)) continue;
      }

      const txMonth = tx.date.toISOString().substring(0, 7);
      addPaidExpenseEntry(
        tx.category || 'outros',
        category,
        tx.category || 'Outros',
        txMonth,
        formatMonthLabel(txMonth),
        Math.abs(tx.amount),
        true
      );
    }

    for (const group of Object.values(paidExpensesByCreditor)) {
      group.months.sort((a, b) => a.month.localeCompare(b.month));
    }

    const paidExpenseGroups = Object.values(paidExpensesByCreditor).sort((a, b) =>
      a.categoryLabel.localeCompare(b.categoryLabel)
    );
    const totalPaidExpenses = Math.round(paidExpenseGroups.reduce((sum, g) => sum + g.categoryTotal, 0) * 100) / 100;

    // Derive Balancete expense categories directly from paidExpenseGroups so Section 1 and Section 4 match 100%
    const despesasCategories = paidExpenseGroups.map((g) => ({
      label: g.categoryLabel,
      category: g.category,
      amount: g.categoryTotal,
    }));
    const totalDespesasOperacionais = totalPaidExpenses;
    const totalDespesasGeral = totalDespesasOperacionais + totalReforcoPoupanca;

    // Calculate total expected for fixed creditors this year
    let totalFixedExpected = 0;
    const fixedCreditors = creditors.filter(c => c.isFixed);
    for (const creditor of fixedCreditors) {
      for (let m = 1; m <= 12; m++) {
        const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
        const feeData = getTotalFeeForMonth(
          creditor.feeHistory as FeeHistoryRecord[],
          [],
          monthStr,
          creditor.amountDue || 0
        );
        totalFixedExpected += feeData.total;
      }
    }

    // Bank account & cash-in-hand balances (Calculating current balance from snapshot + reinforcements)
    const accountTypeOrder: Record<string, number> = { current: 0, savings: 1, cash: 2 };
    const contasBancarias = bankAccounts
      .map((account) => {
        const snapshot = account.snapshots[0];
        let balance = snapshot?.balance ?? 0;

        // If it's a savings account, we might want to add reinforcements since the last snapshot
        // but usually snapshots are end-of-period.
        // If snapshot is from start of year, we add this year's reinforcements.
        if (account.accountType === 'savings' && snapshot && new Date(snapshot.date) < new Date(`${year}-01-10`)) {
          balance += totalReforcoPoupanca;
        }

        // Format snapshot date for display
        const snapshotDate = snapshot ? snapshot.date.toISOString().split('T')[0] : null;

        return {
          id: account.id,
          name: account.name,
          accountType: account.accountType,
          openingBalance: latestOpeningByAccount[account.id] ?? 0,
          balance,
          description: snapshot?.description ?? null,
          snapshotDate,
        };
      })
      .sort((a, b) => {
        const oa = accountTypeOrder[a.accountType] ?? 99;
        const ob = accountTypeOrder[b.accountType] ?? 99;
        if (oa !== ob) return oa - ob;
        return a.name.localeCompare(b.name, 'pt-PT');
      });
    const totalBankBalance = Math.round(contasBancarias.reduce((sum, c) => sum + c.balance, 0) * 100) / 100;

    // Net change in physical cash accounts for this year (e.g., ATM withdrawal surplus held in cash-in-hand)
    const cashAccountsDelta =
      Math.round(
        contasBancarias
          .filter((c) => c.accountType === 'cash')
          .reduce((sum, c) => sum + (c.balance - (c.openingBalance ?? 0)), 0) * 100
      ) / 100;

    // Saldo final (adds back internal savings transfer, inter-period cash timing adjustment, and cash-in-hand delta so it reconciles 100% with bank+cash balances)
    const saldoExercicio =
      Math.round(((receitasAnosAnteriores + receitasDesteExercicio) - totalDespesasGeral) * 100) / 100;
    const ajusteCaixaExercicio =
      Math.round((totalDespesasOperacionais - actualBankOperationalExpenses + cashAccountsDelta) * 100) / 100;
    const saldoFinalDisponivel =
      Math.round((saldoInicialTransitar + saldoExercicio + totalReforcoPoupanca + ajusteCaixaExercicio) * 100) / 100;

    // =========================================
    // SECTION 2: Valores em Débito por Fração
    // =========================================

    const unitDebtData = units.map((unit) => {
      const unitExtraCharges = allExtraCharges.filter(
        (e) => e.unitId === null || e.unitId === unit.id
      ) as ExtraChargeRecord[];

      // Opening balance (debt at start of year)
      const debtInfo = calculatePastYearsDebt(
        unit.id,
        unit.feeHistory as FeeHistoryRecord[],
        unit.monthlyFee,
        unitExtraCharges,
        unit.owners
      );
      const saldoInicial = debtInfo.pastYearsDebt + debtInfo.previousDebtRemaining;

      // Expected for this year
      let previsto = 0;
      for (let m = 1; m <= 12; m++) {
        const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
        const feeData = getTotalFeeForMonth(
          unit.feeHistory as FeeHistoryRecord[],
          unitExtraCharges,
          monthStr,
          unit.monthlyFee,
          unit.id
        );
        previsto += feeData.total;
      }

      // Received this year
      const recebido = incomeAllocations
        .filter((a) => a.transaction.unitId === unit.id)
        .reduce((sum, a) => sum + a.amount, 0);

      // Closing balance
      const saldo = saldoInicial + previsto - recebido;

      const currentOwner = unit.owners?.find((o) => o.endMonth === null);
      const ownerName = currentOwner?.name || unit.owners?.[0]?.name || '';

      return {
        code: unit.code,
        description: unit.description || '',
        ownerName,
        saldoAnterior2024: debtInfo.previousDebtRemaining,
        saldoAnosAnteriores: debtInfo.pastYearsDebt,
        saldoInicial: Math.max(0, saldoInicial),
        previsto,
        recebido,
        saldo: Math.max(0, saldo),
      };
    });

    const debtTotals = {
      saldoAnterior2024: unitDebtData.reduce((sum, u) => sum + u.saldoAnterior2024, 0),
      saldoAnosAnteriores: unitDebtData.reduce((sum, u) => sum + u.saldoAnosAnteriores, 0),
      saldoInicial: unitDebtData.reduce((sum, u) => sum + u.saldoInicial, 0),
      previsto: unitDebtData.reduce((sum, u) => sum + u.previsto, 0),
      recebido: unitDebtData.reduce((sum, u) => sum + u.recebido, 0),
      saldo: unitDebtData.reduce((sum, u) => sum + u.saldo, 0),
    };

    // =========================================
    // SECTION 3: Avisos e Créditos
    // =========================================

    // Credit notes are transactions with type 'transfer' or negative income adjustments
    const creditNotes = yearAllocations
      .filter((a) => a.transaction.type === 'transfer' && a.transaction.amount < 0 && a.transaction.unitId)
      .map((a) => {
        const unit = units.find((u) => u.id === a.transaction.unitId);
        const currentOwner = unit?.owners?.find((o) => o.endMonth === null);
        return {
          date: a.transaction.date.toISOString().split('T')[0],
          unitCode: unit?.code || '',
          entity: currentOwner?.name || '',
          description: a.transaction.description,
          amount: a.amount,
          settled: 0,
          balance: a.amount,
        };
      });

    // =========================================
    // SECTION 4 & 5: Supplier Invoices (Paid / Unpaid)
    // =========================================

    const paidInvoicesByCategory: Record<string, {
      category: string;
      categoryLabel: string;
      invoices: typeof supplierInvoices;
      categoryTotal: number;
      categoryTotalPaid: number;
    }> = {};

    const unpaidInvoicesByCategory: Record<string, {
      category: string;
      categoryLabel: string;
      invoices: typeof supplierInvoices;
      categoryTotal: number;
      categoryTotalPaid: number;
    }> = {};

    for (const invoice of supplierInvoices) {
      const cat = invoice.category;
      const label = invoice.creditor?.name || cat;
      const target = invoice.isPaid ? paidInvoicesByCategory : unpaidInvoicesByCategory;

      if (!target[cat]) {
        target[cat] = { category: cat, categoryLabel: label, invoices: [], categoryTotal: 0, categoryTotalPaid: 0 };
      }
      target[cat].invoices.push(invoice);
      target[cat].categoryTotal += invoice.amountDue;
      target[cat].categoryTotalPaid += invoice.amountPaid;
    }

    const paidInvoices = Object.values(paidInvoicesByCategory).sort((a, b) =>
      a.categoryLabel.localeCompare(b.categoryLabel)
    );
    const unpaidInvoices = Object.values(unpaidInvoicesByCategory).sort((a, b) =>
      a.categoryLabel.localeCompare(b.categoryLabel)
    );

    // =========================================
    // SECTION 6: Valores por Liquidar por Fração (Detailed)
    // =========================================

    const detailedDebtUnits = units
      .map((unit) => {
        const unitExtraCharges = allExtraCharges.filter(
          (e) => e.unitId === null || e.unitId === unit.id
        ) as ExtraChargeRecord[];

        const items: { description: string; amount: number }[] = [];

        // 1. Past Debts (Pre-2024 and Previous Years)
        const debtInfo = calculatePastYearsDebt(
          unit.id,
          unit.feeHistory as FeeHistoryRecord[],
          unit.monthlyFee,
          unitExtraCharges,
          unit.owners
        );

        const prevDebtPaidInYear = incomeAllocations
          .filter((a) => a.transaction.unitId === unit.id && a.month === 'PREV-DEBT')
          .reduce((sum, a) => sum + a.amount, 0);
        const remainingPrevDebt = Math.max(0, debtInfo.previousDebtRemaining - prevDebtPaidInYear);

        if (remainingPrevDebt > 0.01) {
          const prevDebtDescriptions: Record<string, string> = {
            '6D': 'Dívida Anterior a 2024 (Quotas antigas + extras: pintura do prédio e vídeo-porteiro/campainhas)',
            'RCE': 'Dívida Anterior a 2024 (Quotas antigas + extras do prédio: pintura 2018 e reparação portão)',
          };
          items.push({
            description: prevDebtDescriptions[unit.code] || 'Dívida Anterior a 2024 (Pré-Digital)',
            amount: remainingPrevDebt,
          });
        }

        if (debtInfo.pastYearsDebt > 0.01) {
          items.push({
            description: `Dívida de Anos Anteriores (2024-${year - 1})`,
            amount: debtInfo.pastYearsDebt,
          });
        }

        // 2. Current Year Debts
        // Check each month for unpaid base fees
        for (let m = 1; m <= 12; m++) {
          const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
          const feeData = getTotalFeeForMonth(
            unit.feeHistory as FeeHistoryRecord[],
            unitExtraCharges,
            monthStr,
            unit.monthlyFee,
            unit.id
          );

          // Get total paid for this month (base fee allocations)
          const monthPaid = incomeAllocations
            .filter((a) => a.transaction.unitId === unit.id && a.month === monthStr && !a.extraChargeId)
            .reduce((sum, a) => sum + a.amount, 0);

          const baseDebt = feeData.baseFee - monthPaid;
          if (baseDebt > 0.01) {
            const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
              'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            items.push({
              description: `Quota de ${monthNames[m - 1]} de ${year}`,
              amount: baseDebt,
            });
          }

          // Check each extra charge for this month
          for (const extra of feeData.extras) {
            const extraPaid = incomeAllocations
              .filter((a) => a.transaction.unitId === unit.id && a.month === monthStr && a.extraChargeId === extra.id)
              .reduce((sum, a) => sum + a.amount, 0);

            const extraDebt = extra.amount - extraPaid;
            if (extraDebt > 0.01) {
              items.push({
                description: `Quota Extra ${year} - ${extra.description}`,
                amount: extraDebt,
              });
            }
          }
        }

        const currentOwner = unit.owners?.find((o) => o.endMonth === null);

        return {
          code: unit.code,
          description: unit.description || '',
          ownerName: currentOwner?.name || unit.owners?.[0]?.name || '',
          items,
          unitTotal: items.reduce((sum, i) => sum + i.amount, 0),
        };
      })
      .filter((u) => u.unitTotal > 0.01);

    // =========================================
    // SECTION 6.1: Dívidas a Fornecedores (Fixed Expenses unpaid)
    // =========================================
    const creditorDebts = creditors
      .filter(c => c.isFixed)
      .map(creditor => {
        const items: { description: string; amount: number }[] = [];
        
        // 1. Past Years Debt
        const pastDebt = calculatePastYearsCreditorDebt(
          creditor.id,
          creditor.feeHistory as FeeHistoryRecord[],
          creditor.amountDue || 0
        );

        if (pastDebt > 0.01) {
          items.push({
            description: `Dívida de Anos Anteriores (2024-${year - 1})`,
            amount: pastDebt
          });
        }

        // 2. Current Year unpaid (elapsed months only)
        const fixedShortfallMonths = new Set<string>();
        for (let m = 1; m <= maxElapsedMonth; m++) {
          const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
          const expected = getTotalFeeForMonth(
            creditor.feeHistory as FeeHistoryRecord[],
            [],
            monthStr,
            creditor.amountDue || 0,
            creditor.id
          ).total;

          const paidResult = yearAllocations
            .filter(a => a.transaction.creditorId === creditor.id && a.month === monthStr)
            .reduce((sum, a) => sum + Math.abs(a.amount), 0);

          if (expected - paidResult > 0.01) {
            fixedShortfallMonths.add(monthStr);
            const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
              'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            items.push({
              description: `${monthNames[m - 1]} ${year}`,
              amount: expected - paidResult
            });
          }
        }

        // 3. Unpaid supplier invoices for this fixed creditor (avoid double-counting shortfall month)
        for (const inv of supplierInvoices.filter((i) => !i.isPaid && i.creditorId === creditor.id)) {
          const invMonth = inv.date.toISOString().slice(0, 7);
          const remaining = Math.max(0, inv.amountDue - inv.amountPaid);
          if (remaining > 0.01 && !fixedShortfallMonths.has(invMonth)) {
            items.push({
              description: `${inv.description} (${inv.date.toISOString().slice(0, 10)})`,
              amount: remaining,
            });
          }
        }

        return {
          code: 'FORN',
          description: creditor.category,
          ownerName: creditor.name,
          items,
          unitTotal: items.reduce((sum, i) => sum + i.amount, 0)
        };
      })
      .filter(c => c.unitTotal > 0.01);

    // Also include non-fixed creditors that have unpaid SupplierInvoices (e.g. Endesa)
    const fixedCreditorIds = new Set(creditors.filter((c) => c.isFixed).map((c) => c.id));
    for (const creditor of creditors.filter((c) => !fixedCreditorIds.has(c.id))) {
      const unpaidForCreditor = supplierInvoices.filter((i) => !i.isPaid && i.creditorId === creditor.id);
      const items = unpaidForCreditor
        .map((inv) => ({
          description: `${inv.description} (${inv.date.toISOString().slice(0, 10)})`,
          amount: Math.max(0, inv.amountDue - inv.amountPaid),
        }))
        .filter((i) => i.amount > 0.01);
      if (items.length > 0) {
        creditorDebts.push({
          code: 'FORN',
          description: creditor.category,
          ownerName: creditor.name,
          items,
          unitTotal: items.reduce((sum, i) => sum + i.amount, 0),
        });
      }
    }

    // =========================================
    // Despesas por Liquidar (Unpaid Creditor Expenses)
    // Only for fixed/contract creditors (isFixed=true AND amountDue > 0)
    // e.g. Otis Elevadores, Luar Limpeza
    // Variable expenses (Endesa, bank fees) are NOT included — they have no expected value
    // =========================================

    // Only fixed creditors with a known monthly amount
    const fixedCreditorsForUnpaid = creditors.filter(c => c.isFixed && c.amountDue && c.amountDue > 0);

    const unpaidExpenseGroups: {
      creditorName: string;
      category: string;
      expectedMonthly: number;
      isAverage: boolean;
      unpaidMonths: { month: string; monthLabel: string; expected: number; paid: number; debt: number }[];
      totalUnpaid: number;
    }[] = [];

    for (const creditor of fixedCreditorsForUnpaid) {
      // Use fee history to get the correct expected amount per month
      // (respects contract changes, e.g. Otis went from 219 to 110.68 in Dec 2025)
      const creditorFeeHistory = creditor.feeHistory as FeeHistoryRecord[];

      // Check each elapsed month for allocation shortfall
      const unpaidMonths: typeof unpaidExpenseGroups[0]['unpaidMonths'] = [];
      for (let m = 1; m <= maxElapsedMonth; m++) {
        const monthStr = `${year}-${m.toString().padStart(2, '0')}`;

        // Get expected amount from fee history, falling back to amountDue
        const feeData = getTotalFeeForMonth(
          creditorFeeHistory,
          [],
          monthStr,
          creditor.amountDue || 0,
          creditor.id
        );
        const expectedForMonth = feeData.total;

        const allocated = yearAllocations
          .filter(a => a.transaction.creditorId === creditor.id && a.month === monthStr)
          .reduce((sum, a) => sum + Math.abs(a.amount), 0);

        const debt = expectedForMonth - allocated;
        if (debt > 0.01) {
          unpaidMonths.push({
            month: monthStr,
            monthLabel: `${monthNames[m - 1]} ${year}`,
            expected: expectedForMonth,
            paid: allocated,
            debt,
          });
        }
      }

      if (unpaidMonths.length > 0) {
        // Use current month's expected as the display value
        const currentMonthStr = `${year}-${new Date().getMonth() < 12 ? (new Date().getMonth() + 1).toString().padStart(2, '0') : '12'}`;
        const currentFee = getTotalFeeForMonth(creditorFeeHistory, [], currentMonthStr, creditor.amountDue || 0, creditor.id);

        unpaidExpenseGroups.push({
          creditorName: creditor.name,
          category: creditor.category || 'other',
          expectedMonthly: currentFee.total,
          isAverage: false,
          unpaidMonths,
          totalUnpaid: unpaidMonths.reduce((sum, um) => sum + um.debt, 0),
        });
      }
    }

    // Include unpaid SupplierInvoices (both fixed-creditor extras like Limpeza de vidros and variable creditors like Endesa)
    for (const inv of supplierInvoices.filter((i) => !i.isPaid)) {
      const remaining = Math.max(0, inv.amountDue - inv.amountPaid);
      if (remaining <= 0.01) continue;
      const cname = inv.creditor?.name || inv.category;
      const invMonth = inv.date.toISOString().slice(0, 7);
      const mIdx = parseInt(invMonth.split('-')[1], 10) - 1;
      const mLabel = `${inv.description} (${inv.date.toISOString().slice(0, 10)})`;

      let group = unpaidExpenseGroups.find((g) => g.creditorName === cname);
      const alreadyHasShortfallForMonth = group?.unpaidMonths.some((um) => um.month === invMonth);
      if (alreadyHasShortfallForMonth) continue;

      if (!group) {
        group = {
          creditorName: cname,
          category: inv.category || 'other',
          expectedMonthly: remaining,
          isAverage: false,
          unpaidMonths: [],
          totalUnpaid: 0,
        };
        unpaidExpenseGroups.push(group);
      }
      group.unpaidMonths.push({
        month: invMonth,
        monthLabel: mIdx >= 0 && mIdx < 12 ? `${mLabel}` : invMonth,
        expected: inv.amountDue,
        paid: inv.amountPaid,
        debt: remaining,
      });
      group.totalUnpaid += remaining;
    }

    unpaidExpenseGroups.sort((a, b) => a.creditorName.localeCompare(b.creditorName));
    const totalUnpaidExpenses = unpaidExpenseGroups.reduce((sum, g) => sum + g.totalUnpaid, 0);

    const totalPaidInvoicesAmount = paidInvoices.reduce((sum, c) => sum + c.categoryTotalPaid, 0);
    const totalUnpaidInvoicesAmount = unpaidInvoices.reduce((sum, c) => sum + c.categoryTotal - c.categoryTotalPaid, 0);

    const detailedDebtGrandTotal = detailedDebtUnits.reduce((sum, u) => sum + u.unitTotal, 0) + creditorDebts.reduce((sum, c) => sum + c.unitTotal, 0);
    const combinedDetailedDebt = [...detailedDebtUnits, ...creditorDebts];

    // =========================================
    // SECTION 7: Orçamento de Despesas + Quotas
    // =========================================

    let budgetData = null;
    if (budget) {
      const totalAnnual = budget.lines.reduce((sum, l) => sum + l.annualAmount, 0);
      budgetData = {
        nextYear: budget.year,
        notes: budget.notes,
        lines: budget.lines.map((l) => ({
          category: l.category,
          description: l.description,
          monthlyAmount: l.monthlyAmount,
          annualAmount: l.annualAmount,
          percentage: l.percentage ?? (totalAnnual > 0 ? (l.annualAmount / totalAnnual) * 100 : 0),
        })),
        totalMonthly: budget.lines.reduce((sum, l) => sum + l.monthlyAmount, 0),
        totalAnnual,
      };
    }

    // Fee schedule for next year
    const feeSchedule = units.map((unit) => {
      const currentMonthStr = `${year}-12`;
      const nextYearMonthStr = `${year + 1}-01`;
      const currentFee = getTotalFeeForMonth(
        unit.feeHistory as FeeHistoryRecord[],
        allExtraCharges.filter((e) => e.unitId === null || e.unitId === unit.id) as ExtraChargeRecord[],
        currentMonthStr,
        unit.monthlyFee,
        unit.id
      ).total;
      const nextFee = getTotalFeeForMonth(
        unit.feeHistory as FeeHistoryRecord[],
        allExtraCharges.filter((e) => e.unitId === null || e.unitId === unit.id) as ExtraChargeRecord[],
        nextYearMonthStr,
        unit.monthlyFee,
        unit.id
      ).total;

      return {
        unitCode: unit.code,
        description: unit.description || '',
        currentFee,
        newFee: nextFee,
        variation: currentFee > 0 ? ((nextFee - currentFee) / currentFee) * 100 : 0,
      };
    });

    // =========================================
    // Build response
    // =========================================

    return NextResponse.json({
      year,
      buildingName: 'Rua Vieira da Silva, n.6 - Monte Abraão, Queluz',

      // Section 1
      balancete: {
        receitas: {
          orcamentoExercicio: totalBaseFeeExpected,
          quotasExtra: Object.values(extraChargeBreakdown),
          subTotalExercicio: totalBaseFeeExpected + totalExtraChargesExpected,
          receitasAnosAnteriores,
          receitasDesteExercicio,
          totalRecibos: receitasAnosAnteriores + receitasDesteExercicio,
          totalReceitas: receitasAnosAnteriores + receitasDesteExercicio,
        },
        despesas: {
          categories: despesasCategories,
          totalDespesasOperacionais,
          totalDespesas: totalDespesasGeral,
          totalFixedExpected,
          totalReforcoPoupanca,
        },
        saldoExercicio,
        saldoTransitar: saldoInicialTransitar,
        saldosTransitarContas,
        ajusteCaixaExercicio,
        contasBancarias,
        totalBankBalance,
        saldoFinalDisponivel,
        despesasPorLiquidar: totalUnpaidExpenses,
        quotasPorLiquidar: {
          total: debtTotals.saldo,
        },
      },

      // Section 2
      debtByUnit: {
        units: unitDebtData,
        totals: debtTotals,
      },

      // Section 3
      creditNotes,

      // Section 4: Paid expenses by creditor (monthly allocations)
      paidExpenses: paidExpenseGroups.map((g) => ({
        category: g.category,
        categoryLabel: g.categoryLabel,
        months: g.months,
        categoryTotal: g.categoryTotal,
      })),
      totalPaidExpenses,

      // Section 4 (legacy): Paid supplier invoices
      paidInvoices: paidInvoices.map((c) => ({
        category: c.category,
        categoryLabel: c.categoryLabel,
        invoices: c.invoices.map((inv) => ({
          entryNumber: inv.entryNumber || '',
          invoiceNumber: inv.invoiceNumber || '',
          date: inv.date.toISOString().split('T')[0],
          supplier: inv.creditor?.name || '',
          description: inv.description,
          amountDue: inv.amountDue,
          amountPaid: inv.amountPaid,
        })),
        categoryTotal: c.categoryTotal,
        categoryTotalPaid: c.categoryTotalPaid,
        documentCount: c.invoices.length,
      })),
      totalPaidInvoices: totalPaidInvoicesAmount,

      // Section 5: Unpaid creditor expenses (expected vs allocated)
      unpaidExpenses: unpaidExpenseGroups,
      totalUnpaidExpenses,

      // Section 5 (legacy): Unpaid supplier invoices
      unpaidInvoices: unpaidInvoices.map((c) => ({
        category: c.category,
        categoryLabel: c.categoryLabel,
        invoices: c.invoices.map((inv) => ({
          entryNumber: inv.entryNumber || '',
          invoiceNumber: inv.invoiceNumber || '',
          date: inv.date.toISOString().split('T')[0],
          supplier: inv.creditor?.name || '',
          description: inv.description,
          amountDue: inv.amountDue,
          amountPaid: inv.amountPaid,
        })),
        categoryTotal: c.categoryTotal,
        categoryTotalPaid: c.categoryTotalPaid,
        documentCount: c.invoices.length,
      })),
      totalUnpaidInvoices: totalUnpaidInvoicesAmount,

      // Section 6
      detailedDebtByUnit: {
        units: combinedDetailedDebt,
        grandTotal: detailedDebtGrandTotal,
      },

      // Section 7
      budget: budgetData,
      feeSchedule,
    });
  } catch (error) {
    console.error('Error generating annual report:', error);
    return NextResponse.json({ error: 'Failed to generate annual report' }, { status: 500 });
  }
}