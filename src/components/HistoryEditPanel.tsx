'use client';

import { useEffect, useState, useMemo } from 'react';
import MonthCalendar from '@/components/MonthCalendar';
import { Transaction, MonthPaymentStatus, MonthExpectedBreakdown, OutstandingExtra } from '@/lib/types';

interface HistoryEditPanelProps {
  unitId: string;
  month: string;
  expectedBreakdown: MonthExpectedBreakdown | null;
  ownerId?: string;
  onSave: () => void;
  onClose: () => void;
}

interface MonthExpected {
  baseFee: number;
  extras: { id: string; description: string; amount: number }[];
  total: number;
}

// Per-month allocation: base fee amount + per-extra amounts
interface MonthCategoryAmounts {
  baseFee: string;
  extras: Record<string, string>; // extraChargeId -> amount string
}

export default function HistoryEditPanel({
  unitId,
  month,
  expectedBreakdown,
  ownerId,
  onSave,
  onClose,
}: HistoryEditPanelProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [categoryAmounts, setCategoryAmounts] = useState<Record<string, MonthCategoryAmounts>>({});
  const [showCustom, setShowCustom] = useState(false);
  const [calendarYear, setCalendarYear] = useState(parseInt(month.split('-')[0]));
  const [monthStatus, setMonthStatus] = useState<MonthPaymentStatus[]>([]);
  const [saving, setSaving] = useState(false);
  const [prevDebt, setPrevDebt] = useState(false);
  const [prevDebtAmount, setPrevDebtAmount] = useState('');
  const [ownerRemainingPrevDebt, setOwnerRemainingPrevDebt] = useState(0);
  const [monthExpected, setMonthExpected] = useState<MonthExpected | null>(null);
  const [outstandingExtras, setOutstandingExtras] = useState<OutstandingExtra[]>([]);

  // Combine prop + API data: prefer API (fresh) over prop (may be stale)
  const effectiveExpected = useMemo<MonthExpected | null>(() => {
    if (monthExpected) return monthExpected;
    if (expectedBreakdown) {
      return {
        baseFee: expectedBreakdown.baseFee,
        extras: expectedBreakdown.extras,
        total: expectedBreakdown.baseFee + expectedBreakdown.extras.reduce((s, e) => s + e.amount, 0),
      };
    }
    return null;
  }, [monthExpected, expectedBreakdown]);

  const hasExtras = !!(
    (effectiveExpected && effectiveExpected.extras && effectiveExpected.extras.length > 0) ||
    outstandingExtras.length > 0
  );

  // Merge this month's expected extras with outstanding extras (those with remaining debt)
  const allAllocatableExtras = useMemo(() => {
    const expectedExtras = effectiveExpected?.extras || [];
    const expectedIds = new Set(expectedExtras.map((e) => e.id));
    const merged = [
      ...expectedExtras,
      ...outstandingExtras
        .filter((oe) => !expectedIds.has(oe.id))
        .map((oe) => ({ id: oe.id, description: oe.description, amount: 0 })),
    ];
    return merged;
  }, [effectiveExpected, outstandingExtras]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedTx) {
      fetchMonthStatus(calendarYear);
    }
  }, [calendarYear]);

  // When extras data arrives after initial load, re-initialize category amounts
  // if we're already in custom mode but don't have category data yet
  useEffect(() => {
    if (hasExtras && showCustom && selectedMonths.length > 0) {
      const needsInit = selectedMonths.some((m) => !categoryAmounts[m]);
      if (needsInit) {
        const catAmounts: Record<string, MonthCategoryAmounts> = { ...categoryAmounts };
        const amounts: Record<string, string> = { ...customAmounts };
        selectedMonths.forEach((m) => {
          if (!catAmounts[m]) {
            catAmounts[m] = buildDefaultCategoryAmountsFromExpected(m);
            const total = parseFloat(catAmounts[m].baseFee || '0') +
              Object.values(catAmounts[m].extras).reduce((s, v) => s + parseFloat(v || '0'), 0);
            amounts[m] = total.toFixed(2);
          }
        });
        setCategoryAmounts(catAmounts);
        setCustomAmounts(amounts);
      }
    }
  }, [hasExtras, showCustom, selectedMonths]);

  async function loadData() {
    // Fetch owner's remaining previous debt
    try {
      const ownerParam = ownerId ? `?ownerId=${ownerId}` : '';
      const res = await fetch(`/api/units/${unitId}/debt${ownerParam}`);
      if (res.ok) {
        const data = await res.json();
        setOwnerRemainingPrevDebt(data.previousDebtRemaining || 0);
      }
    } catch { /* ignore */ }

    // Fetch transactions allocated to this month
    try {
      const res = await fetch(`/api/units/${unitId}/month-transactions?month=${month}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions);
        if (data.expected) {
          setMonthExpected(data.expected);
        }
        if (data.outstandingExtras) {
          setOutstandingExtras(data.outstandingExtras);
        }
        if (data.transactions.length === 1) {
          selectTransaction(data.transactions[0], data.expected);
        }
      }
    } catch (error) {
      console.error('Error fetching month transactions:', error);
    }

    fetchMonthStatus(parseInt(month.split('-')[0]));
  }

  async function fetchMonthStatus(year: number) {
    try {
      const res = await fetch(`/api/monthly-status?unitId=${unitId}&year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setMonthStatus(data.months);
      }
    } catch (error) {
      console.error('Error fetching monthly status:', error);
    }
  }

  function selectTransaction(tx: Transaction, apiExpected?: MonthExpected | null) {
    setSelectedTx(tx);

    // Use the freshest extras info we have (including outstanding extras with debt)
    const extrasInfo = apiExpected || effectiveExpected;
    const extrasExist = !!(
      (extrasInfo && extrasInfo.extras && extrasInfo.extras.length > 0) ||
      outstandingExtras.length > 0
    );

    if (tx.monthAllocations && tx.monthAllocations.length > 0) {
      const prevDebtAlloc = tx.monthAllocations.find((a) => a.month === 'PREV-DEBT');
      const regularAllocs = tx.monthAllocations.filter((a) => a.month !== 'PREV-DEBT');

      if (prevDebtAlloc) {
        setPrevDebt(true);
        setPrevDebtAmount(prevDebtAlloc.amount.toFixed(2));
      } else {
        setPrevDebt(false);
        setPrevDebtAmount('');
      }

      const months = regularAllocs.map((a) => a.month);
      setSelectedMonths(months);

      if (months.length > 0) {
        const equalAmount = Math.abs(tx.amount) / tx.monthAllocations.length;
        const hasExtraChargeAllocs = regularAllocs.some((a) => a.extraChargeId);
        const isCustom = regularAllocs.some(
          (a) => Math.abs(a.amount - equalAmount) > 0.01
        ) || !!prevDebtAlloc || hasExtraChargeAllocs || extrasExist;

        if (isCustom) {
          setShowCustom(true);
          const amounts: Record<string, string> = {};
          const catAmounts: Record<string, MonthCategoryAmounts> = {};

          for (const alloc of regularAllocs) {
            if (!catAmounts[alloc.month]) {
              catAmounts[alloc.month] = { baseFee: '0', extras: {} };
            }
            if (alloc.extraChargeId) {
              catAmounts[alloc.month].extras[alloc.extraChargeId] =
                (parseFloat(catAmounts[alloc.month].extras[alloc.extraChargeId] || '0') + alloc.amount).toFixed(2);
            } else {
              catAmounts[alloc.month].baseFee =
                (parseFloat(catAmounts[alloc.month].baseFee) + alloc.amount).toFixed(2);
            }
          }

          // Build flat amounts
          regularAllocs.forEach((a) => {
            amounts[a.month] = ((parseFloat(amounts[a.month] || '0')) + a.amount).toFixed(2);
          });

          setCustomAmounts(amounts);
          setCategoryAmounts(catAmounts);
        } else {
          setShowCustom(false);
          setCustomAmounts({});
          setCategoryAmounts({});
        }
        setCalendarYear(parseInt(months[0].split('-')[0]));
      }
    } else {
      setSelectedMonths([month]);
      setCustomAmounts({});
      setCategoryAmounts({});
      setShowCustom(false);
      setPrevDebt(false);
      setPrevDebtAmount('');
    }
  }

  function buildDefaultCategoryAmountsFromExpected(monthStr: string): MonthCategoryAmounts {
    const expected = effectiveExpected;
    if (allAllocatableExtras.length === 0) {
      return { baseFee: '0', extras: {} };
    }
    const extras: Record<string, string> = {};
    const expectedIds = new Set((expected?.extras || []).map((e) => e.id));
    for (const e of allAllocatableExtras) {
      // Extras in this month's expected range get their monthly amount; outstanding-only extras default to 0
      extras[e.id] = expectedIds.has(e.id) ? e.amount.toFixed(2) : '0';
    }
    return { baseFee: (expected?.baseFee || 0).toFixed(2), extras };
  }

  function handleToggleMonth(monthStr: string) {
    if (!selectedTx) return;
    const txAmount = Math.abs(selectedTx.amount);

    setSelectedMonths((prev) => {
      const next = prev.includes(monthStr)
        ? prev.filter((m) => m !== monthStr)
        : [...prev, monthStr].sort();

      if (!prev.includes(monthStr)) {
        // Adding month
        if (hasExtras && showCustom) {
          const defaults = buildDefaultCategoryAmountsFromExpected(monthStr);
          setCategoryAmounts((ca) => ({
            ...ca,
            [monthStr]: defaults,
          }));
          const total = parseFloat(defaults.baseFee || '0') +
            Object.values(defaults.extras).reduce((s, v) => s + parseFloat(v || '0'), 0);
          setCustomAmounts((ca) => ({ ...ca, [monthStr]: total.toFixed(2) }));
        } else if (!customAmounts[monthStr]) {
          const equalAmount = txAmount / (next.length || 1);
          if (!showCustom) {
            const amounts: Record<string, string> = {};
            next.forEach((m) => { amounts[m] = equalAmount.toFixed(2); });
            setCustomAmounts(amounts);
          } else {
            setCustomAmounts((ca) => ({ ...ca, [monthStr]: equalAmount.toFixed(2) }));
          }
        }
      } else {
        // Removing month
        setCustomAmounts((ca) => {
          const copy = { ...ca };
          delete copy[monthStr];
          return copy;
        });
        setCategoryAmounts((ca) => {
          const copy = { ...ca };
          delete copy[monthStr];
          return copy;
        });
      }
      return next;
    });
  }

  function getAllocations(): { month: string; amount: number; extraChargeId?: string | null }[] {
    if (!selectedTx) return [];
    const allocs: { month: string; amount: number; extraChargeId?: string | null }[] = [];
    const txAmount = Math.abs(selectedTx.amount);

    if (selectedMonths.length > 0) {
      if (showCustom && hasExtras) {
        // Category mode: emit separate allocations per category per month
        selectedMonths.forEach((m) => {
          const cat = categoryAmounts[m];
          if (cat) {
            const baseFeeAmt = parseFloat(cat.baseFee || '0');
            if (baseFeeAmt > 0) {
              allocs.push({ month: m, amount: baseFeeAmt, extraChargeId: null });
            }
            for (const [ecId, amtStr] of Object.entries(cat.extras)) {
              const amt = parseFloat(amtStr || '0');
              if (amt > 0) {
                allocs.push({ month: m, amount: amt, extraChargeId: ecId });
              }
            }
          } else {
            // Fallback: use flat amount as base fee
            allocs.push({ month: m, amount: parseFloat(customAmounts[m] || '0'), extraChargeId: null });
          }
        });
      } else if (showCustom) {
        // Flat custom mode (no extras)
        selectedMonths.forEach((m) => {
          allocs.push({ month: m, amount: parseFloat(customAmounts[m] || '0') });
        });
      } else {
        const prevDebtAmt = prevDebt ? (parseFloat(prevDebtAmount) || 0) : 0;
        const remaining = txAmount - prevDebtAmt;
        const perMonth = selectedMonths.length > 0 ? remaining / selectedMonths.length : 0;
        selectedMonths.forEach((m) => {
          allocs.push({ month: m, amount: perMonth });
        });
      }
    }

    if (prevDebt && parseFloat(prevDebtAmount) > 0) {
      allocs.push({ month: 'PREV-DEBT', amount: parseFloat(prevDebtAmount) });
    }

    return allocs;
  }

  function getAllocationTotal(): number {
    return getAllocations().reduce((sum, a) => sum + a.amount, 0);
  }

  async function handleSave() {
    if (!selectedTx) return;
    setSaving(true);
    try {
      const allocations = getAllocations();
      const res = await fetch(`/api/transactions/${selectedTx.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthAllocations: allocations }),
      });

      if (res.ok) {
        onSave();
      } else {
        const data = await res.json();
        alert(`Erro: ${data.error}`);
      }
    } catch {
      alert('Erro ao guardar');
    } finally {
      setSaving(false);
    }
  }

  function handleCategoryAmountChange(monthStr: string, field: 'baseFee' | string, value: string, isExtra?: boolean) {
    setCategoryAmounts((prev) => {
      const current = prev[monthStr] || { baseFee: '0', extras: {} };
      let updated: MonthCategoryAmounts;
      if (isExtra) {
        updated = { ...current, extras: { ...current.extras, [field]: value } };
      } else {
        updated = { ...current, baseFee: value };
      }
      // Update flat amount too
      const total = parseFloat(updated.baseFee || '0') +
        Object.values(updated.extras).reduce((s, v) => s + parseFloat(v || '0'), 0);
      setCustomAmounts((ca) => ({ ...ca, [monthStr]: total.toFixed(2) }));
      return { ...prev, [monthStr]: updated };
    });
  }

  // When entering custom mode, pre-fill category amounts
  function enableCustomMode() {
    setShowCustom(true);
    if (hasExtras) {
      const catAmounts: Record<string, MonthCategoryAmounts> = {};
      const amounts: Record<string, string> = {};
      selectedMonths.forEach((m) => {
        if (categoryAmounts[m]) {
          catAmounts[m] = categoryAmounts[m];
        } else {
          catAmounts[m] = buildDefaultCategoryAmountsFromExpected(m);
        }
        const total = parseFloat(catAmounts[m].baseFee || '0') +
          Object.values(catAmounts[m].extras).reduce((s, v) => s + parseFloat(v || '0'), 0);
        amounts[m] = total.toFixed(2);
      });
      setCategoryAmounts(catAmounts);
      setCustomAmounts(amounts);
    } else {
      if (selectedTx) {
        const perMonth = Math.abs(selectedTx.amount) / selectedMonths.length;
        const amounts: Record<string, string> = {};
        selectedMonths.forEach((m) => { amounts[m] = perMonth.toFixed(2); });
        setCustomAmounts(amounts);
      }
    }
  }

  return (
    <div className="w-80 shrink-0">
      <div className="card sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            Editar Alocação
          </h3>
          <button
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
            onClick={onClose}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-500">Mês selecionado:</p>
          <p className="font-medium text-gray-900">{month}</p>
        </div>

        {/* Expected breakdown display */}
        {effectiveExpected && effectiveExpected.extras && effectiveExpected.extras.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xs font-semibold text-blue-700 mb-2">Esperado este mês:</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Quota mensal</span>
                <span className="font-medium">{effectiveExpected.baseFee.toFixed(2)} €</span>
              </div>
              {effectiveExpected.extras.map((e) => {
                const oe = outstandingExtras.find((o) => o.id === e.id);
                return (
                  <div key={e.id} className="flex justify-between">
                    <span className="text-gray-600">{e.description}</span>
                    <span className="font-medium">
                      +{e.amount.toFixed(2)} €
                      {oe && <span className="text-xs text-orange-600 ml-1">(restam {oe.remaining.toFixed(2)} €)</span>}
                    </span>
                  </div>
                );
              })}
              <div className="border-t border-blue-200 pt-1 flex justify-between font-semibold">
                <span className="text-gray-700">Total</span>
                <span>{effectiveExpected.total.toFixed(2)} €</span>
              </div>
            </div>
          </div>
        )}

        {/* Outstanding extras with remaining debt (not in this month's expected) */}
        {(() => {
          const expectedIds = new Set((effectiveExpected?.extras || []).map((e) => e.id));
          const extraDebt = outstandingExtras.filter((oe) => !expectedIds.has(oe.id));
          if (extraDebt.length === 0) return null;
          return (
            <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-100">
              <p className="text-xs font-semibold text-orange-700 mb-2">Extras com dívida pendente:</p>
              <div className="space-y-1 text-sm">
                {extraDebt.map((oe) => (
                  <div key={oe.id} className="flex justify-between">
                    <span className="text-gray-600">{oe.description}</span>
                    <span className="font-medium text-orange-600">{oe.remaining.toFixed(2)} € restante</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {transactions.length === 0 ? (
          <p className="text-gray-400 text-sm">Nenhum pagamento alocado a este mês.</p>
        ) : transactions.length > 1 && !selectedTx ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-500 mb-2">
              {transactions.length} transações encontradas:
            </p>
            {transactions.map((tx) => (
              <button
                key={tx.id}
                className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-primary-500 hover:bg-primary-50 transition-colors"
                onClick={() => selectTransaction(tx)}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{Math.abs(tx.amount).toFixed(2)}€</span>
                  <span className="text-sm text-gray-500">
                    {new Date(tx.date).toLocaleDateString('pt-PT')}
                  </span>
                </div>
                <p className="text-sm text-gray-600 truncate">{tx.description}</p>
              </button>
            ))}
          </div>
        ) : selectedTx ? (
          <div className="space-y-4">
            {transactions.length > 1 && (
              <button
                className="text-sm text-primary-600 hover:text-primary-700"
                onClick={() => setSelectedTx(null)}
              >
                ← Voltar à lista
              </button>
            )}

            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Valor da transação</p>
              <p className="text-lg font-bold text-green-600">
                {Math.abs(selectedTx.amount).toFixed(2)} EUR
              </p>
              <p className="text-xs text-gray-500 mt-1">{selectedTx.description}</p>
              <p className="text-xs text-gray-400">
                {new Date(selectedTx.date).toLocaleDateString('pt-PT')}
              </p>
            </div>

            <div>
              <label className="label mb-2">Meses de referência</label>
              <MonthCalendar
                year={calendarYear}
                onYearChange={setCalendarYear}
                monthStatus={monthStatus}
                selectedMonths={selectedMonths}
                onToggleMonth={handleToggleMonth}
              />

              {ownerRemainingPrevDebt > 0 && (
                <div className="mt-3">
                  <button
                    type="button"
                    className={`w-full text-sm px-3 py-2 rounded-lg font-medium transition-all ${
                      prevDebt
                        ? 'bg-orange-100 text-orange-700 border border-orange-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                    }`}
                    onClick={() => {
                      const next = !prevDebt;
                      setPrevDebt(next);
                      if (next) {
                        setPrevDebtAmount(ownerRemainingPrevDebt.toFixed(2));
                      } else {
                        setPrevDebtAmount('');
                      }
                    }}
                  >
                    Dívida Anterior ({ownerRemainingPrevDebt.toFixed(2)} EUR restante)
                  </button>
                  {prevDebt && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        className="input text-sm py-1 flex-1"
                        value={prevDebtAmount}
                        onChange={(e) => setPrevDebtAmount(e.target.value)}
                      />
                      <span className="text-xs text-gray-400">EUR</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedMonths.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    {selectedMonths.length} mês(es) &mdash; {(Math.abs(selectedTx.amount) / selectedMonths.length).toFixed(2)} EUR/mês
                  </span>
                  <button
                    type="button"
                    className={`text-xs px-2 py-1 rounded ${showCustom ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    onClick={() => {
                      if (!showCustom) {
                        enableCustomMode();
                      } else {
                        setShowCustom(false);
                      }
                    }}
                  >
                    Personalizar
                  </button>
                </div>

                {showCustom && (
                  <div className="space-y-2 p-2 bg-gray-50 rounded-lg">
                    {selectedMonths.map((m) => {
                      const cat = categoryAmounts[m];
                      if (hasExtras && allAllocatableExtras.length > 0) {
                        // Category mode: show base fee + each extra (including outstanding)
                        const currentCat = cat || { baseFee: customAmounts[m] || '0', extras: {} };
                        return (
                          <div key={m} className="space-y-1">
                            <div className="text-xs font-semibold text-gray-600 mb-1">{m}</div>
                            <div className="flex items-center gap-2 pl-2">
                              <span className="text-xs text-gray-500 w-20 truncate" title="Quota mensal">Quota</span>
                              <input
                                type="number"
                                step="0.01"
                                className="input text-sm py-1 flex-1"
                                value={currentCat.baseFee}
                                onChange={(e) => handleCategoryAmountChange(m, 'baseFee', e.target.value)}
                              />
                              <span className="text-xs text-gray-400">€</span>
                            </div>
                            {allAllocatableExtras.map((extra) => (
                              <div key={extra.id} className="flex items-center gap-2 pl-2">
                                <span className="text-xs text-gray-500 w-20 truncate" title={extra.description}>
                                  {extra.description.length > 10 ? extra.description.slice(0, 10) + '.' : extra.description}
                                </span>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="input text-sm py-1 flex-1"
                                  value={currentCat.extras[extra.id] || ''}
                                  onChange={(e) => handleCategoryAmountChange(m, extra.id, e.target.value, true)}
                                />
                                <span className="text-xs text-gray-400">€</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      // Flat mode
                      return (
                        <div key={m} className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-16">{m}</span>
                          <input
                            type="number"
                            step="0.01"
                            className="input text-sm py-1 flex-1"
                            value={customAmounts[m] || ''}
                            onChange={(e) => setCustomAmounts({ ...customAmounts, [m]: e.target.value })}
                          />
                          <span className="text-xs text-gray-400">EUR</span>
                        </div>
                      );
                    })}
                    <div className={`text-xs mt-1 ${getAllocationTotal() > Math.abs(selectedTx.amount) + 0.01 ? 'text-red-500' : 'text-gray-500'}`}>
                      Total: {getAllocationTotal().toFixed(2)} / {Math.abs(selectedTx.amount).toFixed(2)} EUR
                      {prevDebt && ` (incl. ${prevDebtAmount || '0'} dív. ant.)`}
                      {getAllocationTotal() > Math.abs(selectedTx.amount) + 0.01 && ' (excede o valor!)'}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              className="btn-primary w-full"
              onClick={handleSave}
              disabled={saving || (selectedMonths.length === 0 && !prevDebt) || getAllocationTotal() > Math.abs(selectedTx.amount) + 0.01}
            >
              {saving ? 'A guardar...' : 'Guardar'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
