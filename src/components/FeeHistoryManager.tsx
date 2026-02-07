'use client';

import { useState } from 'react';
import { FeeHistory } from '@/lib/types';

interface FeeHistoryManagerProps {
  unitId?: string;
  creditorId?: string;
  feeHistory: FeeHistory[];
  defaultFee: number;
  readOnly?: boolean;
  onUpdate: () => void;
}

export default function FeeHistoryManager({
  unitId,
  creditorId,
  feeHistory,
  defaultFee,
  readOnly = false,
  onUpdate,
}: FeeHistoryManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    effectiveFrom: '',
    effectiveTo: '',
  });

  const sortedHistory = [...feeHistory].sort((a, b) =>
    b.effectiveFrom.localeCompare(a.effectiveFrom)
  );

  function resetForm() {
    setFormData({ amount: '', effectiveFrom: '', effectiveTo: '' });
    setEditingId(null);
    setShowForm(false);
  }

  function openEdit(item: FeeHistory) {
    setFormData({
      amount: item.amount.toString(),
      effectiveFrom: item.effectiveFrom,
      effectiveTo: item.effectiveTo || '',
    });
    setEditingId(item.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      let url = editingId ? `/api/fee-history/${editingId}` : '';
      if (!editingId) {
        if (unitId) url = `/api/units/${unitId}/fee-history`;
        else if (creditorId) url = `/api/creditors/${creditorId}/fee-history`;
      }
      
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: formData.amount,
          effectiveFrom: formData.effectiveFrom,
          effectiveTo: formData.effectiveTo || null,
        }),
      });

      if (res.ok) {
        resetForm();
        onUpdate();
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

  async function handleDelete(id: string) {
    if (!confirm('Tem a certeza que quer eliminar este registo?')) return;

    try {
      const res = await fetch(`/api/fee-history/${id}`, { method: 'DELETE' });
      if (res.ok) {
        onUpdate();
      } else {
        alert('Erro ao eliminar');
      }
    } catch {
      alert('Erro ao eliminar');
    }
  }

  function formatMonth(month: string) {
    const [year, m] = month.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${months[parseInt(m) - 1]} ${year}`;
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Historico de Quotas</h2>
        {!readOnly && !showForm && (
          <button
            type="button"
            className="text-primary-600 hover:text-primary-800 text-sm font-medium"
            onClick={() => setShowForm(true)}
          >
            + Adicionar
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Quota base atual: <span className="font-semibold">{defaultFee.toFixed(2)} EUR</span>
      </p>

      {showForm && !readOnly && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Valor (EUR)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">De (YYYY-MM)</label>
              <input
                type="month"
                className="input"
                value={formData.effectiveFrom}
                onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Ate (YYYY-MM)</label>
              <input
                type="month"
                className="input"
                value={formData.effectiveTo}
                onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value })}
                placeholder="Vazio = em curso"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" className="btn-primary text-sm" disabled={saving}>
              {saving ? 'A guardar...' : editingId ? 'Atualizar' : 'Adicionar'}
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={resetForm}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {sortedHistory.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">
          Sem alteracoes registadas. A quota base sera usada.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">Valor</th>
                <th className="pb-2 font-medium">De</th>
                <th className="pb-2 font-medium">Ate</th>
                {!readOnly && <th className="pb-2 font-medium w-20"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedHistory.map((item) => (
                <tr key={item.id}>
                  <td className="py-2 font-semibold">{item.amount.toFixed(2)} EUR</td>
                  <td className="py-2 text-gray-600">{formatMonth(item.effectiveFrom)}</td>
                  <td className="py-2 text-gray-600">
                    {item.effectiveTo ? formatMonth(item.effectiveTo) : (
                      <span className="text-green-600">Em curso</span>
                    )}
                  </td>
                  {!readOnly && (
                    <td className="py-2">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="text-gray-400 hover:text-primary-600 p-1"
                          onClick={() => openEdit(item)}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-red-600 p-1"
                          onClick={() => handleDelete(item.id)}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
