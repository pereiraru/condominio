'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { Budget, BudgetLine } from '@/lib/types';

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    year: new Date().getFullYear() + 1,
    notes: '',
    lines: [
      { category: 'manutencao', description: 'Manutenção Elevador', monthlyAmount: 0, annualAmount: 0 },
      { category: 'eletricidade', description: 'Eletricidade (Escadas)', monthlyAmount: 0, annualAmount: 0 },
      { category: 'limpeza', description: 'Limpeza do Prédio', monthlyAmount: 0, annualAmount: 0 },
    ]
  });

  useEffect(() => {
    fetchBudgets();
  }, []);

  async function fetchBudgets() {
    try {
      const res = await fetch('/api/budgets');
      if (res.ok) setBudgets(await res.json());
    } finally {
      setLoading(false);
    }
  }

  function addLine() {
    setFormData({
      ...formData,
      lines: [...formData.lines, { category: 'other', description: '', monthlyAmount: 0, annualAmount: 0 }]
    });
  }

  function updateLine(index: number, field: string, value: string | number) {
    const newLines = [...formData.lines];
    const line = { ...newLines[index], [field]: value };
    
    if (field === 'monthlyAmount') {
      line.annualAmount = Number(value) * 12;
    } else if (field === 'annualAmount') {
      line.monthlyAmount = Number(value) / 12;
    }
    
    newLines[index] = line;
    setFormData({ ...formData, lines: newLines });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowModal(false);
        fetchBudgets();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Orçamentos Anuais</h1>
            <button className="btn-primary" onClick={() => setShowModal(true)}>+ Novo Orçamento</button>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {budgets.map(budget => (
              <div key={budget.id} className="card">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black text-gray-900">Exercício {budget.year}</h2>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Total Anual Estimado</p>
                    <p className="text-xl font-black text-primary-600">
                      {budget.lines?.reduce((sum, l) => sum + l.annualAmount, 0).toFixed(2)}€
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-100 uppercase text-[10px] font-bold">
                        <th className="pb-2">Descrição</th>
                        <th className="pb-2 text-right">Mensal</th>
                        <th className="pb-2 text-right">Anual</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {budget.lines?.map(line => (
                        <tr key={line.id}>
                          <td className="py-3 text-gray-700 font-medium">{line.description}</td>
                          <td className="py-3 text-right text-gray-600">{line.monthlyAmount.toFixed(2)}€</td>
                          <td className="py-3 text-right font-bold text-gray-900">{line.annualAmount.toFixed(2)}€</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h2 className="text-xl font-bold text-gray-900">Configurar Orçamento</h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6">
                <div>
                  <label className="label">Ano do Exercício</label>
                  <input type="number" className="input font-bold text-lg w-32" value={formData.year} onChange={e => setFormData({...formData, year: parseInt(e.target.value)})} required />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Rubricas de Despesa</h3>
                    <button type="button" onClick={addLine} className="text-primary-600 text-xs font-bold">+ Adicionar</button>
                  </div>
                  
                  {formData.lines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-3 items-end p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="col-span-6">
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Descrição</label>
                        <input type="text" className="input text-sm h-9" value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} placeholder="Ex: Eletricidade" required />
                      </div>
                      <div className="col-span-3">
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Mensal</label>
                        <input type="number" step="0.01" className="input text-sm h-9" value={line.monthlyAmount} onChange={e => updateLine(idx, 'monthlyAmount', e.target.value)} required />
                      </div>
                      <div className="col-span-3">
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Anual</label>
                        <input type="number" step="0.01" className="input text-sm h-9 font-bold" value={line.annualAmount} onChange={e => updateLine(idx, 'annualAmount', e.target.value)} required />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <button type="button" className="btn-secondary px-8" onClick={() => setShowModal(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary px-8" disabled={saving}>Criar Orçamento</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
