'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addMinutesToTime,
  CondoMeetingDTO,
  createClientItemId,
  createDefaultDiscussionPoints,
  DEFAULT_ADMIN_SIGNERS,
  DEFAULT_CONVOCATION_EXTRA_NOTE,
  formatMeetingDateLong,
  formatMeetingDateShort,
  inferLinkedSectionFromTitle,
  MeetingDiscussionPoint,
  suggestNextActaNumber,
} from '@/lib/meetings';
import { UnitReportItem } from '../types';
import { fmtEur } from '../utils';
import AttendanceSheetView from './AttendanceSheetView';

interface ConvocatoriaTabProps {
  year: number;
  buildingName: string;
  units: UnitReportItem[];
  projectedAnnualImpact?: number;
  meetings: CondoMeetingDTO[];
  selectedMeetingId: string | null;
  onSelectMeetingId: (id: string | null) => void;
  onMeetingSaved: (saved: CondoMeetingDTO) => void;
  onGoToActa: () => void;
}

interface AgendaRow {
  id: string;
  title: string;
}

function buildDefaultAgendaRows(year: number, projectedAnnualImpact: number): AgendaRow[] {
  const defaults = createDefaultDiscussionPoints(year);
  return [
    { id: createClientItemId('pt-prev'), title: 'Leitura e análise da última ata.' },
    ...defaults.map((pt) => {
      if (pt.linkedSection === 'orcamento' && projectedAnnualImpact > 0) {
        return {
          id: pt.id,
          title: `${pt.title} (impacto previsto +${fmtEur(projectedAnnualImpact)}/ano)`,
        };
      }
      return { id: pt.id, title: pt.title };
    }),
  ];
}

export default function ConvocatoriaTab({
  year,
  buildingName,
  units,
  projectedAnnualImpact = 0,
  meetings,
  selectedMeetingId,
  onSelectMeetingId,
  onMeetingSaved,
  onGoToActa,
}: ConvocatoriaTabProps) {
  const selectedMeeting = useMemo(
    () => meetings.find((m) => m.id === selectedMeetingId) || null,
    [meetings, selectedMeetingId]
  );

  const [actaNumber, setActaNumber] = useState<string>(() => suggestNextActaNumber(meetings));
  const [assemblyType, setAssemblyType] = useState<'Ordinária' | 'Extraordinária'>('Ordinária');
  const [meetingDate, setMeetingDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [firstConvocationTime, setFirstConvocationTime] = useState<string>('21:30');
  const [meetingLocation, setMeetingLocation] = useState<string>(
    'Parqueamento situado no Piso -4 do Edifício'
  );
  const [issueDate, setIssueDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [adminSigners, setAdminSigners] = useState<string>(DEFAULT_ADMIN_SIGNERS);
  const [extraNote, setExtraNote] = useState<string>(DEFAULT_CONVOCATION_EXTRA_NOTE);
  const [agendaRows, setAgendaRows] = useState<AgendaRow[]>(() =>
    buildDefaultAgendaRows(year, projectedAnnualImpact)
  );

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [emailMode, setEmailMode] = useState<'all_units' | 'custom'>('all_units');
  const [customEmails, setCustomEmails] = useState('');
  const [emailCustomNote, setEmailCustomNote] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const [printMode, setPrintMode] = useState<'convocatoria' | 'attendance'>('convocatoria');

  const lastHydratedSignatureRef = useRef<string | null>(null);

  const startNewConvocatoria = useCallback(() => {
    onSelectMeetingId(null);
    lastHydratedSignatureRef.current = '__new__';
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setActaNumber(suggestNextActaNumber(meetings));
    setAssemblyType('Ordinária');
    setMeetingDate(d.toISOString().slice(0, 10));
    setFirstConvocationTime('21:30');
    setMeetingLocation('Parqueamento situado no Piso -4 do Edifício');
    setIssueDate(new Date().toISOString().slice(0, 10));
    setAdminSigners(DEFAULT_ADMIN_SIGNERS);
    setExtraNote(DEFAULT_CONVOCATION_EXTRA_NOTE);
    setAgendaRows(buildDefaultAgendaRows(year, projectedAnnualImpact));
    setFeedback(null);
    setEmailFeedback(null);
  }, [meetings, onSelectMeetingId, projectedAnnualImpact, year]);

  useEffect(() => {
    if (!selectedMeeting) {
      if (selectedMeetingId === null && lastHydratedSignatureRef.current !== '__new__') {
        lastHydratedSignatureRef.current = '__new__';
      }
      return;
    }

    const sig = `${selectedMeeting.id}:${selectedMeeting.updatedAt}`;
    if (lastHydratedSignatureRef.current === sig) return;
    lastHydratedSignatureRef.current = sig;

    setActaNumber(selectedMeeting.actaNumber);
    setAssemblyType(selectedMeeting.assemblyType);
    setMeetingDate(selectedMeeting.meetingDate);
    setFirstConvocationTime(selectedMeeting.firstConvocationTime || '21:30');
    setMeetingLocation(selectedMeeting.location);
    setIssueDate(selectedMeeting.issueDate || new Date().toISOString().slice(0, 10));
    setAdminSigners(selectedMeeting.adminSigners ?? DEFAULT_ADMIN_SIGNERS);
    setExtraNote(selectedMeeting.extraNote ?? DEFAULT_CONVOCATION_EXTRA_NOTE);
    setAgendaRows(
      selectedMeeting.discussionPoints.length > 0
        ? selectedMeeting.discussionPoints.map((pt) => ({ id: pt.id, title: pt.title }))
        : buildDefaultAgendaRows(selectedMeeting.year || year, projectedAnnualImpact)
    );
    setEmailFeedback(null);
  }, [selectedMeeting, selectedMeetingId, year, projectedAnnualImpact]);

  useEffect(() => {
    if (printMode !== 'attendance') return;

    const handleAfterPrint = () => {
      setPrintMode('convocatoria');
    };
    window.addEventListener('afterprint', handleAfterPrint);

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        window.print();
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [printMode]);

  const unitIdsWithEmailCount = useMemo(() => {
    const emailSet = new Set<string>();
    for (const u of units) {
      const candidate = u.defaultEmail || u.email || u.currentOwner?.email;
      if (candidate && candidate.includes('@') && !candidate.endsWith('.local')) {
        emailSet.add(u.id);
      }
    }
    return emailSet.size;
  }, [units]);

  function updateAgendaRow(idx: number, val: string) {
    setAgendaRows((prev) => prev.map((row, i) => (i === idx ? { ...row, title: val } : row)));
  }

  function addAgendaRow() {
    setAgendaRows((prev) => [...prev, { id: createClientItemId('pt'), title: '' }]);
  }

  function moveAgendaRow(idx: number, direction: -1 | 1) {
    setAgendaRows((prev) => {
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, item);
      return copy;
    });
  }

  function removeAgendaRow(idx: number) {
    setAgendaRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function buildMergedDiscussionPoints(): MeetingDiscussionPoint[] {
    const existingById = new Map<string, MeetingDiscussionPoint>();
    if (selectedMeeting) {
      for (const pt of selectedMeeting.discussionPoints) {
        existingById.set(pt.id, pt);
      }
    }
    const defaultsById = new Map<string, MeetingDiscussionPoint>();
    for (const pt of createDefaultDiscussionPoints(selectedMeeting?.year || year)) {
      defaultsById.set(pt.id, pt);
    }

    return agendaRows
      .filter((row) => row.title.trim() !== '')
      .map((row) => {
        const cleanTitle = row.title.trim();
        const existing = existingById.get(row.id);
        if (existing) {
          return { ...existing, title: cleanTitle };
        }
        const preset = defaultsById.get(row.id);
        if (preset) {
          return { ...preset, title: cleanTitle };
        }
        return {
          id: row.id,
          title: cleanTitle,
          linkedSection: inferLinkedSectionFromTitle(cleanTitle),
          discussion: '',
          votingOutcome: 'Tomado conhecimento (sem votação)',
          votingDetails: '',
          decision: '',
        };
      });
  }

  async function saveConvocatoria(silent = false): Promise<CondoMeetingDTO | null> {
    setSaving(true);
    if (!silent) setFeedback(null);

    const discussionPoints = buildMergedDiscussionPoints();
    const payload = selectedMeeting
      ? {
          year: selectedMeeting.year,
          actaNumber: actaNumber.trim() || selectedMeeting.actaNumber,
          assemblyType,
          meetingDate,
          startTime: selectedMeeting.startTime || addMinutesToTime(firstConvocationTime, 30),
          endTime: selectedMeeting.endTime,
          convocationUsed: selectedMeeting.convocationUsed,
          location: meetingLocation,
          presidedBy: selectedMeeting.presidedBy,
          secretaryBy: selectedMeeting.secretaryBy,
          newAdminNames: selectedMeeting.newAdminNames,
          status: selectedMeeting.status,
          quorumMode: selectedMeeting.quorumMode,
          firstConvocationTime,
          issueDate,
          extraNote,
          adminSigners,
          generalNotes: selectedMeeting.generalNotes,
          attendance: selectedMeeting.attendance,
          discussionPoints,
          actionItems: selectedMeeting.actionItems,
        }
      : {
          year,
          actaNumber: actaNumber.trim() || suggestNextActaNumber(meetings),
          assemblyType,
          meetingDate,
          startTime: addMinutesToTime(firstConvocationTime, 30),
          endTime: '',
          convocationUsed: '2.ª',
          location: meetingLocation,
          presidedBy: 'Administração Cessante',
          secretaryBy: 'A designar na reunião',
          newAdminNames: '',
          status: 'draft',
          quorumMode: 'units',
          firstConvocationTime,
          issueDate,
          extraNote,
          adminSigners,
          generalNotes: '',
          attendance: { statuses: {}, permilagens: {}, representatives: {} },
          discussionPoints,
          actionItems: [],
        };

    try {
      const url = selectedMeeting
        ? `/api/admin/meetings/${selectedMeeting.id}`
        : '/api/admin/meetings';
      const method = selectedMeeting ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', text: data.error || 'Erro ao guardar convocatória.' });
        return null;
      }

      const saved = data as CondoMeetingDTO;
      lastHydratedSignatureRef.current = `${saved.id}:${saved.updatedAt}`;
      onMeetingSaved(saved);
      if (!silent) {
        setFeedback({
          type: 'ok',
          text: `Convocatória e Ordem de Trabalhos (Acta N.º ${saved.actaNumber}) guardadas e sincronizadas com a Reunião & Ata.`,
        });
      }
      return saved;
    } catch {
      setFeedback({ type: 'err', text: 'Erro de ligação ao guardar convocatória.' });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleGoToActa() {
    const saved = await saveConvocatoria(true);
    if (saved) {
      onGoToActa();
    }
  }

  async function handleSendConvocatoriaEmail() {
    setSendingEmail(true);
    setEmailFeedback(null);

    try {
      const saved = await saveConvocatoria(true);
      if (!saved) {
        setEmailFeedback({
          type: 'err',
          text: 'Não foi possível guardar a convocatória antes do envio.',
        });
        return;
      }

      const res = await fetch(`/api/admin/meetings/${saved.id}/send-convocatoria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: emailMode,
          customEmails: emailMode === 'custom' ? customEmails : undefined,
          customNote: emailCustomNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.sent) {
        setEmailFeedback({
          type: 'err',
          text: data.reason || data.error || 'Não foi possível enviar a convocatória.',
        });
      } else {
        if (data.convocationSentAt) {
          const updated: CondoMeetingDTO = { ...saved, convocationSentAt: data.convocationSentAt };
          lastHydratedSignatureRef.current = `${updated.id}:${updated.updatedAt}`;
          onMeetingSaved(updated);
        }
        setEmailFeedback({
          type: 'ok',
          text: `Convocatória enviada para ${data.recipients.length} destinatário(s): ${data.recipients.join(', ')}.`,
        });
      }
    } catch {
      setEmailFeedback({ type: 'err', text: 'Erro ao enviar a convocatória por email.' });
    } finally {
      setSendingEmail(false);
    }
  }

  const secondConvocationTime = useMemo(
    () => addMinutesToTime(firstConvocationTime, 30),
    [firstConvocationTime]
  );

  const visibleAgendaTitles = useMemo(
    () => agendaRows.map((r) => r.title.trim()).filter(Boolean),
    [agendaRows]
  );

  return (
    <div className="space-y-6">
      {/* Editor Controls (hidden on print) */}
      <div className="no-print card space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Configurar Convocatória</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              A Convocatória e os pontos da Ordem de Trabalhos ficam guardados e ligados diretamente à Reunião &amp; Ata correspondente.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => saveConvocatoria(false)}
              className="btn-secondary text-xs h-9 px-3.5"
            >
              {saving ? 'A guardar...' : 'Guardar Convocatória'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleGoToActa}
              className="btn-secondary text-xs h-9 px-3.5"
            >
              Abrir Reunião &amp; Ata →
            </button>
            <button
              type="button"
              onClick={() => setPrintMode('attendance')}
              className="btn-secondary text-xs h-9 px-3.5"
            >
              Imprimir Folha de Presenças (p/ Assinar)
            </button>
            <button
              type="button"
              onClick={() => setShowEmailPanel((prev) => !prev)}
              className="btn-secondary text-xs h-9 px-3.5"
            >
              Enviar Convocatória por Email
            </button>
            <button
              type="button"
              onClick={() => {
                setPrintMode('convocatoria');
                setTimeout(() => window.print(), 20);
              }}
              className="btn-primary text-xs h-9 px-4"
            >
              Imprimir / PDF Convocatória
            </button>
          </div>
        </div>

        {/* Linked Saved Meetings Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-gray-600">Reunião associada:</label>
            <select
              className="input h-9 text-xs w-full sm:w-auto sm:min-w-[260px]"
              value={selectedMeetingId || '__new__'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '__new__') {
                  startNewConvocatoria();
                } else {
                  onSelectMeetingId(val);
                }
              }}
            >
              <option value="__new__">
                {selectedMeetingId
                  ? '— Criar nova convocatória / reunião —'
                  : `Nova Reunião (Acta N.º ${actaNumber})`}
              </option>
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  Acta N.º {m.actaNumber} ({m.assemblyType}) — {formatMeetingDateShort(m.meetingDate)}{' '}
                  [{m.status === 'finalized' ? 'Finalizada' : 'Rascunho'}]
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={startNewConvocatoria}
              className="px-3 h-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700"
            >
              + Nova Convocatória / Reunião
            </button>
          </div>

          {selectedMeeting?.convocationSentAt && (
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
              Convocatória enviada em{' '}
              {new Date(selectedMeeting.convocationSentAt).toLocaleString('pt-PT')}
            </span>
          )}
        </div>

        {feedback && (
          <div
            className={`px-4 py-2.5 rounded-xl text-xs font-medium ${
              feedback.type === 'ok'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {showEmailPanel && (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <label className="flex items-center gap-2 font-semibold text-gray-800 cursor-pointer">
                <input
                  type="radio"
                  name="convocatoriaEmailMode"
                  checked={emailMode === 'all_units'}
                  onChange={() => setEmailMode('all_units')}
                />
                Todos os condóminos com email ({unitIdsWithEmailCount} frações)
              </label>
              <label className="flex items-center gap-2 font-semibold text-gray-800 cursor-pointer">
                <input
                  type="radio"
                  name="convocatoriaEmailMode"
                  checked={emailMode === 'custom'}
                  onChange={() => setEmailMode('custom')}
                />
                Emails personalizados
              </label>
            </div>

            {emailMode === 'custom' && (
              <div>
                <label className="label text-xs">Destinatários (separados por vírgula)</label>
                <input
                  type="text"
                  className="input h-9 text-xs bg-white"
                  placeholder="email1@exemplo.com, email2@exemplo.com"
                  value={customEmails}
                  onChange={(e) => setCustomEmails(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="label text-xs">Nota adicional no email (opcional)</label>
              <textarea
                rows={2}
                className="input h-auto py-2 text-xs bg-white"
                placeholder="Ex.: Agradecemos a confirmação de presença até 48 horas antes..."
                value={emailCustomNote}
                onChange={(e) => setEmailCustomNote(e.target.value)}
              />
            </div>

            {emailFeedback && (
              <div
                className={`px-3 py-2 rounded-lg text-xs ${
                  emailFeedback.type === 'ok'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {emailFeedback.text}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowEmailPanel(false)}
                className="btn-ghost text-xs h-8 px-3"
              >
                Fechar
              </button>
              <button
                type="button"
                disabled={sendingEmail}
                onClick={handleSendConvocatoriaEmail}
                className="btn-primary text-xs h-8 px-4"
              >
                {sendingEmail ? 'A enviar...' : 'Confirmar Envio'}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="label text-xs">N.º da Ata</label>
            <input
              type="text"
              className="input h-10 text-sm font-bold"
              value={actaNumber}
              onChange={(e) => setActaNumber(e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs">Tipo de Assembleia</label>
            <select
              className="input h-10 text-sm"
              value={assemblyType}
              onChange={(e) => setAssemblyType(e.target.value as 'Ordinária' | 'Extraordinária')}
            >
              <option value="Ordinária">Assembleia Geral Ordinária</option>
              <option value="Extraordinária">Assembleia Geral Extraordinária</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">Data da Reunião</label>
            <input
              type="date"
              className="input h-10 text-sm"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs">Hora (1.ª Convocatória)</label>
            <input
              type="time"
              className="input h-10 text-sm"
              value={firstConvocationTime}
              onChange={(e) => setFirstConvocationTime(e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs">Data de Emissão</label>
            <input
              type="date"
              className="input h-10 text-sm"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label text-xs">Local</label>
            <input
              type="text"
              className="input h-10 text-sm"
              value={meetingLocation}
              onChange={(e) => setMeetingLocation(e.target.value)}
            />
          </div>
          <div className="md:col-span-3">
            <label className="label text-xs">Nota Adicional</label>
            <input
              type="text"
              className="input h-10 text-sm"
              value={extraNote}
              onChange={(e) => setExtraNote(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <label className="label text-xs mb-0">Pontos da Ordem de Trabalhos</label>
              <p className="text-[11px] text-gray-500">
                Estes pontos ficam automaticamente ligados aos Pontos Discutidos na Reunião &amp; Ata.
              </p>
            </div>
            <button
              type="button"
              onClick={addAgendaRow}
              className="text-xs font-bold text-primary-600 hover:underline"
            >
              + Adicionar Ponto
            </button>
          </div>
          {agendaRows.map((row, idx) => (
            <div key={row.id} className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 w-6 text-right">{idx + 1}.</span>
              <input
                type="text"
                className="input h-9 text-sm flex-1"
                value={row.title}
                onChange={(e) => updateAgendaRow(idx, e.target.value)}
              />
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => moveAgendaRow(idx, -1)}
                className="px-2 py-1 rounded border border-gray-200 bg-white text-xs text-gray-600 disabled:opacity-40 hover:bg-gray-100"
                title="Mover para cima"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={idx === agendaRows.length - 1}
                onClick={() => moveAgendaRow(idx, 1)}
                className="px-2 py-1 rounded border border-gray-200 bg-white text-xs text-gray-600 disabled:opacity-40 hover:bg-gray-100"
                title="Mover para baixo"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeAgendaRow(idx)}
                className="text-gray-400 hover:text-red-600 px-2"
                title="Remover ponto"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div>
          <label className="label text-xs">Assinatura / Administração</label>
          <textarea
            rows={2}
            className="input h-auto py-2 text-sm"
            value={adminSigners}
            onChange={(e) => setAdminSigners(e.target.value)}
          />
        </div>
      </div>

      {/* Printable Official Convocatória Document */}
      <div className={printMode === 'attendance' ? 'no-print' : ''}>
        <div className="report-container bg-white rounded-2xl shadow-sm p-5 sm:p-10 print:p-2 border border-gray-200 print:border-none max-w-4xl mx-auto text-gray-900">
          <div className="text-center border-b-2 border-gray-800 pb-4 mb-8">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-600">
              Condomínio do Prédio sito na
            </p>
            <p className="text-base font-bold text-gray-900 mt-0.5">{buildingName}</p>
            <h1 className="text-2xl font-black tracking-wide uppercase mt-5 underline underline-offset-4">
              CONVOCATÓRIA
            </h1>
          </div>

          <div className="space-y-5 text-sm leading-relaxed text-justify">
            <p className="font-semibold">Exmo.(a) Senhor(a) Condómino(a),</p>

            <p>
              Nos termos do n.º 2 do artigo 1431.º e do n.º 1 do artigo 1432.º do Código Civil, fica V.ª Ex.ª convocado(a) para a{' '}
              <strong>Assembleia Geral {assemblyType} de Condóminos</strong>, a realizar no dia{' '}
              <strong className="uppercase">{formatMeetingDateLong(meetingDate)}</strong>, pelas{' '}
              <strong>{firstConvocationTime} horas</strong>, no <strong>{meetingLocation}</strong>, com a seguinte:
            </p>

            <div className="my-6 p-5 bg-gray-50 border border-gray-300 rounded-lg">
              <h2 className="text-sm font-black uppercase tracking-wider mb-3 text-gray-900">
                Ordem de Trabalhos
              </h2>
              <ol className="list-decimal pl-6 space-y-2">
                {visibleAgendaTitles.map((item, idx) => (
                  <li key={idx} className="font-medium text-gray-900">
                    {item}
                  </li>
                ))}
              </ol>
            </div>

            <p className="text-xs leading-relaxed text-gray-700 bg-gray-50/60 p-4 border-l-4 border-gray-700">
              Na reunião da Assembleia de Condóminos acima referida, se não estiverem presentes ou representados condóminos titulares da maioria dos votos representativos do capital investido no prédio, ou não for possível formar a maioria prevista no n.º 3 do art.º 1432.º do Código Civil, fica também desde já convocada nova reunião da Assembleia de Condóminos a realizar no <strong>mesmo dia e no mesmo local, trinta minutos depois ({secondConvocationTime} horas)</strong>, com a mesma ordem de trabalhos, a qual poderá deliberar por maioria dos votos dos proprietários presentes, desde que representem pelo menos um quarto do valor total do prédio, nos termos do n.º 4 do citado art.º 1432.º do Código Civil.
            </p>

            {extraNote.trim() && (
              <p className="text-xs italic text-gray-700">{extraNote}</p>
            )}

            <p className="pt-2">
              A sua comparência e participação são muito importantes para a gestão do nosso edifício.
            </p>
            <p>Com os melhores cumprimentos,</p>

            <div className="pt-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
              <p className="text-sm text-gray-700">
                Monte Abraão — Queluz,{' '}
                <strong>
                  {issueDate ? formatMeetingDateLong(issueDate) : '____ / ____ / ______'}
                </strong>
              </p>
              <div className="text-center min-w-[240px]">
                <div className="border-t border-gray-800 pt-2 whitespace-pre-line text-sm font-semibold">
                  {adminSigners}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Standalone Printable Attendance Sign-in Sheet (only visible when printing attendance sheet) */}
      {printMode === 'attendance' && (
        <div className="hidden print:block">
          <div className="report-container bg-white p-2 text-gray-900">
            <AttendanceSheetView
              buildingName={buildingName}
              actaNumber={actaNumber}
              assemblyType={assemblyType}
              meetingDate={meetingDate}
              startTime={selectedMeeting?.startTime || secondConvocationTime}
              firstConvocationTime={firstConvocationTime}
              location={meetingLocation}
              units={units}
              quorumMode={selectedMeeting?.quorumMode || 'units'}
              attendance={{}}
              permilagens={selectedMeeting?.attendance.permilagens || {}}
              representatives={{}}
              mode="signin"
            />
          </div>
        </div>
      )}
    </div>
  );
}
