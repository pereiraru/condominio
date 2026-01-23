'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Creditor } from '@/lib/types';

const CATEGORIES = [
  { value: 'electricity', label: 'Electricidade' },
  { value: 'water', label: 'Agua' },
  { value: 'gas', label: 'Gas' },
  { value: 'maintenance', label: 'Manutencao' },
  { value: 'insurance', label: 'Seguro' },
  { value: 'cleaning', label: 'Limpeza' },
  { value: 'elevator', label: 'Elevador' },
  { value: 'bank_fee', label: 'Taxa Bancaria' },
  { value: 'other', label: 'Outro' },
];

function getCategoryLabel(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export default function CreditorsPage() {
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
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

  function resetForm() {
    setFormData({
      name: '',
      description: '',
      category: 'other',
      amountDue: '',
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
    } catch (error) {
      alert('Erro ao criar credor');
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(creditorId: string, file: File) {
    setUploadingFor(creditorId);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/creditors/${creditorId}/attachments`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        fetchCreditors();
      } else {
        const data = await res.json();
        alert(`Erro: ${data.error}`);
      }
    } catch (error) {
      alert('Erro ao carregar ficheiro');
    } finally {
      setUploadingFor(null);
    }
  }

  function handleAttachClick(creditorId: string) {
    setUploadingFor(creditorId);
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadingFor) return;
    handleFileUpload(uploadingFor, file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Credores</h1>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            + Novo Credor
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          className="hidden"
        />

        {loading ? (
          <p className="text-gray-500">A carregar...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {creditors.map((creditor) => (
              <div key={creditor.id} className="card-hover" onClick={() => router.push(`/dashboard/creditors/${creditor.id}`)}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {creditor.name}
                    </h3>
                    <span className="text-sm text-gray-400">
                      {getCategoryLabel(creditor.category)}
                    </span>
                  </div>
                  {creditor.amountDue && (
                    <span className="bg-orange-50 text-orange-600 px-3 py-1 rounded-lg text-sm font-medium">
                      {creditor.amountDue.toFixed(2)} EUR
                    </span>
                  )}
                </div>

                {creditor.description && (
                  <p className="mt-3 text-gray-600">{creditor.description}</p>
                )}

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-400">
                  {creditor.telefone && <span>Tel: {creditor.telefone}</span>}
                  {creditor.email && <span>Email: {creditor.email}</span>}
                  {creditor.nib && <span>NIB: {creditor.nib}</span>}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm">
                  <div>
                    <span className="text-gray-400">Total pago: </span>
                    <span className="font-medium text-gray-700">
                      {(creditor.totalPaid ?? 0).toFixed(2)} EUR
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Media/mes: </span>
                    <span className="font-medium text-gray-700">
                      {(creditor.avgMonthly ?? 0).toFixed(2)} EUR
                    </span>
                  </div>
                </div>

                {creditor.attachments && creditor.attachments.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-1">Anexos:</p>
                    <div className="flex flex-wrap gap-1">
                      {creditor.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={`/uploads/attachments/${att.filename}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-600 hover:text-gray-900"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {att.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3">
                  <button
                    className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
                    onClick={(e) => { e.stopPropagation(); handleAttachClick(creditor.id); }}
                    disabled={uploadingFor === creditor.id}
                  >
                    {uploadingFor === creditor.id ? 'A carregar...' : '+ Anexar ficheiro'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && creditors.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-gray-500 mb-4">Sem credores registados</p>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              + Novo Credor
            </button>
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Novo Credor</h2>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="label">Nome *</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome do credor"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="label">Categoria *</label>
                  <select
                    className="input"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="label">Descricao</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descricao do servico"
                  />
                </div>

                <div className="mb-4">
                  <label className="label">Valor a pagar (EUR)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={formData.amountDue}
                    onChange={(e) => setFormData({ ...formData, amountDue: e.target.value })}
                    placeholder="Valor regular esperado"
                  />
                </div>

                <div className="mb-4">
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Email de contacto"
                  />
                </div>

                <div className="mb-4">
                  <label className="label">Telefone</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="Numero de telefone"
                  />
                </div>

                <div className="mb-6">
                  <label className="label">NIB</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.nib}
                    onChange={(e) => setFormData({ ...formData, nib: e.target.value })}
                    placeholder="NIB bancario"
                  />
                </div>

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
