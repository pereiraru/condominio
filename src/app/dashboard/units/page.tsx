'use client';

import { useEffect, useState, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import { Unit } from '@/lib/types';

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    } catch (error) {
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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Fraccoes</h1>
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xlsm,.xls"
              className="hidden"
            />
            <button
              className="btn-secondary"
              onClick={handleImportClick}
              disabled={importing}
            >
              {importing ? 'A importar...' : 'Importar Excel'}
            </button>
            <button className="btn-primary">+ Nova Fraccao</button>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500">A carregar...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {units.map((unit) => (
              <div key={unit.id} className="card hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {unit.code}
                    </h3>
                    {unit.floor && (
                      <p className="text-gray-500">{unit.floor}o Andar</p>
                    )}
                  </div>
                  <span className="bg-primary-100 text-primary-700 px-3 py-1 rounded-full text-sm font-medium">
                    {unit.monthlyFee.toFixed(2)} EUR/mes
                  </span>
                </div>
                {unit.description && (
                  <p className="mt-2 text-gray-600">{unit.description}</p>
                )}
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
      </main>
    </div>
  );
}
