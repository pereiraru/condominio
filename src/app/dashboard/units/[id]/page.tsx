'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Sidebar from '@/components/Sidebar';
import MonthCalendar from '@/components/MonthCalendar';
import TransactionEditPanel from '@/components/TransactionEditPanel';
import FeeHistoryManager from '@/components/FeeHistoryManager';
import ExtraChargesManager from '@/components/ExtraChargesManager';
import { Unit, Transaction, Creditor, MonthPaymentStatus, FeeHistory, ExtraCharge } from '@/lib/types';

export default function UnitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';
  const id = params.id as string;

  const [unit, setUnit] = useState<Unit & { transactions?: Transaction[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    floor: '',
    description: '',
    monthlyFee: '45',
    nib: '',
    telefone: '',
    email: '',
  });
  const [owners, setOwners] = useState<string[]>(['']);
  const [activeTab, setActiveTab] = useState<'dados' | 'historico'>('dados');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [creditors, setCreditors] = useState<Creditor[]>([]);

  // Calendar and summary state
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [monthStatus, setMonthStatus] = useState<MonthPaymentStatus[]>([]);
  const [pastYearsDebt, setPastYearsDebt] = useState(0);
  const [paymentHistory, setPaymentHistory] = useState<Record<string, number>>({});
  const [expectedHistory, setExpectedHistory] = useState<Record<string, number>>({});
  const [yearlyData, setYearlyData] = useState<{
    year: number;
    paid: number;
    expected: number;
    debt: number;
    accumulatedDebt: number;
  }[]>([]);

  // Fee history and extra charges state
  const [feeHistory, setFeeHistory] = useState<FeeHistory[]>([]);
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([]);

  // History edit panel state
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [historyPanelMonth, setHistoryPanelMonth] = useState('');
  const [historyPanelTransactions, setHistoryPanelTransactions] = useState<Transaction[]>([]);
  const [historyPanelSelectedTx, setHistoryPanelSelectedTx] = useState<Transaction | null>(null);
  const [historyPanelSelectedMonths, setHistoryPanelSelectedMonths] = useState<string[]>([]);
  const [historyPanelCustomAmounts, setHistoryPanelCustomAmounts] = useState<Record<string, string>>({});
  const [historyPanelShowCustom, setHistoryPanelShowCustom] = useState(false);
  const [historyPanelCalendarYear, setHistoryPanelCalendarYear] = useState(new Date().getFullYear());
  const [historyPanelMonthStatus, setHistoryPanelMonthStatus] = useState<MonthPaymentStatus[]>([]);
  const [historyPanelSaving, setHistoryPanelSaving] = useState(false);

  useEffect(() => {
    fetchUnit();
    fetchPaymentHistory();
    fetchFeeHistory();
    fetchExtraCharges();
    // Only admins need these for the edit panel
    if (isAdmin) {
      fetchAllUnits();
      fetchCreditors();
    }
  }, [id, isAdmin]);

  // Fetch monthly status when unit loads or year changes
  useEffect(() => {
    if (id) {
      fetchMonthlyStatus();
      fetchPastYearsDebt();
    }
  }, [id, calendarYear]);

  async function fetchAllUnits() {
    try {
      const res = await fetch('/api/units');
      if (res.ok) setAllUnits(await res.json());
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  }

  async function fetchCreditors() {
    try {
      const res = await fetch('/api/creditors');
      if (res.ok) setCreditors(await res.json());
    } catch (error) {
      console.error('Error fetching creditors:', error);
    }
  }

  async function openTxPanel(tx: Transaction) {
    try {
      const res = await fetch(`/api/transactions/${tx.id}`);
      if (res.ok) {
        setSelectedTx(await res.json());
      } else {
        setSelectedTx(tx);
      }
    } catch {
      setSelectedTx(tx);
    }
  }

  async function fetchMonthlyStatus() {
    try {
      const res = await fetch(`/api/monthly-status?unitId=${id}&year=${calendarYear}`);
      if (res.ok) {
        const data = await res.json();
        setMonthStatus(data.months);
      }
    } catch (error) {
      console.error('Error fetching monthly status:', error);
    }
  }

  async function fetchPastYearsDebt() {
    try {
      const res = await fetch(`/api/units/${id}/debt`);
      if (res.ok) {
        const data = await res.json();
        setPastYearsDebt(data.pastYearsDebt);
      }
    } catch (error) {
      console.error('Error fetching past years debt:', error);
    }
  }

  async function fetchPaymentHistory() {
    try {
      const res = await fetch(`/api/units/${id}/payment-history`);
      if (res.ok) {
        const data = await res.json();
        setPaymentHistory(data.payments || {});
        setExpectedHistory(data.expected || {});
        setYearlyData(data.yearlyData || []);
      }
    } catch (error) {
      console.error('Error fetching payment history:', error);
    }
  }

  async function fetchFeeHistory() {
    try {
      const res = await fetch(`/api/units/${id}/fee-history`);
      if (res.ok) {
        setFeeHistory(await res.json());
      }
    } catch (error) {
      console.error('Error fetching fee history:', error);
    }
  }

  async function fetchExtraCharges() {
    try {
      const res = await fetch(`/api/extra-charges?unitId=${id}`);
      if (res.ok) {
        setExtraCharges(await res.json());
      }
    } catch (error) {
      console.error('Error fetching extra charges:', error);
    }
  }

  function handleFeeHistoryUpdate() {
    fetchFeeHistory();
    fetchMonthlyStatus();
  }

  function handleExtraChargesUpdate() {
    fetchExtraCharges();
    fetchMonthlyStatus();
  }

  async function handleHistoryCellClick(month: string) {
    setHistoryPanelMonth(month);
    setHistoryPanelCalendarYear(parseInt(month.split('-')[0]));
    setHistoryPanelSelectedTx(null);
    setHistoryPanelSelectedMonths([]);
    setHistoryPanelCustomAmounts({});
    setHistoryPanelShowCustom(false);

    try {
      // Fetch transactions allocated to this month
      const res = await fetch(`/api/units/${id}/month-transactions?month=${month}`);
      if (res.ok) {
        const data = await res.json();
        setHistoryPanelTransactions(data.transactions);
        // If single transaction, auto-select it
        if (data.transactions.length === 1) {
          selectHistoryPanelTransaction(data.transactions[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching month transactions:', error);
    }

    // Fetch monthly status
    fetchHistoryPanelMonthStatus(parseInt(month.split('-')[0]));
    setHistoryPanelOpen(true);
  }

  function selectHistoryPanelTransaction(tx: Transaction) {
    setHistoryPanelSelectedTx(tx);
    if (tx.monthAllocations && tx.monthAllocations.length > 0) {
      const months = tx.monthAllocations.map((a) => a.month);
      setHistoryPanelSelectedMonths(months);
      const equalAmount = Math.abs(tx.amount) / months.length;
      const isCustom = tx.monthAllocations.some(
        (a) => Math.abs(a.amount - equalAmount) > 0.01
      );
      if (isCustom) {
        setHistoryPanelShowCustom(true);
        const amounts: Record<string, string> = {};
        tx.monthAllocations.forEach((a) => {
          amounts[a.month] = a.amount.toFixed(2);
        });
        setHistoryPanelCustomAmounts(amounts);
      } else {
        setHistoryPanelShowCustom(false);
        setHistoryPanelCustomAmounts({});
      }
      setHistoryPanelCalendarYear(parseInt(months[0].split('-')[0]));
    } else {
      setHistoryPanelSelectedMonths([historyPanelMonth]);
      setHistoryPanelCustomAmounts({});
      setHistoryPanelShowCustom(false);
    }
  }

  async function fetchHistoryPanelMonthStatus(year: number) {
    try {
      const res = await fetch(`/api/monthly-status?unitId=${id}&year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setHistoryPanelMonthStatus(data.months);
      }
    } catch (error) {
      console.error('Error fetching monthly status:', error);
    }
  }

  useEffect(() => {
    if (historyPanelOpen && historyPanelSelectedTx) {
      fetchHistoryPanelMonthStatus(historyPanelCalendarYear);
    }
  }, [historyPanelCalendarYear]);

  function handleHistoryPanelToggleMonth(month: string) {
    if (!historyPanelSelectedTx) return;
    const txAmount = Math.abs(historyPanelSelectedTx.amount);

    setHistoryPanelSelectedMonths((prev) => {
      const next = prev.includes(month)
        ? prev.filter((m) => m !== month)
        : [...prev, month].sort();

      if (!prev.includes(month) && !historyPanelCustomAmounts[month]) {
        const equalAmount = txAmount / (next.length || 1);
        if (!historyPanelShowCustom) {
          const amounts: Record<string, string> = {};
          next.forEach((m) => { amounts[m] = equalAmount.toFixed(2); });
          setHistoryPanelCustomAmounts(amounts);
        } else {
          setHistoryPanelCustomAmounts((ca) => ({ ...ca, [month]: equalAmount.toFixed(2) }));
        }
      } else if (prev.includes(month)) {
        setHistoryPanelCustomAmounts((ca) => {
          const copy = { ...ca };
          delete copy[month];
          return copy;
        });
      }
      return next;
    });
  }

  function getHistoryPanelAllocations(): { month: string; amount: number }[] {
    if (!historyPanelSelectedTx || historyPanelSelectedMonths.length === 0) return [];
    const txAmount = Math.abs(historyPanelSelectedTx.amount);
    if (historyPanelShowCustom) {
      return historyPanelSelectedMonths.map((month) => ({
        month,
        amount: parseFloat(historyPanelCustomAmounts[month] || '0'),
      }));
    }
    const perMonth = txAmount / historyPanelSelectedMonths.length;
    return historyPanelSelectedMonths.map((month) => ({ month, amount: perMonth }));
  }

  function getHistoryPanelAllocationTotal(): number {
    return getHistoryPanelAllocations().reduce((sum, a) => sum + a.amount, 0);
  }

  async function handleHistoryPanelSave() {
    if (!historyPanelSelectedTx) return;
    setHistoryPanelSaving(true);
    try {
      const allocations = getHistoryPanelAllocations();
      const res = await fetch(`/api/transactions/${historyPanelSelectedTx.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthAllocations: allocations }),
      });

      if (res.ok) {
        setHistoryPanelOpen(false);
        fetchPaymentHistory();
        fetchUnit();
        fetchMonthlyStatus();
      } else {
        const data = await res.json();
        alert(`Erro: ${data.error}`);
      }
    } catch {
      alert('Erro ao guardar');
    } finally {
      setHistoryPanelSaving(false);
    }
  }

  function closeHistoryPanel() {
    setHistoryPanelOpen(false);
    setHistoryPanelSelectedTx(null);
    setHistoryPanelTransactions([]);
  }

  async function fetchUnit() {
    try {
      const res = await fetch(`/api/units/${id}`);
      if (res.ok) {
        const data = await res.json();
        setUnit(data);
        setFormData({
          code: data.code || '',
          floor: data.floor?.toString() || '',
          description: data.description || '',
          monthlyFee: data.monthlyFee?.toString() || '45',
          nib: data.nib || '',
          telefone: data.telefone || '',
          email: data.email || '',
        });
        setOwners(
          data.owners && data.owners.length > 0
            ? data.owners.map((o: { name: string }) => o.name)
            : ['']
        );
      } else {
        router.push('/dashboard/units');
      }
    } catch (error) {
      console.error('Error fetching unit:', error);
    } finally {
      setLoading(false);
    }
  }

  function addOwner() {
    setOwners([...owners, '']);
  }

  function removeOwner(index: number) {
    if (owners.length <= 1) return;
    setOwners(owners.filter((_, i) => i !== index));
  }

  function updateOwner(index: number, value: string) {
    const updated = [...owners];
    updated[index] = value;
    setOwners(updated);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const validOwners = owners.filter((name) => name.trim() !== '');

      const res = await fetch(`/api/units/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          floor: formData.floor ? parseInt(formData.floor) : null,
          owners: validOwners,
        }),
      });

      if (res.ok) {
        fetchUnit();
      } else {
        const data = await res.json();
        alert(`Erro: ${data.error}`);
      }
    } catch (error) {
      alert('Erro ao guardar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8">
          <p className="text-gray-500">A carregar...</p>
        </main>
      </div>
    );
  }

  if (!unit) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="flex items-center gap-4 mb-4">
          <button
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-all"
            onClick={() => router.push(isAdmin ? '/dashboard/units' : '/dashboard')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">Fração {unit.code}</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'dados'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('dados')}
          >
            Dados
          </button>
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'historico'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('historico')}
          >
            Histórico
          </button>
        </div>

        {activeTab === 'dados' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Edit Form */}
            <div className="lg:col-span-2">
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">Dados da Fração</h2>
                <form onSubmit={handleSave}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Código</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        required
                        disabled={!isAdmin}
                      />
                    </div>
                    <div>
                      <label className="label">Andar</label>
                      <input
                        type="number"
                        className="input"
                        value={formData.floor}
                        onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                        disabled={!isAdmin}
                      />
                    </div>
                    <div>
                      <label className="label">Quota Mensal (EUR)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="input"
                        value={formData.monthlyFee}
                        onChange={(e) => setFormData({ ...formData, monthlyFee: e.target.value })}
                        required
                        disabled={!isAdmin}
                      />
                    </div>
                    <div>
                      <label className="label">Email</label>
                      <input
                        type="email"
                        className="input"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        disabled={!isAdmin}
                      />
                    </div>
                    <div>
                      <label className="label">Telefone</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.telefone}
                        onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                        disabled={!isAdmin}
                      />
                    </div>
                    <div>
                      <label className="label">NIB</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.nib}
                        onChange={(e) => setFormData({ ...formData, nib: e.target.value })}
                        disabled={!isAdmin}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">Descrição</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        disabled={!isAdmin}
                      />
                    </div>
                  </div>

                  {/* Owners */}
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <label className="label mb-0">Proprietário(s)</label>
                      {isAdmin && (
                        <button
                          type="button"
                          className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                          onClick={addOwner}
                        >
                          + Adicionar
                        </button>
                      )}
                    </div>
                    {owners.map((owner, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          className="input flex-1"
                          value={owner}
                          onChange={(e) => updateOwner(index, e.target.value)}
                          placeholder="Nome do proprietário"
                          disabled={!isAdmin}
                        />
                        {isAdmin && owners.length > 1 && (
                          <button
                            type="button"
                            className="text-red-500 hover:text-red-700 px-2"
                            onClick={() => removeOwner(index)}
                          >
                            x
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {isAdmin && (
                    <div className="mt-4 flex justify-end">
                      <button type="submit" className="btn-primary" disabled={saving}>
                        {saving ? 'A guardar...' : 'Guardar alterações'}
                      </button>
                    </div>
                  )}
                </form>
              </div>

              {/* Transactions */}
              <div className="card mt-4">
                <h2 className="text-lg font-semibold mb-4">Últimas Transações</h2>
                {unit.transactions && unit.transactions.length > 0 ? (
                  <div className={`${selectedTx && isAdmin ? 'flex gap-4' : ''}`}>
                    <div className={`overflow-x-auto ${selectedTx && isAdmin ? 'flex-1' : ''}`}>
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-sm text-gray-400">
                            <th className="pb-4 font-medium">Data</th>
                            <th className="pb-4 font-medium">Mês Ref.</th>
                            <th className="pb-4 font-medium">Descrição</th>
                            <th className="pb-4 font-medium text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unit.transactions.map((tx: Transaction, i: number) => (
                            <tr
                              key={tx.id}
                              className={`${isAdmin ? 'hover:bg-gray-50 cursor-pointer' : ''} transition-colors ${
                                selectedTx?.id === tx.id && isAdmin ? 'bg-primary-50' : ''
                              } ${i !== (unit.transactions?.length ?? 0) - 1 ? 'border-b border-gray-100' : ''}`}
                              onClick={() => isAdmin && openTxPanel(tx)}
                            >
                              <td className="py-4 text-sm text-gray-500">
                                {new Date(tx.date).toLocaleDateString('pt-PT')}
                              </td>
                              <td className="py-4 text-sm text-gray-400">
                                {tx.monthAllocations && tx.monthAllocations.length > 0
                                  ? tx.monthAllocations.map((a) => a.month).join(', ')
                                  : tx.referenceMonth || '-'}
                              </td>
                              <td className="py-4 text-sm text-gray-900 font-medium">
                                {tx.description}
                              </td>
                              <td className={`py-4 text-sm text-right font-semibold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {tx.amount >= 0 ? '+' : ''}{Math.abs(tx.amount).toFixed(2)} EUR
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {isAdmin && selectedTx && (
                      <TransactionEditPanel
                        transaction={selectedTx}
                        units={allUnits}
                        creditors={creditors}
                        onSave={() => { setSelectedTx(null); fetchUnit(); fetchMonthlyStatus(); fetchPaymentHistory(); }}
                        onDelete={() => { setSelectedTx(null); fetchUnit(); fetchMonthlyStatus(); fetchPaymentHistory(); }}
                        onClose={() => setSelectedTx(null)}
                      />
                    )}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-4">Sem pagamentos registados</p>
                )}
              </div>

              {/* Fee History Manager */}
              <FeeHistoryManager
                unitId={id}
                feeHistory={feeHistory}
                defaultFee={unit.monthlyFee}
                readOnly={!isAdmin}
                onUpdate={handleFeeHistoryUpdate}
              />

              {/* Extra Charges Manager */}
              <ExtraChargesManager
                unitId={id}
                extraCharges={extraCharges}
                readOnly={!isAdmin}
                onUpdate={handleExtraChargesUpdate}
              />
            </div>

            {/* Sidebar info */}
            <div className="space-y-4">
              {/* Year Summary */}
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">Resumo {calendarYear}</h2>
                {(() => {
                  const now = new Date();
                  const currentYear = now.getFullYear();
                  const currentMonth = now.getMonth() + 1;

                  const paidYTD = monthStatus.reduce((sum, s) => sum + s.paid, 0);

                  let expectedYTD = 0;
                  let expectedLabel = '';

                  if (calendarYear < currentYear) {
                    expectedYTD = monthStatus.reduce((sum, s) => sum + s.expected, 0);
                    expectedLabel = '12 meses';
                  } else if (calendarYear === currentYear) {
                    expectedYTD = monthStatus
                      .filter((_, i) => i < currentMonth)
                      .reduce((sum, s) => sum + s.expected, 0);
                    expectedLabel = `até ao ${currentMonth}º mês`;
                  } else {
                    expectedYTD = 0;
                    expectedLabel = 'N/A';
                  }

                  const yearDebt = Math.max(0, expectedYTD - paidYTD);

                  const displayExpected = Math.max(expectedYTD, paidYTD);
                  if (paidYTD > expectedYTD && calendarYear >= currentYear) {
                    expectedLabel = `Pago adiantado`;
                  }

                  const totalDebt = yearDebt + pastYearsDebt;

                  return (
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Quota mensal:</span>
                        <span className="font-medium">{unit.monthlyFee.toFixed(2)} EUR</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">
                          Esperado ({expectedLabel}):
                        </span>
                        <span className="font-medium">{displayExpected.toFixed(2)} EUR</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Pago em {calendarYear}:</span>
                        <span className="font-medium text-green-600">{paidYTD.toFixed(2)} EUR</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Dívida {calendarYear}:</span>
                        <span className={`font-medium ${yearDebt > 0 ? 'text-red-500' : 'text-green-600'}`}>
                          {yearDebt.toFixed(2)} EUR
                        </span>
                      </div>

                      {totalDebt > 0 && (
                        <div className="pt-3 border-t border-gray-100">
                          <div className="flex justify-between">
                            <span className="text-gray-400 text-sm">Dívida anos anteriores:</span>
                            <span className={`font-medium ${pastYearsDebt > 0 ? 'text-red-500' : ''}`}>
                              {pastYearsDebt.toFixed(2)} EUR
                            </span>
                          </div>
                          <div className="flex justify-between mt-2">
                            <span className="text-gray-700 font-medium text-sm">Dívida total:</span>
                            <span className="font-semibold text-red-500">
                              {totalDebt.toFixed(2)} EUR
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Month Calendar */}
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">Estado dos Pagamentos</h2>
                <MonthCalendar
                  year={calendarYear}
                  onYearChange={setCalendarYear}
                  monthStatus={monthStatus}
                  readOnly
                />
              </div>
            </div>
          </div>
        ) : (
          /* Histórico Tab */
          <div className={`flex gap-6`}>
            <div className={`flex-1 ${isAdmin && historyPanelOpen ? 'max-w-[calc(100%-340px)]' : ''}`}>
              {/* Summary Cards */}
              {(() => {
                const currentYear = new Date().getFullYear();
                const totalAllTime = Object.values(paymentHistory).reduce((sum, v) => sum + v, 0);
                const totalCurrentYear = Object.entries(paymentHistory)
                  .filter(([k]) => k.startsWith(`${currentYear}-`))
                  .reduce((sum, [, v]) => sum + v, 0);

                return (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="card">
                      <h3 className="text-sm text-gray-500 mb-1">Quota Mensal</h3>
                      <p className="text-2xl font-semibold text-gray-900">{unit.monthlyFee.toFixed(2)} EUR</p>
                    </div>
                    <div className="card">
                      <h3 className="text-sm text-gray-500 mb-1">Pago em {currentYear}</h3>
                      <p className="text-2xl font-semibold text-green-600">{totalCurrentYear.toFixed(2)} EUR</p>
                    </div>
                    <div className="card">
                      <h3 className="text-sm text-gray-500 mb-1">Total Histórico</h3>
                      <p className="text-2xl font-semibold text-gray-900">{totalAllTime.toFixed(2)} EUR</p>
                    </div>
                    <div className="card">
                      <h3 className="text-sm text-gray-500 mb-1">Dívida Total</h3>
                      <p className={`text-2xl font-semibold ${pastYearsDebt > 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {pastYearsDebt.toFixed(2)} EUR
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Payment History Table */}
              <div className="card">
                <h2 className="text-lg font-semibold mb-4">Histórico de Pagamentos</h2>
                {isAdmin && <p className="text-xs text-gray-500 mb-4">Clique numa célula para editar a alocação de meses</p>}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="pb-2 pr-3 font-medium sticky left-0 bg-white z-10"></th>
                        {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((m) => (
                          <th key={m} className="pb-2 px-2 font-medium text-center min-w-[60px]">{m}</th>
                        ))}
                        <th className="pb-2 px-2 font-medium text-right min-w-[80px]">Pago</th>
                        <th className="pb-2 px-2 font-medium text-right min-w-[80px]">Esperado</th>
                        <th className="pb-2 px-2 font-medium text-right min-w-[80px]">Divida</th>
                        <th className="pb-2 px-2 font-medium text-right min-w-[80px]">Acumulado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {Array.from({ length: new Date().getFullYear() - 2011 + 1 }, (_, i) => new Date().getFullYear() - i).map((year) => {
                        const yearData = yearlyData.find((y) => y.year === year);
                        const yearPaid = yearData?.paid || 0;
                        const yearExpected = yearData?.expected || 0;
                        const yearDebt = yearData?.debt || 0;
                        const accumulatedDebt = yearData?.accumulatedDebt || 0;

                        return (
                          <tr key={year}>
                            <td className="py-2 pr-3 font-semibold text-gray-900 sticky left-0 bg-white z-10 text-right">
                              {year}
                            </td>
                            {Array.from({ length: 12 }, (_, m) => {
                              const monthStr = `${year}-${(m + 1).toString().padStart(2, '0')}`;
                              const paid = paymentHistory[monthStr] || 0;
                              const expected = expectedHistory[monthStr] || 0;
                              const isSelected = historyPanelOpen && historyPanelMonth === monthStr;
                              const isPaidInFull = paid >= expected && expected > 0;
                              const isPartial = paid > 0 && paid < expected;
                              const isUnpaid = paid === 0 && expected > 0;

                              return (
                                <td
                                  key={monthStr}
                                  className={`py-2 px-2 text-center transition-colors ${isAdmin ? 'cursor-pointer' : ''} ${
                                    isSelected
                                      ? 'bg-primary-100 ring-2 ring-primary-500'
                                      : isPaidInFull
                                        ? `bg-green-50 text-green-700 ${isAdmin ? 'hover:bg-green-100' : ''}`
                                        : isPartial
                                          ? `bg-yellow-50 text-yellow-700 ${isAdmin ? 'hover:bg-yellow-100' : ''}`
                                          : isUnpaid
                                            ? `bg-red-50 text-red-400 ${isAdmin ? 'hover:bg-red-100' : ''}`
                                            : isAdmin ? 'hover:bg-gray-50' : ''
                                  }`}
                                  onClick={() => isAdmin && handleHistoryCellClick(monthStr)}
                                  title={expected > 0 ? `Esperado: ${expected.toFixed(2)}€` : ''}
                                >
                                  {paid > 0 ? (
                                    <span className="text-sm font-medium">
                                      {Number.isInteger(paid) ? paid : paid.toFixed(2)}
                                    </span>
                                  ) : expected > 0 ? (
                                    <span className="text-sm text-red-300">{expected.toFixed(0)}</span>
                                  ) : (
                                    <span className="text-sm text-gray-300">-</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="py-2 px-2 text-right font-semibold text-green-600">
                              {yearPaid > 0 ? yearPaid.toFixed(2) : '-'}
                            </td>
                            <td className="py-2 px-2 text-right font-medium text-gray-600">
                              {yearExpected > 0 ? yearExpected.toFixed(2) : '-'}
                            </td>
                            <td className={`py-2 px-2 text-right font-semibold ${yearDebt > 0 ? 'text-red-500' : 'text-green-600'}`}>
                              {yearExpected > 0 ? yearDebt.toFixed(2) : '-'}
                            </td>
                            <td className={`py-2 px-2 text-right font-semibold ${accumulatedDebt > 0 ? 'text-red-600 bg-red-50' : 'text-green-600'}`}>
                              {accumulatedDebt > 0 ? accumulatedDebt.toFixed(2) : yearExpected > 0 ? '0.00' : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* History Edit Side Panel (admin only) */}
            {isAdmin && historyPanelOpen && (
              <div className="w-80 shrink-0">
                <div className="card sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900">
                      Editar Alocação
                    </h3>
                    <button
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                      onClick={closeHistoryPanel}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm text-gray-500">Mês selecionado:</p>
                    <p className="font-medium text-gray-900">{historyPanelMonth}</p>
                  </div>

                  {historyPanelTransactions.length === 0 ? (
                    <p className="text-gray-400 text-sm">Nenhum pagamento alocado a este mês.</p>
                  ) : historyPanelTransactions.length > 1 && !historyPanelSelectedTx ? (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-500 mb-2">
                        {historyPanelTransactions.length} transações encontradas:
                      </p>
                      {historyPanelTransactions.map((tx) => (
                        <button
                          key={tx.id}
                          className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-primary-500 hover:bg-primary-50 transition-colors"
                          onClick={() => selectHistoryPanelTransaction(tx)}
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
                  ) : historyPanelSelectedTx ? (
                    <div className="space-y-4">
                      {historyPanelTransactions.length > 1 && (
                        <button
                          className="text-sm text-primary-600 hover:text-primary-700"
                          onClick={() => setHistoryPanelSelectedTx(null)}
                        >
                          ← Voltar à lista
                        </button>
                      )}

                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Valor da transação</p>
                        <p className="text-lg font-bold text-green-600">
                          {Math.abs(historyPanelSelectedTx.amount).toFixed(2)} EUR
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{historyPanelSelectedTx.description}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(historyPanelSelectedTx.date).toLocaleDateString('pt-PT')}
                        </p>
                      </div>

                      <div>
                        <label className="label mb-2">Meses de referência</label>
                        <MonthCalendar
                          year={historyPanelCalendarYear}
                          onYearChange={setHistoryPanelCalendarYear}
                          monthStatus={historyPanelMonthStatus}
                          selectedMonths={historyPanelSelectedMonths}
                          onToggleMonth={handleHistoryPanelToggleMonth}
                        />
                      </div>

                      {historyPanelSelectedMonths.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">
                              {historyPanelSelectedMonths.length} mês(es) &mdash; {(Math.abs(historyPanelSelectedTx.amount) / historyPanelSelectedMonths.length).toFixed(2)} EUR/mês
                            </span>
                            <button
                              type="button"
                              className={`text-xs px-2 py-1 rounded ${historyPanelShowCustom ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                              onClick={() => {
                                setHistoryPanelShowCustom(!historyPanelShowCustom);
                                if (!historyPanelShowCustom) {
                                  const perMonth = Math.abs(historyPanelSelectedTx.amount) / historyPanelSelectedMonths.length;
                                  const amounts: Record<string, string> = {};
                                  historyPanelSelectedMonths.forEach((m) => { amounts[m] = perMonth.toFixed(2); });
                                  setHistoryPanelCustomAmounts(amounts);
                                }
                              }}
                            >
                              Personalizar
                            </button>
                          </div>

                          {historyPanelShowCustom && (
                            <div className="space-y-1 p-2 bg-gray-50 rounded-lg">
                              {historyPanelSelectedMonths.map((month) => (
                                <div key={month} className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 w-16">{month}</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="input text-sm py-1 flex-1"
                                    value={historyPanelCustomAmounts[month] || ''}
                                    onChange={(e) => setHistoryPanelCustomAmounts({ ...historyPanelCustomAmounts, [month]: e.target.value })}
                                  />
                                  <span className="text-xs text-gray-400">EUR</span>
                                </div>
                              ))}
                              <div className={`text-xs mt-1 ${getHistoryPanelAllocationTotal() > Math.abs(historyPanelSelectedTx.amount) + 0.01 ? 'text-red-500' : 'text-gray-500'}`}>
                                Total: {getHistoryPanelAllocationTotal().toFixed(2)} / {Math.abs(historyPanelSelectedTx.amount).toFixed(2)} EUR
                                {getHistoryPanelAllocationTotal() > Math.abs(historyPanelSelectedTx.amount) + 0.01 && ' (excede o valor!)'}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        className="btn-primary w-full"
                        onClick={handleHistoryPanelSave}
                        disabled={historyPanelSaving || historyPanelSelectedMonths.length === 0 || getHistoryPanelAllocationTotal() > Math.abs(historyPanelSelectedTx.amount) + 0.01}
                      >
                        {historyPanelSaving ? 'A guardar...' : 'Guardar'}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
