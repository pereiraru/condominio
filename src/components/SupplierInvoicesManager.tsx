'use client';

import { useEffect, useState, useCallback } from 'react';
import { SupplierInvoice } from '@/lib/types';

interface SupplierInvoicesManagerProps {
  creditorId: string;
  category: string;
  readOnly?: boolean;
  onSummaryChange?: (pendingTotal: number, pendingCount: number) => void;
}

export default function SupplierInvoicesManager({
  creditorId,
  category,
  readOnly = false,
  onSummaryChange,
}: SupplierInvoicesManagerProps) {
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [description, setDescription] = useState('');
  const [amountDue, setAmountDue] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [invoiceNumber, setInvoiceNumber] = useState('');

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch(`/api/supplier-invoices?creditorId=${encodeURIComponent(creditorId)}`);
      if (res.ok) {
        const data: SupplierInvoice[] = await res.json();
        setInvoices(data);
        const pending = data.filter((inv) => !inv.isPaid);
        const pendingTotal = pending.reduce((sum, inv) => sum + Math.max(0, inv.amountDue - inv.amountPaid), 0);
        onSummaryChange?.(pendingTotal, pending.length);
      }
    } catch (error) {
      console.error('Error fetching supplier invoices:', error);
    } finally {
      setLoading(false);
    }
  }, [creditorId, onSummaryChange]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = parseFloat(amountDue);
    if (!description.trim() || isNaN(parsedAmount) || parsedAmount <= 0) return;

    setSaving(true);
    try {
      const res = await fetch('/api/supplier-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditorId,
          category,
          description: description.trim(),
          amountDue: parsedAmount,
          date,
          invoiceNumber: invoiceNumber.trim() || null,
          isPaid: false,
          amountPaid: 0,
        }),
      });
      if (res.ok) {
        setDescription('');
        setAmountDue('');
        setInvoiceNumber('');
        setShowForm(false);
        await fetchInvoices();
      }
    } finally {
      setSaving(false);
    }
  }

  async function togglePaid(inv: SupplierInvoice) {
    const nextPaid = !inv.isPaid;
    const res = await fetch(`/api/supplier-invoices/${inv.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isPaid: nextPaid,
        amountPaid: nextPaid ? inv.amountDue : 0,
      }),
    });
    if (res.ok) await fetchInvoices();
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover esta despesa/fatura?')) return;
    const res = await fetch(`/api/supplier-invoices/${id}`, { method: 'DELETE' });
    if (res.ok) await fetchInvoices();
  }

  const pendingInvoices = invoices.filter((i) => !i.isPaid);
  const pendingTotal = pendingInvoices.reduce((s, i) => s + Math.max(0, i.amountDue - i.amountPaid), 0);

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900">Faturas / Despesas Pendentes</h2>
          {pendingTotal > 0 ? (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
              Por pagar: {pendingTotal.toFixed(2)}€
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
              Sem pendências
            </span>
          )}
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="btn-secondary text-xs py-1.5 px-3 font-bold"
          >
            {showForm ? 'Cancelar' : '+ Nova Despesa Pendente'}
          </button>
        )}
      </div>

      {showForm && !readOnly && (
        <form onSubmit={handleCreate} className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="label text-xs">Descrição</label>
            <input
              type="text"
              className="input text-sm"
              placeholder="Ex.: Limpeza de vidros"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label text-xs">Valor (€)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="input text-sm"
              placeholder="100.00"
              value={amountDue}
              onChange={(e) => setAmountDue(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label text-xs">Data</label>
            <input
              type="date"
              className="input text-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="label text-xs">N.º Fatura (opcional)</label>
            <input
              type="text"
              className="input text-sm"
              placeholder="FT 2026/..."
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
          </div>
          <div className="md:col-span-2 flex items-end justify-end">
            <button type="submit" disabled={saving} className="btn-primary text-xs py-2 px-5">
              {saving ? 'A guardar...' : 'Guardar Despesa'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 py-3">A carregar...</p>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-3">Nenhuma fatura ou despesa pendente registada.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {invoices.map((inv) => (
            <div key={inv.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${inv.isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
                    {inv.isPaid ? 'Pago' : 'Pendente'}
                  </span>
                  <p className="text-sm font-bold text-gray-900">{inv.description}</p>
                  {inv.invoiceNumber && (
                    <span className="text-xs text-gray-400 font-mono">({inv.invoiceNumber})</span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {new Date(inv.date).toLocaleDateString('pt-PT')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-black ${inv.isPaid ? 'text-gray-400 line-through' : 'text-red-600'}`}>
                  {inv.amountDue.toFixed(2)}€
                </span>
                {!readOnly && (
                  <>
                    <button
                      type="button"
                      onClick={() => togglePaid(inv)}
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-colors ${
                        inv.isPaid
                          ? 'border-gray-200 text-gray-500 hover:bg-gray-50'
                          : 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
                      }`}
                    >
                      {inv.isPaid ? 'Reabrir' : 'Marcar Pago'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(inv.id)}
                      className="text-xs text-gray-400 hover:text-red-600 px-1.5 py-1"
                      title="Remover"
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
