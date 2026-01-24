'use client';

import { useState, useEffect } from 'react';
import MonthCalendar from './MonthCalendar';
import { Transaction, Unit, Creditor, MonthPaymentStatus, TransactionMonth } from '@/lib/types';

interface TransactionEditPanelProps {
  transaction: Transaction;
  units: Unit[];
  creditors: Creditor[];
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
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
  const [showCustom, setShowCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [prevDebtEnabled, setPrevDebtEnabled] = useState(false);
  const [prevDebtAmount, setPrevDebtAmount] = useState('');
  const [ownerRemainingPrevDebt, setOwnerRemainingPrevDebt] = useState(0);

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

      // Check if amounts are custom (not equal split)
      if (months.length > 0) {
        const equalAmount = Math.abs(transaction.amount) / transaction.monthAllocations.length;
        const isCustom = regularAllocs.some(
          (a) => Math.abs(a.amount - equalAmount) > 0.01
        ) || !!prevDebtAlloc;
        if (isCustom) {
          setShowCustom(true);
          const amounts: Record<string, string> = {};
          regularAllocs.forEach((a) => {
            amounts[a.month] = a.amount.toFixed(2);
          });
          setCustomAmounts(amounts);
        }

        setCalendarYear(parseInt(months[0].split('-')[0]));
      }
    }
  }, [transaction]);

  // Fetch owner's remaining previous debt when unit changes
  useEffect(() => {
    if (type === 'unit' && unitId) {
      fetch(`/api/units/${unitId}/debt`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data) {
            setOwnerRemainingPrevDebt(data.previousDebtRemaining || 0);
          }
        })
        .catch(() => setOwnerRemainingPrevDebt(0));
    } else {
      setOwnerRemainingPrevDebt(0);
    }
  }, [unitId, type]);

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

      // Update custom amounts
      if (!prev.includes(month) && !customAmounts[month]) {
        const equalAmount = Math.abs(transaction.amount) / (next.length || 1);
        if (!showCustom) {
          // Reset all to equal
          const amounts: Record<string, string> = {};
          next.forEach((m) => { amounts[m] = equalAmount.toFixed(2); });
          setCustomAmounts(amounts);
        } else {
          setCustomAmounts((ca) => ({ ...ca, [month]: equalAmount.toFixed(2) }));
        }
      } else if (prev.includes(month)) {
        setCustomAmounts((ca) => {
          const copy = { ...ca };
          delete copy[month];
          return copy;
        });
      }
      return next;
    });
  }

  function getAllocations(): { month: string; amount: number }[] {
    const allocs: { month: string; amount: number }[] = [];
    const txAmount = Math.abs(transaction.amount);

    if (selectedMonths.length > 0) {
      if (showCustom) {
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
                      setShowCustom(!showCustom);
                      if (!showCustom) {
                        // Initialize custom amounts with equal split
                        const perMonth = transAmount / selectedMonths.length;
                        const amounts: Record<string, string> = {};
                        selectedMonths.forEach((m) => { amounts[m] = perMonth.toFixed(2); });
                        setCustomAmounts(amounts);
                      }
                    }}
                  >
                    Personalizar
                  </button>
                </div>

                {/* Custom amount inputs */}
                {showCustom && (
                  <div className="space-y-1 p-2 bg-gray-50 rounded-lg">
                    {selectedMonths.map((month) => (
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
                    ))}
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
