'use client';

import { useState } from 'react';
import { ExtraCharge } from '@/lib/types';

interface ExtraChargesManagerProps {
  unitId: string;
  extraCharges: ExtraCharge[];
  readOnly?: boolean;
  onUpdate: () => void;
}

export default function ExtraChargesManager({
  unitId,
  extraCharges,
  readOnly = false,
  onUpdate,
}: ExtraChargesManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    effectiveFrom: '',
    effectiveTo: '',
    isGlobal: false,
  });

  // Separate global and unit-specific charges
  const globalCharges = extraCharges.filter((c) => c.unitId === null);
  const unitCharges = extraCharges.filter((c) => c.unitId === unitId);

  const sortedGlobal = [...globalCharges].sort((a, b) =>
    b.effectiveFrom.localeCompare(a.effectiveFrom)
  );
  const sortedUnit = [...unitCharges].sort((a, b) =>
    b.effectiveFrom.localeCompare(a.effectiveFrom)
  );

  function resetForm() {
    setFormData({ description: '', amount: '', effectiveFrom: '', effectiveTo: '', isGlobal: false });
    setEditingId(null);
    setShowForm(false);
  }

  function openEdit(item: ExtraCharge) {
    setFormData({
      description: item.description,
      amount: item.amount.toString(),
      effectiveFrom: item.effectiveFrom,
      effectiveTo: item.effectiveTo || '',
      isGlobal: item.unitId === null,
    });
    setEditingId(item.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const url = editingId
        ? `/api/extra-charges/${editingId}`
        : '/api/extra-charges';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: formData.isGlobal ? null : unitId,
          description: formData.description,
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
    if (!confirm('Tem a certeza que quer eliminar esta despesa extra?')) return;

    try {
      const res = await fetch(`/api/extra-charges/${id}`, { method: 'DELETE' });
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

  function renderTable(items: ExtraCharge[], title: string, isGlobalSection: boolean) {
    if (items.length === 0 && readOnly) return null;

    return (
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          {title}
          {isGlobalSection && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
              Aplica-se a todas as fracoes
            </span>
          )}
        </h3>

        {items.length === 0 ? (
          <p className="text-gray-400 text-sm py-2">Sem despesas registadas</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">Descricao</th>
                <th className="pb-2 font-medium">Valor</th>
                <th className="pb-2 font-medium">De</th>
                <th className="pb-2 font-medium">Ate</th>
                {!readOnly && <th className="pb-2 font-medium w-20"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2 text-gray-900">{item.description}</td>
                  <td className="py-2 font-semibold text-orange-600">+{item.amount.toFixed(2)} EUR</td>
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
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Despesas Extra</h2>
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
        Valores adicionados a quota mensal (reparacoes, melhorias, etc.)
      </p>

      {showForm && !readOnly && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2">
              <label className="label">Descricao</label>
              <input
                type="text"
                className="input"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Reparacao bomba de agua"
                required
              />
            </div>
            <div>
              <label className="label">Valor Mensal (EUR)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isGlobal}
                  onChange={(e) => setFormData({ ...formData, isGlobal: e.target.checked })}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <span className="text-sm text-gray-700">Aplicar a todas as fracoes</span>
              </label>
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
          <div className="flex gap-2">
            <button type="submit" className="btn-primary text-sm" disabled={saving}>
              {saving ? 'A guardar...' : editingId ? 'Atualizar' : 'Adicionar'}
            </button>
            <button type="button" className="btn-secondary text-sm" onClick={resetForm}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {renderTable(sortedGlobal, 'Despesas Globais', true)}
      {renderTable(sortedUnit, 'Despesas desta Fracao', false)}

      {sortedGlobal.length === 0 && sortedUnit.length === 0 && readOnly && (
        <p className="text-gray-400 text-sm text-center py-4">
          Sem despesas extra registadas
        </p>
      )}
    </div>
  );
}
