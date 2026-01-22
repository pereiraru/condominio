'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { Document } from '@/lib/types';

const categoryLabels: Record<string, string> = {
  invoice: 'Fatura',
  receipt: 'Recibo',
  minutes: 'Ata',
  contract: 'Contrato',
  other: 'Outro',
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
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
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Documentos</h1>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="btn-primary"
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
                <label className="label">Descricao (opcional)</label>
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
          <p className="text-gray-500">A carregar...</p>
        ) : (
          <div className="card">
            {documents.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Sem documentos carregados
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between py-4"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">📄</span>
                      <div>
                        <h3 className="font-medium text-gray-900">{doc.name}</h3>
                        <p className="text-sm text-gray-500">
                          {categoryLabels[doc.category]} &bull;{' '}
                          {formatSize(doc.size)} &bull;{' '}
                          {new Date(doc.uploadedAt).toLocaleDateString('pt-PT')}
                        </p>
                      </div>
                    </div>
                    <a
                      href={`/uploads/${doc.filename}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary"
                    >
                      Abrir
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
