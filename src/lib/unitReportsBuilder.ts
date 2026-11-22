import { prisma } from '@/lib/prisma';
import { getTotalFeeForMonth, FeeHistoryRecord, ExtraChargeRecord } from '@/lib/feeHistory';
import type {
  UnitReportIncidentItem,
  UnitReportItem,
  UnitReportsPayload,
} from '@/app/dashboard/admin/budgets/types';

const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function buildUnitReportsData({
  targetYear,
  targetUnitId,
  isAdmin,
}: {
  targetYear: number;
  targetUnitId: string | null;
  isAdmin: boolean;
}): Promise<UnitReportsPayload> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthNum = now.getMonth() + 1;

  const [
    units,
    allExtraCharges,
    unitTransactions,
    creditors,
    expenseAllocations,
    supplierInvoices,
    savingsTxs,
    allIncidents,
  ] = await Promise.all([
    prisma.unit.findMany({
      where: targetUnitId ? { id: targetUnitId } : undefined,
      orderBy: { code: 'asc' },
      include: {
        owners: { orderBy: { startMonth: 'asc' } },
        feeHistory: { orderBy: { effectiveFrom: 'asc' } },
        user: { select: { email: true } },
      },
    }),
    prisma.extraCharge.findMany(),
    prisma.transaction.findMany({
      where: { unitId: targetUnitId ? targetUnitId : { not: null }, amount: { gt: 0 } },
      orderBy: { date: 'desc' },
      include: {
        monthAllocations: {
          orderBy: { month: 'asc' },
          include: { extraCharge: { select: { description: true } } },
        },
      },
    }),
    isAdmin
      ? prisma.creditor.findMany({
          include: { feeHistory: { orderBy: { effectiveFrom: 'asc' } } },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
    isAdmin
      ? prisma.transactionMonth.findMany({
          where: {
            month: { gte: `${targetYear}-01`, lte: `${targetYear}-12` },
            transaction: { amount: { lt: 0 }, creditorId: { not: null } },
          },
          include: { transaction: { select: { creditorId: true } } },
        })
      : Promise.resolve([]),
    isAdmin
      ? prisma.supplierInvoice.findMany({
          where: {
            date: {
              gte: new Date(`${targetYear}-01-01`),
              lte: new Date(`${targetYear}-12-31T23:59:59`),
            },
          },
        })
      : Promise.resolve([]),
    isAdmin
      ? prisma.transaction.findMany({
          where: {
            date: {
              gte: new Date(`${targetYear}-01-01`),
              lte: new Date(`${targetYear}-12-31T23:59:59`),
            },
            amount: { lt: 0 },
            OR: [{ category: 'savings' }, { creditor: { category: 'savings' } }],
          },
        })
      : Promise.resolve([]),
    prisma.incident.findMany({
      orderBy: [{ reportedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        code: true,
        title: true,
        location: true,
        priority: true,
        status: true,
        visibility: true,
        reportedByUnitId: true,
        reportedAt: true,
        plannedDate: true,
        resolvedAt: true,
        assignedTo: true,
      },
    }),
  ]);

  const toIncidentItem = (
    inc: (typeof allIncidents)[number]
  ): UnitReportIncidentItem => ({
    id: inc.id,
    code: inc.code,
    title: inc.title,
    location: inc.location,
    priority: inc.priority,
    status: inc.status,
    visibility: inc.visibility,
    reportedAt: inc.reportedAt.toISOString().slice(0, 10),
    plannedDate: inc.plannedDate ? inc.plannedDate.toISOString().slice(0, 10) : null,
    resolvedAt: inc.resolvedAt ? inc.resolvedAt.toISOString().slice(0, 10) : null,
    assignedTo: inc.assignedTo,
  });

  const gridYears: number[] = [];
  for (let y = 2024; y <= targetYear; y++) {
    gridYears.push(y);
  }

  const unitReports: UnitReportItem[] = units.map((unit) => {
    const unitExtraCharges = allExtraCharges.filter(
      (e) => e.unitId === null || e.unitId === unit.id
    ) as ExtraChargeRecord[];

    const txs = unitTransactions.filter((t) => t.unitId === unit.id);
    const allAllocations = txs.flatMap((t) =>
      t.monthAllocations.map((a) => ({
        ...a,
        txDate: t.date,
        txDescription: t.description,
        txAmount: t.amount,
      }))
    );

    const prevDebtAllocs = allAllocations.filter((a) => a.month === 'PREV-DEBT');
    const regularAllocs = allAllocations.filter((a) => a.month !== 'PREV-DEBT');

    const pre2024Initial = round2(
      Math.max(
        0,
        unit.owners.reduce((sum, o) => sum + (o.previousDebt || 0), 0) -
          (unit.previousBalance || 0)
      )
    );
    const pre2024Paid = round2(prevDebtAllocs.reduce((sum, a) => sum + a.amount, 0));
    const pre2024Remaining = round2(Math.max(0, pre2024Initial - pre2024Paid));

    const yearsGrid = gridYears.map((y) => {
      const months = Array.from({ length: 12 }, (_, idx) => {
        const m = idx + 1;
        const monthStr = `${y}-${m.toString().padStart(2, '0')}`;
        const feeData = getTotalFeeForMonth(
          unit.feeHistory as FeeHistoryRecord[],
          unitExtraCharges,
          monthStr,
          unit.monthlyFee,
          unit.id
        );
        const expected = round2(feeData.total);
        const paid = round2(
          regularAllocs.filter((a) => a.month === monthStr).reduce((sum, a) => sum + a.amount, 0)
        );
        const isElapsed = y < currentYear || (y === currentYear && m <= currentMonthNum);
        const debt = isElapsed ? round2(Math.max(0, expected - paid)) : 0;

        let status: 'paid' | 'partial' | 'unpaid' | 'future' = 'future';
        if (paid + 0.01 >= expected && expected > 0) {
          status = 'paid';
        } else if (isElapsed) {
          status = paid > 0.01 ? 'partial' : 'unpaid';
        }

        return {
          month: monthStr,
          label: MONTH_NAMES_PT[idx].slice(0, 3),
          fullLabel: `${MONTH_NAMES_PT[idx]} ${y}`,
          expected,
          paid,
          debt,
          isElapsed,
          status,
        };
      });

      const yearExpectedDue = round2(
        months.reduce((sum, item) => sum + (item.isElapsed ? item.expected : 0), 0)
      );
      const yearExpectedFull = round2(months.reduce((sum, item) => sum + item.expected, 0));
      const yearPaid = round2(months.reduce((sum, item) => sum + item.paid, 0));
      const yearDebt = round2(Math.max(0, yearExpectedDue - yearPaid));

      return {
        year: y,
        months,
        expectedDue: yearExpectedDue,
        expectedFull: yearExpectedFull,
        paid: yearPaid,
        debt: yearDebt,
      };
    });

    let pastYearsDebt = 0;
    for (const yg of yearsGrid) {
      if (yg.year < targetYear) {
        pastYearsDebt = round2(Math.max(0, pastYearsDebt + yg.expectedDue - yg.paid));
      }
    }

    const targetYearGrid = yearsGrid.find((yg) => yg.year === targetYear);
    const currentYearDebt = targetYearGrid ? targetYearGrid.debt : 0;
    const totalDebt = round2(pre2024Remaining + pastYearsDebt + currentYearDebt);

    const unpaidMonths = yearsGrid.flatMap((yg) =>
      yg.months.filter((m) => m.isElapsed && m.expected - m.paid > 0.01)
    );

    const autoNotes: string[] = [];
    if (unit.code === '6D') {
      autoNotes.push(
        'Dívida Pré-2024 (2 149,85 €): resulta do saldo acumulado até 31/12/2023 (2 872,75 €, integrando quotas em atraso de 2009–2023 e quotas extraordinárias da Pintura 2018 e Vídeo-Porteiro/Campainhas), já deduzidos 722,90 € recuperados através de advogado (Proc. 24458/15.4T8SNT).'
      );
    } else if (unit.code === 'RCE') {
      autoNotes.push(
        `Dívida Pré-2024 (${pre2024Remaining.toFixed(2)} € remanescentes): valor confirmado em assembleia a 17/05/2024 (Acta N.º 23) de ${pre2024Initial.toFixed(2)} € (quotas antigas 2008–2023 e despesas extras de Pintura 2018 e Reparação Portão; vídeo-porteiro regularizado em 2023), já abatido em ${pre2024Paid.toFixed(2)} € (${prevDebtAllocs.length} prestações de 5,00 €/mês pagas acima da quota mensal de 45,00 € desde junho de 2024).`
      );
    } else if (pre2024Remaining > 0) {
      autoNotes.push(`Dívida Pré-2024 remanescente: ${pre2024Remaining.toFixed(2)} €.`);
    }

    if (unpaidMonths.length > 0) {
      const listStr = unpaidMonths
        .map((m) =>
          m.paid > 0.01
            ? `${m.fullLabel} (em falta ${(m.expected - m.paid).toFixed(2)} €, pago ${m.paid.toFixed(2)} € de ${m.expected.toFixed(2)} €)`
            : `${m.fullLabel} (${m.expected.toFixed(2)} €)`
        )
        .join('; ');
      autoNotes.push(`Quotas vencidas por regularizar (${gridYears[0]}–${targetYear}): ${listStr}.`);
    }

    if (autoNotes.length === 0) {
      autoNotes.push('Situação contributiva totalmente regularizada até ao mês corrente, sem valores em dívida.');
    }

    const currentOwner =
      unit.owners.find((o) => !o.endMonth && Boolean(o.startMonth)) ||
      unit.owners.find((o) => !o.endMonth) ||
      unit.owners[0] ||
      null;
    const totalPaidDigital = round2(txs.reduce((sum, t) => sum + t.amount, 0));

    const userEmail =
      unit.user?.email && !unit.user.email.endsWith('.local') ? unit.user.email : null;
    const defaultEmail = currentOwner?.email || unit.email || userEmail || null;

    return {
      id: unit.id,
      code: unit.code,
      floor: unit.floor,
      description: unit.description,
      email: unit.email,
      defaultEmail,
      monthlyFee: unit.monthlyFee,
      permilagem: 62.5,
      currentOwner: currentOwner
        ? {
            id: currentOwner.id,
            name: currentOwner.name,
            email: currentOwner.email,
            telefone: currentOwner.telefone,
          }
        : null,
      owners: unit.owners,
      pre2024: {
        initial: pre2024Initial,
        paid: pre2024Paid,
        remaining: pre2024Remaining,
        payments: prevDebtAllocs.map((a) => ({
          id: a.transactionId,
          date: a.txDate.toISOString().slice(0, 10),
          description: a.txDescription,
          amount: round2(a.amount),
        })),
      },
      debtByYear: {
        pastYearsDebt,
        currentYearDebt,
        totalDebt,
      },
      totalPaidDigital,
      yearsGrid,
      payments: txs.map((t) => ({
        id: t.id,
        date: t.date.toISOString().slice(0, 10),
        description: t.description,
        amount: round2(t.amount),
        allocations: t.monthAllocations.map((a) => ({
          month: a.month,
          amount: round2(a.amount),
          extraDescription: a.extraCharge?.description || null,
        })),
      })),
      autoNotes: autoNotes.join('\n'),
      unitIncidents: allIncidents
        .filter((inc) => inc.reportedByUnitId === unit.id)
        .map(toIncidentItem),
      globalIncidents: allIncidents
        .filter(
          (inc) => inc.visibility !== 'unit_private' && inc.reportedByUnitId !== unit.id
        )
        .slice(0, 15)
        .map(toIncidentItem),
    };
  });

  const suggestedLinesMap: Record<string, { category: string; description: string; annualAmount: number }> = {};
  for (const alloc of expenseAllocations) {
    const c = creditors.find((cr) => cr.id === alloc.transaction.creditorId);
    if (!c || c.category === 'savings') continue;
    if (!suggestedLinesMap[c.id]) {
      suggestedLinesMap[c.id] = {
        category: c.category || 'other',
        description: c.name,
        annualAmount: 0,
      };
    }
    suggestedLinesMap[c.id].annualAmount = round2(
      suggestedLinesMap[c.id].annualAmount + Math.abs(alloc.amount)
    );
  }

  for (const inv of supplierInvoices) {
    if (inv.transactionId) continue;
    const c = creditors.find((cr) => cr.id === inv.creditorId);
    if (!c?.isFixed && !inv.isPaid) continue;
    if (c?.category === 'savings') continue;
    const key = c?.id || inv.creditorId;
    if (!suggestedLinesMap[key]) {
      suggestedLinesMap[key] = {
        category: c?.category || inv.category || 'other',
        description: c?.name || 'Outros Serviços',
        annualAmount: 0,
      };
    }
    suggestedLinesMap[key].annualAmount = round2(
      suggestedLinesMap[key].annualAmount + inv.amountDue
    );
  }

  const totalSavingsAnnual = round2(
    savingsTxs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
  );
  if (totalSavingsAnnual > 0) {
    suggestedLinesMap['savings'] = {
      category: 'savings',
      description: 'Fundo de Reserva / Conta Poupança (Art. 4.º DL 268/94)',
      annualAmount: totalSavingsAnnual,
    };
  }

  const suggestedBudgetLines = Object.values(suggestedLinesMap)
    .sort((a, b) => a.description.localeCompare(b.description))
    .map((item) => ({
      category: item.category,
      description: item.description,
      monthlyAmount: round2(item.annualAmount / 12),
      annualAmount: item.annualAmount,
    }));

  return {
    year: targetYear,
    buildingName: 'Rua Vieira da Silva, n.º 6 — Monte Abraão, Queluz',
    units: unitReports,
    suggestedBudgetLines,
  };
}
