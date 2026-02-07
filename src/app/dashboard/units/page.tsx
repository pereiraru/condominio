'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Unit } from '@/lib/types';

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function fetchUnits() {
    try {
      const res = await fetch('/api/units');
      if (res.ok) {
        setUnits(await res.json());
      }
    } catch (error) {
      console.error('Error fetching units:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUnits();
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setImportResult(`Sucesso! ${data.message}`);
        fetchUnits();
      } else {
        setImportResult(`Erro: ${data.error}`);
      }
    } catch {
      setImportResult('Erro ao importar ficheiro');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
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

  function resetForm() {
    setFormData({
      code: '',
      floor: '',
      description: '',
      monthlyFee: '45',
      nib: '',
      telefone: '',
      email: '',
    });
    setOwners(['']);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const validOwners = owners.filter((name) => name.trim() !== '');

      const res = await fetch('/api/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: formData.code,
          floor: formData.floor ? parseInt(formData.floor) : null,
          description: formData.description || null,
          monthlyFee: formData.monthlyFee,
          nib: formData.nib || null,
          telefone: formData.telefone || null,
          email: formData.email || null,
          owners: validOwners,
        }),
      });

      if (res.ok) {
        setShowModal(false);
        resetForm();
        fetchUnits();
      } else {
        const data = await res.json();
        alert(`Erro: ${data.error}`);
      }
    } catch {
      alert('Erro ao criar fração');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Frações</h1>
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xlsm,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12,application/vnd.ms-excel"
              className="hidden"
            />
            <button
              className="btn-secondary"
              onClick={handleImportClick}
              disabled={importing}
            >
              {importing ? 'A importar...' : 'Importar Excel'}
            </button>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              + Nova Fração
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500">A carregar...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {units.map((unit) => (
              <div key={unit.id} className="card-hover" onClick={() => router.push(`/dashboard/units/${unit.id}`)}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {unit.code}
                    </h3>
                    {unit.floor != null && (
                      <p className="text-sm text-gray-500">{unit.floor}o Andar</p>
                    )}
                  </div>
                  <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-lg text-sm font-medium">
                    {unit.monthlyFee.toFixed(2)} EUR/mes
                  </span>
                </div>

                {unit.owners && unit.owners.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Proprietário</p>
                    <p className="text-gray-700 mt-0.5">
                      {(unit.owners.find(o => !o.endMonth) || unit.owners[0]).name}
                    </p>
                  </div>
                )}

                {unit.description && (
                  <p className="mt-3 text-gray-600">{unit.description}</p>
                )}

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-400">
                  {unit.telefone && <span>Tel: {unit.telefone}</span>}
                  {unit.email && <span>Email: {unit.email}</span>}
                  {unit.nib && <span>NIB: {unit.nib}</span>}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm">
                  <div>
                    <span className="text-gray-400">Pago {new Date().getFullYear()}: </span>
                    <span className="font-medium text-green-600">
                      {(unit.totalPaid ?? 0).toFixed(2)} EUR
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Divida: </span>
                    <span className={`font-medium ${(unit.totalOwed ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {(unit.totalOwed ?? 0).toFixed(2)} EUR
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && units.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-gray-500 mb-4">Sem fraccoes registadas</p>
            <button
              className="btn-primary"
              onClick={handleImportClick}
              disabled={importing}
            >
              {importing ? 'A importar...' : 'Importar do Excel'}
            </button>
          </div>
        )}

        {importResult && (
          <div className={`mt-4 p-4 rounded-lg ${importResult.startsWith('Sucesso') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {importResult}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Nova Fração</h2>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="label">Código *</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Ex: 1D, 2E, RCE"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="label">Andar</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.floor}
                    onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                    placeholder="Ex: 1, 2, 3"
                  />
                </div>

                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <label className="label mb-0">Nome(s)</label>
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
                        placeholder="Nome do proprietário"
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

                <div className="mb-4">
                  <label className="label">NIB</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.nib}
                    onChange={(e) => setFormData({ ...formData, nib: e.target.value })}
                    placeholder="NIB bancario"
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
                  <label className="label">Descrição</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição opcional"
                  />
                </div>

                <div className="mb-6">
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
