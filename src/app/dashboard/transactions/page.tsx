'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TransactionList from '@/components/TransactionList';
import TransactionEditPanel from '@/components/TransactionEditPanel';
import MonthCalendar from '@/components/MonthCalendar';
import { Transaction, Unit, Creditor, MonthPaymentStatus } from '@/lib/types';

interface DescriptionMapping {
  id: string;
  pattern: string;
  unitId: string | null;
  creditorId: string | null;
  unit?: { code: string } | null;
  creditor?: { name: string } | null;
}

const PAGE_SIZE = 50;

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [units, setUnits] = useState<Unit[]>([]);
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [mappings, setMappings] = useState<DescriptionMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState({
    type: '',
    startDate: '',
    endDate: '',
    entityFilter: '', // 'unit:id', 'creditor:id', 'unassigned', or ''
  });

  // Mappings panel state
  const [showMappingsPanel, setShowMappingsPanel] = useState(false);
  const [editingMapping, setEditingMapping] = useState<DescriptionMapping | null>(null);
  const [mappingForm, setMappingForm] = useState({ pattern: '', type: 'unit' as 'unit' | 'creditor', targetId: '' });

  // Side panel state
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    type: 'payment',
    unitId: '',
    creditorId: '',
  });
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [monthStatus, setMonthStatus] = useState<MonthPaymentStatus[]>([]);
  const [expectedAmount, setExpectedAmount] = useState(0);

  useEffect(() => {
    fetchUnits();
    fetchCreditors();
    fetchMappings();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [currentPage]);

  // Fetch monthly status when unit/creditor or year changes
  useEffect(() => {
    const targetId = formData.type === 'payment' ? formData.unitId : formData.creditorId;
    if (targetId) {
      fetchMonthlyStatus(targetId, formData.type === 'payment' ? 'unitId' : 'creditorId');
    } else {
      setMonthStatus([]);
      setExpectedAmount(0);
    }
  }, [formData.unitId, formData.creditorId, formData.type, calendarYear]);

  // Auto-suggest months when amount changes
  useEffect(() => {
    if (!formData.amount || !expectedAmount || selectedMonths.length > 0) return;

    const amount = parseFloat(formData.amount);
    if (amount <= 0 || expectedAmount <= 0) return;

    const numMonths = Math.round(amount / expectedAmount);
    if (numMonths <= 0) return;

    const unpaidMonths = monthStatus
      .filter((s) => !s.isPaid)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(0, numMonths)
      .map((s) => s.month);

    if (unpaidMonths.length > 0) {
      setSelectedMonths(unpaidMonths);
    }
  }, [formData.amount, monthStatus, expectedAmount]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', PAGE_SIZE.toString());
      params.set('offset', ((currentPage - 1) * PAGE_SIZE).toString());
      if (filter.type) params.set('type', filter.type);
      if (filter.startDate) params.set('startDate', filter.startDate);
      if (filter.endDate) params.set('endDate', filter.endDate);

      if (filter.entityFilter === 'unassigned') {
        params.set('unassigned', 'true');
      } else if (filter.entityFilter.startsWith('unit:')) {
        params.set('unitId', filter.entityFilter.replace('unit:', ''));
      } else if (filter.entityFilter.startsWith('creditor:')) {
        params.set('creditorId', filter.entityFilter.replace('creditor:', ''));
      }

      const res = await fetch(`/api/transactions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
        setTotalTransactions(data.total || 0);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnits = async () => {
    try {
      const res = await fetch('/api/units');
      if (res.ok) setUnits(await res.json());
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  };

  const fetchCreditors = async () => {
    try {
      const res = await fetch('/api/creditors');
      if (res.ok) setCreditors(await res.json());
    } catch (error) {
      console.error('Error fetching creditors:', error);
    }
  };

  const fetchMappings = async () => {
    try {
      const res = await fetch('/api/mappings');
      if (res.ok) setMappings(await res.json());
    } catch (error) {
      console.error('Error fetching mappings:', error);
    }
  };

  const fetchMonthlyStatus = async (id: string, paramName: string) => {
    try {
      const res = await fetch(`/api/monthly-status?${paramName}=${id}&year=${calendarYear}`);
      if (res.ok) {
        const data = await res.json();
        setMonthStatus(data.months);
        setExpectedAmount(data.expectedAmount);
      }
    } catch (error) {
      console.error('Error fetching monthly status:', error);
    }
  };

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchTransactions();
  };

  const totalPages = Math.ceil(totalTransactions / PAGE_SIZE);

  // Mapping functions
  const handleEditMapping = (mapping: DescriptionMapping) => {
    setEditingMapping(mapping);
    setMappingForm({
      pattern: mapping.pattern,
      type: mapping.unitId ? 'unit' : 'creditor',
      targetId: mapping.unitId || mapping.creditorId || '',
    });
  };

  const handleDeleteMapping = async (id: string) => {
    if (!confirm('Tem certeza que deseja eliminar este mapeamento?')) return;
    try {
      const res = await fetch(`/api/mappings/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchMappings();
      }
    } catch (error) {
      console.error('Error deleting mapping:', error);
    }
  };

  const handleSaveMapping = async () => {
    if (!mappingForm.pattern || !mappingForm.targetId) return;
    try {
      const body = {
        pattern: mappingForm.pattern,
        unitId: mappingForm.type === 'unit' ? mappingForm.targetId : null,
        creditorId: mappingForm.type === 'creditor' ? mappingForm.targetId : null,
      };

      if (editingMapping) {
        const res = await fetch(`/api/mappings/${editingMapping.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          setEditingMapping(null);
          setMappingForm({ pattern: '', type: 'unit', targetId: '' });
          fetchMappings();
        }
      } else {
        const res = await fetch('/api/mappings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          setMappingForm({ pattern: '', type: 'unit', targetId: '' });
          fetchMappings();
          fetchTransactions();
        }
      }
    } catch (error) {
      console.error('Error saving mapping:', error);
    }
  };

  // Side panel logic
  async function openPanel(tx: Transaction) {
    // Fetch full transaction with allocations
    try {
      const res = await fetch(`/api/transactions/${tx.id}`);
      if (res.ok) {
        const fullTx = await res.json();
        setSelectedTx(fullTx);
      } else {
        setSelectedTx(tx);
      }
    } catch {
      setSelectedTx(tx);
    }
  }

  function closePanel() {
    setSelectedTx(null);
  }

  function resetForm() {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      description: '',
      amount: '',
      type: 'payment',
      unitId: '',
      creditorId: '',
    });
    setSelectedMonths([]);
    setMonthStatus([]);
    setExpectedAmount(0);
    setCalendarYear(new Date().getFullYear());
  }

  function handleToggleMonth(month: string) {
    setSelectedMonths((prev) =>
      prev.includes(month)
        ? prev.filter((m) => m !== month)
        : [...prev, month].sort()
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const amount = parseFloat(formData.amount);
      const finalAmount = formData.type === 'expense' ? -Math.abs(amount) : Math.abs(amount);

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formData.date,
          description: formData.description,
          amount: finalAmount,
          type: formData.type,
          category: formData.type === 'payment' ? 'monthly_fee' : null,
          unitId: formData.type === 'payment' ? formData.unitId || null : null,
          creditorId: formData.type === 'expense' ? formData.creditorId || null : null,
          months: selectedMonths.length > 0 ? selectedMonths : undefined,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        resetForm();
        fetchTransactions();
      } else {
        const data = await res.json();
        alert(`Erro: ${data.error}`);
      }
    } catch {
      alert('Erro ao criar transação');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      {/* Mappings Panel */}
      {showMappingsPanel && (
        <div className="w-80 bg-white border-r border-gray-100 p-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Mapeamentos</h2>
            <button
              className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
              onClick={() => setShowMappingsPanel(false)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Add/Edit Mapping Form */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              {editingMapping ? 'Editar Mapeamento' : 'Novo Mapeamento'}
            </h3>
            <div className="space-y-2">
              <input
                type="text"
                className="input text-sm"
                placeholder="Padrao (ex: DD-OTIS)"
                value={mappingForm.pattern}
                onChange={(e) => setMappingForm({ ...mappingForm, pattern: e.target.value })}
              />
              <select
                className="input text-sm"
                value={mappingForm.type}
                onChange={(e) => setMappingForm({ ...mappingForm, type: e.target.value as 'unit' | 'creditor', targetId: '' })}
              >
                <option value="unit">Fração</option>
                <option value="creditor">Credor</option>
              </select>
              <select
                className="input text-sm"
                value={mappingForm.targetId}
                onChange={(e) => setMappingForm({ ...mappingForm, targetId: e.target.value })}
              >
                <option value="">-- Selecionar --</option>
                {mappingForm.type === 'unit'
                  ? units.map((u) => (
                      <option key={u.id} value={u.id}>{u.code}</option>
                    ))
                  : creditors.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
              </select>
              <div className="flex gap-2">
                <button
                  className="btn-primary text-sm flex-1"
                  onClick={handleSaveMapping}
                  disabled={!mappingForm.pattern || !mappingForm.targetId}
                >
                  {editingMapping ? 'Guardar' : 'Adicionar'}
                </button>
                {editingMapping && (
                  <button
                    className="btn-secondary text-sm"
                    onClick={() => {
                      setEditingMapping(null);
                      setMappingForm({ pattern: '', type: 'unit', targetId: '' });
                    }}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Mappings List */}
          <div className="space-y-2">
            {mappings.map((m) => (
              <div key={m.id} className="p-2 bg-white border border-gray-200 rounded-lg text-sm">
                <div className="font-medium text-gray-900 truncate" title={m.pattern}>
                  {m.pattern}
                </div>
                <div className="text-gray-500 text-xs">
                  → {m.unit?.code || m.creditor?.name || 'N/A'}
                </div>
                <div className="flex gap-2 mt-1">
                  <button
                    className="text-xs text-primary-600 hover:underline"
                    onClick={() => handleEditMapping(m)}
                  >
                    Editar
                  </button>
                  <button
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => handleDeleteMapping(m.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
            {mappings.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">Sem mapeamentos</p>
            )}
          </div>
        </div>
      )}

      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">Transações</h1>
            <button
              className={`text-sm px-3 py-1.5 rounded-lg transition-all ${showMappingsPanel ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              onClick={() => setShowMappingsPanel(!showMappingsPanel)}
            >
              Mapeamentos
            </button>
          </div>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            + Nova Transação
          </button>
        </div>

        <form onSubmit={handleFilter} className="card mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="label">Tipo</label>
              <select
                value={filter.type}
                onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                className="input"
              >
                <option value="">Todos</option>
                <option value="payment">Pagamento</option>
                <option value="expense">Despesa</option>
                <option value="fee">Taxa</option>
                <option value="transfer">Transferencia</option>
              </select>
            </div>
            <div>
              <label className="label">Fração/Credor</label>
              <select
                value={filter.entityFilter}
                onChange={(e) => setFilter({ ...filter, entityFilter: e.target.value })}
                className="input"
              >
                <option value="">Todos</option>
                <option value="unassigned">Sem atribuição</option>
                <optgroup label="Frações">
                  {units.map((u) => (
                    <option key={u.id} value={`unit:${u.id}`}>{u.code}</option>
                  ))}
                </optgroup>
                <optgroup label="Credores">
                  {creditors.map((c) => (
                    <option key={c.id} value={`creditor:${c.id}`}>{c.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="label">Data Início</label>
              <input
                type="date"
                value={filter.startDate}
                onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Data Fim</label>
              <input
                type="date"
                value={filter.endDate}
                onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">&nbsp;</label>
              <button type="submit" className="btn-secondary w-full">
                Filtrar
              </button>
            </div>
          </div>
        </form>

        <div className={`${selectedTx ? 'flex gap-6' : ''}`}>
          <div className={`card ${selectedTx ? 'flex-1' : ''}`}>
            {loading ? (
              <p className="text-gray-500">A carregar...</p>
            ) : (
              <>
                <TransactionList
                  transactions={transactions}
                  onRowClick={openPanel}
                  selectedId={selectedTx?.id}
                />

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-500">
                      A mostrar {(currentPage - 1) * PAGE_SIZE + 1} a {Math.min(currentPage * PAGE_SIZE, totalTransactions)} de {totalTransactions}
                    </p>
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        Anterior
                      </button>
                      <span className="px-3 py-1 text-sm">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        Seguinte
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Side Panel */}
          {selectedTx && (
            <TransactionEditPanel
              transaction={selectedTx}
              units={units}
              creditors={creditors}
              onSave={() => { closePanel(); fetchTransactions(); }}
              onDelete={() => { closePanel(); fetchTransactions(); }}
              onClose={closePanel}
            />
          )}
        </div>

        {/* Modal Nova Transação */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Nova Transação</h2>
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="label">Tipo *</label>
                    <select
                      className="input"
                      value={formData.type}
                      onChange={(e) => {
                        setFormData({ ...formData, type: e.target.value, unitId: '', creditorId: '' });
                        setSelectedMonths([]);
                        setMonthStatus([]);
                      }}
                      required
                    >
                      <option value="payment">Pagamento (entrada)</option>
                      <option value="expense">Despesa (saida)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Data *</label>
                    <input
                      type="date"
                      className="input"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {formData.type === 'payment' && (
                  <div className="mb-4">
                    <label className="label">Fração *</label>
                    <select
                      className="input"
                      value={formData.unitId}
                      onChange={(e) => {
                        setFormData({ ...formData, unitId: e.target.value });
                        setSelectedMonths([]);
                      }}
                      required
                    >
                      <option value="">-- Selecionar fração --</option>
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.code} {unit.owners && unit.owners.length > 0 ? `(${unit.owners[0].name})` : ''} - {unit.monthlyFee} EUR/mes
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.type === 'expense' && (
                  <div className="mb-4">
                    <label className="label">Credor *</label>
                    <select
                      className="input"
                      value={formData.creditorId}
                      onChange={(e) => {
                        setFormData({ ...formData, creditorId: e.target.value });
                        setSelectedMonths([]);
                      }}
                      required
                    >
                      <option value="">-- Selecionar credor --</option>
                      {creditors.map((creditor) => (
                        <option key={creditor.id} value={creditor.id}>
                          {creditor.name} {creditor.amountDue ? `- ${creditor.amountDue} EUR` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="label">Valor (EUR) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="input"
                      value={formData.amount}
                      onChange={(e) => {
                        setFormData({ ...formData, amount: e.target.value });
                        setSelectedMonths([]);
                      }}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Descrição *</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Descrição"
                      required
                    />
                  </div>
                </div>

                {/* Month Calendar */}
                {((formData.type === 'payment' && formData.unitId) ||
                  (formData.type === 'expense' && formData.creditorId)) && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <label className="label mb-2">Meses de referencia</label>
                    <MonthCalendar
                      year={calendarYear}
                      onYearChange={setCalendarYear}
                      monthStatus={monthStatus}
                      selectedMonths={selectedMonths}
                      onToggleMonth={handleToggleMonth}
                    />
                    {selectedMonths.length > 0 && formData.amount && (
                      <div className="mt-3 p-2 bg-blue-50 rounded text-sm text-blue-700">
                        {selectedMonths.length} mes(es) selecionado(s) &mdash;{' '}
                        {(parseFloat(formData.amount) / selectedMonths.length).toFixed(2)} EUR/mes
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => { setShowModal(false); resetForm(); }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={saving}
                  >
                    {saving ? 'A guardar...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
