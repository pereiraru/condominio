'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  INCIDENT_LOCATIONS,
  INCIDENT_PRIORITIES,
} from '@/lib/incidentConstants';
import type { Incident, Unit } from '@/lib/types';

interface IncidentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (incident: Incident, notificationReason?: string) => void;
  defaultUnitId?: string | null;
}

export default function IncidentReportModal({
  isOpen,
  onClose,
  onCreated,
  defaultUnitId,
}: IncidentReportModalProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  const [units, setUnits] = useState<Unit[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [immediateAction, setImmediateAction] = useState('');
  const [location, setLocation] = useState('other');
  const [priority, setPriority] = useState('normal');
  const [visibility, setVisibility] = useState<'public' | 'unit_private'>('public');
  const [reportedByUnitId, setReportedByUnitId] = useState<string>(defaultUnitId || '');
  const [reportedByName, setReportedByName] = useState('');
  const [reportedByEmail, setReportedByEmail] = useState('');
  const [notifyEmails, setNotifyEmails] = useState('');
  const [reportedAt, setReportedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setReportedAt(new Date().toISOString().slice(0, 10));

    const initialUnitId = defaultUnitId || session?.user?.unitId || '';
    setReportedByUnitId(initialUnitId);

    const sessionEmail =
      session?.user?.email && !session.user.email.endsWith('.local')
        ? session.user.email
        : '';
    setReportedByEmail(sessionEmail);
    setReportedByName(session?.user?.name || '');

    fetch('/api/units')
      .then((res) => (res.ok ? res.json() : []))
      .then((list: Unit[]) => {
        setUnits(list);
        const targetId = defaultUnitId || session?.user?.unitId || '';
        const matched = list.find((u) => u.id === targetId);
        if (matched) {
          const activeOwner =
            matched.owners?.find((o) => !o.endMonth) || matched.owners?.[0];
          if (activeOwner?.name) setReportedByName(activeOwner.name);
          if (activeOwner?.email) setReportedByEmail(activeOwner.email);
          else if (matched.email) setReportedByEmail(matched.email);
        }
      })
      .catch(() => undefined);
  }, [isOpen, defaultUnitId, session]);

  if (!isOpen) return null;

  function handleUnitChange(unitId: string) {
    setReportedByUnitId(unitId);
    const matched = units.find((u) => u.id === unitId);
    if (matched) {
      const activeOwner =
        matched.owners?.find((o) => !o.endMonth) || matched.owners?.[0];
      if (activeOwner?.name) setReportedByName(activeOwner.name);
      if (activeOwner?.email) setReportedByEmail(activeOwner.email);
      else if (matched.email) setReportedByEmail(matched.email);
    }
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const picked = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...picked]);
    e.target.value = '';
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !description.trim()) {
      setError('Indique o título e a descrição da anomalia.');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('description', description.trim());
      if (immediateAction.trim()) fd.append('immediateAction', immediateAction.trim());
      fd.append('location', location);
      fd.append('priority', priority);
      fd.append('visibility', visibility);
      if (reportedByUnitId) fd.append('reportedByUnitId', reportedByUnitId);
      if (reportedByName.trim()) fd.append('reportedByName', reportedByName.trim());
      if (reportedByEmail.trim()) fd.append('reportedByEmail', reportedByEmail.trim());
      if (notifyEmails.trim()) fd.append('notifyEmails', notifyEmails.trim());
      if (reportedAt) fd.append('reportedAt', `${reportedAt}T12:00:00`);
      files.forEach((f) => fd.append('files', f));

      const res = await fetch('/api/incidents', {
        method: 'POST',
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Não foi possível registar a anomalia.');
        return;
      }

      setTitle('');
      setDescription('');
      setImmediateAction('');
      setNotifyEmails('');
      setFiles([]);
      onCreated(
        data.incident,
        data.notification && !data.notification.sent ? data.notification.reason : undefined
      );
      onClose();
    } catch (err) {
      console.error('Error submitting incident:', err);
      setError('Erro de ligação ao enviar o reporte.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-[1px] z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-2xl w-full my-8 overflow-hidden">
        <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Reportar Anomalia / Incidente</h2>
            <p className="text-xs text-gray-300 mt-0.5">
              Registo de avaria ou ocorrência no edifício com notificação à Administração
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-300 hover:text-white p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Fração</label>
              {isAdmin ? (
                <select
                  className="input"
                  value={reportedByUnitId}
                  onChange={(e) => handleUnitChange(e.target.value)}
                >
                  <option value="">Partes Comuns / Administração</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.code} {u.description ? `— ${u.description}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="input bg-gray-100 text-gray-700"
                  value={
                    units.find((u) => u.id === reportedByUnitId)?.code ||
                    session?.user?.unitCode ||
                    'Partes Comuns'
                  }
                  disabled
                />
              )}
            </div>

            <div>
              <label className="label">Data do Reporte</label>
              <input
                type="date"
                className="input"
                value={reportedAt}
                onChange={(e) => setReportedAt(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label">Quem reportou *</label>
              <input
                type="text"
                className="input"
                placeholder="Ex.: Rui Pereira"
                value={reportedByName}
                onChange={(e) => setReportedByName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label">Email de Confirmação</label>
              <input
                type="email"
                className="input"
                placeholder="email@exemplo.com"
                value={reportedByEmail}
                onChange={(e) => setReportedByEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Assunto / Título *</label>
            <input
              type="text"
              className="input"
              placeholder="Ex.: Botão do piso 3 no elevador direito não responde"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Zona / Equipamento</label>
              <select
                className="input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                {INCIDENT_LOCATIONS.map((loc) => (
                  <option key={loc.value} value={loc.value}>
                    {loc.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Urgência</label>
              <select
                className="input"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {INCIDENT_PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Visibilidade no Portal</label>
              <select
                className="input"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as 'public' | 'unit_private')}
              >
                <option value="public">Pública (prédio todo)</option>
                <option value="unit_private">Privada da fração</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Descrição da Anomalia *</label>
            <textarea
              className="input min-h-[88px] py-2.5 h-auto"
              placeholder="Descreva o problema detetado, piso exato ou sintomas..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Ação Imediata Tomada (opcional)</label>
            <input
              type="text"
              className="input"
              placeholder="Ex.: Porta fechada manualmente / sinalização colocada"
              value={immediateAction}
              onChange={(e) => setImmediateAction(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Emails Adicionais para Notificação (opcional)</label>
            <input
              type="text"
              className="input"
              placeholder="Ex.: outro.email@gmail.com, familiar@gmail.com (separados por vírgula)"
              value={notifyEmails}
              onChange={(e) => setNotifyEmails(e.target.value)}
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Receberão notificação automática na criação e resolução deste incidente.
            </p>
          </div>

          <div>
            <label className="label">Fotografias / Anexos</label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-4 cursor-pointer hover:border-gray-400 hover:bg-gray-50/70 transition-all">
              <span className="text-xs font-semibold text-gray-700">
                Clique para anexar fotografias (JPG, PNG, WEBP) ou PDF
              </span>
              <input
                type="file"
                multiple
                accept="image/*,.pdf"
                className="hidden"
                onChange={handleFilesSelected}
              />
            </label>

            {files.length > 0 && (
              <div className="mt-2.5 space-y-1.5">
                {files.map((f, idx) => (
                  <div
                    key={`${f.name}-${idx}`}
                    className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 text-xs"
                  >
                    <span className="truncate font-medium text-gray-700">
                      {f.name} ({Math.round(f.size / 1024)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-red-600 hover:text-red-800 font-semibold ml-3"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'A registar...' : 'Registar Anomalia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
