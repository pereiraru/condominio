'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Sidebar from '@/components/Sidebar';
import MonthCalendar from '@/components/MonthCalendar';
import TransactionEditPanel from '@/components/TransactionEditPanel';
import HistoryEditPanel from '@/components/HistoryEditPanel';
import FeeHistoryManager from '@/components/FeeHistoryManager';
import ExtraChargesManager from '@/components/ExtraChargesManager';
import { Unit, Transaction, Creditor, MonthPaymentStatus, FeeHistory, ExtraCharge, Owner, MonthExpectedBreakdown, MonthPaymentBreakdown } from '@/lib/types';

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
  const [owners, setOwners] = useState<Owner[]>([{ id: '', name: '', unitId: '' }]);
  const [activeTab, setActiveTab] = useState<'dados' | 'historico'>('dados');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>(''); // For Historico filter
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [creditors, setCreditors] = useState<Creditor[]>([]);

  // Calendar and summary state
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [monthStatus, setMonthStatus] = useState<MonthPaymentStatus[]>([]);
  const [pastYearsDebt, setPastYearsDebt] = useState(0);
  const [previousDebtRemaining, setPreviousDebtRemaining] = useState(0);
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

  // Recalculate state
  const [recalculating, setRecalculating] = useState(false);

  // History edit panel state
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [historyPanelMonth, setHistoryPanelMonth] = useState('');

  // Breakdown data
  const [paymentBreakdown, setPaymentBreakdown] = useState<Record<string, MonthPaymentBreakdown>>({});
  const [expectedBreakdown, setExpectedBreakdown] = useState<Record<string, MonthExpectedBreakdown>>({});

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
      fetchMonthlyStatus(selectedOwnerId || undefined);
      fetchPastYearsDebt(selectedOwnerId || undefined);
    }
  }, [id, calendarYear, selectedOwnerId]);

  // Refetch payment history when owner filter changes
  useEffect(() => {
    if (id) {
      fetchPaymentHistory(selectedOwnerId || undefined);
    }
  }, [selectedOwnerId]);

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

  async function fetchMonthlyStatus(ownerId?: string) {
    try {
      const ownerParam = ownerId ? `&ownerId=${ownerId}` : '';
      const res = await fetch(`/api/monthly-status?unitId=${id}&year=${calendarYear}${ownerParam}`);
      if (res.ok) {
        const data = await res.json();
        setMonthStatus(data.months);
      }
    } catch (error) {
      console.error('Error fetching monthly status:', error);
    }
  }

  async function fetchPastYearsDebt(ownerId?: string) {
    try {
      const ownerParam = ownerId ? `?ownerId=${ownerId}` : '';
      const res = await fetch(`/api/units/${id}/debt${ownerParam}`);
      if (res.ok) {
        const data = await res.json();
        setPastYearsDebt(data.pastYearsDebt);
        setPreviousDebtRemaining(data.previousDebtRemaining || 0);
      }
    } catch (error) {
      console.error('Error fetching past years debt:', error);
    }
  }

  async function fetchPaymentHistory(ownerId?: string) {
    try {
      const ownerParam = ownerId ? `?ownerId=${ownerId}` : '';
      const res = await fetch(`/api/units/${id}/payment-history${ownerParam}`);
      if (res.ok) {
        const data = await res.json();
        setPaymentHistory(data.payments || {});
        setExpectedHistory(data.expected || {});
        setYearlyData(data.yearlyData || []);
        setPaymentBreakdown(data.paymentBreakdown || {});
        setExpectedBreakdown(data.expectedBreakdown || {});
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

  async function handleRecalculate() {
    setRecalculating(true);
    try {
      await Promise.all([
        fetchMonthlyStatus(selectedOwnerId || undefined),
        fetchPastYearsDebt(selectedOwnerId || undefined),
        fetchPaymentHistory(selectedOwnerId || undefined),
      ]);
    } finally {
      setRecalculating(false);
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

  function handleHistoryCellClick(month: string) {
    setHistoryPanelMonth(month);
    setHistoryPanelOpen(true);
  }

  function handleHistoryPanelSave() {
    setHistoryPanelOpen(false);
    fetchPaymentHistory(selectedOwnerId || undefined);
    fetchUnit();
    fetchMonthlyStatus(selectedOwnerId || undefined);
    fetchPastYearsDebt(selectedOwnerId || undefined);
  }

  function closeHistoryPanel() {
    setHistoryPanelOpen(false);
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
            ? data.owners
            : [{ id: '', name: '', unitId: id }]
        );
        // Default to current owner for Histórico filter
        if (data.owners && data.owners.length > 0 && !selectedOwnerId) {
          const currentOwner = data.owners.find((o: Owner) => !o.endMonth);
          if (currentOwner) {
            setSelectedOwnerId(currentOwner.id);
          }
        }
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
    setOwners([...owners, { id: '', name: '', unitId: id }]);
  }

  function removeOwner(index: number) {
    if (owners.length <= 1) return;
    setOwners(owners.filter((_, i) => i !== index));
  }

  function updateOwnerField(index: number, field: keyof Owner, value: string | number | null) {
    const updated = [...owners];
    updated[index] = { ...updated[index], [field]: value };
    setOwners(updated);
  }

  function handleChangeOwner() {
    // End current owner's period and create a new blank owner
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    const nextMonth = now.getMonth() === 11
      ? `${now.getFullYear() + 1}-01`
      : `${now.getFullYear()}-${(now.getMonth() + 2).toString().padStart(2, '0')}`;

    const updated = owners.map((o) => {
      if (!o.endMonth) {
        return { ...o, endMonth: currentMonth };
      }
      return o;
    });
    updated.push({ id: '', name: '', unitId: id, startMonth: nextMonth, endMonth: null });
    setOwners(updated);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const validOwners = owners
        .filter((o) => o.name.trim() !== '')
        .map((o) => ({
          id: o.id || undefined,
          name: o.name,
          email: o.email || null,
          telefone: o.telefone || null,
          nib: o.nib || null,
          startMonth: o.startMonth || null,
          endMonth: o.endMonth || null,
          previousDebt: o.previousDebt ?? 0,
        }));

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
                  <div className="mt-6">
                    <div className="flex justify-between items-center mb-3">
                      <label className="label mb-0">Proprietário(s)</label>
                      {isAdmin && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="text-orange-600 hover:text-orange-800 text-sm font-medium"
                            onClick={handleChangeOwner}
                          >
                            Mudar Proprietário
                          </button>
                          <button
                            type="button"
                            className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                            onClick={addOwner}
                          >
                            + Adicionar
                          </button>
                        </div>
                      )}
                    </div>
                    {owners.map((owner, index) => (
                      <div key={owner.id || `new-${index}`} className="border border-gray-200 rounded-lg p-3 mb-3">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            {owner.endMonth === null || owner.endMonth === undefined ? (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Atual</span>
                            ) : (
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Anterior</span>
                            )}
                            {owner.startMonth && (
                              <span className="text-xs text-gray-400">
                                {owner.startMonth}{owner.endMonth ? ` → ${owner.endMonth}` : ' → presente'}
                              </span>
                            )}
                          </div>
                          {isAdmin && owners.length > 1 && (
                            <button
                              type="button"
                              className="text-red-500 hover:text-red-700 text-sm"
                              onClick={() => removeOwner(index)}
                            >
                              Remover
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-gray-500">Nome</label>
                            <input
                              type="text"
                              className="input text-sm"
                              value={owner.name}
                              onChange={(e) => updateOwnerField(index, 'name', e.target.value)}
                              placeholder="Nome do proprietário"
                              disabled={!isAdmin}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Email</label>
                            <input
                              type="email"
                              className="input text-sm"
                              value={owner.email || ''}
                              onChange={(e) => updateOwnerField(index, 'email', e.target.value || null)}
                              placeholder="Email"
                              disabled={!isAdmin}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Telefone</label>
                            <input
                              type="text"
                              className="input text-sm"
                              value={owner.telefone || ''}
                              onChange={(e) => updateOwnerField(index, 'telefone', e.target.value || null)}
                              placeholder="Telefone"
                              disabled={!isAdmin}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">NIB</label>
                            <input
                              type="text"
                              className="input text-sm"
                              value={owner.nib || ''}
                              onChange={(e) => updateOwnerField(index, 'nib', e.target.value || null)}
                              placeholder="NIB"
                              disabled={!isAdmin}
                            />
                          </div>
                          {isAdmin && (
                            <>
                              <div>
                                <label className="text-xs text-gray-500">Dívida Anterior (EUR)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="input text-sm"
                                  value={owner.previousDebt ?? 0}
                                  onChange={(e) => updateOwnerField(index, 'previousDebt', parseFloat(e.target.value) || 0)}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500">Início (AAAA-MM)</label>
                                <input
                                  type="text"
                                  className="input text-sm"
                                  value={owner.startMonth || ''}
                                  onChange={(e) => updateOwnerField(index, 'startMonth', e.target.value || null)}
                                  placeholder="2024-01"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500">Fim (AAAA-MM)</label>
                                <input
                                  type="text"
                                  className="input text-sm"
                                  value={owner.endMonth || ''}
                                  onChange={(e) => updateOwnerField(index, 'endMonth', e.target.value || null)}
                                  placeholder="Vazio = atual"
                                />
                              </div>
                            </>
                          )}
                        </div>
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

                  const totalDebt = yearDebt + pastYearsDebt + previousDebtRemaining;

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
                          {previousDebtRemaining > 0 && (
                            <div className="flex justify-between mt-1">
                              <span className="text-gray-400 text-sm">Dívida anterior:</span>
                              <span className="font-medium text-red-500">
                                {previousDebtRemaining.toFixed(2)} EUR
                              </span>
                            </div>
                          )}
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
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
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
                      <p className={`text-2xl font-semibold ${(pastYearsDebt + previousDebtRemaining) > 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {(pastYearsDebt + previousDebtRemaining).toFixed(2)} EUR
                      </p>
                      {previousDebtRemaining > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          (inclui {previousDebtRemaining.toFixed(2)} dívida anterior)
                        </p>
                      )}
                    </div>
                    <div className="card flex flex-col items-center justify-center">
                      <button
                        onClick={handleRecalculate}
                        disabled={recalculating}
                        className="btn-secondary text-sm flex items-center gap-2"
                      >
                        <svg className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {recalculating ? 'A recalcular...' : 'Recalcular Saldo'}
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Payment History Table */}
              <div className="card">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">Histórico de Pagamentos</h2>
                  {isAdmin && unit.owners && unit.owners.length > 1 && (
                    <select
                      className="input text-sm w-auto"
                      value={selectedOwnerId}
                      onChange={(e) => setSelectedOwnerId(e.target.value)}
                    >
                      <option value="">Todos os proprietários</option>
                      {unit.owners.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}{o.endMonth ? ` (até ${o.endMonth})` : ' (atual)'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {isAdmin && <p className="text-xs text-gray-500 mb-4">Clique numa célula para editar a alocação de meses</p>}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="pb-2 pr-3 font-medium sticky left-0 bg-white z-10"></th>
                        {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((m) => (
                          <th key={m} className="pb-2 px-2 font-medium text-center min-w-[80px]">{m}</th>
                        ))}
                        <th className="pb-2 px-2 font-medium text-right min-w-[80px]">Pago</th>
                        <th className="pb-2 px-2 font-medium text-right min-w-[80px]">Esperado</th>
                        <th className="pb-2 px-2 font-medium text-right min-w-[80px]">Divida</th>
                        <th className="pb-2 px-2 font-medium text-right min-w-[80px]">Acumulado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(() => {
                        const startYear = yearlyData.length > 0
                          ? Math.min(...yearlyData.map(y => y.year))
                          : new Date().getFullYear();
                        return Array.from({ length: new Date().getFullYear() - startYear + 1 }, (_, i) => new Date().getFullYear() - i);
                      })().map((year) => {
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
                              const eb = expectedBreakdown[monthStr];
                              const pb = paymentBreakdown[monthStr];

                              return (
                                <td
                                  key={monthStr}
                                  className={`py-1 px-1 text-center transition-colors ${isAdmin ? 'cursor-pointer' : ''} ${
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
                                  {(() => {
                                    // Merge extras from expected (eb) and paid (pb) breakdowns
                                    const mergedExtras: { id: string; description: string; expectedAmount: number; paidAmount: number }[] = [];
                                    if (eb?.extras) {
                                      for (const extra of eb.extras) {
                                        const paidEntry = pb?.extras.find((e) => e.extraChargeId === extra.id);
                                        mergedExtras.push({ id: extra.id, description: extra.description, expectedAmount: extra.amount, paidAmount: paidEntry?.paid || 0 });
                                      }
                                    }
                                    if (pb?.extras) {
                                      for (const paidExtra of pb.extras) {
                                        if (!mergedExtras.some((e) => e.id === paidExtra.extraChargeId)) {
                                          mergedExtras.push({ id: paidExtra.extraChargeId, description: paidExtra.description, expectedAmount: 0, paidAmount: paidExtra.paid });
                                        }
                                      }
                                    }

                                    if (mergedExtras.length > 0) {
                                      const basePaid = pb ? pb.baseFee : 0;
                                      const baseExpected = eb ? eb.baseFee : expected;
                                      const baseOk = basePaid >= baseExpected && baseExpected > 0;
                                      const basePartial = basePaid > 0 && basePaid < baseExpected;
                                      return (
                                        <div className="flex flex-col items-center gap-0.5">
                                          <span className={`text-xs font-medium ${
                                            basePaid > 0
                                              ? baseOk ? 'text-green-700' : basePartial ? 'text-yellow-700' : 'text-red-400'
                                              : baseExpected > 0 ? 'text-red-300' : 'text-gray-300'
                                          }`}>
                                            {basePaid > 0
                                              ? (Number.isInteger(basePaid) ? basePaid : basePaid.toFixed(2))
                                              : baseExpected > 0 ? baseExpected.toFixed(0) : '-'}
                                          </span>
                                          {mergedExtras.map((extra) => {
                                            const abbrev = extra.description.length > 5
                                              ? extra.description.slice(0, 5) + '.'
                                              : extra.description;
                                            const extraOk = extra.paidAmount >= extra.expectedAmount && extra.expectedAmount > 0;
                                            const extraPartial = extra.paidAmount > 0 && extra.expectedAmount > 0 && extra.paidAmount < extra.expectedAmount;
                                            return (
                                              <span
                                                key={extra.id}
                                                className={`text-[10px] leading-tight ${
                                                  extra.paidAmount > 0
                                                    ? extraOk || extra.expectedAmount === 0 ? 'text-green-600' : extraPartial ? 'text-yellow-600' : 'text-red-400'
                                                    : extra.expectedAmount > 0 ? 'text-red-300' : 'text-gray-300'
                                                }`}
                                                title={`${extra.description}: ${extra.paidAmount > 0 ? extra.paidAmount.toFixed(2) : extra.expectedAmount.toFixed(2)}€`}
                                              >
                                                {extra.paidAmount > 0
                                                  ? `${Number.isInteger(extra.paidAmount) ? extra.paidAmount : extra.paidAmount.toFixed(0)} (${abbrev})`
                                                  : `${extra.expectedAmount.toFixed(0)} (${abbrev})`}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      );
                                    }
                                    return null;
                                  })() || (paid > 0 ? (
                                    <span className="text-sm font-medium">
                                      {Number.isInteger(paid) ? paid : paid.toFixed(2)}
                                    </span>
                                  ) : expected > 0 ? (
                                    <span className="text-sm text-red-300">{expected.toFixed(0)}</span>
                                  ) : (
                                    <span className="text-sm text-gray-300">-</span>
                                  ))}
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
              <HistoryEditPanel
                key={historyPanelMonth}
                unitId={id}
                month={historyPanelMonth}
                expectedBreakdown={expectedBreakdown[historyPanelMonth] || null}
                ownerId={selectedOwnerId || undefined}
                onSave={handleHistoryPanelSave}
                onClose={closeHistoryPanel}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
