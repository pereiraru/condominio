'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  INCIDENT_PRIORITIES,
  INCIDENT_STATUSES,
  LOCATION_LABEL_MAP,
  PRIORITY_STYLE_MAP,
  STATUS_STYLE_MAP,
  isImageMime,
} from '@/lib/incidentConstants';
import type { Creditor, Incident } from '@/lib/types';

interface IncidentDetailModalProps {
  incidentId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

const CREDITOR_CATEGORIES = [
  { value: 'maintenance', label: 'Manutenção / Reparações' },
  { value: 'elevator', label: 'Elevadores' },
  { value: 'electricity', label: 'Eletricidade' },
  { value: 'cleaning', label: 'Limpeza' },
  { value: 'water', label: 'Água / Canalizações' },
  { value: 'insurance', label: 'Seguro' },
  { value: 'other', label: 'Outro' },
];

function formatDatePt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTimePt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toInputDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export default function IncidentDetailModal({
  incidentId,
  onClose,
  onUpdated,
}: IncidentDetailModalProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  const [incident, setIncident] = useState<Incident | null>(null);
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Admin resolution state
  const [status, setStatus] = useState('open');
  const [priority, setPriority] = useState('normal');
  const [visibility, setVisibility] = useState('public');
  const [assignedTo, setAssignedTo] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [resolvedAt, setResolvedAt] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [creditorMode, setCreditorMode] = useState<'existing' | 'new'>('existing');
  const [creditorId, setCreditorId] = useState('');
  const [newCreditorName, setNewCreditorName] = useState('');
  const [newCreditorCategory, setNewCreditorCategory] = useState('maintenance');
  const [createSupplierInvoice, setCreateSupplierInvoice] = useState(false);
  const [sendUpdateEmail, setSendUpdateEmail] = useState(false);
  const [resolutionFiles, setResolutionFiles] = useState<File[]>([]);
  const [comment, setComment] = useState('');

  async function loadIncident(targetId: string) {
    setLoading(true);
    setFeedback(null);
    try {
      const [incRes, credRes] = await Promise.all([
        fetch(`/api/incidents/${targetId}`),
        isAdmin ? fetch('/api/creditors') : Promise.resolve(null),
      ]);

      if (incRes.ok) {
        const inc: Incident = await incRes.json();
        setIncident(inc);
        setStatus(inc.status);
        setPriority(inc.priority);
        setVisibility(inc.visibility);
        setAssignedTo(inc.assignedTo || '');
        setPlannedDate(toInputDate(inc.plannedDate));
        setResolvedAt(toInputDate(inc.resolvedAt));
        setResolutionNotes(inc.resolutionNotes || '');
        setExpenseAmount(
          inc.expenseAmount !== null && inc.expenseAmount !== undefined
            ? String(inc.expenseAmount)
            : ''
        );
        setCreditorId(inc.creditorId || '');
        setCreditorMode('existing');
        setNewCreditorName('');
        setCreateSupplierInvoice(false);
        setResolutionFiles([]);
      }

      if (credRes && credRes.ok) {
        setCreditors(await credRes.json());
      }
    } catch (err) {
      console.error('Error loading incident:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (incidentId) {
      loadIncident(incidentId);
    } else {
      setIncident(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentId, isAdmin]);

  if (!incidentId) return null;

  async function handleSaveAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!incident) return;

    setSaving(true);
    setFeedback(null);
    try {
      const fd = new FormData();
      fd.append('status', status);
      fd.append('priority', priority);
      fd.append('visibility', visibility);
      fd.append('assignedTo', assignedTo);
      fd.append('plannedDate', plannedDate);
      fd.append('resolvedAt', resolvedAt);
      fd.append('resolutionNotes', resolutionNotes);
      fd.append('expenseAmount', expenseAmount);
      fd.append('phase', 'resolution');
      fd.append('sendNotification', String(sendUpdateEmail));
      fd.append('createSupplierInvoice', String(createSupplierInvoice));

      if (creditorMode === 'new' && newCreditorName.trim()) {
        fd.append('newCreditorName', newCreditorName.trim());
        fd.append('newCreditorCategory', newCreditorCategory);
      } else {
        fd.append('creditorId', creditorId);
      }

      if (comment.trim()) {
        fd.append('comment', comment.trim());
      }
      resolutionFiles.forEach((f) => fd.append('files', f));

      const res = await fetch(`/api/incidents/${incident.id}`, {
        method: 'PATCH',
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', text: data.error || 'Erro ao guardar alterações.' });
        return;
      }

      setComment('');
      setResolutionFiles([]);
      if (data.incident) setIncident(data.incident);
      if (creditorMode === 'new' && isAdmin) {
        const credRes = await fetch('/api/creditors');
        if (credRes.ok) setCreditors(await credRes.json());
        if (data.incident?.creditorId) {
          setCreditorMode('existing');
          setCreditorId(data.incident.creditorId);
          setNewCreditorName('');
        }
      }

      const notifMsg = data.notification
        ? data.notification.sent
          ? ` Notificação enviada (${data.notification.recipients.length} destinatário(s)).`
          : ` (${data.notification.reason || 'Email não enviado'})`
        : '';
      setFeedback({ type: 'ok', text: `Alterações guardadas.${notifMsg}` });
      onUpdated();
    } catch (err) {
      console.error('Error updating incident:', err);
      setFeedback({ type: 'err', text: 'Erro de ligação ao atualizar incidente.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!incident || !comment.trim()) return;

    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/incidents/${incident.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comment.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.incident) {
        setIncident(data.incident);
        setComment('');
        setFeedback({ type: 'ok', text: 'Comentário adicionado ao histórico.' });
        onUpdated();
      } else {
        setFeedback({ type: 'err', text: data.error || 'Erro ao adicionar comentário.' });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!incident) return;
    if (!window.confirm(`Tem a certeza que deseja eliminar o incidente ${incident.code}?`)) return;

    const res = await fetch(`/api/incidents/${incident.id}`, { method: 'DELETE' });
    if (res.ok) {
      onUpdated();
      onClose();
    } else {
      const data = await res.json().catch(() => ({}));
      setFeedback({ type: 'err', text: data.error || 'Não foi possível eliminar.' });
    }
  }

  const reportAttachments =
    incident?.attachments?.filter((a) => a.phase !== 'resolution') || [];
  const resolutionAttachments =
    incident?.attachments?.filter((a) => a.phase === 'resolution') || [];

  const statusMeta = incident
    ? STATUS_STYLE_MAP[incident.status] || STATUS_STYLE_MAP.open
    : STATUS_STYLE_MAP.open;
  const priorityMeta = incident
    ? PRIORITY_STYLE_MAP[incident.priority] || PRIORITY_STYLE_MAP.normal
    : PRIORITY_STYLE_MAP.normal;

  const canDelete =
    incident &&
    (isAdmin ||
      (session?.user?.unitId &&
        incident.reportedByUnitId === session.user.unitId &&
        incident.status === 'open'));

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-[1px] z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-4xl w-full my-6 overflow-hidden">
        {/* Top bar */}
        <div className="px-6 py-4 bg-gray-900 text-white flex items-start justify-between gap-4">
          <div className="min-w-0">
            {incident ? (
              <>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/15 text-white">
                    {incident.code}
                  </span>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusMeta.pillClass}`}>
                    {statusMeta.label}
                  </span>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${priorityMeta.badgeClass}`}>
                    Prioridade: {priorityMeta.label}
                  </span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-white/10 text-gray-200">
                    {LOCATION_LABEL_MAP[incident.location] || incident.location}
                  </span>
                </div>
                <h2 className="text-lg font-bold truncate">{incident.title}</h2>
              </>
            ) : (
              <h2 className="text-lg font-bold">Detalhe da Anomalia</h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-300 hover:text-white p-1 rounded-lg shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="p-6 max-h-[82vh] overflow-y-auto space-y-6">
          {loading || !incident ? (
            <div className="py-12 text-center text-gray-500 text-sm">A carregar incidente...</div>
          ) : (
            <>
              {feedback && (
                <div
                  className={`p-3 rounded-xl border text-xs font-medium ${
                    feedback.type === 'ok'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  {feedback.text}
                </div>
              )}

              {/* Report Details Card */}
              <div className="bg-gray-50/80 rounded-2xl border border-gray-100 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                  <span>
                    Reportado por:{' '}
                    <strong className="text-gray-900">
                      {incident.reportedByName}
                      {incident.reportedByUnit ? ` (Fração ${incident.reportedByUnit.code})` : ''}
                    </strong>
                  </span>
                  <span>
                    Data do reporte:{' '}
                    <strong className="text-gray-900">{formatDatePt(incident.reportedAt)}</strong>
                  </span>
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase text-gray-400 mb-1">Descrição</p>
                  <p className="text-sm text-gray-800 whitespace-pre-line">{incident.description}</p>
                </div>

                {incident.immediateAction && (
                  <div>
                    <p className="text-[11px] font-bold uppercase text-gray-400 mb-1">
                      Ação Imediata Tomada
                    </p>
                    <p className="text-sm text-gray-700">{incident.immediateAction}</p>
                  </div>
                )}

                {reportAttachments.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase text-gray-400 mb-2">
                      Fotografias / Anexos do Reporte
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {reportAttachments.map((att) => {
                        const url = `/api/documents/attachment?name=${encodeURIComponent(att.filename)}`;
                        return (
                          <a
                            key={att.id}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="group block border border-gray-200 rounded-xl overflow-hidden bg-white hover:border-gray-400 transition-all"
                          >
                            {isImageMime(att.mimeType, att.filename) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={url}
                                alt={att.name}
                                className="w-28 h-20 object-cover"
                              />
                            ) : (
                              <div className="w-28 h-20 flex items-center justify-center bg-gray-100 text-xs font-bold text-gray-600 px-2 text-center">
                                PDF / Anexo
                              </div>
                            )}
                            <p className="text-[10px] text-gray-600 truncate max-w-[112px] px-2 py-1">
                              {att.name}
                            </p>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Treatment & Resolution Section */}
              {isAdmin ? (
                <form
                  onSubmit={handleSaveAdmin}
                  className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">
                        Tratamento & Resolução (Gestão ITIL)
                      </h3>
                      <p className="text-xs text-gray-500">
                        Atribua responsável, datas planeada/resolução, custos e credor associado
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="label">Estado</label>
                      <select
                        className="input"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                      >
                        {INCIDENT_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label">Prioridade</label>
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
                      <label className="label">Visibilidade</label>
                      <select
                        className="input"
                        value={visibility}
                        onChange={(e) => setVisibility(e.target.value)}
                      >
                        <option value="public">Pública (todas as frações)</option>
                        <option value="unit_private">Privada da fração</option>
                      </select>
                    </div>

                    <div>
                      <label className="label">Quem está a tratar</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="Ex.: Administração / Técnico Otis"
                        value={assignedTo}
                        onChange={(e) => setAssignedTo(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="label">Data Planeada</label>
                      <input
                        type="date"
                        className="input"
                        value={plannedDate}
                        onChange={(e) => setPlannedDate(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="label">Data de Resolução</label>
                      <input
                        type="date"
                        className="input"
                        value={resolvedAt}
                        onChange={(e) => setResolvedAt(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Notas de Tratamento / Resolução</label>
                    <textarea
                      className="input min-h-[76px] py-2.5 h-auto"
                      placeholder="Descreva a intervenção realizada, peças substituídas ou conclusão..."
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                    />
                  </div>

                  {/* Expense + Creditor linking */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                        Despesa & Associação a Credor
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCreditorMode('existing')}
                          className={`text-xs px-3 py-1 rounded-lg font-semibold ${
                            creditorMode === 'existing'
                              ? 'bg-gray-900 text-white'
                              : 'bg-white border border-gray-200 text-gray-600'
                          }`}
                        >
                          Credor Existente
                        </button>
                        <button
                          type="button"
                          onClick={() => setCreditorMode('new')}
                          className={`text-xs px-3 py-1 rounded-lg font-semibold ${
                            creditorMode === 'new'
                              ? 'bg-gray-900 text-white'
                              : 'bg-white border border-gray-200 text-gray-600'
                          }`}
                        >
                          + Criar Novo Credor
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="label">Valor da Despesa (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="input bg-white"
                          placeholder="0.00"
                          value={expenseAmount}
                          onChange={(e) => setExpenseAmount(e.target.value)}
                        />
                      </div>

                      {creditorMode === 'existing' ? (
                        <div className="md:col-span-2">
                          <label className="label">Credor / Fornecedor</label>
                          <select
                            className="input bg-white"
                            value={creditorId}
                            onChange={(e) => setCreditorId(e.target.value)}
                          >
                            <option value="">Sem credor associado</option>
                            {creditors.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="label">Nome do Novo Credor *</label>
                            <input
                              type="text"
                              className="input bg-white"
                              placeholder="Ex.: Serralharia Silva"
                              value={newCreditorName}
                              onChange={(e) => setNewCreditorName(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="label">Categoria</label>
                            <select
                              className="input bg-white"
                              value={newCreditorCategory}
                              onChange={(e) => setNewCreditorCategory(e.target.value)}
                            >
                              {CREDITOR_CATEGORIES.map((c) => (
                                <option key={c.value} value={c.value}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}
                    </div>

                    {incident.supplierInvoice ? (
                      <p className="text-xs text-emerald-700 font-semibold">
                        Fatura de Fornecedor associada: {incident.supplierInvoice.description} (
                        {incident.supplierInvoice.amountDue.toFixed(2)} € —{' '}
                        {incident.supplierInvoice.isPaid ? 'Paga' : 'Por liquidar'})
                      </p>
                    ) : (
                      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={createSupplierInvoice}
                          onChange={(e) => setCreateSupplierInvoice(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <span>
                          Criar automaticamente Fatura de Fornecedor (SupplierInvoice) neste credor
                          para reconciliação bancária
                        </span>
                      </label>
                    )}
                  </div>

                  {/* Resolution photos */}
                  <div>
                    <label className="label">Anexos / Fotografias da Resolução</label>
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      className="text-xs text-gray-600"
                      onChange={(e) => {
                        if (e.target.files) {
                          setResolutionFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                        }
                      }}
                    />
                    {resolutionFiles.length > 0 && (
                      <p className="text-xs text-gray-600 mt-1">
                        {resolutionFiles.length} novo(s) ficheiro(s) selecionado(s) para upload.
                      </p>
                    )}
                    {resolutionAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-3 mt-2">
                        {resolutionAttachments.map((att) => {
                          const url = `/api/documents/attachment?name=${encodeURIComponent(att.filename)}`;
                          return (
                            <a
                              key={att.id}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="block border border-gray-200 rounded-xl overflow-hidden bg-gray-50 hover:border-gray-400"
                            >
                              {isImageMime(att.mimeType, att.filename) ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={url} alt={att.name} className="w-24 h-16 object-cover" />
                              ) : (
                                <div className="w-24 h-16 flex items-center justify-center text-[10px] font-bold text-gray-600">
                                  Anexo PDF
                                </div>
                              )}
                              <p className="text-[10px] truncate max-w-[96px] px-1.5 py-0.5 text-gray-600">
                                {att.name}
                              </p>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sendUpdateEmail}
                        onChange={(e) => setSendUpdateEmail(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span>Notificar por email (alterações de estado/resolução já notificam)</span>
                    </label>

                    <div className="flex items-center gap-2 ml-auto">
                      {canDelete && (
                        <button
                          type="button"
                          onClick={handleDelete}
                          className="btn-ghost text-red-600 hover:bg-red-50 text-xs"
                        >
                          Eliminar
                        </button>
                      )}
                      <button type="submit" disabled={saving} className="btn-primary text-sm">
                        {saving ? 'A guardar...' : 'Guardar Tratamento'}
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                /* Read-only Resolution View for Residents */
                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900">Estado do Tratamento</h3>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        Anular Reporte
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="p-2.5 bg-gray-50 rounded-xl">
                      <p className="text-[10px] font-bold uppercase text-gray-400">Responsável</p>
                      <p className="font-semibold text-gray-800 mt-0.5">
                        {incident.assignedTo || 'Administração'}
                      </p>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-xl">
                      <p className="text-[10px] font-bold uppercase text-gray-400">Data Planeada</p>
                      <p className="font-semibold text-gray-800 mt-0.5">
                        {formatDatePt(incident.plannedDate)}
                      </p>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-xl">
                      <p className="text-[10px] font-bold uppercase text-gray-400">Data Resolução</p>
                      <p className="font-semibold text-gray-800 mt-0.5">
                        {formatDatePt(incident.resolvedAt)}
                      </p>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-xl">
                      <p className="text-[10px] font-bold uppercase text-gray-400">Custo / Credor</p>
                      <p className="font-semibold text-gray-800 mt-0.5">
                        {incident.expenseAmount !== null && incident.expenseAmount !== undefined
                          ? `${incident.expenseAmount.toFixed(2)} €`
                          : '—'}
                        {incident.creditor ? ` (${incident.creditor.name})` : ''}
                      </p>
                    </div>
                  </div>

                  {incident.resolutionNotes && (
                    <div className="pt-1">
                      <p className="text-[11px] font-bold uppercase text-gray-400 mb-1">
                        Notas da Resolução
                      </p>
                      <p className="text-sm text-gray-700 whitespace-pre-line">
                        {incident.resolutionNotes}
                      </p>
                    </div>
                  )}

                  {resolutionAttachments.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold uppercase text-gray-400 mb-2">
                        Comprovativos da Resolução
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {resolutionAttachments.map((att) => {
                          const url = `/api/documents/attachment?name=${encodeURIComponent(att.filename)}`;
                          return (
                            <a
                              key={att.id}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="block border border-gray-200 rounded-xl overflow-hidden bg-gray-50"
                            >
                              {isImageMime(att.mimeType, att.filename) ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={url} alt={att.name} className="w-24 h-16 object-cover" />
                              ) : (
                                <div className="w-24 h-16 flex items-center justify-center text-[10px] font-bold text-gray-600">
                                  Anexo PDF
                                </div>
                              )}
                              <p className="text-[10px] truncate max-w-[96px] px-1.5 py-0.5 text-gray-600">
                                {att.name}
                              </p>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Activity Timeline + Add Comment */}
              <div className="bg-gray-50/70 rounded-2xl border border-gray-100 p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Histórico de Atividade (ITIL Log)
                </h3>

                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    className="input bg-white text-sm"
                    placeholder="Adicionar comentário ou atualização..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={saving || !comment.trim()}
                    className="btn-secondary text-xs shrink-0"
                  >
                    Comentar
                  </button>
                </form>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {incident.logs?.map((log) => (
                    <div
                      key={log.id}
                      className="bg-white rounded-xl border border-gray-100 px-3.5 py-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] text-gray-400">
                        <span className="font-semibold text-gray-700">
                          {log.actorName}{' '}
                          {log.actorRole === 'admin' && (
                            <span className="ml-1 px-1.5 py-0.2 bg-gray-100 text-gray-600 rounded text-[10px]">
                              Admin
                            </span>
                          )}
                        </span>
                        <span>{formatDateTimePt(log.createdAt)}</span>
                      </div>
                      <p className="text-gray-700 mt-1">{log.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
