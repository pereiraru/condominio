'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
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
  paidThisMonth?: number;
}

export default function CreditorsPage() {
  const [creditors, setCreditors] = useState<EnhancedCreditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
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

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Credores</h1>
              <p className="text-gray-500 mt-1">Gestão de fornecedores e prestadores de serviços</p>
            </div>
            <button className="btn-primary flex items-center gap-2" onClick={() => setShowModal(true)}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Novo Credor
            </button>
          </div>

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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredCreditors.map((creditor) => {
                const cat = getCategoryInfo(creditor.category);
                // Fixed costs that haven't been paid this month turn red
                const isOverdue = creditor.isFixed && (creditor.amountDue ?? 0) > 0 && (creditor.paidThisMonth ?? 0) < (creditor.amountDue ?? 0) * 0.95;

                return (
                  <div 
                    key={creditor.id} 
                    className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-primary-100 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col"
                    onClick={() => router.push(`/dashboard/creditors/${creditor.id}`)}
                  >
                    <div className="p-5 flex-1">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isOverdue ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={cat.icon} /></svg>
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary-600 transition-colors">{creditor.name}</h3>
                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{cat.label}</p>
                          </div>
                        </div>
                        {creditor.amountDue && (
                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-900">{creditor.amountDue.toFixed(2)}€</p>
                            <p className="text-[10px] text-gray-400 uppercase font-bold">{creditor.isFixed ? '/ mês' : 'esperado'}</p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="p-3 bg-gray-50/50 rounded-xl border border-gray-100/50">
                          <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Total Pago (Histórico)</p>
                          <p className="text-sm font-semibold text-gray-700">{(creditor.totalPaid ?? 0).toFixed(2)}€</p>
                        </div>
                        
                        {creditor.description && (
                          <p className="text-xs text-gray-500 italic line-clamp-2">{creditor.description}</p>
                        )}
                      </div>
                    </div>

                    <div className={`mt-auto px-5 py-3 border-t flex justify-between items-center ${isOverdue ? 'bg-red-50/30 border-red-100' : 'bg-blue-50/30 border-blue-100'}`}>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Estado Mensal</span>
                        <span className={`text-xs font-bold ${isOverdue ? 'text-red-600' : 'text-blue-600'}`}>
                          {isOverdue ? 'Pagamento Pendente' : (creditor.isFixed ? 'Regularizado' : 'Variável')}
                        </span>
                      </div>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        {isOverdue ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        )}
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
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
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