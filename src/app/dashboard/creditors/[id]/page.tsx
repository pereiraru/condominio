'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Sidebar from '@/components/Sidebar';
import TransactionEditPanel from '@/components/TransactionEditPanel';
import FeeHistoryManager from '@/components/FeeHistoryManager';
import { Creditor, Transaction, FeeHistory, DescriptionMapping } from '@/lib/types';

const CATEGORIES = [
  { value: 'electricity', label: 'Eletricidade' },
  { value: 'water', label: 'Água' },
  { value: 'gas', label: 'Gás' },
  { value: 'maintenance', label: 'Manutenção' },
  { value: 'insurance', label: 'Seguro' },
  { value: 'cleaning', label: 'Limpeza' },
  { value: 'elevator', label: 'Elevador' },
  { value: 'bank_fee', label: 'Taxa Bancária' },
  { value: 'other', label: 'Outro' },
];

function getCategoryLabel(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

type TabType = 'geral' | 'historico' | 'config';

interface EnhancedCreditor extends Creditor {
  transactions?: Transaction[];
  descriptionMappings?: DescriptionMapping[];
  isFixed: boolean;
}

export default function CreditorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';
  const id = params.id as string;

  const [creditor, setCreditor] = useState<EnhancedCreditor | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('geral');
  
  const [formData, setFormData] = useState({
    name: '',
    category: 'other',
    description: '',
    amountDue: '',
    isFixed: false,
    email: '',
    telefone: '',
    nib: '',
  });

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [allCreditors, setAllCreditors] = useState<Creditor[]>([]);

  // Calendar and summary state
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [feeHistory, setFeeHistory] = useState<FeeHistory[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Record<string, number>>({});
  const [expectedHistory, setExpectedHistory] = useState<Record<string, number>>({});
  const [yearlyData, setYearlyData] = useState<{
    year: number;
    paid: number;
    expected: number;
    debt: number;
    accumulatedDebt: number;
  }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    fetchCreditor();
    fetchFeeHistory();
    fetchPaymentHistory();
    if (isAdmin) {
      fetchAllCreditors();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isAdmin]);

  async function fetchAllCreditors() {
    try {
      const res = await fetch('/api/creditors');
      if (res.ok) setAllCreditors(await res.json());
    } catch (error) { console.error(error); }
  }

  async function openTxPanel(tx: Transaction) {
    try {
      const res = await fetch(`/api/transactions/${tx.id}`);
      if (res.ok) setSelectedTx(await res.json());
      else setSelectedTx(tx);
    } catch { setSelectedTx(tx); }
  }

  async function fetchPaymentHistory() {
    try {
      const res = await fetch(`/api/creditors/${id}/payment-history`);
      if (res.ok) {
        const data = await res.json();
        setPaymentHistory(data.payments || {});
        setExpectedHistory(data.expected || {});
        setYearlyData(data.yearlyData || []);
      }
    } catch (error) { console.error(error); }
  }

  async function fetchFeeHistory() {
    try {
      const res = await fetch(`/api/creditors/${id}/fee-history`);
      if (res.ok) setFeeHistory(await res.json());
    } catch (error) { console.error(error); }
  }

  async function fetchCreditor() {
    try {
      const res = await fetch(`/api/creditors/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCreditor(data);
        setFormData({
          name: data.name || '',
          category: data.category || 'other',
          description: data.description || '',
          amountDue: data.amountDue?.toString() || '',
          isFixed: data.isFixed || false,
          email: data.email || '',
          telefone: data.telefone || '',
          nib: data.nib || '',
        });
      } else {
        router.push('/dashboard/creditors');
      }
    } catch (error) { 
      console.error(error); 
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/creditors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amountDue: formData.amountDue ? parseFloat(formData.amountDue) : null,
        }),
      });

      if (res.ok) {
        fetchCreditor();
        alert('Guardado com sucesso');
      } else {
        const data = await res.json();
        alert(`Erro: ${data.error}`);
      }
    } catch { alert('Erro ao guardar'); }
    finally { setSaving(false); }
  }

  async function handleFileUpload(file: File) {
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/creditors/${id}/attachments`, { method: 'POST', body: fd });
      if (res.ok) fetchCreditor();
      else alert('Erro ao carregar ficheiro');
    } catch { alert('Erro ao carregar ficheiro'); }
    finally { setUploadingFile(false); }
  }

  if (loading) return <div className="flex min-h-screen"><Sidebar /><main className="flex-1 p-8 text-gray-500">A carregar...</main></div>;
  if (!creditor) return null;

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-red-200">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{creditor.name}</h1>
                <p className="text-gray-500 flex items-center gap-2">
                  <span className="bg-gray-200 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider text-gray-600">
                    {getCategoryLabel(creditor.category)}
                  </span>
                  {creditor.description && <span className="text-gray-400">•</span>}
                  <span>{creditor.description}</span>
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button onClick={() => router.push('/dashboard/creditors')} className="btn-secondary flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Voltar
              </button>
              {isAdmin && (
                <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 px-6">
                  {saving ? 'A guardar...' : 'Guardar Alterações'}
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-1 mb-8 bg-gray-200/50 p-1.5 rounded-2xl w-fit">
            {[
              { id: 'geral', label: 'Dados Gerais', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
              { id: 'historico', label: 'Histórico de Despesas', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
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

          {activeTab === 'geral' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                {/* Creditor Details Card */}
                <div className="card">
                  <h2 className="text-xl font-bold mb-6">Dados do Credor</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="label">Nome do Credor</label>
                      <input type="text" className="input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} disabled={!isAdmin} />
                    </div>
                    <div>
                      <label className="label">Categoria</label>
                      <select className="input" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} disabled={!isAdmin}>
                        {CATEGORIES.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Email</label>
                      <input type="email" className="input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} disabled={!isAdmin} />
                    </div>
                    <div>
                      <label className="label">Telefone</label>
                      <input type="text" className="input" value={formData.telefone} onChange={e => setFormData({...formData, telefone: e.target.value})} disabled={!isAdmin} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">NIB Bancário</label>
                      <input type="text" className="input font-mono" value={formData.nib} onChange={e => setFormData({...formData, nib: e.target.value})} disabled={!isAdmin} />
                    </div>
                  </div>
                </div>

                {/* Fixed vs Variable Section */}
                <div className={`card border-l-4 ${formData.isFixed ? 'border-l-blue-500 bg-blue-50/10' : 'border-l-gray-400 bg-gray-50/10'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold">Tipo de Despesa</h2>
                      <p className="text-sm text-gray-500">Defina se este custo é fixo ou variável</p>
                    </div>
                    <div className="flex items-center gap-3 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                      <button 
                        onClick={() => setFormData({...formData, isFixed: false})}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${!formData.isFixed ? 'bg-gray-100 text-gray-900 shadow-inner' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        Variável
                      </button>
                      <button 
                        onClick={() => setFormData({...formData, isFixed: true})}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${formData.isFixed ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        Fixo / Mensal
                      </button>
                    </div>
                  </div>

                  {formData.isFixed && (
                    <div className="mt-6 animate-in fade-in slide-in-from-top-2">
                      <label className="label">Valor Mensal Esperado</label>
                      <div className="relative max-w-[200px]">
                        <input 
                          type="number" step="0.01" className="input pr-12 font-bold text-lg" 
                          value={formData.amountDue} 
                          onChange={e => setFormData({...formData, amountDue: e.target.value})}
                          disabled={!isAdmin}
                        />
                        <span className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 font-bold">€</span>
                      </div>
                      <p className="text-xs text-blue-600 mt-2 font-medium">Este valor será usado para calcular dívidas e orçamentos.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-8">
                {/* Metrics Card */}
                <div className="card overflow-hidden !p-0">
                  <div className="p-6">
                    <h2 className="text-xl font-bold mb-6">Resumo Financeiro</h2>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 text-sm">Total Pago (Sempre):</span>
                        <span className="font-bold text-gray-900">{(creditor.totalPaid ?? 0).toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 text-sm">Média Mensal:</span>
                        <span className="font-bold text-gray-900">{(creditor.avgMonthly ?? 0).toFixed(2)}€</span>
                      </div>
                      {creditor.isFixed && (
                        <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                          <span className="text-gray-500 text-sm">Valor Fixo Atual:</span>
                          <span className="font-black text-blue-600">{creditor.amountDue?.toFixed(2)}€</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Attachments Card */}
                <div className="card">
                  <h2 className="text-lg font-bold mb-4">Documentos e Anexos</h2>
                  <input type="file" ref={fileInputRef} onChange={e => { const f = e.target.files?.[0]; if(f) handleFileUpload(f); }} className="hidden" />
                  <div className="space-y-2 mb-4">
                    {creditor.attachments?.map(att => (
                      <a key={att.id} href={`/api/documents/attachment?name=${encodeURIComponent(att.filename)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg text-sm text-gray-600 transition-colors border border-gray-100">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <span className="truncate">{att.name}</span>
                      </a>
                    ))}
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} className="btn-secondary w-full text-xs py-2 uppercase tracking-widest font-bold">+ Adicionar Anexo</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'historico' && (
            <div className="space-y-8">
              {/* Payment Grid */}
              <div className="card !p-0 overflow-hidden border border-gray-200">
                <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-900">Grelha de Despesas</h2>
                  <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1">
                    <button onClick={() => setCalendarYear(Math.max(2024, calendarYear-1))} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30" disabled={calendarYear <= 2024}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <span className="px-3 text-sm font-bold text-gray-700">{calendarYear}</span>
                    <button onClick={() => setCalendarYear(calendarYear+1)} className="p-1 hover:bg-gray-100 rounded">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px] border-collapse">
                    <thead>
                      <tr className="text-left text-gray-500 bg-gray-50/50 uppercase text-[9px] font-bold tracking-wider border-b border-gray-200">
                        <th className="py-2 px-3 sticky left-0 bg-gray-50 z-10 border-r border-gray-200">Ano</th>
                        {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map(m => (
                          <th key={m} className="py-2 px-0.5 text-center min-w-[70px] border-r border-gray-100 last:border-r-0">{m}</th>
                        ))}
                        <th className="py-2 px-2 text-right bg-red-50/50 border-l border-gray-200 min-w-[75px]">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(() => {
                        const startYear = Math.max(2024, yearlyData.length > 0 ? Math.min(...yearlyData.map(y => y.year)) : 2024);
                        return Array.from({ length: new Date().getFullYear() - startYear + 1 }, (_, i) => new Date().getFullYear() - i);
                      })().map(year => {
                        const yearData = yearlyData.find(y => y.year === year);
                        return (
                          <tr key={year} className="hover:bg-blue-50/20 transition-colors">
                            <td className="py-3 px-4 font-bold text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-200 text-center">{year}</td>
                            {Array.from({ length: 12 }, (_, m) => {
                              const monthStr = `${year}-${(m + 1).toString().padStart(2, '0')}`;
                              const paid = paymentHistory[monthStr] || 0;
                              const expected = expectedHistory[monthStr] || 0;
                              const isPaidInFull = creditor.isFixed ? (paid >= expected && expected > 0) : paid > 0;
                              const isUnpaid = creditor.isFixed && paid === 0 && expected > 0;

                              return (
                                <td key={monthStr} className={`py-2 px-1 text-center border-r border-gray-100 last:border-r-0 transition-all ${isPaidInFull ? 'bg-green-50/50 text-green-700' : isUnpaid ? 'bg-red-50/50 text-red-400' : ''}`}>
                                  <div className="flex flex-col items-center justify-center min-h-[32px]">
                                    {paid > 0 ? <span className="font-bold">{paid.toFixed(0)}€</span> : expected > 0 ? <span className="text-red-300 font-medium opacity-50">{expected.toFixed(0)}</span> : <span className="text-gray-200">-</span>}
                                  </div>
                                </td>
                              );
                            })}
                            <td className="py-3 px-3 text-right font-bold text-red-600 bg-red-50/20 border-l border-gray-200">
                              {yearData?.paid ? `${yearData.paid.toFixed(0)}€` : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Transactions List */}
              <div className="card">
                <h2 className="text-lg font-bold mb-4">Últimas Transações</h2>
                <div className="divide-y divide-gray-100">
                  {creditor.transactions?.slice(0, 10).map(tx => (
                    <div key={tx.id} className="py-3 flex justify-between items-center group cursor-pointer" onClick={() => isAdmin && openTxPanel(tx)}>
                      <div>
                        <p className="text-sm font-bold text-gray-900 group-hover:text-primary-600 transition-colors">{tx.description}</p>
                        <p className="text-[10px] text-gray-400 uppercase font-bold">{new Date(tx.date).toLocaleDateString('pt-PT')}</p>
                      </div>
                      <p className="text-sm font-black text-red-600">{tx.amount.toFixed(2)}€</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-8">
                {/* Mappings Card */}
                <div className="card">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">Mapeamentos Bancários</h2>
                    <button onClick={() => router.push('/dashboard/transactions')} className="text-primary-600 text-xs font-bold uppercase tracking-widest hover:underline">Gerir</button>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">Palavras-chave para identificação automática no extrato.</p>
                  <div className="space-y-2">
                    {creditor.descriptionMappings?.length ? creditor.descriptionMappings.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 font-mono text-sm font-bold text-gray-700">{m.pattern}</div>
                    )) : <p className="text-sm text-gray-400 italic py-4 text-center">Nenhum mapeamento configurado.</p>}
                  </div>
                </div>

                {/* Fee History Section */}
                {creditor.isFixed && (
                  <FeeHistoryManager
                    creditorId={id}
                    feeHistory={feeHistory}
                    defaultFee={creditor.amountDue || 0}
                    readOnly={!isAdmin}
                    onUpdate={fetchFeeHistory}
                  />
                )}
              </div>
            </div>
          )}

          {selectedTx && (
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex justify-end">
              <div className="w-full max-w-md bg-white h-full shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto">
                <TransactionEditPanel
                  transaction={selectedTx}
                  units={[]}
                  creditors={allCreditors}
                  onSave={() => { setSelectedTx(null); fetchCreditor(); fetchPaymentHistory(); }}
                  onDelete={() => { setSelectedTx(null); fetchCreditor(); fetchPaymentHistory(); }}
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