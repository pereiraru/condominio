'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import MonthCalendar from '@/components/MonthCalendar';
import { Unit, Transaction, MonthPaymentStatus } from '@/lib/types';

export default function UnitDetailPage() {
  const params = useParams();
  const router = useRouter();
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
  const [owners, setOwners] = useState<string[]>(['']);

  // Calendar and summary state
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [monthStatus, setMonthStatus] = useState<MonthPaymentStatus[]>([]);
  const [pastYearsDebt, setPastYearsDebt] = useState(0);

  useEffect(() => {
    fetchUnit();
  }, [id]);

  // Fetch monthly status when unit loads or year changes
  useEffect(() => {
    if (id) {
      fetchMonthlyStatus();
      fetchPastYearsDebt();
    }
  }, [id, calendarYear]);

  async function fetchMonthlyStatus() {
    try {
      const res = await fetch(`/api/monthly-status?unitId=${id}&year=${calendarYear}`);
      if (res.ok) {
        const data = await res.json();
        setMonthStatus(data.months);
      }
    } catch (error) {
      console.error('Error fetching monthly status:', error);
    }
  }

  async function fetchPastYearsDebt() {
    try {
      const res = await fetch(`/api/units/${id}/debt`);
      if (res.ok) {
        const data = await res.json();
        setPastYearsDebt(data.pastYearsDebt);
      }
    } catch (error) {
      console.error('Error fetching past years debt:', error);
    }
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
            ? data.owners.map((o: { name: string }) => o.name)
            : ['']
        );
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
    setOwners([...owners, '']);
  }

  function removeOwner(index: number) {
    if (owners.length <= 1) return;
    setOwners(owners.filter((_, i) => i !== index));
  }

  function updateOwner(index: number, value: string) {
    const updated = [...owners];
    updated[index] = value;
    setOwners(updated);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const validOwners = owners.filter((name) => name.trim() !== '');

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
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 p-8">
          <p className="text-gray-500">A carregar...</p>
        </main>
      </div>
    );
  }

  if (!unit) return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="flex items-center gap-4 mb-6">
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={() => router.push('/dashboard/units')}
          >
            &larr; Voltar
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Fraccao {unit.code}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Edit Form */}
          <div className="lg:col-span-2">
            <div className="card">
              <h2 className="text-lg font-bold mb-4">Dados da Fraccao</h2>
              <form onSubmit={handleSave}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Codigo *</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Andar</label>
                    <input
                      type="number"
                      className="input"
                      value={formData.floor}
                      onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Quota Mensal (EUR) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={formData.monthlyFee}
                      onChange={(e) => setFormData({ ...formData, monthlyFee: e.target.value })}
                      required
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
                    <label className="label">Descricao</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                </div>

                {/* Owners */}
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="label mb-0">Proprietario(s)</label>
                    <button
                      type="button"
                      className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                      onClick={addOwner}
                    >
                      + Adicionar
                    </button>
                  </div>
                  {owners.map((owner, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        className="input flex-1"
                        value={owner}
                        onChange={(e) => updateOwner(index, e.target.value)}
                        placeholder="Nome do proprietario"
                      />
                      {owners.length > 1 && (
                        <button
                          type="button"
                          className="text-red-500 hover:text-red-700 px-2"
                          onClick={() => removeOwner(index)}
                        >
                          x
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex justify-end">
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'A guardar...' : 'Guardar alteracoes'}
                  </button>
                </div>
              </form>
            </div>

            {/* Transactions */}
            <div className="card mt-6">
              <h2 className="text-lg font-bold mb-4">Pagamentos</h2>
              {unit.transactions && unit.transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm text-gray-500 border-b">
                        <th className="pb-3 font-medium">Data</th>
                        <th className="pb-3 font-medium">Mes Ref.</th>
                        <th className="pb-3 font-medium">Descricao</th>
                        <th className="pb-3 font-medium text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {unit.transactions.map((tx: Transaction) => (
                        <tr key={tx.id} className="hover:bg-gray-50">
                          <td className="py-3 text-sm text-gray-600">
                            {new Date(tx.date).toLocaleDateString('pt-PT')}
                          </td>
                          <td className="py-3 text-sm text-gray-500">
                            {tx.referenceMonth || '-'}
                          </td>
                          <td className="py-3 text-sm text-gray-900">
                            {tx.description}
                          </td>
                          <td className={`py-3 text-sm text-right font-medium ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.amount >= 0 ? '+' : ''}{Math.abs(tx.amount).toFixed(2)} EUR
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">Sem pagamentos registados</p>
              )}
            </div>
          </div>

          {/* Sidebar info */}
          <div className="space-y-6">
            {/* Year Summary */}
            <div className="card">
              <h2 className="text-lg font-bold mb-4">Resumo {calendarYear}</h2>
              {(() => {
                const now = new Date();
                const currentYear = now.getFullYear();
                const currentMonth = now.getMonth() + 1; // 1-12

                // Soma total de todos os pagamentos efetuados no ano selecionado.
                const paidYTD = monthStatus.reduce((sum, s) => sum + s.paid, 0);

                let expectedYTD = 0;
                let expectedLabel = '';

                // Use per-month expected values from monthStatus (historical fees)
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

                const totalDebt = yearDebt + pastYearsDebt;

                return (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Quota mensal:</span>
                      <span className="font-medium">{unit.monthlyFee.toFixed(2)} EUR</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">
                        Esperado ({expectedLabel}):
                      </span>
                      <span className="font-medium">{displayExpected.toFixed(2)} EUR</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Pago em {calendarYear}:</span>
                      <span className="font-medium text-green-600">{paidYTD.toFixed(2)} EUR</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Dívida {calendarYear}:</span>
                      <span className={`font-medium ${yearDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {yearDebt.toFixed(2)} EUR
                      </span>
                    </div>
                    
                    {/* Mostra a secção de dívida total apenas se houver alguma dívida. */}
                    {totalDebt > 0 && (
                      <div className="pt-3 border-t border-gray-200">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Dívida anos anteriores:</span>
                          <span className={`font-medium ${pastYearsDebt > 0 ? 'text-red-600' : ''}`}>
                            {pastYearsDebt.toFixed(2)} EUR
                          </span>
                        </div>
                        <div className="flex justify-between mt-2">
                          <span className="text-gray-700 font-medium">Dívida total:</span>
                          <span className="font-bold text-red-600">
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
              <h2 className="text-lg font-bold mb-4">Estado dos Pagamentos</h2>
              <MonthCalendar
                year={calendarYear}
                onYearChange={setCalendarYear}
                monthStatus={monthStatus}
                readOnly
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
