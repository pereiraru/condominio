'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface DiscrepancyItem {
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

interface CreditorDiscrepanciesPanelProps {
  creditorId?: string;
  showCreditorLink?: boolean;
  onCountsChange?: (byCreditor: Record<string, { unresolved: number; resolved: number }>) => void;
}

const TYPE_BADGE: Record<DiscrepancyItem['type'], { label: string; cls: string }> = {
  unreconciled_invoice: { label: 'Sem Reconciliação', cls: 'bg-red-100 text-red-700' },
  unpaid_invoice: { label: 'Por Pagar', cls: 'bg-amber-100 text-amber-800' },
  amount_mismatch: { label: 'Valor Diferente', cls: 'bg-orange-100 text-orange-800' },
  allocation_mismatch: { label: 'Alocação', cls: 'bg-purple-100 text-purple-800' },
};

export default function CreditorDiscrepanciesPanel({
  creditorId,
  showCreditorLink = false,
  onCountsChange,
}: CreditorDiscrepanciesPanelProps) {
  const [items, setItems] = useState<DiscrepancyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  const fetchDiscrepancies = useCallback(async () => {
    try {
      const qs = creditorId ? `?creditorId=${encodeURIComponent(creditorId)}` : '';
      const res = await fetch(`/api/creditors/discrepancies${qs}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        onCountsChange?.(data.summary?.byCreditor || {});
      }
    } catch (error) {
      console.error('Error loading discrepancies:', error);
    } finally {
      setLoading(false);
    }
  }, [creditorId, onCountsChange]);

  useEffect(() => {
    fetchDiscrepancies();
  }, [fetchDiscrepancies]);

  async function toggleResolve(item: DiscrepancyItem) {
    setUpdatingKey(item.discrepancyKey);
    try {
      const res = await fetch('/api/creditors/discrepancies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          resolved: !item.resolved,
        }),
      });
      if (res.ok) {
        await fetchDiscrepancies();
      }
    } finally {
      setUpdatingKey(null);
    }
  }

  const unresolved = items.filter((i) => !i.resolved);
  const resolved = items.filter((i) => i.resolved);

  if (loading || (unresolved.length === 0 && resolved.length === 0)) {
    return null;
  }

  return (
    <div className="mb-8 space-y-3">
      {unresolved.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-3.5 shadow-sm">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-black">
                !
              </span>
              <span className="text-sm font-bold text-amber-950">
                Verificações Pendentes ({unresolved.length})
              </span>
            </div>
            <span className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1 text-xs font-bold text-amber-900 hover:bg-amber-100/60 transition-colors">
              {expanded ? '▲ Fechar' : '▼ Expandir'}
            </span>
          </button>

          {expanded && (
            <div className="mt-4 space-y-2.5">
              {unresolved.map((item) => {
                const badge = TYPE_BADGE[item.type] || TYPE_BADGE.unreconciled_invoice;
                return (
                  <div
                    key={item.discrepancyKey}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl bg-white p-4 border border-amber-200/80 shadow-sm"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badge.cls}`}>
                          {badge.label}
                        </span>
                        {showCreditorLink && (
                          <Link
                            href={`/dashboard/creditors/${item.creditorId}`}
                            className="text-xs font-bold text-primary-600 hover:underline"
                          >
                            {item.creditorName}
                          </Link>
                        )}
                        <span className="text-sm font-bold text-gray-900">{item.title}</span>
                      </div>
                      <p className="text-xs text-gray-600">{item.description}</p>
                      <p className="text-xs text-blue-700 font-medium">
                        Solução sugerida: {item.suggestedFix}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={updatingKey === item.discrepancyKey}
                      onClick={() => toggleResolve(item)}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-800 hover:bg-green-100 transition-colors disabled:opacity-50"
                      title="Confirmar que foi verificada/corrigida"
                    >
                      <span>✓</span>
                      <span>{updatingKey === item.discrepancyKey ? 'A guardar...' : 'Confirmar corrigida'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {resolved.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => setShowResolved((v) => !v)}
            className="flex w-full items-center justify-between text-xs font-bold text-gray-500 hover:text-gray-800"
          >
            <span>Histórico de Verificações Confirmadas ({resolved.length})</span>
            <span>{showResolved ? '▲ Ocultar' : '▼ Ver histórico'}</span>
          </button>

          {showResolved && (
            <div className="mt-3 divide-y divide-gray-100 border-t border-gray-100 pt-2">
              {resolved.map((item) => (
                <div key={item.discrepancyKey} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 font-bold">✓</span>
                      {showCreditorLink && (
                        <Link href={`/dashboard/creditors/${item.creditorId}`} className="font-bold text-primary-600 hover:underline">
                          {item.creditorName}
                        </Link>
                      )}
                      <span className="font-semibold text-gray-700">{item.title}</span>
                    </div>
                    <p className="text-gray-400 mt-0.5">
                      Confirmado por <span className="font-medium text-gray-600">{item.resolvedBy || 'admin'}</span>
                      {item.resolvedAt && ` em ${new Date(item.resolvedAt).toLocaleString('pt-PT')}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={updatingKey === item.discrepancyKey}
                    onClick={() => toggleResolve(item)}
                    className="text-gray-400 hover:text-amber-700 font-semibold self-start sm:self-center"
                  >
                    Reabrir
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
