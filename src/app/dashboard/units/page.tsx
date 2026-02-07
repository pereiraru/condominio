'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
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
  const [searchTerm, setSearchString] = useState('');
  
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

  const filteredUnits = useMemo(() => {
    if (!searchTerm) return units;
    const s = searchTerm.toLowerCase();
    return units.filter(u => 
      u.code.toLowerCase().includes(s) || 
      u.owners?.some(o => o.name.toLowerCase().includes(s)) ||
      u.description?.toLowerCase().includes(s)
    );
  }, [units, searchTerm]);

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

  function formatUnitCode(code: string) {
    // Exact matches
    const exacts: Record<string, string> = {
      'RCD': 'RC Direito',
      'RCE': 'RC Esquerdo',
      'CVD': 'Cave Direito',
      'CVE': 'Cave Esquerdo',
      'CV': 'Cave',
    };
    if (exacts[code]) return exacts[code];

    // Garage handling
    if (code.startsWith('G')) {
      const num = code.replace(/^Garagem\s*/i, '').replace(/^G/, '');
      return `Garagem ${num}`;
    }
    
    // Standard floor logic (e.g. 1D -> 1º Direito)
    const match = code.match(/^(\d+)([DE])$/);
    if (match) {
      const floor = match[1];
      const side = match[2] === 'D' ? 'Direito' : 'Esquerdo';
      return `${floor}º ${side}`;
    }
    
    return code;
  }

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Frações</h1>
              <p className="text-gray-500 mt-1">Gestão de unidades e proprietários do edifício</p>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx,.xlsm,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12,application/vnd.ms-excel"
                className="hidden"
              />
              <button
                className="btn-secondary flex-1 md:flex-none justify-center gap-2"
                onClick={handleImportClick}
                disabled={importing}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {importing ? 'A importar...' : 'Importar Excel'}
              </button>
              <button className="btn-primary flex-1 md:flex-none justify-center gap-2" onClick={() => setShowModal(true)}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nova Unidade
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mb-6">
            <div className="relative group max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 group-focus-within:text-primary-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Procurar fração, proprietário ou descrição..."
                className="input pl-10 bg-white border-gray-200 focus:ring-primary-500 focus:border-primary-500 transition-all shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchString(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
              <p className="text-gray-500 font-medium">A carregar frações...</p>
            </div>
          ) : (
            <>
              {filteredUnits.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-fr">
                  {filteredUnits.map((unit) => {
                    const currentOwner = unit.owners?.find(o => !o.endMonth) || unit.owners?.[0];
                    // RED if previous months unpaid, GREEN if only current month unpaid
                    const hasPastDebt = (unit.pastDebt ?? 0) > 0.01;
                    const totalOwed = unit.totalOwed ?? 0;
                    const isGaragem = unit.code.startsWith('G') || unit.code.toLowerCase().startsWith('garagem');
                    
                    return (
                      <div 
                        key={unit.id} 
                        className={`group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-primary-100 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col ${isGaragem ? 'scale-[0.95] ring-1 ring-gray-100' : ''}`}
                        onClick={() => router.push(`/dashboard/units/${unit.id}`)}
                      >
                        <div className={`${isGaragem ? 'p-3' : 'p-5'} flex-1`}>
                          <div className={`flex justify-between items-start ${isGaragem ? 'mb-2' : 'mb-4'}`}>
                            <div className="flex items-center gap-3">
                              <div className={`${isGaragem ? 'w-8 h-8' : 'w-10 h-10'} rounded-lg flex items-center justify-center ${hasPastDebt ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                {isGaragem ? (
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                  </svg>
                                ) : (
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                  </svg>
                                )}
                              </div>
                              <div>
                                <h3 className={`${isGaragem ? 'text-sm' : 'text-lg'} font-bold text-gray-900 group-hover:text-primary-600 transition-colors`}>
                                  {formatUnitCode(unit.code)}
                                </h3>
                                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                                  {isGaragem ? 'Lugar de Estacionamento' : (unit.floor != null ? `${unit.floor}º Andar` : 'Fração Autónoma')}
                                </p>
                              </div>
                            </div>
                            {!isGaragem && (
                              <div className="text-right">
                                <p className="text-sm font-bold text-gray-900">{unit.monthlyFee.toFixed(2)}€</p>
                                <p className="text-[10px] text-gray-400 uppercase font-bold">/ mês</p>
                              </div>
                            )}
                          </div>

                          <div className={isGaragem ? 'space-y-1' : 'space-y-3'}>
                            <div className={`${isGaragem ? 'p-2' : 'p-3'} bg-gray-50/50 rounded-xl border border-gray-100/50`}>
                              <p className="text-[9px] text-gray-400 font-bold uppercase mb-0.5">Proprietário</p>
                              <p className={`${isGaragem ? 'text-xs' : 'text-sm'} font-semibold text-gray-700 truncate`}>
                                {currentOwner?.name || 'N/A'}
                              </p>
                            </div>

                            {!isGaragem && (
                              <div className="flex flex-wrap gap-2">
                                {unit.email && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-600 text-[10px] font-bold uppercase">
                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    Email
                                  </span>
                                )}
                                {unit.telefone && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-purple-50 text-purple-600 text-[10px] font-bold uppercase">
                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 011.94.86l-.85 4.48a1 1 0 01-1.03.79H6.22a9.62 9.62 0 004.42 4.42v-2.04a1 1 0 01.79-1.03l4.48-.85a1 1 0 011.23.96V19a2 2 0 01-2 2h-1.27a9.91 9.91 0 01-9.91-9.91V5z" />
                                    </svg>
                                    Tel
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className={`mt-auto ${isGaragem ? 'px-3 py-2' : 'px-5 py-3'} border-t flex justify-between items-center ${hasPastDebt ? 'bg-red-50/30 border-red-100' : 'bg-green-50/30 border-green-100'}`}>
                          <div className="flex flex-col">
                            <span className="text-[9px] text-gray-400 font-bold uppercase">Financeiro</span>
                            <span className={`text-[10px] font-bold ${hasPastDebt ? 'text-red-600' : 'text-green-600'}`}>
                              {totalOwed > 0.01 ? `${totalOwed.toFixed(2)}€` : 'Ok'}
                            </span>
                          </div>
                          <div className={`${isGaragem ? 'w-6 h-6' : 'w-8 h-8'} rounded-full flex items-center justify-center ${hasPastDebt ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                            {hasPastDebt ? (
                              <svg className={`${isGaragem ? 'w-3 h-3' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ) : (
                              <svg className={`${isGaragem ? 'w-3 h-3' : 'w-4 h-4'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-3xl border-2 border-dashed border-gray-200 py-24 text-center">
                  <div className="mx-auto w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhuma fração encontrada</h3>
                  <p className="text-gray-500 max-w-xs mx-auto mb-8">
                    {searchTerm 
                      ? `Não encontramos resultados para "${searchTerm}". Tente outro termo.` 
                      : 'Comece por adicionar frações manualmente ou importar de um ficheiro Excel.'}
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button className="btn-primary" onClick={() => setShowModal(true)}>+ Nova Fração</button>
                    {!searchTerm && <button className="btn-secondary" onClick={handleImportClick}>Importar Excel</button>}
                  </div>
                </div>
              )}
            </>
          )}

          {importResult && (
            <div className={`mt-6 p-4 rounded-2xl flex items-center gap-3 ${importResult.startsWith('Sucesso') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={importResult.startsWith('Sucesso') ? "M5 13l4 4L19 7" : "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"} />
              </svg>
              <span className="font-semibold text-sm">{importResult}</span>
            </div>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Nova Fração</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Preencha os dados da nova unidade</p>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div>
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

                  <div>
                    <label className="label">Andar</label>
                    <input
                      type="number"
                      className="input"
                      value={formData.floor}
                      onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                      placeholder="Ex: 1, 2, 3"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex justify-between items-center mb-2">
                      <label className="label mb-0">Proprietários</label>
                      <button
                        type="button"
                        className="text-primary-600 hover:text-primary-800 text-xs font-bold uppercase tracking-wider"
                        onClick={addOwner}
                      >
                        + Adicionar
                      </button>
                    </div>
                    <div className="space-y-2">
                      {owners.map((owner, index) => (
                        <div key={index} className="flex gap-2">
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
                              className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                              onClick={() => removeOwner(index)}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b pb-2">Informação de Contacto</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="label">Telefone</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.telefone}
                        onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                        placeholder="Ex: 912 345 678"
                      />
                    </div>
                    <div>
                      <label className="label">Email</label>
                      <input
                        type="email"
                        className="input"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="Ex: joao@exemplo.com"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">NIB Bancário</label>
                      <input
                        type="text"
                        className="input font-mono text-sm"
                        value={formData.nib}
                        onChange={(e) => setFormData({ ...formData, nib: e.target.value })}
                        placeholder="0000 0000 0000 0000 0000 0"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6 mt-8">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest border-b pb-2">Configuração Financeira</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="label">Descrição da Fração</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Ex: Tipologia T3, Garagem, Arrecadação..."
                      />
                    </div>
                    <div>
                      <label className="label">Quota Mensal (EUR) *</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          className="input pr-12 font-bold"
                          value={formData.monthlyFee}
                          onChange={(e) => setFormData({ ...formData, monthlyFee: e.target.value })}
                          required
                        />
                        <span className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 font-bold">€</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-end mt-12 pb-2">
                  <button
                    type="button"
                    className="btn-secondary px-8"
                    onClick={() => { setShowModal(false); resetForm(); }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary px-8"
                    disabled={saving}
                  >
                    {saving ? 'A guardar...' : 'Criar Fração'}
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