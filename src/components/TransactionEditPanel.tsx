'use client';

import { useState, useEffect, useMemo } from 'react';
import MonthCalendar from './MonthCalendar';
import { Transaction, Unit, Creditor, MonthPaymentStatus, ExtraCharge, OutstandingExtra } from '@/lib/types';

interface TransactionEditPanelProps {
  transaction: Transaction;
  units: Unit[];
  creditors: Creditor[];
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}

// Per-month allocation: base fee amount + per-extra amounts
interface MonthCategoryAmounts {
  baseFee: string;
  extras: Record<string, string>; // extraChargeId -> amount string
}

export default function TransactionEditPanel({
  transaction,
  units,
  creditors,
  onSave,
  onDelete,
  onClose,
}: TransactionEditPanelProps) {
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'unit' | 'creditor'>('unit');
  const [unitId, setUnitId] = useState('');
  const [creditorId, setCreditorId] = useState('');
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [monthStatus, setMonthStatus] = useState<MonthPaymentStatus[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [categoryAmounts, setCategoryAmounts] = useState<Record<string, MonthCategoryAmounts>>({});
  const [showCustom, setShowCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [prevDebtEnabled, setPrevDebtEnabled] = useState(false);
  const [prevDebtAmount, setPrevDebtAmount] = useState('');
  const [ownerRemainingPrevDebt, setOwnerRemainingPrevDebt] = useState(0);
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([]);
  const [outstandingExtras, setOutstandingExtras] = useState<OutstandingExtra[]>([]);

  // Build a merged list of all allocatable extras (from extra charges + outstanding)
  const allAllocatableExtras = useMemo(() => {
    const fromCharges = extraCharges.map((ec) => ({
      id: ec.id,
      description: ec.description,
      amount: ec.amount,
      effectiveFrom: ec.effectiveFrom,
      effectiveTo: ec.effectiveTo,
    }));
    const chargeIds = new Set(fromCharges.map((e) => e.id));
    const fromOutstanding = outstandingExtras
      .filter((oe) => !chargeIds.has(oe.id) && oe.remaining > 0)
      .map((oe) => ({
        id: oe.id,
        description: oe.description,
        amount: oe.monthlyAmount,
        effectiveFrom: '',
        effectiveTo: null as string | null,
      }));
    return [...fromCharges, ...fromOutstanding];
  }, [extraCharges, outstandingExtras]);

  const hasExtras = allAllocatableExtras.length > 0;

  function isMonthInChargeRange(month: string, charge: { effectiveFrom: string; effectiveTo?: string | null }): boolean {
    if (!charge.effectiveFrom) return false;
    if (month < charge.effectiveFrom) return false;
    if (charge.effectiveTo && month > charge.effectiveTo) return false;
    return true;
  }

  function buildDefaultCategoryAmounts(monthStr: string): MonthCategoryAmounts {
    const unit = units.find((u) => u.id === unitId);
    const baseFee = unit?.monthlyFee || 45;
    const extras: Record<string, string> = {};
    for (const extra of allAllocatableExtras) {
      extras[extra.id] = isMonthInChargeRange(monthStr, extra) ? extra.amount.toFixed(2) : '0';
    }
    return { baseFee: baseFee.toFixed(2), extras };
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
      const total = parseFloat(updated.baseFee || '0') +
        Object.values(updated.extras).reduce((s, v) => s + parseFloat(v || '0'), 0);
      setCustomAmounts((ca) => ({ ...ca, [monthStr]: total.toFixed(2) }));
      return { ...prev, [monthStr]: updated };
    });
  }

  // Initialize form from transaction
  useEffect(() => {
    setDate(new Date(transaction.date).toISOString().split('T')[0]);
    setDescription(transaction.description);
    setType(transaction.unitId ? 'unit' : 'creditor');
    setUnitId(transaction.unitId || '');
    setCreditorId(transaction.creditorId || '');

    // Load existing allocations
    if (transaction.monthAllocations && transaction.monthAllocations.length > 0) {
      const prevDebtAlloc = transaction.monthAllocations.find((a) => a.month === 'PREV-DEBT');
      const regularAllocs = transaction.monthAllocations.filter((a) => a.month !== 'PREV-DEBT');

      if (prevDebtAlloc) {
        setPrevDebtEnabled(true);
        setPrevDebtAmount(prevDebtAlloc.amount.toFixed(2));
      } else {
        setPrevDebtEnabled(false);
        setPrevDebtAmount('');
      }

      const months = regularAllocs.map((a) => a.month);
      setSelectedMonths(months);

      if (months.length > 0) {
        const equalAmount = Math.abs(transaction.amount) / transaction.monthAllocations.length;
        const hasExtraChargeAllocs = regularAllocs.some((a) => a.extraChargeId);
        const isCustom = regularAllocs.some(
          (a) => Math.abs(a.amount - equalAmount) > 0.01
        ) || !!prevDebtAlloc || hasExtraChargeAllocs;

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

          regularAllocs.forEach((a) => {
            amounts[a.month] = ((parseFloat(amounts[a.month] || '0')) + a.amount).toFixed(2);
          });

          setCustomAmounts(amounts);
          setCategoryAmounts(catAmounts);
        }

        setCalendarYear(parseInt(months[0].split('-')[0]));
      }
    }
  }, [transaction]);

  // Fetch extra charges and outstanding extras when unit changes
  useEffect(() => {
    if (type === 'unit' && unitId) {
      fetch(`/api/units/${unitId}/debt`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data) {
            setOwnerRemainingPrevDebt(data.previousDebtRemaining || 0);
            setOutstandingExtras(data.outstandingExtras || []);
          }
        })
        .catch(() => {
          setOwnerRemainingPrevDebt(0);
          setOutstandingExtras([]);
        });

      fetch(`/api/extra-charges?unitId=${unitId}`)
        .then((res) => res.ok ? res.json() : [])
        .then((data) => setExtraCharges(data))
        .catch(() => setExtraCharges([]));
    } else {
      setOwnerRemainingPrevDebt(0);
      setOutstandingExtras([]);
      setExtraCharges([]);
    }
  }, [unitId, type]);

  // Auto-enable custom mode and fill category amounts when extras data arrives
  useEffect(() => {
    if (!hasExtras || selectedMonths.length === 0) return;

    if (!showCustom) {
      setShowCustom(true);
    }

    const catAmounts: Record<string, MonthCategoryAmounts> = { ...categoryAmounts };
    const amounts: Record<string, string> = { ...customAmounts };
    let changed = false;

    selectedMonths.forEach((m) => {
      if (!catAmounts[m]) {
        catAmounts[m] = buildDefaultCategoryAmounts(m);
        const total = parseFloat(catAmounts[m].baseFee || '0') +
          Object.values(catAmounts[m].extras).reduce((s, v) => s + parseFloat(v || '0'), 0);
        amounts[m] = total.toFixed(2);
        changed = true;
      }
    });

    if (changed) {
      setCategoryAmounts(catAmounts);
      setCustomAmounts(amounts);
    }
  }, [hasExtras, selectedMonths.length]);

  // Fetch monthly status when entity or year changes
  useEffect(() => {
    const targetId = type === 'unit' ? unitId : creditorId;
    if (targetId) {
      fetchMonthlyStatus(targetId, type === 'unit' ? 'unitId' : 'creditorId');
    } else {
      setMonthStatus([]);
    }
  }, [unitId, creditorId, type, calendarYear]);

  async function fetchMonthlyStatus(id: string, paramName: string) {
    try {
      const res = await fetch(`/api/monthly-status?${paramName}=${id}&year=${calendarYear}`);
      if (res.ok) {
        const data = await res.json();
        setMonthStatus(data.months);
      }
    } catch (error) {
      console.error('Error fetching monthly status:', error);
    }
  }

  function handleToggleMonth(month: string) {
    setSelectedMonths((prev) => {
      const next = prev.includes(month)
        ? prev.filter((m) => m !== month)
        : [...prev, month].sort();

      if (!prev.includes(month)) {
        // Adding month
        if (hasExtras && showCustom) {
          const defaults = buildDefaultCategoryAmounts(month);
          setCategoryAmounts((ca) => ({ ...ca, [month]: defaults }));
          const total = parseFloat(defaults.baseFee || '0') +
            Object.values(defaults.extras).reduce((s, v) => s + parseFloat(v || '0'), 0);
          setCustomAmounts((ca) => ({ ...ca, [month]: total.toFixed(2) }));
        } else if (!customAmounts[month]) {
          const equalAmount = Math.abs(transaction.amount) / (next.length || 1);
          if (!showCustom) {
            const amounts: Record<string, string> = {};
            next.forEach((m) => { amounts[m] = equalAmount.toFixed(2); });
            setCustomAmounts(amounts);
          } else {
            setCustomAmounts((ca) => ({ ...ca, [month]: equalAmount.toFixed(2) }));
          }
        }
      } else {
        // Removing month
        setCustomAmounts((ca) => {
          const copy = { ...ca };
          delete copy[month];
          return copy;
        });
        setCategoryAmounts((ca) => {
          const copy = { ...ca };
          delete copy[month];
          return copy;
        });
      }
      return next;
    });
  }

  function enableCustomMode() {
    setShowCustom(true);
    if (hasExtras) {
      const catAmounts: Record<string, MonthCategoryAmounts> = {};
      const amounts: Record<string, string> = {};
      selectedMonths.forEach((m) => {
        if (categoryAmounts[m]) {
          catAmounts[m] = categoryAmounts[m];
        } else {
          catAmounts[m] = buildDefaultCategoryAmounts(m);
        }
        const total = parseFloat(catAmounts[m].baseFee || '0') +
          Object.values(catAmounts[m].extras).reduce((s, v) => s + parseFloat(v || '0'), 0);
        amounts[m] = total.toFixed(2);
      });
      setCategoryAmounts(catAmounts);
      setCustomAmounts(amounts);
    } else {
      const perMonth = Math.abs(transaction.amount) / (selectedMonths.length || 1);
      const amounts: Record<string, string> = {};
      selectedMonths.forEach((m) => { amounts[m] = perMonth.toFixed(2); });
      setCustomAmounts(amounts);
    }
  }

  function getAllocations(): { month: string; amount: number; extraChargeId?: string | null }[] {
    const allocs: { month: string; amount: number; extraChargeId?: string | null }[] = [];
    const txAmount = Math.abs(transaction.amount);

    if (selectedMonths.length > 0) {
      if (showCustom && hasExtras) {
        // Category mode: emit separate allocations per category per month
        selectedMonths.forEach((month) => {
          const cat = categoryAmounts[month];
          if (cat) {
            const baseFeeAmt = parseFloat(cat.baseFee || '0');
            if (baseFeeAmt > 0) {
              allocs.push({ month, amount: baseFeeAmt, extraChargeId: null });
            }
            for (const [ecId, amtStr] of Object.entries(cat.extras)) {
              const amt = parseFloat(amtStr || '0');
              if (amt > 0) {
                allocs.push({ month, amount: amt, extraChargeId: ecId });
              }
            }
          } else {
            allocs.push({ month, amount: parseFloat(customAmounts[month] || '0'), extraChargeId: null });
          }
        });
      } else if (showCustom) {
        selectedMonths.forEach((month) => {
          allocs.push({ month, amount: parseFloat(customAmounts[month] || '0') });
        });
      } else {
        const prevDebtAmt = prevDebtEnabled ? (parseFloat(prevDebtAmount) || 0) : 0;
        const remaining = txAmount - prevDebtAmt;
        const perMonth = selectedMonths.length > 0 ? remaining / selectedMonths.length : 0;
        selectedMonths.forEach((month) => {
          allocs.push({ month, amount: perMonth });
        });
      }
    }

    if (prevDebtEnabled && parseFloat(prevDebtAmount) > 0) {
      allocs.push({ month: 'PREV-DEBT', amount: parseFloat(prevDebtAmount) });
    }

    return allocs;
  }

  function getAllocationTotal(): number {
    const allocs = getAllocations();
    return allocs.reduce((sum, a) => sum + a.amount, 0);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        date,
        description,
        type: type === 'unit' ? 'payment' : 'expense',
        unitId: type === 'unit' ? unitId : null,
        creditorId: type === 'creditor' ? creditorId : null,
        monthAllocations: getAllocations(),
      };

      const res = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        onDelete();
      } else {
        alert('Erro ao eliminar');
      }
    } catch {
      alert('Erro ao eliminar');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const allocationTotal = getAllocationTotal();
  const transAmount = Math.abs(transaction.amount);
  const isOverAllocated = allocationTotal > transAmount + 0.01;

  return (
    <div className="w-96 shrink-0">
      <div className="card sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">Editar Transação</h3>
          <button
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
            onClick={onClose}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Amount display */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">Valor da transação</p>
          <p className={`text-xl font-bold ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {transaction.amount >= 0 ? '+' : ''}{transaction.amount.toFixed(2)} EUR
          </p>
        </div>

        {/* Date */}
        <div className="mb-3">
          <label className="label">Data</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* Description */}
        <div className="mb-3">
          <label className="label">Descrição</label>
          <input
            type="text"
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Type */}
        <div className="mb-3">
          <label className="label">Tipo</label>
          <select
            className="input"
            value={type}
            onChange={(e) => {
              setType(e.target.value as 'unit' | 'creditor');
              setUnitId('');
              setCreditorId('');
              setSelectedMonths([]);
              setCustomAmounts({});
              setCategoryAmounts({});
            }}
          >
            <option value="unit">Fração</option>
            <option value="creditor">Credor</option>
          </select>
        </div>

        {/* Unit/Creditor dropdown */}
        {type === 'unit' && (
          <div className="mb-3">
            <label className="label">Fração</label>
            <select
              className="input"
              value={unitId}
              onChange={(e) => {
                setUnitId(e.target.value);
                setSelectedMonths([]);
                setCustomAmounts({});
                setCategoryAmounts({});
              }}
            >
              <option value="">-- Selecionar --</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} {u.owners?.[0]?.name ? `(${u.owners[0].name})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {type === 'creditor' && (
          <div className="mb-3">
            <label className="label">Credor</label>
            <select
              className="input"
              value={creditorId}
              onChange={(e) => {
                setCreditorId(e.target.value);
                setSelectedMonths([]);
                setCustomAmounts({});
                setCategoryAmounts({});
              }}
            >
              <option value="">-- Selecionar --</option>
              {creditors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Outstanding extras info */}
        {type === 'unit' && unitId && outstandingExtras.some((oe) => oe.remaining > 0) && (
          <div className="mb-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
            <p className="text-xs font-semibold text-orange-700 mb-2">Extras com dívida pendente:</p>
            <div className="space-y-1 text-sm">
              {outstandingExtras.filter((oe) => oe.remaining > 0).map((oe) => (
                <div key={oe.id} className="flex justify-between">
                  <span className="text-gray-600">{oe.description}</span>
                  <span className="font-medium text-orange-600">{oe.remaining.toFixed(2)} € restante</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Month Calendar */}
        {(unitId || creditorId) && (
          <div className="mb-4">
            <label className="label mb-2">Meses de referência</label>
            <MonthCalendar
              year={calendarYear}
              onYearChange={setCalendarYear}
              monthStatus={monthStatus}
              selectedMonths={selectedMonths}
              onToggleMonth={handleToggleMonth}
            />

            {/* Previous Debt Button */}
            {ownerRemainingPrevDebt > 0 && (
              <div className="mt-3">
                <button
                  type="button"
                  className={`w-full text-sm px-3 py-2 rounded-lg font-medium transition-all ${
                    prevDebtEnabled
                      ? 'bg-orange-100 text-orange-700 border border-orange-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                  }`}
                  onClick={() => {
                    const next = !prevDebtEnabled;
                    setPrevDebtEnabled(next);
                    if (next) {
                      setPrevDebtAmount(ownerRemainingPrevDebt.toFixed(2));
                    } else {
                      setPrevDebtAmount('');
                    }
                  }}
                >
                  Dívida Anterior ({ownerRemainingPrevDebt.toFixed(2)} EUR restante)
                </button>
                {prevDebtEnabled && (
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

            {/* Allocation info */}
            {selectedMonths.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    {selectedMonths.length} mês(es) &mdash; {(transAmount / selectedMonths.length).toFixed(2)} EUR/mês
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

                {/* Custom amount inputs */}
                {showCustom && (
                  <div className="space-y-2 p-2 bg-gray-50 rounded-lg">
                    {selectedMonths.map((month) => {
                      const cat = categoryAmounts[month];
                      if (hasExtras && allAllocatableExtras.length > 0) {
                        // Category mode: show base fee + each extra
                        const currentCat = cat || { baseFee: customAmounts[month] || '0', extras: {} };
                        return (
                          <div key={month} className="space-y-1">
                            <div className="text-xs font-semibold text-gray-600 mb-1">{month}</div>
                            <div className="flex items-center gap-2 pl-2">
                              <span className="text-xs text-gray-500 w-20 truncate" title="Quota mensal">Quota</span>
                              <input
                                type="number"
                                step="0.01"
                                className="input text-sm py-1 flex-1"
                                value={currentCat.baseFee}
                                onChange={(e) => handleCategoryAmountChange(month, 'baseFee', e.target.value)}
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
                                  onChange={(e) => handleCategoryAmountChange(month, extra.id, e.target.value, true)}
                                />
                                <span className="text-xs text-gray-400">€</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      // Flat mode (no extras)
                      return (
                        <div key={month} className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-16">{month}</span>
                          <input
                            type="number"
                            step="0.01"
                            className="input text-sm py-1 flex-1"
                            value={customAmounts[month] || ''}
                            onChange={(e) => setCustomAmounts({ ...customAmounts, [month]: e.target.value })}
                          />
                          <span className="text-xs text-gray-400">EUR</span>
                        </div>
                      );
                    })}
                    <div className={`text-xs mt-1 ${isOverAllocated ? 'text-red-500' : 'text-gray-500'}`}>
                      Total: {allocationTotal.toFixed(2)} / {transAmount.toFixed(2)} EUR
                      {isOverAllocated && ' (excede o valor!)'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
          <button
            className="btn-primary flex-1"
            onClick={handleSave}
            disabled={saving || isOverAllocated}
          >
            {saving ? 'A guardar...' : 'Guardar'}
          </button>
          <button
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              confirmDelete
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'text-red-500 hover:bg-red-50'
            }`}
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? '...' : confirmDelete ? 'Confirmar' : 'Eliminar'}
          </button>
        </div>
        {confirmDelete && (
          <p className="text-xs text-red-500 mt-1 text-center">
            Clique novamente para confirmar
          </p>
        )}
      </div>
    </div>
  );
}
