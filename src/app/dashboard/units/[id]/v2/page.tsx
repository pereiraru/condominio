'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Sidebar from '@/components/Sidebar';
import MonthCalendar from '@/components/MonthCalendar';
import TransactionEditPanel from '@/components/TransactionEditPanel';
import HistoryEditPanel from '@/components/HistoryEditPanel';
import FeeHistoryManager from '@/components/FeeHistoryManager';
import ExtraChargesManager from '@/components/ExtraChargesManager';
import { Unit, Transaction, Creditor, MonthPaymentStatus, FeeHistory, ExtraCharge, Owner, MonthExpectedBreakdown, DescriptionMapping } from '@/lib/types';

type TabType = 'geral' | 'historico' | 'config';

interface EnhancedUnit extends Unit {
  transactions?: Transaction[];
  descriptionMappings?: DescriptionMapping[];
  pre2024?: {
    initial: number;
    paid: number;
    remaining: number;
    payments: {
      id: string;
      date: string;
      description: string;
      amount: number;
    }[];
  };
}

export default function UnitDetailV2Page() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';
  const id = params.id as string;

  const [unit, setUnit] = useState<EnhancedUnit | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('geral');
  
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
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [creditors, setCreditors] = useState<Creditor[]>([]);

  // Refs for navigation
  const ownerHistoryRef = useRef<HTMLDivElement>(null);

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
  const [expectedBreakdown, setExpectedBreakdown] = useState<Record<string, MonthExpectedBreakdown>>({});

  // Extras summary
  const [extrasSummary, setExtrasSummary] = useState<{ id: string; description: string; totalExpected: number; totalPaid: number; remaining: number }[]>([]);

  useEffect(() => {
    fetchUnit();
    fetchPaymentHistory();
    fetchFeeHistory();
    fetchExtraCharges();
    if (isAdmin) {
      fetchAllUnits();
      fetchCreditors();
    }
  }, [id, isAdmin]);

  useEffect(() => {
    if (id) {
      fetchMonthlyStatus(selectedOwnerId || undefined);
      fetchPastYearsDebt(selectedOwnerId || undefined);
    }
  }, [id, calendarYear, selectedOwnerId]);

  useEffect(() => {
    if (id) {
      fetchPaymentHistory(selectedOwnerId || undefined);
    }
  }, [selectedOwnerId]);

  async function fetchAllUnits() {
    try {
      const res = await fetch('/api/units');
      if (res.ok) setAllUnits(await res.json());
    } catch (error) { console.error(error); }
  }

  async function fetchCreditors() {
    try {
      const res = await fetch('/api/creditors');
      if (res.ok) setCreditors(await res.json());
    } catch (error) { console.error(error); }
  }

  async function openTxPanel(tx: Transaction) {
    try {
      const res = await fetch(`/api/transactions/${tx.id}`);
      if (res.ok) setSelectedTx(await res.json());
      else setSelectedTx(tx);
    } catch { setSelectedTx(tx); }
  }

  async function fetchMonthlyStatus(ownerId?: string) {
    try {
      const ownerParam = ownerId ? `&ownerId=${ownerId}` : '';
      const res = await fetch(`/api/monthly-status?unitId=${id}&year=${calendarYear}${ownerParam}`);
      if (res.ok) {
        const data = await res.json();
        setMonthStatus(data.months);
      }
    } catch (error) { console.error(error); }
  }

  async function fetchPastYearsDebt(ownerId?: string) {
    try {
      const ownerParam = ownerId ? `?ownerId=${ownerId}` : '';
      const res = await fetch(`/api/units/${id}/debt${ownerParam}`);
      if (res.ok) {
        const data = await res.json();
        setPastYearsDebt(data.pastYearsDebt);
        setPreviousDebtRemaining(data.previousDebtRemaining || 0);
        setExtrasSummary(data.outstandingExtras || []);
      }
    } catch (error) { console.error(error); }
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
        setExpectedBreakdown(data.expectedBreakdown || {});
      }
    } catch (error) { console.error(error); }
  }

  async function fetchFeeHistory() {
    try {
      const res = await fetch(`/api/units/${id}/fee-history`);
      if (res.ok) setFeeHistory(await res.json());
    } catch (error) { console.error(error); }
  }

  async function fetchExtraCharges() {
    try {
      const res = await fetch(`/api/extra-charges?unitId=${id}`);
      if (res.ok) setExtraCharges(await res.json());
    } catch (error) { console.error(error); }
  }

  async function handleRecalculate() {
    setRecalculating(true);
    try {
      await Promise.all([
        fetchMonthlyStatus(selectedOwnerId || undefined),
        fetchPastYearsDebt(selectedOwnerId || undefined),
        fetchPaymentHistory(selectedOwnerId || undefined),
        fetchUnit()
      ]);
    } finally { setRecalculating(false); }
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
        setOwners(data.owners && data.owners.length > 0 ? data.owners : [{ id: '', name: '', unitId: id }]);
        if (data.owners && data.owners.length > 0 && !selectedOwnerId) {
          const currentOwner = data.owners.find((o: Owner) => !o.endMonth);
          if (currentOwner) setSelectedOwnerId(currentOwner.id);
        }
      } else { router.push('/dashboard/units'); }
    } catch (error) { 
      console.error(error); 
      setLoading(false);
    } finally { setLoading(false); }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function updateOwnerField(index: number, field: keyof Owner, value: any) {
    const updated = [...owners];
    updated[index] = { ...updated[index], [field]: value };
    setOwners(updated);
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
        alert('Guardado com sucesso');
      } else {
        const data = await res.json();
        alert(`Erro: ${data.error}`);
      }
    } catch { alert('Erro ao guardar'); }
    finally { setSaving(false); }
  }

  const scrollToOwnerHistory = () => {
    setActiveTab('config');
    setTimeout(() => {
      ownerHistoryRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  if (loading) return <div className="flex min-h-screen"><Sidebar /><main className="flex-1 p-8 text-gray-500">A carregar...</main></div>;
  if (!unit) return null;

  const currentOwner = owners.find(o => !o.endMonth) || owners[0];
  const totalDebt = (pastYearsDebt + previousDebtRemaining + (unit.totalOwed ?? 0) + (unit.pre2024?.remaining ?? 0));

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-primary-200">
                {unit.code}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Fração {unit.code}</h1>
                <p className="text-gray-500 flex items-center gap-2">
                  <span className="bg-gray-200 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider text-gray-600">
                    {unit.floor != null ? `${unit.floor}º Andar` : 'Unidade'}
                  </span>
                  {unit.description && <span className="text-gray-400">•</span>}
                  <span>{unit.description}</span>
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => router.push('/dashboard/units')}
                className="btn-secondary flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Voltar
              </button>
              {isAdmin && (
                <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary flex items-center gap-2 px-6"
                >
                  {saving ? 'A guardar...' : 'Guardar Alterações'}
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-1 mb-8 bg-gray-200/50 p-1.5 rounded-2xl w-fit">
            {[
              { id: 'geral', label: 'Dados Gerais', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
              { id: 'historico', label: 'Histórico de Pagamentos', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
              { id: 'config', label: 'Configurações', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  activeTab === tab.id 
                    ? 'bg-white text-primary-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: DADOS GERAIS */}
          {activeTab === 'geral' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                {/* Unit Details Card */}
                <div className="card">
                  <div className="flex items-center gap-2 mb-6 text-gray-900">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-bold">Dados da Fração</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="label">Código da Fração</label>
                      <input 
                        type="text" className="input" 
                        value={formData.code} 
                        onChange={e => setFormData({...formData, code: e.target.value})}
                        disabled={!isAdmin}
                      />
                    </div>
                    <div>
                      <label className="label">Andar</label>
                      <input 
                        type="number" className="input" 
                        value={formData.floor} 
                        onChange={e => setFormData({...formData, floor: e.target.value})}
                        disabled={!isAdmin}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">Descrição / Notas</label>
                      <textarea 
                        className="input min-h-[100px] py-3" 
                        value={formData.description} 
                        onChange={e => setFormData({...formData, description: e.target.value})}
                        placeholder="Ex: T3 com varanda, inclui arrecadação no piso -1..."
                        disabled={!isAdmin}
                      />
                    </div>
                  </div>
                </div>

                {/* Current Owner Card */}
                <div className="card">
                  <div className="flex items-center gap-2 mb-6 text-gray-900">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-bold">Proprietário Atual</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="label">Nome Completo</label>
                      <input 
                        type="text" className="input font-bold text-gray-900" 
                        value={currentOwner.name} 
                        onChange={e => updateOwnerField(owners.indexOf(currentOwner), 'name', e.target.value)}
                        disabled={!isAdmin}
                      />
                    </div>
                    <div>
                      <label className="label">Email de Contacto</label>
                      <input 
                        type="email" className="input" 
                        value={currentOwner.email || ''} 
                        onChange={e => updateOwnerField(owners.indexOf(currentOwner), 'email', e.target.value)}
                        disabled={!isAdmin}
                      />
                    </div>
                    <div>
                      <label className="label">Telefone</label>
                      <input 
                        type="text" className="input" 
                        value={currentOwner.telefone || ''} 
                        onChange={e => updateOwnerField(owners.indexOf(currentOwner), 'telefone', e.target.value)}
                        disabled={!isAdmin}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">NIB para Reembolsos</label>
                      <input 
                        type="text" className="input font-mono" 
                        value={currentOwner.nib || ''} 
                        onChange={e => updateOwnerField(owners.indexOf(currentOwner), 'nib', e.target.value)}
                        disabled={!isAdmin}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar Info */}
              <div className="space-y-8">
                {/* Financial Overview Card */}
                <div className="card overflow-hidden !p-0">
                  <div className="p-6">
                    <h2 className="text-xl font-bold mb-6">Resumo Financeiro</h2>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 text-sm">Quota Mensal:</span>
                        <span className="font-bold text-gray-900">{unit.monthlyFee.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 text-sm">Dívida {new Date().getFullYear()}:</span>
                        <span className={`font-bold ${(unit.totalOwed ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {(unit.totalOwed ?? 0).toFixed(2)}€
                        </span>
                      </div>
                      
                      {/* Pre-2024 Debt Row */}
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 text-sm">Dívida Anterior (Pre-2024):</span>
                        <span className={`font-bold ${(unit.pre2024?.remaining ?? 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                          {(unit.pre2024?.remaining ?? 0).toFixed(2)}€
                        </span>
                      </div>

                      <div className="flex justify-between items-center pt-4 border-t border-gray-100 font-black">
                        <span className="text-gray-900 uppercase text-xs tracking-wider">Dívida Total</span>
                        <span className={`text-xl ${totalDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {totalDebt.toFixed(2)}€
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={`px-6 py-4 border-t flex items-center justify-center gap-2 font-bold text-[10px] uppercase tracking-widest ${ totalDebt > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700' }`}>
                    <div className={`w-2 h-2 rounded-full animate-pulse ${ totalDebt > 0 ? 'bg-red-500' : 'bg-green-500' }`}></div>
                    {totalDebt > 0 ? 'Valores Pendentes' : 'Regularizado'}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="card">
                  <h2 className="text-lg font-bold mb-4">Ações Rápidas</h2>
                  <div className="space-y-3">
                    <button 
                      onClick={() => setActiveTab('historico')}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors group"
                    >
                      <span className="text-sm font-semibold text-gray-700">Ver Histórico Completo</span>
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => router.push(`/dashboard/payments?unitId=${id}`)}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors group"
                    >
                      <span className="text-sm font-semibold text-gray-700">Registar Novo Pagamento</span>
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                    {isAdmin && (unit.pre2024?.remaining ?? 0) > 0 && (
                      <button 
                        onClick={() => router.push(`/dashboard/payments?unitId=${id}&month=PREV-DEBT`)}
                        className="w-full flex items-center justify-between p-3 rounded-xl border border-orange-100 bg-orange-50 hover:bg-orange-100 transition-colors group"
                      >
                        <span className="text-sm font-bold text-orange-700">Pagar Dívida Anterior</span>
                        <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HISTÓRICO */}
          {activeTab === 'historico' && (
            <div className="space-y-8">
              {/* Summary Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="card bg-white border-l-4 border-l-primary-600">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Quota Base Atual</p>
                  <p className="text-2xl font-black text-gray-900">{unit.monthlyFee.toFixed(2)}€</p>
                </div>
                <div className="card bg-white border-l-4 border-l-green-500">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Pago em {new Date().getFullYear()}</p>
                  <p className="text-2xl font-black text-green-600">{(unit.totalPaid ?? 0).toFixed(2)}€</p>
                </div>
                <div className="card bg-white border-l-4 border-l-red-500">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Dívida {new Date().getFullYear()}</p>
                  <p className="text-2xl font-black text-red-600">{(unit.totalOwed ?? 0).toFixed(2)}€</p>
                </div>
                <div className="card bg-white border-l-4 border-l-orange-500 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Dívida Total Acumulada</p>
                    <p className="text-2xl font-black text-orange-600">{totalDebt.toFixed(2)}€</p>
                  </div>
                  <button 
                    onClick={handleRecalculate}
                    disabled={recalculating}
                    className="mt-3 text-[10px] font-bold text-primary-600 hover:text-primary-800 flex items-center gap-1 uppercase tracking-widest"
                  >
                    <svg className={`w-3 h-3 ${recalculating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Recalcular Saldo
                  </button>
                </div>
              </div>

              {/* Extras Grid */}
              {extrasSummary.length > 0 && (
                <div className="flex flex-wrap gap-4">
                  {extrasSummary.map(extra => (
                    <div key={extra.id} className={`flex-1 min-w-[200px] card border-l-4 ${extra.remaining === 0 ? 'border-l-green-500 bg-green-50/30' : 'border-l-yellow-500 bg-yellow-50/30'}`}>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{extra.description}</p>
                      <p className={`text-lg font-bold ${extra.remaining === 0 ? 'text-green-700' : 'text-yellow-800'}`}>
                        {extra.totalPaid.toFixed(2)}€ / {extra.totalExpected.toFixed(2)}€
                      </p>
                      <p className="text-[10px] font-medium text-gray-400 mt-1">
                        {extra.remaining === 0 ? 'Totalmente Pago' : `Faltam ${extra.remaining.toFixed(2)}€`}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* The History Grid Card */}
              <div className="card !p-0 overflow-hidden border border-gray-200">
                <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Grelha de Pagamentos</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Visão anual consolidada de quotas e extras</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {owners.length > 1 && (
                      <select 
                        className="input text-xs w-auto h-9" 
                        value={selectedOwnerId} 
                        onChange={e => setSelectedOwnerId(e.target.value)}
                      >
                        <option value="">Todos os proprietários</option>
                        {owners.map(o => <option key={o.id} value={o.id}>{o.name}{o.endMonth ? ` (até ${o.endMonth})` : ' (atual)'}</option>)}
                      </select>
                    )}
                    <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1">
                      <button onClick={() => setCalendarYear(calendarYear-1)} className="p-1 hover:bg-gray-100 rounded">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      <span className="px-3 text-sm font-bold text-gray-700">{calendarYear}</span>
                      <button onClick={() => setCalendarYear(calendarYear+1)} className="p-1 hover:bg-gray-100 rounded">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-[13px] border-collapse">
                    <thead>
                      <tr className="text-left text-gray-500 bg-gray-50/50 uppercase text-[10px] font-bold tracking-wider border-b border-gray-200">
                        <th className="py-3 px-4 sticky left-0 bg-gray-50 z-10 border-r border-gray-200">Ano</th>
                        {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map(m => (
                          <th key={m} className="py-3 px-1 text-center min-w-[85px] border-r border-gray-100 last:border-r-0">{m}</th>
                        ))}
                        <th className="py-3 px-3 text-right bg-green-50/50 border-l border-gray-200">Pago</th>
                        <th className="py-3 px-3 text-right bg-red-50/50 border-l border-gray-200">Dívida</th>
                        <th className="py-3 px-3 text-right bg-gray-100 border-l border-gray-200">Acum..</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(() => {
                        const startYear = yearlyData.length > 0 ? Math.min(...yearlyData.map(y => y.year)) : new Date().getFullYear();
                        return Array.from({ length: new Date().getFullYear() - startYear + 1 }, (_, i) => new Date().getFullYear() - i);
                      })().map(year => {
                        const yearData = yearlyData.find(y => y.year === year);
                        return (
                          <tr key={year} className="hover:bg-blue-50/20 transition-colors">
                            <td className="py-3 px-4 font-bold text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-200 text-center">
                              {year}
                            </td>
                            {Array.from({ length: 12 }, (_, m) => {
                              const monthStr = `${year}-${(m + 1).toString().padStart(2, '0')}`;
                              const paid = paymentHistory[monthStr] || 0;
                              const expected = expectedHistory[monthStr] || 0;
                              const eb = expectedBreakdown[monthStr];
                              
                              const isPaidInFull = paid >= expected && expected > 0;
                              const isPartial = paid > 0 && paid < expected;
                              const isUnpaid = paid === 0 && expected > 0;

                              return (
                                <td 
                                  key={monthStr} 
                                  onClick={() => isAdmin && handleHistoryCellClick(monthStr)}
                                  className={`py-2 px-1 text-center border-r border-gray-100 last:border-r-0 cursor-pointer transition-all ${
                                    isPaidInFull ? 'bg-green-50/50 text-green-700 hover:bg-green-100' :
                                    isPartial ? 'bg-yellow-50/50 text-yellow-700 hover:bg-yellow-100' :
                                    isUnpaid ? 'bg-red-50/50 text-red-400 hover:bg-red-100' : 'hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex flex-col items-center gap-0.5 min-h-[32px] justify-center">
                                    {paid > 0 ? (
                                      <span className="font-bold">{Number.isInteger(paid) ? paid : paid.toFixed(1)}</span>
                                    ) : expected > 0 ? (
                                      <span className="text-red-300 font-medium">{expected.toFixed(0)}</span>
                                    ) : (
                                      <span className="text-gray-200">-</span>
                                    )}
                                    {(eb?.extras.length || 0) > 0 && <div className="w-1 h-1 rounded-full bg-blue-400"></div>}
                                  </div>
                                </td>
                              );
                            })}
                            <td className="py-3 px-3 text-right font-bold text-green-600 bg-green-50/20 border-l border-gray-200">
                              {yearData?.paid ? `${yearData.paid.toFixed(0)}€` : '-'}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-red-600 bg-red-50/20 border-l border-gray-200">
                              {yearData?.debt ? `${yearData.debt.toFixed(0)}€` : '-'}
                            </td>
                            <td className={`py-3 px-3 text-right font-black border-l border-gray-200 ${yearData?.accumulatedDebt && yearData.accumulatedDebt > 0 ? 'text-red-700 bg-red-50' : 'text-gray-400'}`}>
                              {yearData?.accumulatedDebt ? `${yearData.accumulatedDebt.toFixed(0)}€` : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Visual Calendar */}
                <div className="card">
                  <h2 className="text-lg font-bold mb-4">Estado Mensal ({calendarYear})</h2>
                  <MonthCalendar
                    year={calendarYear}
                    onYearChange={setCalendarYear}
                    monthStatus={monthStatus}
                    readOnly
                  />
                </div>

                {/* Latest Activity */}
                <div className="card">
                  <h2 className="text-lg font-bold mb-4">Últimas Transações</h2>
                  <div className="divide-y divide-gray-100">
                    {unit.transactions?.slice(0, 5).map(tx => (
                      <div key={tx.id} className="py-3 flex justify-between items-center group cursor-pointer" onClick={() => isAdmin && openTxPanel(tx)}>
                        <div>
                          <p className="text-sm font-bold text-gray-900 group-hover:text-primary-600 transition-colors">{tx.description}</p>
                          <p className="text-[10px] text-gray-400 uppercase font-bold">{new Date(tx.date).toLocaleDateString('pt-PT')}</p>
                        </div>
                        <p className={`text-sm font-black ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)}€
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CONFIGURAÇÕES */}
          {activeTab === 'config' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-8">
                {/* Mappings Card */}
                <div className="card">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </div>
                      <h2 className="text-xl font-bold text-gray-900">Mapeamentos Bancários</h2>
                    </div>
                    {isAdmin && (
                      <button 
                        onClick={() => router.push('/dashboard/transactions')}
                        className="text-primary-600 text-xs font-bold uppercase tracking-widest hover:underline"
                      >
                        Gerir
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Palavras-chave que identificam automaticamente pagamentos desta fração no extrato.
                  </p>
                  <div className="space-y-2">
                    {unit.descriptionMappings && unit.descriptionMappings.length > 0 ? (
                      unit.descriptionMappings.map(m => (
                        <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <span className="font-mono text-sm text-gray-700 font-bold">{m.pattern}</span>
                          <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Automático</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400 italic py-4 text-center">Nenhum mapeamento configurado.</p>
                    )}
                  </div>
                </div>

                {/* Pre-2024 Debt Control Card */}
                <div className="card border-l-4 border-l-orange-500 bg-orange-50/10 overflow-hidden !p-0">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">Dívida Anterior a 2024</h2>
                      </div>
                      {isAdmin && (
                        <button 
                          onClick={scrollToOwnerHistory}
                          className="flex items-center gap-1.5 text-[10px] font-bold text-primary-600 uppercase tracking-widest hover:bg-primary-50 px-2 py-1 rounded transition-colors border border-primary-100"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          Editar Dívida Inicial
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-white rounded-xl border border-orange-100">
                          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Dívida Inicial</p>
                          <p className="text-lg font-bold text-gray-900">{(unit.pre2024?.initial ?? 0).toFixed(2)}€</p>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-green-100">
                          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Total Amortizado</p>
                          <p className="text-lg font-bold text-green-600">{(unit.pre2024?.paid ?? 0).toFixed(2)}€</p>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-orange-500 rounded-2xl text-white shadow-lg shadow-orange-100">
                        <p className="text-[10px] font-bold uppercase opacity-80 mb-1">Saldo Devedor Histórico</p>
                        <div className="flex justify-between items-end">
                          <p className="text-3xl font-black">{(unit.pre2024?.remaining ?? 0).toFixed(2)}€</p>
                          {isAdmin && (unit.pre2024?.remaining ?? 0) > 0 && (
                            <button 
                              onClick={() => router.push(`/dashboard/payments?unitId=${id}&month=PREV-DEBT`)}
                              className="bg-white text-orange-600 text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg hover:bg-orange-50 transition-all active:scale-95 shadow-sm"
                            >
                              Registar Amortização
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment History Sub-section */}
                  {unit.pre2024?.payments && unit.pre2024.payments.length > 0 && (
                    <div className="border-t border-orange-100 bg-orange-50/20">
                      <div className="px-6 py-3">
                        <p className="text-[10px] font-black text-orange-800 uppercase tracking-widest">Pagamentos Registados</p>
                      </div>
                      <div className="divide-y divide-orange-100 max-h-[200px] overflow-y-auto">
                        {unit.pre2024.payments.map(p => (
                          <div key={p.id} className="px-6 py-2 flex justify-between items-center hover:bg-orange-50/50 cursor-pointer" onClick={() => openTxPanel({id: p.id} as any)}>
                            <div>
                              <p className="text-xs font-bold text-gray-700">{p.description}</p>
                              <p className="text-[9px] text-gray-400 font-bold uppercase">{new Date(p.date).toLocaleDateString('pt-PT')}</p>
                            </div>
                            <p className="text-xs font-black text-green-600">+{p.amount.toFixed(2)}€</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Fee History Section */}
                <FeeHistoryManager
                  unitId={id}
                  feeHistory={feeHistory}
                  defaultFee={unit.monthlyFee}
                  readOnly={!isAdmin}
                  onUpdate={handleFeeHistoryUpdate}
                />

                {/* Extra Charges Section */}
                <ExtraChargesManager
                  unitId={id}
                  extraCharges={extraCharges}
                  readOnly={!isAdmin}
                  onUpdate={handleExtraChargesUpdate}
                />
              </div>

              <div className="space-y-8">
                {/* Owner History Card */}
                <div className="card scroll-mt-8" ref={ownerHistoryRef}>
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <h2 className="text-xl font-bold">Histórico de Proprietários</h2>
                    </div>
                    {isAdmin && (
                      <button 
                        type="button"
                        onClick={() => setOwners([...owners, { id: '', name: '', unitId: id, previousDebt: 0 }])}
                        className="text-primary-600 text-xs font-bold uppercase tracking-widest hover:underline"
                      >
                        + Adicionar
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {owners.sort((a, b) => (b.startMonth || '').localeCompare(a.startMonth || '')).map((owner, idx) => (
                      <div key={owner.id || idx} className={`p-4 rounded-2xl border ${!owner.endMonth ? 'border-primary-200 bg-primary-50/30 shadow-sm' : 'border-gray-100 bg-gray-50/30'}`}>
                        <div className="flex justify-between items-start mb-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${!owner.endMonth ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                            {!owner.endMonth ? 'Atual' : 'Anterior'}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400 font-bold">
                            {owner.startMonth || '???'} → {owner.endMonth || 'Presente'}
                          </span>
                        </div>
                        <input 
                          type="text" className="bg-transparent border-none p-0 font-bold text-gray-900 w-full focus:ring-0" 
                          value={owner.name} 
                          onChange={e => updateOwnerField(owners.indexOf(owner), 'name', e.target.value)}
                          placeholder="Nome do Proprietário"
                          disabled={!isAdmin}
                        />
                        <div className="grid grid-cols-2 gap-4 mt-3">
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Início</label>
                            <input 
                              type="text" className="input text-xs h-8" 
                              value={owner.startMonth || ''} 
                              onChange={e => updateOwnerField(owners.indexOf(owner), 'startMonth', e.target.value)}
                              placeholder="AAAA-MM"
                              disabled={!isAdmin}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Fim</label>
                            <input 
                              type="text" className="input text-xs h-8" 
                              value={owner.endMonth || ''} 
                              onChange={e => updateOwnerField(owners.indexOf(owner), 'endMonth', e.target.value)}
                              placeholder="AAAA-MM (vazio=atual)"
                              disabled={!isAdmin}
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase text-orange-600 font-black">Dívida Inicial Transitada (Pre-2024)</label>
                            <div className="relative mt-1">
                              <input 
                                type="number" step="0.01" className="input text-xs h-9 border-orange-200 focus:ring-orange-500 focus:border-orange-500 pl-8 font-bold text-gray-900 bg-orange-50/20" 
                                value={owner.previousDebt ?? 0} 
                                onChange={e => updateOwnerField(owners.indexOf(owner), 'previousDebt', parseFloat(e.target.value) || 0)}
                                disabled={!isAdmin}
                              />
                              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-orange-400 font-bold text-xs">€</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Overlays / Panels */}
          {historyPanelOpen && (
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex justify-end">
              <div className="w-full max-w-md bg-white h-full shadow-2xl animate-in slide-in-from-right duration-300">
                <HistoryEditPanel
                  key={historyPanelMonth}
                  unitId={id}
                  month={historyPanelMonth}
                  expectedBreakdown={expectedBreakdown[historyPanelMonth] || null}
                  ownerId={selectedOwnerId || undefined}
                  onSave={handleHistoryPanelSave}
                  onClose={() => setHistoryPanelOpen(false)}
                />
              </div>
            </div>
          )}

          {selectedTx && (
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex justify-end">
              <div className="w-full max-w-md bg-white h-full shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto">
                <TransactionEditPanel
                  transaction={selectedTx}
                  units={allUnits}
                  creditors={creditors}
                  onSave={() => { setSelectedTx(null); fetchUnit(); fetchMonthlyStatus(); fetchPaymentHistory(); }}
                  onDelete={() => { setSelectedTx(null); fetchUnit(); fetchMonthlyStatus(); fetchPaymentHistory(); }}
                  onClose={() => setSelectedTx(null)}
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
