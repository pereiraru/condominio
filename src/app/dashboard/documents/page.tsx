'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { Document } from '@/lib/types';

const categoryLabels: Record<string, string> = {
  invoice: 'Fatura',
  receipt: 'Recibo',
  minutes: 'Ata',
  convocation: 'Convocatória',
  contract: 'Contrato',
  other: 'Outro',
};

const categoryBadgeStyles: Record<string, string> = {
  convocation: 'bg-blue-50 text-blue-700 border-blue-200',
  minutes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  invoice: 'bg-amber-50 text-amber-800 border-amber-200',
  receipt: 'bg-teal-50 text-teal-700 border-teal-200',
  contract: 'bg-purple-50 text-purple-700 border-purple-200',
  other: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadData, setUploadData] = useState({
    name: '',
    category: 'invoice',
    description: '',
    file: null as File | null,
  });

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        setDocuments(await res.json());
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadData.file) return;

    const formData = new FormData();
    formData.append('file', uploadData.file);
    formData.append('name', uploadData.name);
    formData.append('category', uploadData.category);
    if (uploadData.description) {
      formData.append('description', uploadData.description);
    }

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setShowUpload(false);
        setUploadData({ name: '', category: 'invoice', description: '', file: null });
        fetchDocuments();
      }
    } catch (error) {
      console.error('Error uploading document:', error);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="app-main">
        <div className="app-container space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Documentos</h1>
              <p className="text-sm text-slate-500 mt-1">
                Ficheiros carregados na categoria <strong className="text-slate-700">Ata</strong> ficam automaticamente acessíveis para consulta aos condóminos em <strong className="text-slate-700">Atas</strong>.
              </p>
            </div>
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="btn-primary self-start sm:self-auto"
            >
              + Carregar Documento
            </button>
          </div>

        {showUpload && (
          <form onSubmit={handleUpload} className="card mb-6">
            <h2 className="text-lg font-semibold mb-4">Novo Documento</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Nome</label>
                <input
                  type="text"
                  value={uploadData.name}
                  onChange={(e) =>
                    setUploadData({ ...uploadData, name: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Categoria</label>
                <select
                  value={uploadData.category}
                  onChange={(e) =>
                    setUploadData({ ...uploadData, category: e.target.value })
                  }
                  className="input"
                >
                  {Object.entries(categoryLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label">Descrição (opcional)</label>
                <input
                  type="text"
                  value={uploadData.description}
                  onChange={(e) =>
                    setUploadData({ ...uploadData, description: e.target.value })
                  }
                  className="input"
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Ficheiro</label>
                <input
                  type="file"
                  onChange={(e) =>
                    setUploadData({
                      ...uploadData,
                      file: e.target.files?.[0] ?? null,
                    })
                  }
                  className="input"
                  required
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button type="submit" className="btn-primary">
                Carregar
              </button>
              <button
                type="button"
                onClick={() => setShowUpload(false)}
                className="btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-slate-500">A carregar...</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'Todos', count: documents.length },
                ...Object.entries(categoryLabels).map(([key, label]) => ({
                  key,
                  label,
                  count: documents.filter((d) => d.category === key).length,
                })),
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setCategoryFilter(opt.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    categoryFilter === opt.key
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {opt.label} ({opt.count})
                </button>
              ))}
            </div>

            <div className="card">
              {(() => {
                const visibleDocs =
                  categoryFilter === 'all'
                    ? documents
                    : documents.filter((d) => d.category === categoryFilter);
                if (visibleDocs.length === 0) {
                  return (
                    <p className="text-slate-500 text-center py-8 text-sm">
                      Sem documentos nesta categoria.
                    </p>
                  );
                }
                return (
                  <div className="divide-y divide-slate-100">
                    {visibleDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4"
                      >
                        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                          <span className="text-2xl shrink-0">📄</span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-medium text-slate-900 break-words">{doc.name}</h3>
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                                  categoryBadgeStyles[doc.category] || categoryBadgeStyles.other
                                }`}
                              >
                                {categoryLabels[doc.category] || doc.category}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                              {formatSize(doc.size)} &bull;{' '}
                              {new Date(doc.uploadedAt).toLocaleDateString('pt-PT')}
                              {doc.description ? ` · ${doc.description}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <a
                            href={`/api/documents/file?name=${encodeURIComponent(doc.filename)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary text-xs h-9 px-3.5"
                          >
                            Abrir
                          </a>
                          <a
                            href={`/api/documents/file?name=${encodeURIComponent(doc.filename)}&download=1`}
                            className="btn-primary text-xs h-9 px-3.5"
                          >
                            Descarregar
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
