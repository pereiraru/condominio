import { prisma } from '@/lib/prisma';
import { getFeeForMonth, FeeHistoryRecord } from '@/lib/feeHistory';

export interface CreditorDiscrepancyItem {
  discrepancyKey: string;
  creditorId: string;
  creditorName: string;
  type: 'unreconciled_invoice' | 'unpaid_invoice' | 'amount_mismatch' | 'allocation_mismatch';
  title: string;
  description: string;
  suggestedFix: string;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  notes: string | null;
}

export async function getCreditorDiscrepancies(creditorId?: string) {
  const creditors = await prisma.creditor.findMany({
    where: creditorId ? { id: creditorId } : undefined,
    include: {
      feeHistory: true,
      transactions: {
        include: { monthAllocations: true, supplierInvoices: true },
        orderBy: { date: 'desc' },
      },
      supplierInvoices: {
        orderBy: { date: 'desc' },
      },
      discrepancyResolutions: true,
    },
    orderBy: { name: 'asc' },
  });

  const items: CreditorDiscrepancyItem[] = [];
  const byCreditor: Record<string, { unresolved: number; resolved: number }> = {};

  for (const creditor of creditors) {
    const resMap = new Map(
      creditor.discrepancyResolutions.map((r) => [r.discrepancyKey, r])
    );

    const pushItem = (
      discrepancyKey: string,
      type: CreditorDiscrepancyItem['type'],
      title: string,
      description: string,
      suggestedFix: string
    ) => {
      const existing = resMap.get(discrepancyKey);
      const resolved = existing?.resolved ?? false;
      items.push({
        discrepancyKey,
        creditorId: creditor.id,
        creditorName: creditor.name,
        type,
        title,
        description,
        suggestedFix,
        resolved,
        resolvedAt: existing?.resolvedAt ? existing.resolvedAt.toISOString() : null,
        resolvedBy: existing?.resolvedBy ?? null,
        notes: existing?.notes ?? null,
      });

      if (!byCreditor[creditor.id]) {
        byCreditor[creditor.id] = { unresolved: 0, resolved: 0 };
      }
      if (resolved) byCreditor[creditor.id].resolved++;
      else byCreditor[creditor.id].unresolved++;
    };

    // 1. Unreconciled / unpaid supplier invoices
    for (const inv of creditor.supplierInvoices) {
      const invDateStr = inv.date.toISOString().slice(0, 10);
      const hasLinkedTx = Boolean(inv.transactionId);

      // Check if any transaction matches amount within +-45 days
      const hasBankMatch =
        hasLinkedTx ||
        creditor.transactions.some((tx) => {
          const diffDays = Math.abs(tx.date.getTime() - inv.date.getTime()) / (1000 * 60 * 60 * 24);
          return diffDays <= 45 && Math.abs(Math.abs(tx.amount) - inv.amountDue) < 0.01;
        });

      if (!hasBankMatch) {
        pushItem(
          `unreconciled-invoice:${inv.id}`,
          'unreconciled_invoice',
          `Fatura sem reconciliação bancária (${inv.amountDue.toFixed(2)}€)`,
          `${inv.invoiceNumber ? `Fatura ${inv.invoiceNumber} — ` : ''}${inv.description} (${invDateStr}) não corresponde a nenhum movimento no extrato bancário.`,
          inv.isPaid
            ? 'Verificar se o pagamento foi feito noutra data/valor ou associar manualmente à transação bancária.'
            : 'Confirmar se o débito ainda está pendente no banco ou registar o pagamento quando ocorrer.'
        );
      } else if (!inv.isPaid) {
        pushItem(
          `unpaid-invoice:${inv.id}`,
          'unpaid_invoice',
          `Despesa pendente de pagamento (${inv.amountDue.toFixed(2)}€)`,
          `${inv.description} (${invDateStr}) encontra-se por pagar.`,
          'Efetuar o pagamento e marcar a fatura como paga na secção Faturas / Despesas Pendentes.'
        );
      }
    }

    // 2. Fixed creditor amount mismatches & allocation mismatches
    const feeHistory = creditor.feeHistory as FeeHistoryRecord[];

    for (const tx of creditor.transactions) {
      const txDateStr = tx.date.toISOString().slice(0, 10);
      const txMonth = txDateStr.slice(0, 7);
      const absAmt = Math.abs(tx.amount);

      // Allocation integrity check (exclude savings transfers)
      if (tx.category !== 'savings') {
        if (tx.monthAllocations.length === 0) {
          pushItem(
            `unallocated-tx:${tx.id}`,
            'allocation_mismatch',
            `Despesa sem alocação mensal (${absAmt.toFixed(2)}€)`,
            `${tx.description} (${txDateStr}) não tem meses alocados em TransactionMonth.`,
            'Abrir a transação e atribuir o mês correspondente para aparecer na grelha de despesas.'
          );
        } else {
          const allocSum = tx.monthAllocations.reduce((s, a) => s + Math.abs(a.amount), 0);
          const diff = Math.round(Math.abs(allocSum - absAmt) * 100) / 100;
          if (diff > 0.01) {
            pushItem(
              `alloc-diff:${tx.id}`,
              'allocation_mismatch',
              `Diferença na alocação mensal (${diff.toFixed(2)}€)`,
              `${tx.description} (${txDateStr}): valor do movimento é ${absAmt.toFixed(2)}€ mas soma alocada é ${allocSum.toFixed(2)}€.`,
              'Abrir a transação e ajustar o valor alocado ao mês para igualar o movimento bancário.'
            );
          }
        }
      }

      // Amount mismatch vs agreed fee for fixed creditors
      // Skip if reconciled to supplier invoice(s), multi-month, ATM, or one-off PAG.SERV./COMPRA
      if (creditor.isFixed && (creditor.amountDue != null || feeHistory.length > 0)) {
        const expected = getFeeForMonth(feeHistory, txMonth, creditor.amountDue || 0);
        const isMultiMonth = tx.monthAllocations.length > 1;
        const descUp = tx.description.toUpperCase();
        const isOneOff =
          descUp.includes('LEV.ATM') ||
          descUp.includes('PAG.SERV') ||
          descUp.includes('COMPRA ') ||
          descUp.includes('INSPEC');
        const hasLinkedInvoice = tx.supplierInvoices.length > 0;
        if (expected > 0 && !isMultiMonth && !isOneOff && !hasLinkedInvoice && Math.abs(absAmt - expected) > 0.01) {
          pushItem(
            `amount-mismatch:${tx.id}`,
            'amount_mismatch',
            `Valor diferente do acordado (${absAmt.toFixed(2)}€ vs ${expected.toFixed(2)}€)`,
            `${tx.description} (${txDateStr}) foi cobrado ${absAmt.toFixed(2)}€, diferente do valor previsto de ${expected.toFixed(2)}€.`,
            'Verificar a fatura do fornecedor; se houve atualização de preço, atualizar o Histórico de Valores.'
          );
        }
      }
    }
  }

  // Sort unresolved first, then by creditor name
  items.sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    return a.creditorName.localeCompare(b.creditorName);
  });

  const totalUnresolved = items.filter((i) => !i.resolved).length;
  const totalResolved = items.filter((i) => i.resolved).length;

  return {
    items,
    summary: {
      totalUnresolved,
      totalResolved,
      byCreditor,
    },
  };
}
