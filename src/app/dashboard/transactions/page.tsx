'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TransactionList from '@/components/TransactionList';
import MonthCalendar from '@/components/MonthCalendar';
import { Transaction, Unit, Creditor, MonthPaymentStatus } from '@/lib/types';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState({ type: '', startDate: '', endDate: '' });

  // Form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    type: 'payment',
    unitId: '',
    creditorId: '',
  });
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [monthStatus, setMonthStatus] = useState<MonthPaymentStatus[]>([]);
  const [expectedAmount, setExpectedAmount] = useState(0);

  useEffect(() => {
    fetchTransactions();
    fetchUnits();
    fetchCreditors();
  }, []);

  // Fetch monthly status when unit/creditor or year changes
  useEffect(() => {
    const targetId = formData.type === 'payment' ? formData.unitId : formData.creditorId;
    if (targetId) {
      fetchMonthlyStatus(targetId, formData.type === 'payment' ? 'unitId' : 'creditorId');
    } else {
      setMonthStatus([]);
      setExpectedAmount(0);
    }
  }, [formData.unitId, formData.creditorId, formData.type, calendarYear]);

  // Auto-suggest months when amount changes
  useEffect(() => {
    if (!formData.amount || !expectedAmount || selectedMonths.length > 0) return;

    const amount = parseFloat(formData.amount);
    if (amount <= 0 || expectedAmount <= 0) return;

    const numMonths = Math.round(amount / expectedAmount);
    if (numMonths <= 0) return;

    // Find unpaid months (oldest first)
    const unpaidMonths = monthStatus
      .filter((s) => !s.isPaid)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(0, numMonths)
      .map((s) => s.month);

    if (unpaidMonths.length > 0) {
      setSelectedMonths(unpaidMonths);
    }
  }, [formData.amount, monthStatus, expectedAmount]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.type) params.set('type', filter.type);
      if (filter.startDate) params.set('startDate', filter.startDate);
      if (filter.endDate) params.set('endDate', filter.endDate);

      const res = await fetch(`/api/transactions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnits = async () => {
    try {
      const res = await fetch('/api/units');
      if (res.ok) setUnits(await res.json());
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  };

  const fetchCreditors = async () => {
    try {
      const res = await fetch('/api/creditors');
      if (res.ok) setCreditors(await res.json());
    } catch (error) {
      console.error('Error fetching creditors:', error);
    }
  };

  const fetchMonthlyStatus = async (id: string, paramName: string) => {
    try {
      const res = await fetch(`/api/monthly-status?${paramName}=${id}&year=${calendarYear}`);
      if (res.ok) {
        const data = await res.json();
        setMonthStatus(data.months);
        setExpectedAmount(data.expectedAmount);
      }
    } catch (error) {
      console.error('Error fetching monthly status:', error);
    }
  };

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTransactions();
  };

  function resetForm() {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      description: '',
      amount: '',
      type: 'payment',
      unitId: '',
      creditorId: '',
    });
    setSelectedMonths([]);
    setMonthStatus([]);
    setExpectedAmount(0);
    setCalendarYear(new Date().getFullYear());
  }

  function handleToggleMonth(month: string) {
    setSelectedMonths((prev) =>
      prev.includes(month)
        ? prev.filter((m) => m !== month)
        : [...prev, month].sort()
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const amount = parseFloat(formData.amount);
      const finalAmount = formData.type === 'expense' ? -Math.abs(amount) : Math.abs(amount);

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formData.date,
          description: formData.description,
          amount: finalAmount,
          type: formData.type,
          category: formData.type === 'payment' ? 'monthly_fee' : null,
          unitId: formData.type === 'payment' ? formData.unitId || null : null,
          creditorId: formData.type === 'expense' ? formData.creditorId || null : null,
          months: selectedMonths.length > 0 ? selectedMonths : undefined,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        resetForm();
        fetchTransactions();
      } else {
        const data = await res.json();
        alert(`Erro: ${data.error}`);
      }
    } catch (error) {
      alert('Erro ao criar transacao');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Transacoes</h1>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            + Nova Transacao
          </button>
        </div>

        <form onSubmit={handleFilter} className="card mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Tipo</label>
              <select
                value={filter.type}
                onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                className="input"
              >
                <option value="">Todos</option>
                <option value="payment">Pagamento</option>
                <option value="expense">Despesa</option>
                <option value="fee">Taxa</option>
                <option value="transfer">Transferencia</option>
              </select>
            </div>
            <div>
              <label className="label">Data Inicio</label>
              <input
                type="date"
                value={filter.startDate}
                onChange={(e) =>
                  setFilter({ ...filter, startDate: e.target.value })
                }
                className="input"
              />
            </div>
            <div>
              <label className="label">Data Fim</label>
              <input
                type="date"
                value={filter.endDate}
                onChange={(e) =>
                  setFilter({ ...filter, endDate: e.target.value })
                }
                className="input"
              />
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn-secondary w-full">
                Filtrar
              </button>
            </div>
          </div>
        </form>

        <div className="card">
          {loading ? (
            <p className="text-gray-500">A carregar...</p>
          ) : (
            <TransactionList transactions={transactions} />
          )}
        </div>

        {/* Modal Nova Transacao */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Nova Transacao</h2>
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="label">Tipo *</label>
                    <select
                      className="input"
                      value={formData.type}
                      onChange={(e) => {
                        setFormData({ ...formData, type: e.target.value, unitId: '', creditorId: '' });
                        setSelectedMonths([]);
                        setMonthStatus([]);
                      }}
                      required
                    >
                      <option value="payment">Pagamento (entrada)</option>
                      <option value="expense">Despesa (saida)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Data *</label>
                    <input
                      type="date"
                      className="input"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {formData.type === 'payment' && (
                  <div className="mb-4">
                    <label className="label">Fraccao *</label>
                    <select
                      className="input"
                      value={formData.unitId}
                      onChange={(e) => {
                        setFormData({ ...formData, unitId: e.target.value });
                        setSelectedMonths([]);
                      }}
                      required
                    >
                      <option value="">-- Selecionar fraccao --</option>
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.code} {unit.owners && unit.owners.length > 0 ? `(${unit.owners[0].name})` : ''} - {unit.monthlyFee} EUR/mes
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.type === 'expense' && (
                  <div className="mb-4">
                    <label className="label">Credor *</label>
                    <select
                      className="input"
                      value={formData.creditorId}
                      onChange={(e) => {
                        setFormData({ ...formData, creditorId: e.target.value });
                        setSelectedMonths([]);
                      }}
                      required
                    >
                      <option value="">-- Selecionar credor --</option>
                      {creditors.map((creditor) => (
                        <option key={creditor.id} value={creditor.id}>
                          {creditor.name} {creditor.amountDue ? `- ${creditor.amountDue} EUR` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="label">Valor (EUR) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="input"
                      value={formData.amount}
                      onChange={(e) => {
                        setFormData({ ...formData, amount: e.target.value });
                        setSelectedMonths([]); // Reset to trigger auto-suggest
                      }}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Descricao *</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Descricao"
                      required
                    />
                  </div>
                </div>

                {/* Month Calendar */}
                {((formData.type === 'payment' && formData.unitId) ||
                  (formData.type === 'expense' && formData.creditorId)) && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <label className="label mb-2">Meses de referencia</label>
                    <MonthCalendar
                      year={calendarYear}
                      onYearChange={setCalendarYear}
                      monthStatus={monthStatus}
                      selectedMonths={selectedMonths}
                      onToggleMonth={handleToggleMonth}
                    />
                    {selectedMonths.length > 0 && formData.amount && (
                      <div className="mt-3 p-2 bg-blue-50 rounded text-sm text-blue-700">
                        {selectedMonths.length} mes(es) selecionado(s) &mdash;{' '}
                        {(parseFloat(formData.amount) / selectedMonths.length).toFixed(2)} EUR/mes
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => { setShowModal(false); resetForm(); }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={saving}
                  >
                    {saving ? 'A guardar...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
