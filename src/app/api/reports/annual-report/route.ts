import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { getTotalFeeForMonth, FeeHistoryRecord, ExtraChargeRecord } from '@/lib/feeHistory';

interface VirtualInvoice {
  id?: string;
  date: string | Date;
  description: string;
  amountDue: number;
  amountPaid: number;
  supplier: string;
  invoiceNumber: string;
  entryNumber: string;
  creditor?: { name: string; category: string };
}

interface ReportCategoryGroup {
  category: string;
  categoryLabel: string;
  invoices: VirtualInvoice[];
  categoryTotal: number;
  categoryTotalPaid: number;
  documentCount: number;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const year = parseInt(
      request.nextUrl.searchParams.get('year') ?? new Date().getFullYear().toString()
    );

    const [units, creditors, allExtraCharges, yearAllocations, pastAllocations, bankAccounts, supplierInvoices] = await Promise.all([
      prisma.unit.findMany({
        include: { owners: true, feeHistory: { orderBy: { effectiveFrom: 'asc' } } },
        orderBy: { code: 'asc' },
      }),
      prisma.creditor.findMany({
        include: { feeHistory: { orderBy: { effectiveFrom: 'asc' } } },
        orderBy: { name: 'asc' },
      }),
      prisma.extraCharge.findMany(),
      prisma.transactionMonth.findMany({
        where: { month: { gte: `${year}-01`, lte: `${year}-12` } },
        include: { transaction: { select: { id: true, unitId: true, creditorId: true, amount: true, date: true, description: true, type: true, category: true } } },
      }),
      prisma.transactionMonth.findMany({
        where: { month: { lt: `${year}-01` } },
        include: { transaction: { select: { unitId: true, creditorId: true, amount: true } } },
      }),
      prisma.bankAccount.findMany({
        include: { snapshots: { where: { date: { lte: new Date(`${year}-12-31T23:59:59`) } }, orderBy: { date: 'desc' }, take: 1 } },
      }),
      prisma.supplierInvoice.findMany({
        where: { date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59`) } },
        include: { creditor: { select: { name: true, category: true } } },
        orderBy: [{ category: 'asc' }, { date: 'asc' }],
      }),
    ]);

    const calculatePastYearsDebt = (
      entityId: string,
      entityType: 'unit' | 'creditor',
      feeHistory: FeeHistoryRecord[],
      defaultFee: number,
      extraCharges: ExtraChargeRecord[]
    ): number => {
      const entityAllocs = pastAllocations.filter((a) =>
        entityType === 'unit' ? a.transaction.unitId === entityId : a.transaction.creditorId === entityId
      );
      const pastYears = new Set<number>();
      entityAllocs.forEach((a) => {
        const y = parseInt(a.month.split('-')[0]);
        if (y < year) pastYears.add(y);
      });
      feeHistory.forEach((fh) => {
        const startY = parseInt(fh.effectiveFrom.split('-')[0]);
        const endY = fh.effectiveTo ? parseInt(fh.effectiveTo.split('-')[0]) : year - 1;
        for (let y = Math.max(2024, startY); y <= Math.min(endY, year - 1); y++) pastYears.add(y);
      });
      if (pastYears.size === 0) return 0;
      let accumulatedDebt = 0;
      const sortedYears = Array.from(pastYears).sort((a, b) => a - b);
      for (const y of sortedYears) {
        let expectedForYear = 0;
        let paidForYear = 0;
        for (let m = 1; m <= 12; m++) {
          const monthStr = `${y}-${m.toString().padStart(2, '0')}`;
          const feeData = getTotalFeeForMonth(feeHistory, entityType === 'unit' ? extraCharges : [], monthStr, defaultFee, entityType === 'unit' ? entityId : undefined);
          expectedForYear += feeData.total;
          paidForYear += entityAllocs.filter((a) => a.month === monthStr).reduce((sum, a) => sum + (entityType === 'unit' ? a.amount : Math.abs(a.amount)), 0);
        }
        accumulatedDebt = Math.max(0, accumulatedDebt + expectedForYear - paidForYear);
      }
      return accumulatedDebt;
    };

    const incomeAllocations = yearAllocations.filter((a) => a.transaction.amount > 0);
    const openingSnapshots = await prisma.bankAccountSnapshot.findMany({
      where: { date: { gte: new Date(`${year - 1}-12-01`), lte: new Date(`${year}-01-05`) } },
      orderBy: { date: 'desc' },
    });
    const latestOpeningByAccount: Record<string, number> = {};
    openingSnapshots.forEach(s => { if (!latestOpeningByAccount[s.bankAccountId]) latestOpeningByAccount[s.bankAccountId] = s.balance; });
    const saldoInicialTransitar = Object.values(latestOpeningByAccount).reduce((sum, b) => sum + b, 0);

    let totalBaseFeeExpected = 0;
    let totalExtraChargesExpected = 0;
    const extraChargeBreakdown: Record<string, { description: string; amount: number }> = {};

    for (const unit of units) {
      const unitExtraCharges = allExtraCharges.filter((e) => e.unitId === null || e.unitId === unit.id) as ExtraChargeRecord[];
      for (let m = 1; m <= 12; m++) {
        const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
        const feeData = getTotalFeeForMonth(unit.feeHistory as any as FeeHistoryRecord[], unitExtraCharges, monthStr, unit.monthlyFee, unit.id);
        totalBaseFeeExpected += feeData.baseFee;
        for (const extra of feeData.extras) {
          const key = extra.id || extra.description;
          if (!extraChargeBreakdown[key]) extraChargeBreakdown[key] = { description: extra.description, amount: 0 };
          extraChargeBreakdown[key].amount += extra.amount;
        }
      }
    }
    totalExtraChargesExpected = Object.values(extraChargeBreakdown).reduce((sum, e) => sum + e.amount, 0);

    const currentYearIncomeTransactions = await prisma.transaction.findMany({
      where: { date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59`) }, amount: { gt: 0 } },
      include: { monthAllocations: true }
    });

    let receitasAnosAnteriores = 0;
    let receitasDesteExercicio = 0;
    for (const tx of currentYearIncomeTransactions) {
      for (const alloc of tx.monthAllocations) {
        if (alloc.month < `${year}-01`) receitasAnosAnteriores += alloc.amount;
        else if (alloc.month <= `${year}-12`) receitasDesteExercicio += alloc.amount;
      }
    }

    const expensesByCreditor: Record<string, { label: string; category: string; amount: number }> = {};
    let totalReforcoPoupanca = 0;
    const currentYearExpenseTransactions = await prisma.transaction.findMany({
      where: { date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59`) }, amount: { lt: 0 } }
    });

    for (const tx of currentYearExpenseTransactions) {
      const creditor = creditors.find((c) => c.id === tx.creditorId);
      const category = creditor?.category || tx.category || 'other';
      if (category === 'savings') { totalReforcoPoupanca += Math.abs(tx.amount); continue; }
      const label = creditor?.name || tx.category || 'Outros';
      if (!expensesByCreditor[label]) expensesByCreditor[label] = { label, category, amount: 0 };
      expensesByCreditor[label].amount += Math.abs(tx.amount);
    }

    const despesasCategories = Object.values(expensesByCreditor).filter(c => c.amount > 0.01).sort((a, b) => a.label.localeCompare(b.label));
    const totalDespesasOperacionais = despesasCategories.reduce((sum, c) => sum + c.amount, 0);
    const totalDespesasGeral = totalDespesasOperacionais + totalReforcoPoupanca;

    const contasBancarias = bankAccounts.map((account) => {
      const snapshot = account.snapshots[0];
      let balance = snapshot?.balance ?? 0;
      if (account.accountType === 'savings' && snapshot && new Date(snapshot.date) < new Date(`${year}-01-10`)) balance += totalReforcoPoupanca;
      return { id: account.id, name: account.name, accountType: account.accountType, balance, date: snapshot?.date?.toISOString() ?? null, description: snapshot?.description ?? null };
    });
    const totalBankBalance = contasBancarias.reduce((sum, c) => sum + c.balance, 0);

    const unitDebtData = units.map((unit) => {
      const unitExtraCharges = allExtraCharges.filter((e) => e.unitId === null || e.unitId === unit.id) as ExtraChargeRecord[];
      const saldoInicial = calculatePastYearsDebt(unit.id, 'unit', unit.feeHistory as any as FeeHistoryRecord[], unit.monthlyFee, unitExtraCharges);
      let previsto = 0;
      for (let m = 1; m <= 12; m++) previsto += getTotalFeeForMonth(unit.feeHistory as any as FeeHistoryRecord[], unitExtraCharges, `${year}-${m.toString().padStart(2, '0')}`, unit.monthlyFee, unit.id).total;
      const recebido = incomeAllocations.filter((a) => a.transaction.unitId === unit.id).reduce((sum, a) => sum + a.amount, 0);
      const saldo = saldoInicial + previsto - recebido;
      const currentOwner = unit.owners?.find((o) => o.endMonth === null);
      return { code: unit.code, description: unit.description || '', ownerName: currentOwner?.name || '', saldoInicial: Math.max(0, saldoInicial), previsto, recebido, saldo: Math.max(0, saldo) };
    });

    const creditorDebts = creditors.filter(c => c.isFixed).map(creditor => {
      const items: { description: string; amount: number }[] = [];
      const pastDebt = calculatePastYearsDebt(creditor.id, 'creditor', creditor.feeHistory as any as FeeHistoryRecord[], creditor.amountDue || 0, []);
      if (pastDebt > 0.01) items.push({ description: 'Dívida de Anos Anteriores', amount: pastDebt });
      for (let m = 1; m <= 12; m++) {
        const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
        const expected = getTotalFeeForMonth(creditor.feeHistory as any as FeeHistoryRecord[], [], monthStr, creditor.amountDue || 0, creditor.id).total;
        const paidResult = yearAllocations.filter(a => a.transaction.creditorId === creditor.id && a.month === monthStr).reduce((sum, a) => sum + Math.abs(a.amount), 0);
        if (expected - paidResult > 0.01) items.push({ description: `${monthStr}`, amount: expected - paidResult });
      }
      return { code: 'FORN', description: creditor.category, ownerName: creditor.name, items, unitTotal: items.reduce((sum, i) => sum + i.amount, 0) };
    }).filter(c => c.unitTotal > 0.01);

    const paidInvoicesByCategory: Record<string, ReportCategoryGroup> = {};
    const unpaidInvoicesByCategory: Record<string, ReportCategoryGroup> = {};

    if (supplierInvoices.length > 0) {
      for (const inv of supplierInvoices) {
        const cat = inv.category;
        const target = inv.isPaid ? paidInvoicesByCategory : unpaidInvoicesByCategory;
        if (!target[cat]) target[cat] = { category: cat, categoryLabel: inv.creditor?.name || cat, invoices: [], categoryTotal: 0, categoryTotalPaid: 0, documentCount: 0 };
        target[cat].invoices.push({
          date: inv.date,
          description: inv.description,
          amountDue: inv.amountDue,
          amountPaid: inv.amountPaid,
          supplier: inv.creditor?.name || '',
          invoiceNumber: inv.invoiceNumber || '-',
          entryNumber: inv.entryNumber || '-'
        });
        target[cat].categoryTotal += inv.amountDue;
        target[cat].categoryTotalPaid += inv.amountPaid;
        target[cat].documentCount++;
      }
    } else {
      for (const tx of currentYearExpenseTransactions) {
        const creditor = creditors.find((c) => c.id === tx.creditorId);
        const category = creditor?.category || tx.category || 'other';
        if (category === 'savings') continue;
        const label = creditor?.name || tx.category || 'Outros';
        if (!paidInvoicesByCategory[category]) paidInvoicesByCategory[category] = { category, categoryLabel: label, invoices: [], categoryTotal: 0, categoryTotalPaid: 0, documentCount: 0 };
        paidInvoicesByCategory[category].invoices.push({ id: tx.id, date: tx.date, description: tx.description, amountDue: Math.abs(tx.amount), amountPaid: Math.abs(tx.amount), supplier: label, invoiceNumber: '-', entryNumber: '-' });
        paidInvoicesByCategory[category].categoryTotal += Math.abs(tx.amount);
        paidInvoicesByCategory[category].categoryTotalPaid += Math.abs(tx.amount);
        paidInvoicesByCategory[category].documentCount++;
      }
    }

    for (const cd of creditorDebts) {
      const cat = cd.description || 'other';
      if (!unpaidInvoicesByCategory[cat]) unpaidInvoicesByCategory[cat] = { category: cat, categoryLabel: cd.ownerName, invoices: [], categoryTotal: 0, categoryTotalPaid: 0, documentCount: 0 };
      for (const item of cd.items) {
        unpaidInvoicesByCategory[cat].invoices.push({ date: new Date(`${year}-12-31`), description: item.description, amountDue: item.amount, amountPaid: 0, supplier: cd.ownerName, invoiceNumber: 'PREVISTO', entryNumber: '-' });
        unpaidInvoicesByCategory[cat].categoryTotal += item.amount;
        unpaidInvoicesByCategory[cat].documentCount++;
      }
    }

    const finalPaid = Object.values(paidInvoicesByCategory).filter(c => c.categoryTotalPaid > 0.01).sort((a,b) => a.categoryLabel.localeCompare(b.categoryLabel));
    const finalUnpaid = Object.values(unpaidInvoicesByCategory).filter(c => (c.categoryTotal - c.categoryTotalPaid) > 0.01).sort((a,b) => a.categoryLabel.localeCompare(b.categoryLabel));

    const totalReceitas = unitDebtData.reduce((sum, u) => sum + u.recebido, 0) + receitasAnosAnteriores;
    const saldoExercicio = totalReceitas - totalDespesasGeral;
    const saldoFinalDisponivel = saldoInicialTransitar + saldoExercicio;

    return NextResponse.json({
      year, buildingName: 'Rua Vieira da Silva, n.6 - Monte Abraão, Queluz',
      balancete: {
        receitas: { orcamentoExercicio: totalBaseFeeExpected, quotasExtra: Object.values(extraChargeBreakdown), subTotalExercicio: totalBaseFeeExpected + totalExtraChargesExpected, receitasAnosAnteriores, receitasDesteExercicio, totalReceitas },
        despesas: { categories: despesasCategories, totalDespesasOperacionais, totalDespesas: totalDespesasGeral, totalReforcoPoupanca },
        saldoExercicio, saldoTransitar: saldoInicialTransitar, contasBancarias, totalBankBalance, saldoFinalDisponivel,
        despesasPorLiquidar: finalUnpaid.reduce((sum: number, c: any) => sum + (c.categoryTotal - c.categoryTotalPaid), 0),
        quotasPorLiquidar: { total: unitDebtData.reduce((sum, u) => sum + u.saldo, 0) }
      },
      paidInvoices: finalPaid, unpaidInvoices: finalUnpaid,
      detailedDebtByUnit: { units: [...unitDebtData.filter(u => u.saldo > 0.01).map(u => ({ ...u, items: [{ description: 'Dívida Acumulada', amount: u.saldo }], unitTotal: u.saldo })), ...creditorDebts] }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
