import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import {
  getFeeForMonth,
  getTotalFeeForMonth,
  FeeHistoryRecord,
  ExtraChargeRecord,
} from '@/lib/feeHistory';
import { canViewerSeeIncident } from '@/lib/incidents';
import type {
  DashboardAnnouncement,
  DashboardBalanceHistoryPoint,
  DashboardBankAccountSummary,
  DashboardExpenseCategoryItem,
  DashboardExtraordinaryActivity,
  DashboardMyUnitSummary,
  DashboardPendingIssue,
  DashboardRegularService,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

const round2 = (value: number) => Math.round(value * 100) / 100;

const CATEGORY_LABELS: Record<string, string> = {
  elevator: 'Elevadores (Manutenção e Inspeções)',
  electricity: 'Eletricidade (Partes Comuns)',
  cleaning: 'Limpeza do Edifício',
  savings: 'Fundo de Reserva (Poupança)',
  bank_fee: 'Despesas e Solução Bancária',
  maintenance: 'Manutenção e Reparações',
  insurance: 'Seguro do Edifício',
  water: 'Água',
  other: 'Outros Encargos',
};

const SERVICE_SORT_ORDER: Record<string, number> = {
  elevator: 0,
  cleaning: 1,
  electricity: 2,
  savings: 3,
  bank_fee: 4,
};

function formatShortDatePt(date: Date): string {
  return date.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = session.user?.role === 'admin';

  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentYearPrefix = `${currentYear}-`;
    const currentMonthStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
    const rawMonthLabel = now.toLocaleDateString('pt-PT', { month: 'long' });
    const currentMonthLabel = `${rawMonthLabel.charAt(0).toUpperCase()}${rawMonthLabel.slice(1)} ${currentYear}`;

    const startOfYear = new Date(currentYear, 0, 1);
    const startOfMonth = new Date(currentYear, now.getMonth(), 1);
    const startOfLastMonth = new Date(currentYear, now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(currentYear, now.getMonth(), 0);

    const [
      latestTransaction,
      thisMonthTransactions,
      lastMonthTransactions,
      yearTransactions,
      yearExpenseAllocations,
      rawBankAccounts,
      unpaidInvoices,
      allExtraCharges,
      units,
      creditors,
      allExtraordinaryTxs,
      rawIncidents,
      latestMeeting,
    ] = await Promise.all([
      prisma.transaction.findFirst({
        orderBy: { date: 'desc' },
        where: { balance: { not: null } },
      }),
      prisma.transaction.findMany({
        where: { date: { gte: startOfMonth } },
      }),
      prisma.transaction.findMany({
        where: {
          date: {
            gte: startOfLastMonth,
            lte: endOfLastMonth,
          },
        },
      }),
      prisma.transaction.findMany({
        where: { date: { gte: startOfYear } },
        include: {
          creditor: true,
          monthAllocations: { select: { month: true, amount: true } },
        },
        orderBy: { date: 'desc' },
      }),
      prisma.transactionMonth.findMany({
        where: {
          month: { startsWith: currentYearPrefix },
          transaction: { amount: { lt: 0 } },
        },
        include: {
          transaction: {
            select: {
              id: true,
              category: true,
              creditor: { select: { category: true, name: true } },
            },
          },
        },
      }),
      prisma.bankAccount.findMany({
        orderBy: { name: 'asc' },
        include: {
          snapshots: {
            orderBy: { date: 'desc' },
            take: 24,
          },
        },
      }),
      prisma.supplierInvoice.findMany({
        where: { isPaid: false },
        include: { creditor: true },
        orderBy: { date: 'desc' },
      }),
      prisma.extraCharge.findMany(),
      prisma.unit.findMany({
        include: {
          owners: true,
          feeHistory: { orderBy: { effectiveFrom: 'asc' } },
          transactions: {
            where: { amount: { gt: 0 } },
            orderBy: { date: 'desc' },
            select: {
              id: true,
              amount: true,
              date: true,
              monthAllocations: { select: { month: true, amount: true } },
            },
          },
        },
      }),
      prisma.creditor.findMany({
        include: {
          feeHistory: { orderBy: { effectiveFrom: 'asc' } },
          supplierInvoices: {
            where: { isPaid: false },
            select: { id: true, amountDue: true, amountPaid: true },
          },
          transactions: {
            orderBy: { date: 'desc' },
            include: {
              monthAllocations: { select: { month: true, amount: true } },
            },
          },
        },
      }),
      prisma.transaction.findMany({
        where: { amount: { lt: 0 } },
        include: { creditor: true },
        orderBy: { date: 'desc' },
      }),
      prisma.incident.findMany({
        orderBy: [{ reportedAt: 'desc' }, { createdAt: 'desc' }],
        take: 20,
      }),
      prisma.condoMeeting.findFirst({
        orderBy: [{ year: 'desc' }, { meetingDate: 'desc' }],
      }),
    ]);

    // Legacy monthly stats
    const monthlyIncome = round2(
      thisMonthTransactions
        .filter((t) => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0)
    );
    const monthlyExpenses = round2(
      thisMonthTransactions
        .filter((t) => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0)
    );
    const lastMonthIncome = lastMonthTransactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    const balanceTrend =
      lastMonthIncome > 0
        ? ((monthlyIncome - lastMonthIncome) / lastMonthIncome) * 100
        : 0;

    const paidUnitsThisMonth = new Set(
      thisMonthTransactions
        .filter((t) => t.amount > 0 && t.unitId)
        .map((t) => t.unitId)
    );
    const pendingPayments = units.filter(
      (u) => !paidUnitsThisMonth.has(u.id)
    ).length;

    // 1. Bank & cash-in-hand accounts & total balance
    const accountTypeOrder: Record<string, number> = { current: 0, savings: 1, cash: 2 };
    const bankAccounts: DashboardBankAccountSummary[] = rawBankAccounts
      .map((acc) => {
        const snap = acc.snapshots[0];
        return {
          id: acc.id,
          name: acc.name,
          accountType: acc.accountType,
          balance: round2(snap?.balance ?? 0),
          lastDate: snap?.date ? snap.date.toISOString() : null,
        };
      })
      .sort((a, b) => {
        const oa = accountTypeOrder[a.accountType] ?? 99;
        const ob = accountTypeOrder[b.accountType] ?? 99;
        if (oa !== ob) return oa - ob;
        return a.name.localeCompare(b.name, 'pt-PT');
      });

    const totalBankBalance = round2(
      bankAccounts.reduce((sum, acc) => sum + acc.balance, 0)
    );

    // 1b. Historical total bank balance (up to last 12 months)
    const accountMonthMaps = rawBankAccounts.map((acc) => {
      const monthMap = new Map<string, number>();
      // acc.snapshots is ordered desc; iterate oldest -> newest so latest snapshot in month wins
      for (const snap of [...acc.snapshots].reverse()) {
        const monthKey = snap.date.toISOString().slice(0, 7);
        monthMap.set(monthKey, round2(snap.balance));
      }
      return monthMap;
    });

    const allSnapshotMonths = Array.from(
      new Set(accountMonthMaps.flatMap((m) => Array.from(m.keys())))
    ).sort();

    const runningBalances = accountMonthMaps.map(() => 0);
    const fullBalanceHistory: DashboardBalanceHistoryPoint[] = allSnapshotMonths.map((month) => {
      let total = 0;
      accountMonthMaps.forEach((m, idx) => {
        if (m.has(month)) {
          runningBalances[idx] = m.get(month)!;
        }
        total += runningBalances[idx];
      });
      return { month, total: round2(total) };
    });

    const balanceHistory = fullBalanceHistory.slice(-12);
    if (balanceHistory.length > 0) {
      balanceHistory[balanceHistory.length - 1] = {
        ...balanceHistory[balanceHistory.length - 1],
        total: totalBankBalance,
      };
    }

    // 2. Year financial summary (bank cash flow) & real imputed category breakdown
    let yearIncome = 0;
    let yearOperationalExpenses = 0;
    let yearSavingsTransfers = 0;
    const categoryTotals = new Map<string, number>();

    for (const tx of yearTransactions) {
      if (tx.amount > 0) {
        yearIncome += tx.amount;
      } else {
        const category = tx.creditor?.category || tx.category || 'other';
        const absAmount = Math.abs(tx.amount);
        if (category === 'savings') {
          yearSavingsTransfers += absAmount;
        } else {
          yearOperationalExpenses += absAmount;
        }

        // Fallback for non-ATM expenses without any monthly allocations
        if (
          tx.monthAllocations.length === 0 &&
          tx.creditor?.name !== 'Levantamentos ATM'
        ) {
          categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + absAmount);
        }
      }
    }

    // Primary source for "Para Onde Vão as Quotas?": real expenses allocated to months of currentYear
    for (const alloc of yearExpenseAllocations) {
      if (alloc.transaction.creditor?.name === 'Levantamentos ATM') continue;
      const category =
        alloc.transaction.creditor?.category || alloc.transaction.category || 'other';
      const absAmount = Math.abs(alloc.amount);
      categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + absAmount);
    }

    yearIncome = round2(yearIncome);
    yearOperationalExpenses = round2(yearOperationalExpenses);
    yearSavingsTransfers = round2(yearSavingsTransfers);
    const yearNetBalance = round2(yearIncome - yearOperationalExpenses);

    const totalRealOutflows = round2(
      Array.from(categoryTotals.values()).reduce((sum, val) => sum + val, 0)
    );
    const expenseBreakdown: DashboardExpenseCategoryItem[] = Array.from(
      categoryTotals.entries()
    )
      .map(([category, amount]) => ({
        category,
        label: CATEGORY_LABELS[category] ?? category,
        amount: round2(amount),
        percentage:
          totalRealOutflows > 0
            ? Math.round((amount / totalRealOutflows) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const pendingInvoicesTotal = round2(
      unpaidInvoices.reduce(
        (sum, inv) => sum + Math.max(0, (inv.amountDue ?? 0) - (inv.amountPaid ?? 0)),
        0
      )
    );

    // 3. Anonymous unit compliance + personal unit summary (for resident session)
    let totalExpectedYTD = 0;
    let totalPaidYTD = 0;
    let unitsUpToDateThisYear = 0;
    let unitsPendingCurrent = 0;
    let unitsOverdueThisYear = 0;
    let myUnit: DashboardMyUnitSummary | null = null;
    const sessionUnitId = session.user?.unitId ?? null;

    for (const unit of units) {
      const unitExtraCharges = allExtraCharges.filter(
        (e) => e.unitId === null || e.unitId === unit.id
      ) as ExtraChargeRecord[];

      const allAllocations = unit.transactions.flatMap((t) => t.monthAllocations);
      const regularAllocations = allAllocations.filter((a) => a.month !== 'PREV-DEBT');

      let expectedYTD = 0;
      let currentMonthExpected = 0;
      for (let m = 1; m <= currentMonth; m++) {
        const monthStr = `${currentYear}-${m.toString().padStart(2, '0')}`;
        const feeData = getTotalFeeForMonth(
          unit.feeHistory as FeeHistoryRecord[],
          unitExtraCharges,
          monthStr,
          unit.monthlyFee,
          unit.id
        );
        expectedYTD += feeData.total;
        if (m === currentMonth) {
          currentMonthExpected = feeData.total;
        }
      }

      const paidYTD = regularAllocations
        .filter((a) => a.month.startsWith(currentYearPrefix))
        .reduce((sum, a) => sum + a.amount, 0);

      const yearDebt = Math.max(0, round2(expectedYTD - paidYTD));
      totalExpectedYTD += expectedYTD;
      totalPaidYTD += paidYTD;
      if (yearDebt <= 0.01) {
        unitsUpToDateThisYear += 1;
      } else if (yearDebt <= currentMonthExpected + 0.01) {
        unitsPendingCurrent += 1;
      } else {
        unitsOverdueThisYear += 1;
      }

      if (sessionUnitId && unit.id === sessionUnitId) {
        const prevDebtAllocations = allAllocations.filter((a) => a.month === 'PREV-DEBT');
        const pre2024InitialDebt =
          unit.owners.reduce((sum, o) => sum + (o.previousDebt || 0), 0) -
          (unit.previousBalance || 0);
        const pre2024Paid = prevDebtAllocations.reduce((sum, a) => sum + a.amount, 0);
        const previousDebtRemaining = Math.max(
          0,
          round2(pre2024InitialDebt - pre2024Paid)
        );

        const minYear =
          unit.feeHistory.length > 0
            ? parseInt((unit.feeHistory[0] as FeeHistoryRecord).effectiveFrom.split('-')[0])
            : currentYear;

        const pastYears = new Set<number>();
        regularAllocations.forEach((a) => {
          const year = parseInt(a.month.split('-')[0]);
          if (year < currentYear && year >= minYear) pastYears.add(year);
        });
        unit.feeHistory.forEach((fh) => {
          const startYear = Math.max(parseInt(fh.effectiveFrom.split('-')[0]), minYear);
          const endYear = fh.effectiveTo
            ? parseInt(fh.effectiveTo.split('-')[0])
            : currentYear - 1;
          for (let y = startYear; y <= Math.min(endYear, currentYear - 1); y++) {
            pastYears.add(y);
          }
        });
        unitExtraCharges.forEach((ec) => {
          const ecStartYear = Math.max(parseInt(ec.effectiveFrom.split('-')[0]), minYear);
          const ecEndYear = ec.effectiveTo
            ? parseInt(ec.effectiveTo.split('-')[0])
            : currentYear - 1;
          for (let y = ecStartYear; y <= Math.min(ecEndYear, currentYear - 1); y++) {
            pastYears.add(y);
          }
        });

        let pastYearsDebt = 0;
        const sortedYears = Array.from(pastYears).sort((a, b) => a - b);
        for (const year of sortedYears) {
          let expectedForYear = 0;
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
          }
          const paidForYear = regularAllocations
            .filter((a) => a.month.startsWith(`${year}-`))
            .reduce((sum, a) => sum + a.amount, 0);
          pastYearsDebt = Math.max(0, pastYearsDebt + expectedForYear - paidForYear);
        }

        const totalOwed = round2(yearDebt + round2(pastYearsDebt) + previousDebtRemaining);
        const currentOwner =
          unit.owners.find((o) => !o.endMonth || o.endMonth >= currentMonthStr) ||
          unit.owners[unit.owners.length - 1] ||
          null;
        const latestUnitTx = unit.transactions[0] || null;
        const currentFee = round2(
          getFeeForMonth(
            unit.feeHistory as FeeHistoryRecord[],
            currentMonthStr,
            unit.monthlyFee
          )
        );

        myUnit = {
          id: unit.id,
          code: unit.code,
          description: unit.description,
          ownerName: currentOwner?.name ?? null,
          monthlyFee: currentFee,
          paidThisYear: round2(paidYTD),
          totalOwed,
          yearDebt,
          lastPaymentDate: latestUnitTx ? latestUnitTx.date.toISOString() : null,
          lastPaymentAmount: latestUnitTx ? round2(latestUnitTx.amount) : null,
        };
      }
    }

    const collectionRateYear =
      totalExpectedYTD > 0
        ? Math.min(100, Math.round((totalPaidYTD / totalExpectedYTD) * 1000) / 10)
        : 100;

    // 4. Announcements (top banner)
    const savingsAccount = bankAccounts.find((a) => a.accountType === 'savings');
    const savingsCreditor = creditors.find((c) => c.category === 'savings');
    const latestSavingsTx = savingsCreditor?.transactions[0];
    const monthlySavingsValue = latestSavingsTx
      ? round2(Math.abs(latestSavingsTx.amount))
      : 60;

    const formatPtNumber = (val: number) =>
      val.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const assemblyTitle =
      latestMeeting && latestMeeting.status === 'draft'
        ? `Assembleia ${latestMeeting.assemblyType} (${
            latestMeeting.meetingDate
              ? formatShortDatePt(new Date(`${latestMeeting.meetingDate}T12:00:00`))
              : latestMeeting.year
          })`
        : `Assembleia Ordinária de Condóminos (${currentYear}/${currentYear + 1})`;

    const assemblyDateLabel =
      latestMeeting && latestMeeting.status === 'draft'
        ? 'Convocatória ativa'
        : 'Convocatória em preparação';

    const announcements: DashboardAnnouncement[] = [
      {
        id: 'assembly-upcoming',
        title: assemblyTitle,
        message: `Ordem de trabalhos prevista: apresentação de contas de ${currentYear}, orçamento e eventual revisão de quotas para ${currentYear + 1}, assuntos gerais do edifício e eleição da Administração.`,
        category: 'assembly',
        dateLabel: assemblyDateLabel,
      },
      {
        id: 'savings-reserve',
        title: 'Reforço do Fundo Comum de Reserva',
        message: `Reforço mensal regular de ${formatPtNumber(monthlySavingsValue)} € para a conta Montepio Poupança${savingsAccount ? ` (saldo atual de ${formatPtNumber(savingsAccount.balance)} €)` : ''}.`,
        category: 'maintenance',
        dateLabel: 'Fundo de Reserva',
      },
      {
        id: 'transfer-reference',
        title: 'Identificação dos Pagamentos de Quotas',
        message:
          'Indique sempre o código da fração (ex.: 2E, RCD, Garagem) no descritivo das transferências bancárias para agilizar a imputação mensal.',
        category: 'notice',
        dateLabel: 'Aviso Permanente',
      },
    ];

    // 5. Extraordinary activities (non-recurring / inspections / repairs)
    const extraordinaryActivities: DashboardExtraordinaryActivity[] =
      allExtraordinaryTxs
        .filter((t) => {
          if (!t.creditor) return false;
          if (t.creditor.isFixed) return false;
          if (['bank_fee', 'savings', 'electricity'].includes(t.creditor.category)) {
            return false;
          }
          if (t.creditor.name === 'Levantamentos ATM') return false;
          return true;
        })
        .slice(0, 10)
        .map((t) => ({
          id: t.id,
          date: t.date.toISOString(),
          creditorName: t.creditor!.name,
          category: t.creditor!.category,
          description: t.description,
          amount: round2(Math.abs(t.amount)),
        }));

    // 6. Pending issues & building anomalies feed (real Incident records + technical tracking)
    const incidentLocationLabels: Record<string, string> = {
      elevator: 'Elevadores',
      garage: 'Garagem',
      lighting: 'Iluminação',
      door: 'Porta / Campainhas',
      water: 'Água / Canalizações',
      roof: 'Cobertura / Fachada',
      cleaning: 'Limpeza',
      other: 'Geral',
    };

    const viewer = {
      role: session.user?.role,
      unitId: session.user?.unitId,
      email: session.user?.email,
    };

    const incidentIssues: DashboardPendingIssue[] = rawIncidents
      .filter((inc) => canViewerSeeIncident(inc, viewer))
      .slice(0, 6)
      .map((inc) => {
        const statusMap: Record<string, DashboardPendingIssue['status']> = {
          open: 'open',
          in_progress: 'in_analysis',
          scheduled: 'scheduled',
          resolved: 'resolved',
          closed: 'resolved',
        };
        const priorityMap: Record<string, DashboardPendingIssue['priority']> = {
          urgent: 'high',
          normal: 'medium',
          low: 'low',
        };
        return {
          id: `inc-${inc.id}`,
          incidentId: inc.id,
          code: inc.code,
          title: inc.title,
          description: inc.description,
          category: incidentLocationLabels[inc.location] || 'Geral',
          status: statusMap[inc.status] || 'open',
          priority: priorityMap[inc.priority] || 'medium',
          amount: null,
          dateLabel: inc.plannedDate
            ? `Previsto: ${formatShortDatePt(inc.plannedDate)}`
            : inc.resolvedAt
              ? `Resolvido: ${formatShortDatePt(inc.resolvedAt)}`
              : formatShortDatePt(inc.reportedAt),
        };
      });

    const pendingIssues: DashboardPendingIssue[] = [
      ...incidentIssues,
      {
        id: 'issue-equipments',
        incidentId: null,
        code: null,
        title: 'Elevadores, Bomba de Água e Portão da Garagem',
        description:
          'Acompanhamento técnico contínuo dos equipamentos comuns. Utilize o botão "Reportar Anomalia" caso detete alguma avaria.',
        category: 'Equipamentos',
        status: 'monitoring',
        priority: 'low',
        amount: null,
        dateLabel: 'Acompanhamento contínuo',
      },
    ];

    const latestInspection = extraordinaryActivities.find((a) =>
      a.creditorName.toLowerCase().includes('câmara municipal')
    );
    if (latestInspection) {
      pendingIssues.push({
        id: `resolved-${latestInspection.id}`,
        title: 'Inspeção Periódica dos Elevadores — Câmara Municipal de Sintra',
        description:
          'Inspeção periódica realizada e taxa camarária regularizada junto da Câmara Municipal de Sintra.',
        category: 'Segurança',
        status: 'resolved',
        priority: 'low',
        amount: latestInspection.amount,
        dateLabel: `Resolvido em ${formatShortDatePt(new Date(latestInspection.date))}`,
      });
    }

    // 7. Regular building services
    const regularServices: DashboardRegularService[] = creditors
      .filter((c) => c.isFixed || ['electricity', 'savings', 'bank_fee'].includes(c.category))
      .map((c) => {
        let paidThisYearRaw = 0;
        let paidThisMonthRaw = 0;
        const activeMonthsInYear = new Set<string>();

        for (const t of c.transactions) {
          if (t.monthAllocations.length > 0) {
            for (const a of t.monthAllocations) {
              if (a.month === currentMonthStr) paidThisMonthRaw += a.amount;
              if (a.month.startsWith(currentYearPrefix)) {
                paidThisYearRaw += a.amount;
                activeMonthsInYear.add(a.month);
              }
            }
          } else {
            const d = new Date(t.date);
            const txMonth = `${d.getFullYear()}-${(d.getMonth() + 1)
              .toString()
              .padStart(2, '0')}`;
            if (txMonth === currentMonthStr) paidThisMonthRaw += t.amount;
            if (d.getFullYear() === currentYear) {
              paidThisYearRaw += t.amount;
              activeMonthsInYear.add(txMonth);
            }
          }
        }

        const paidThisYear = round2(Math.abs(paidThisYearRaw));
        const paidThisMonth = round2(Math.abs(paidThisMonthRaw));
        const rawPendingAmount = round2(
          c.supplierInvoices.reduce(
            (sum, inv) => sum + Math.max(0, (inv.amountDue ?? 0) - (inv.amountPaid ?? 0)),
            0
          )
        );
        const pendingAmount = isAdmin ? rawPendingAmount : 0;

        const monthlyAmount = c.isFixed
          ? round2(
              getFeeForMonth(
                c.feeHistory as FeeHistoryRecord[],
                currentMonthStr,
                c.amountDue || 0
              )
            )
          : round2(
              activeMonthsInYear.size > 0
                ? paidThisYear / activeMonthsInYear.size
                : c.amountDue ?? 0
            );

        const isFixedOverdue =
          isAdmin && c.isFixed && monthlyAmount > 0 && paidThisMonth < monthlyAmount * 0.95;

        const status: DashboardRegularService['status'] =
          pendingAmount > 0.01 || isFixedOverdue
            ? 'pending'
            : c.isFixed || c.category === 'savings'
              ? 'regularized'
              : 'variable';

        const lastTx = c.transactions[0] || null;

        return {
          id: c.id,
          name: c.name,
          category: c.category,
          isFixed: c.isFixed,
          monthlyAmount,
          paidThisYear,
          lastPaymentDate: lastTx ? lastTx.date.toISOString() : null,
          lastPaymentAmount: lastTx ? round2(Math.abs(lastTx.amount)) : null,
          status,
          pendingAmount,
        };
      })
      .sort((a, b) => {
        const orderA = SERVICE_SORT_ORDER[a.category] ?? 99;
        const orderB = SERVICE_SORT_ORDER[b.category] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name, 'pt-PT');
      });

    return NextResponse.json({
      buildingName: 'Rua Vieira da Silva, n.º 6',
      currentBalance: round2(latestTransaction?.balance ?? 0),
      balanceTrend,
      monthlyIncome,
      monthlyExpenses,
      pendingPayments: isAdmin ? pendingPayments : 0,
      currentYear,
      currentMonthLabel,
      totalBankBalance,
      bankAccounts,
      balanceHistory,
      yearSummary: {
        yearIncome,
        yearOperationalExpenses,
        yearSavingsTransfers,
        yearNetBalance,
        pendingInvoicesTotal: isAdmin ? pendingInvoicesTotal : 0,
        pendingInvoicesCount: isAdmin ? unpaidInvoices.length : 0,
      },
      unitCompliance: {
        totalUnits: units.length,
        unitsUpToDateThisYear,
        unitsPendingCurrent,
        unitsOverdueThisYear,
        collectionRateYear,
      },
      announcements,
      pendingIssues,
      extraordinaryActivities,
      regularServices,
      expenseBreakdown,
      myUnit,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
