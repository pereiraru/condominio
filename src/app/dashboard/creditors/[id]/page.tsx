'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import MonthCalendar from '@/components/MonthCalendar';
import { Creditor, Transaction, MonthPaymentStatus } from '@/lib/types';

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

export default function CreditorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [creditor, setCreditor] = useState<Creditor & { transactions?: Transaction[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'other',
    amountDue: '',
    email: '',
    telefone: '',
    nib: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calendar and summary state
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [monthStatus, setMonthStatus] = useState<MonthPaymentStatus[]>([]);

  useEffect(() => {
    fetchCreditor();
  }, [id]);

  // Fetch monthly status when creditor loads or year changes
  useEffect(() => {
    if (id) {
      fetchMonthlyStatus();
    }
  }, [id, calendarYear]);

  async function fetchMonthlyStatus() {
    try {
      const res = await fetch(`/api/monthly-status?creditorId=${id}&year=${calendarYear}`);
      if (res.ok) {
        const data = await res.json();
        setMonthStatus(data.months);
      }
    } catch (error) {
      console.error('Error fetching monthly status:', error);
    }
  }

  async function fetchCreditor() {
    try {
      const res = await fetch(`/api/creditors/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCreditor(data);
        setFormData({
          name: data.name || '',
          description: data.description || '',
          category: data.category || 'other',
          amountDue: data.amountDue?.toString() || '',
          email: data.email || '',
          telefone: data.telefone || '',
          nib: data.nib || '',
        });
      } else {
        router.push('/dashboard/creditors');
      }
    } catch (error) {
      console.error('Error fetching creditor:', error);
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
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        fetchCreditor();
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

  async function handleFileUpload(file: File) {
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch(`/api/creditors/${id}/attachments`, {
        method: 'POST',
        body: fd,
      });

      if (res.ok) {
        fetchCreditor();
      } else {
        alert('Erro ao carregar ficheiro');
      }
    } catch (error) {
      alert('Erro ao carregar ficheiro');
    } finally {
      setUploadingFile(false);
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

  if (!creditor) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="flex items-center gap-4 mb-6">
          <button
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-all"
            onClick={() => router.push('/dashboard/creditors')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">{creditor.name}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Edit Form */}
          <div className="lg:col-span-2">
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Dados do Credor</h2>
              <form onSubmit={handleSave}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Nome *</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Categoria *</label>
                    <select
                      className="input"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Despesa esperada (EUR)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={formData.amountDue}
                      onChange={(e) => setFormData({ ...formData, amountDue: e.target.value })}
                      placeholder="Valor regular esperado"
                    />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input
                      type="email"
                      className="input"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Telefone</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">NIB</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.nib}
                      onChange={(e) => setFormData({ ...formData, nib: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label">Descrição</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'A guardar...' : 'Guardar alteracoes'}
                  </button>
                </div>
              </form>
            </div>

            {/* Transactions */}
            <div className="card mt-4">
              <h2 className="text-lg font-semibold mb-4">Transacoes</h2>
              {creditor.transactions && creditor.transactions.length > 0 ? (
                <div className="overflow-x-auto">
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
                      {creditor.transactions.map((tx: Transaction, i: number) => (
                        <tr key={tx.id} className={`hover:bg-gray-50 transition-colors ${i !== (creditor.transactions?.length ?? 0) - 1 ? 'border-b border-gray-100' : ''}`}>
                          <td className="py-4 text-sm text-gray-500">
                            {new Date(tx.date).toLocaleDateString('pt-PT')}
                          </td>
                          <td className="py-4 text-sm text-gray-400">
                            {tx.referenceMonth || '-'}
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
              ) : (
                <p className="text-gray-400 text-center py-4">Sem transações registadas</p>
              )}
            </div>
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
                const isCurrentYear = calendarYear === currentYear;
                const monthsToCount = isCurrentYear ? currentMonth : 12;
                const expectedPerMonth = creditor.amountDue || 0;
                // Use per-month expected values from monthStatus (historical fees)
                const expectedYTD = monthStatus
                  .filter((_, i) => i < monthsToCount)
                  .reduce((sum, s) => sum + s.expected, 0);
                const paidYTD = monthStatus
                  .filter((s) => {
                    const monthNum = parseInt(s.month.split('-')[1]);
                    return monthNum <= monthsToCount;
                  })
                  .reduce((sum, s) => sum + s.paid, 0);

                return (
                  <div className="space-y-3">
                    {creditor.amountDue && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">Despesa mensal esperada:</span>
                          <span className="font-medium">{expectedPerMonth.toFixed(2)} EUR</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400 text-sm">
                            Esperado ({isCurrentYear ? `ate ${currentMonth} meses` : '12 meses'}):
                          </span>
                          <span className="font-medium">{expectedYTD.toFixed(2)} EUR</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-sm">Pago em {calendarYear}:</span>
                      <span className="font-medium text-red-500">{paidYTD.toFixed(2)} EUR</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-sm">Total historico:</span>
                      <span className="font-medium">{(creditor.totalPaid ?? 0).toFixed(2)} EUR</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-sm">Media mensal:</span>
                      <span className="font-medium">{(creditor.avgMonthly ?? 0).toFixed(2)} EUR</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Month Calendar */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Despesas por Mes</h2>
              <MonthCalendar
                year={calendarYear}
                onYearChange={setCalendarYear}
                monthStatus={monthStatus}
                readOnly
              />
            </div>

            {/* Attachments */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Anexos</h2>
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
              />

              {creditor.attachments && creditor.attachments.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {creditor.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={`/uploads/attachments/${att.filename}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      {att.name}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm mb-4">Sem anexos</p>
              )}

              <button
                className="btn-secondary w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
              >
                {uploadingFile ? 'A carregar...' : '+ Anexar ficheiro'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
