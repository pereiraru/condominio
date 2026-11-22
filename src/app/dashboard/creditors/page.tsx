'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import CreditorDiscrepanciesPanel from '@/components/CreditorDiscrepanciesPanel';
import { Creditor } from '@/lib/types';

const CATEGORIES = [
  { value: 'electricity', label: 'Eletricidade', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { value: 'water', label: 'Água', icon: 'M20 13c0 5-3.5 7.5-7.66 7.5c-4.17 0-7.67-2.5-7.67-7.5c0-4.17 3.5-6.67 7.67-10.83c4.16 4.16 7.66 6.66 7.66 10.83z' },
  { value: 'gas', label: 'Gás', icon: 'M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z' },
  { value: 'maintenance', label: 'Manutenção', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
  { value: 'insurance', label: 'Seguro', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.213-2.035-.598-2.944z' },
  { value: 'cleaning', label: 'Limpeza', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { value: 'elevator', label: 'Elevador', icon: 'M8 9l4-4 4 4m0 6l-4 4-4-4' },
  { value: 'bank_fee', label: 'Taxa Bancária', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { value: 'savings', label: 'Poupança / Fundo Reserva', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { value: 'other', label: 'Outro', icon: 'M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z' },
];

function getCategoryInfo(value: string) {
  return CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1];
}

interface EnhancedCreditor extends Creditor {
  isFixed: boolean;
  currentAmountDue?: number | null;
  paidThisMonth?: number;
  paidThisYear?: number;
  pendingInvoicesCount?: number;
  pendingInvoicesTotal?: number;
  totalInvoicesCount?: number;
}

export default function CreditorsPage() {
  const [creditors, setCreditors] = useState<EnhancedCreditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [discrepancyCounts, setDiscrepancyCounts] = useState<Record<string, { unresolved: number; resolved: number }>>({});
  const handleCountsChange = useCallback((counts: Record<string, { unresolved: number; resolved: number }>) => {
    setDiscrepancyCounts(counts);
  }, []);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'other',
    amountDue: '',
    isFixed: false,
    email: '',
    telefone: '',
    nib: '',
  });
  
  const router = useRouter();

  async function fetchCreditors() {
    try {
      const res = await fetch('/api/creditors');
      if (res.ok) {
        setCreditors(await res.json());
      }
    } catch (error) {
      console.error('Error fetching creditors:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCreditors();
  }, []);

  const filteredCreditors = useMemo(() => {
    if (!searchTerm) return creditors;
    const s = searchTerm.toLowerCase();
    return creditors.filter(c => 
      c.name.toLowerCase().includes(s) || 
      c.description?.toLowerCase().includes(s) ||
      getCategoryInfo(c.category).label.toLowerCase().includes(s)
    );
  }, [creditors, searchTerm]);

  function resetForm() {
    setFormData({
      name: '',
      description: '',
      category: 'other',
      amountDue: '',
      isFixed: false,
      email: '',
      telefone: '',
      nib: '',
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/creditors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowModal(false);
        resetForm();
        fetchCreditors();
      } else {
        const data = await res.json();
        alert(`Erro: ${data.error}`);
      }
    } catch {
      alert('Erro ao criar credor');
    } finally {
      setSaving(false);
    }
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const rawMonth = now.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '');
  const currentMonthLabel = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1);

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="app-main">
        <div className="app-container">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Credores</h1>
              <p className="text-gray-500 mt-1">Gestão de fornecedores e prestadores de serviços</p>
            </div>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              <span>Novo Credor</span>
            </button>
          </div>

          {/* Verification / Discrepancies Checklist */}
          <CreditorDiscrepanciesPanel showCreditorLink onCountsChange={handleCountsChange} />

          {/* Search */}
          <div className="mb-6">
            <div className="relative group max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 group-focus-within:text-primary-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input
                type="text"
                placeholder="Procurar credor, descrição ou categoria..."
                className="input pl-10 bg-white border-gray-200 focus:ring-primary-500 focus:border-primary-500 transition-all shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-500 font-medium">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
              A carregar credores...
            </div>
          ) : filteredCreditors.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-500">
              Nenhum credor encontrado para a pesquisa atual.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCreditors.map((creditor) => {
                const cat = getCategoryInfo(creditor.category);
                const monthlyDue = creditor.currentAmountDue ?? creditor.amountDue ?? 0;
                const paidThisMonth = creditor.paidThisMonth ?? 0;
                const paidThisYear = creditor.paidThisYear ?? 0;
                const pendingInvoicesCount = creditor.pendingInvoicesCount ?? 0;
                const pendingInvoicesTotal = creditor.pendingInvoicesTotal ?? 0;
                const totalInvoicesCount = creditor.totalInvoicesCount ?? 0;
                const isOverdue = creditor.isFixed && monthlyDue > 0 && paidThisMonth < monthlyDue * 0.95;
                const hasPendingInvoices = pendingInvoicesTotal > 0.01;
                const hasAlert = isOverdue || hasPendingInvoices;

                const iconColors = hasAlert
                  ? 'bg-red-50 text-red-600'
                  : creditor.isFixed
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-blue-50 text-blue-600';

                const statusText = hasPendingInvoices
                  ? `${pendingInvoicesTotal.toFixed(2)}€ por pagar`
                  : isOverdue
                    ? 'Pagamento Pendente'
                    : creditor.isFixed
                      ? 'Regularizado'
                      : 'Variável';

                const statusTextColor = hasAlert
                  ? 'text-red-600'
                  : creditor.isFixed
                    ? 'text-emerald-600'
                    : 'text-blue-600';

                const statusCircleColors = hasAlert
                  ? 'bg-red-50 text-red-600 border border-red-100'
                  : creditor.isFixed
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                    : 'bg-blue-50 text-blue-600 border border-blue-100';

                return (
                  <div
                    key={creditor.id}
                    className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary-200 transition-all duration-200 cursor-pointer px-5 py-3.5"
                    onClick={() => router.push(`/dashboard/creditors/${creditor.id}`)}
                  >
                    {/* Line 1: Main Info, Monthly Value, YTD Paid & Status */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconColors}`}>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={cat.icon} />
                          </svg>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-gray-900 group-hover:text-primary-600 transition-colors">
                              {creditor.name}
                            </h3>
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              {cat.label}
                            </span>
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                                creditor.isFixed
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : 'bg-blue-50 text-blue-700 border-blue-100'
                              }`}
                            >
                              {creditor.isFixed ? 'Avença Fixa' : 'Variável'}
                            </span>
                            {(discrepancyCounts[creditor.id]?.unresolved ?? 0) > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                {discrepancyCounts[creditor.id].unresolved} a verificar
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-6 sm:gap-8 ml-auto">
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                            {creditor.isFixed ? 'Avença Mensal' : 'Média Mensal'}
                          </p>
                          <p className="text-sm font-bold text-gray-900 tabular-nums">
                            {creditor.isFixed
                              ? monthlyDue > 0
                                ? `${monthlyDue.toFixed(2)}€`
                                : '—'
                              : `${(creditor.avgMonthly ?? 0).toFixed(2)}€`}
                            <span className="text-[11px] font-normal text-gray-400 ml-0.5">/ mês</span>
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                            Pago {currentYear}
                          </p>
                          <p className="text-sm font-bold text-gray-900 tabular-nums">
                            {paidThisYear.toFixed(2)}€
                          </p>
                        </div>

                        <div className="flex items-center gap-2.5 min-w-[165px] justify-end">
                          <div className="text-right">
                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Estado</p>
                            <p className={`text-xs font-bold tabular-nums ${statusTextColor}`}>
                              {statusText}
                            </p>
                          </div>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${statusCircleColors}`}>
                            {hasAlert ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Line 2: Monthly Payment, Historical Total, Invoices & Details */}
                    <div className="mt-2.5 pt-2.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 text-xs text-gray-500">
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                        <span>
                          Pago ({currentMonthLabel}):{' '}
                          <strong className="text-gray-700 font-semibold tabular-nums">
                            {paidThisMonth.toFixed(2)}€
                          </strong>
                        </span>
                        <span>
                          Total Histórico:{' '}
                          <strong className="text-gray-700 font-semibold tabular-nums">
                            {(creditor.totalPaid ?? 0).toFixed(2)}€
                          </strong>
                        </span>
                        <span>
                          Faturas:{' '}
                          <strong className="text-gray-700 font-semibold tabular-nums">
                            {totalInvoicesCount}
                          </strong>
                          {pendingInvoicesCount > 0 && (
                            <span className="ml-1.5 text-amber-700 font-semibold tabular-nums">
                              ({pendingInvoicesCount} pendente{pendingInvoicesCount > 1 ? 's' : ''} — {pendingInvoicesTotal.toFixed(2)}€)
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-400 ml-auto">
                        {creditor.description && (
                          <span className="truncate max-w-[260px] text-gray-500 italic" title={creditor.description}>
                            {creditor.description}
                          </span>
                        )}
                        {creditor.email && (
                          <span className="truncate max-w-[190px]" title={creditor.email}>
                            {creditor.email}
                          </span>
                        )}
                        {creditor.telefone && <span>Tel: {creditor.telefone}</span>}
                        {creditor.nib && <span className="text-gray-500 font-medium">IBAN registado</span>}
                        <span className="text-primary-600 font-semibold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                          Ver →
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h2 className="text-xl font-bold text-gray-900">Novo Credor</h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="label">Nome *</label>
                    <input type="text" className="input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: EDP Comercial" required />
                  </div>
                  <div>
                    <label className="label">Categoria *</label>
                    <select className="input" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} required>
                      {CATEGORIES.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <label className="font-bold text-sm text-gray-700">Tipo de Despesa</label>
                    <div className="flex bg-white p-1 rounded-lg border border-gray-200">
                      <button type="button" onClick={() => setFormData({...formData, isFixed: false})} className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${!formData.isFixed ? 'bg-gray-100 text-gray-900' : 'text-gray-400'}`}>Variável</button>
                      <button type="button" onClick={() => setFormData({...formData, isFixed: true})} className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${formData.isFixed ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>Fixo</button>
                    </div>
                  </div>
                  {formData.isFixed && (
                    <div className="mt-2">
                      <label className="label">Valor Mensal (EUR)</label>
                      <input type="number" step="0.01" className="input" value={formData.amountDue} onChange={e => setFormData({ ...formData, amountDue: e.target.value })} placeholder="0.00" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="label">Telefone</label>
                    <input type="text" className="input" value={formData.telefone} onChange={e => setFormData({ ...formData, telefone: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input type="email" className="input" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">NIB Bancário</label>
                    <input type="text" className="input font-mono" value={formData.nib} onChange={e => setFormData({ ...formData, nib: e.target.value })} />
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <button type="button" className="btn-secondary px-8" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary px-8" disabled={saving}>{saving ? 'A guardar...' : 'Criar Credor'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}