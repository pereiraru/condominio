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
        where: { month: { gte: `${year}-01`, lte: `${year}-12` } },
        include: {
          transaction: {
            select: { id: true, unitId: true, creditorId: true, amount: true, date: true, description: true, type: true, category: true },
          },
          extraCharge: true,
        },
      }),
      prisma.transactionMonth.findMany({
        where: { month: { lt: `${year}-01` } },
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

          accumulatedDebt = Math.max(0, accumulatedDebt + expectedForYear - paidForYear);
        }
      }

      return { pastYearsDebt: accumulatedDebt, previousDebtRemaining };
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
    const saldoInicialTransitar = Object.values(latestOpeningByAccount).reduce((sum, b) => sum + b, 0);

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
        if (alloc.month < `${year}-01`) {
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

    // Expenses by creditor (excluding savings transfers)
    // Prefer transactions with creditorId; skip unassigned duplicates from bank extract imports
    const expensesByCreditor: Record<string, { label: string; category: string; amount: number }> = {};
    let totalReforcoPoupanca = 0;

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
        // Round date to day for matching (some imports have noon offset)
        const dateKey = tx.date.toISOString().split('T')[0];
        assignedExpenseKeys.add(`${dateKey}|${tx.amount}`);
      }
    }

    for (const tx of currentYearExpenseTransactions) {
      const creditor = creditors.find((c) => c.id === tx.creditorId);
      const category = creditor?.category || tx.category || 'other';

      // Skip unassigned transactions that have a matching assigned duplicate
      if (!tx.creditorId && !tx.category) {
        const dateKey = tx.date.toISOString().split('T')[0];
        if (assignedExpenseKeys.has(`${dateKey}|${tx.amount}`)) {
          continue; // Skip this duplicate
        }
      }

      if (category === 'savings') {
        totalReforcoPoupanca += Math.abs(tx.amount);
        continue; // Don't count as standard expense
      }

      const label = creditor?.name || tx.category || 'Outros';

      if (!expensesByCreditor[label]) {
        expensesByCreditor[label] = { label, category, amount: 0 };
      }
      expensesByCreditor[label].amount += Math.abs(tx.amount);
    }

    const despesasCategories = Object.values(expensesByCreditor).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
    const totalDespesasOperacionais = despesasCategories.reduce((sum, c) => sum + c.amount, 0);
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

    // Saldo final
    const saldoExercicio = (receitasAnosAnteriores + receitasDesteExercicio) - totalDespesasGeral;
    const saldoFinalDisponivel = saldoInicialTransitar + saldoExercicio;

    // Bank account balances (Calculating current balance from snapshot + reinforcements)
    const contasBancarias = bankAccounts.map((account) => {
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
        balance,
        description: snapshot?.description ?? null,
        snapshotDate,
      };
    });
    const totalBankBalance = contasBancarias.reduce((sum, c) => sum + c.balance, 0);

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

        if (debtInfo.previousDebtRemaining > 0.01) {
          items.push({
            description: 'Dívida Anterior a 2024 (Pré-Digital)',
            amount: debtInfo.previousDebtRemaining,
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

        // 2. Current Year unpaid
        for (let m = 1; m <= 12; m++) {
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
            const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
              'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            items.push({
              description: `${monthNames[m - 1]} ${year}`,
              amount: expected - paidResult
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

    const totalPaidInvoicesAmount = paidInvoices.reduce((sum, c) => sum + c.categoryTotalPaid, 0);
    const totalUnpaidInvoicesAmount = unpaidInvoices.reduce((sum, c) => sum + c.categoryTotal - c.categoryTotalPaid, 0);
    const totalUnpaidFixedExpenses = creditorDebts.reduce((sum, c) => sum + c.unitTotal, 0);

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
        contasBancarias,
        totalBankBalance,
        saldoFinalDisponivel,
        despesasPorLiquidar: totalUnpaidInvoicesAmount + totalUnpaidFixedExpenses,
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

      // Section 4
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

      // Section 5
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