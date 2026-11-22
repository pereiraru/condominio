'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ACTION_PRIORITY_LABELS,
  ACTION_STATUS_LABELS,
  AttendanceStatus,
  computeMeetingQuorum,
  CondoMeetingDTO,
  createClientItemId,
  createDefaultDiscussionPoints,
  formatMeetingDateShort,
  inferLinkedSectionFromTitle,
  LINKED_SECTION_LABELS,
  MeetingActionItem,
  MeetingActionPriority,
  MeetingActionStatus,
  MeetingDiscussionPoint,
  MeetingLinkedSection,
  VOTING_OUTCOME_OPTIONS,
} from '@/lib/meetings';
import {
  AnnualReportData,
  BudgetLineInput,
  ConvocatoriaDraft,
  FeeSimulationConfig,
  UnitReportItem,
} from '../types';
import { formatUnitLabel } from '../utils';
import MeetingDocumentView from './MeetingDocumentView';

interface ActaTabProps {
  year: number;
  buildingName: string;
  units: UnitReportItem[];
  annualReport: AnnualReportData | null;
  budgetLines: BudgetLineInput[];
  feeSimConfig: FeeSimulationConfig;
  convocatoriaDraft?: ConvocatoriaDraft | null;
  pendingImportDraft?: ConvocatoriaDraft | null;
  onPendingImportConsumed?: () => void;
}

function buildDefaultStatuses(units: UnitReportItem[]): Record<string, AttendanceStatus> {
  const map: Record<string, AttendanceStatus> = {};
  units.forEach((u) => {
    map[u.id] = 'ausente';
  });
  return map;
}

function buildDefaultPermilagens(units: UnitReportItem[]): Record<string, number> {
  const map: Record<string, number> = {};
  units.forEach((u) => {
    map[u.id] = u.permilagem || 62.5;
  });
  return map;
}

function getDefaultMeetingDateIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

function suggestNextActaNumber(saved: CondoMeetingDTO[]): string {
  let maxNum = 23;
  for (const m of saved) {
    const parsed = parseInt(m.actaNumber, 10);
    if (Number.isFinite(parsed) && parsed > maxNum) {
      maxNum = parsed;
    }
  }
  return String(maxNum + 1);
}

export default function ActaTab({
  year,
  buildingName,
  units,
  annualReport,
  budgetLines,
  feeSimConfig,
  convocatoriaDraft,
  pendingImportDraft,
  onPendingImportConsumed,
}: ActaTabProps) {
  const nextYear = year + 1;

  const [savedMeetings, setSavedMeetings] = useState<CondoMeetingDTO[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(true);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [meetingStatus, setMeetingStatus] = useState<'draft' | 'finalized'>('draft');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const [templateMode, setTemplateMode] = useState<'filled' | 'blank'>('filled');
  const [actaNumber, setActaNumber] = useState<string>('24');
  const [assemblyType, setAssemblyType] = useState<'Ordinária' | 'Extraordinária'>('Ordinária');
  const [meetingDate, setMeetingDate] = useState<string>(getDefaultMeetingDateIso);
  const [startTime, setStartTime] = useState<string>('22:00');
  const [endTime, setEndTime] = useState<string>('');
  const [convocationUsed, setConvocationUsed] = useState<'1.ª' | '2.ª'>('2.ª');
  const [location, setLocation] = useState<string>('Parqueamento situado no Piso -4 do Edifício');
  const [presidedBy, setPresidedBy] = useState<string>('Administração Cessante');
  const [secretaryBy, setSecretaryBy] = useState<string>('A designar na reunião');
  const [newAdminNames, setNewAdminNames] = useState<string>(
    '_______________________________ e _______________________________'
  );
  const [generalNotes, setGeneralNotes] = useState<string>('');

  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>(() =>
    buildDefaultStatuses(units)
  );
  const [permilagens, setPermilagens] = useState<Record<string, number>>(() =>
    buildDefaultPermilagens(units)
  );
  const [representatives, setRepresentatives] = useState<Record<string, string>>({});

  const [discussionPoints, setDiscussionPoints] = useState<MeetingDiscussionPoint[]>(() =>
    createDefaultDiscussionPoints(year)
  );
  const [actionItems, setActionItems] = useState<MeetingActionItem[]>([]);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [generatedBanner, setGeneratedBanner] = useState<string | null>(null);

  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [emailMode, setEmailMode] = useState<'all_units' | 'custom'>('all_units');
  const [customEmails, setCustomEmails] = useState('');
  const [emailCustomNote, setEmailCustomNote] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const actionsSectionRef = useRef<HTMLDivElement>(null);
  const documentSectionRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  const hydrateFromMeeting = useCallback(
    (m: CondoMeetingDTO) => {
      setMeetingId(m.id);
      setMeetingStatus(m.status);
      setGeneratedAt(m.generatedAt);
      setActaNumber(m.actaNumber);
      setAssemblyType(m.assemblyType);
      setMeetingDate(m.meetingDate);
      setStartTime(m.startTime);
      setEndTime(m.endTime);
      setConvocationUsed(m.convocationUsed);
      setLocation(m.location);
      setPresidedBy(m.presidedBy);
      setSecretaryBy(m.secretaryBy);
      setNewAdminNames(
        m.newAdminNames || '_______________________________ e _______________________________'
      );
      setGeneralNotes(m.generalNotes || '');

      const mergedStatuses = buildDefaultStatuses(units);
      for (const [id, st] of Object.entries(m.attendance.statuses || {})) {
        mergedStatuses[id] = st;
      }
      setAttendance(mergedStatuses);

      const mergedPerm = buildDefaultPermilagens(units);
      for (const [id, perm] of Object.entries(m.attendance.permilagens || {})) {
        mergedPerm[id] = perm;
      }
      setPermilagens(mergedPerm);
      setRepresentatives({ ...(m.attendance.representatives || {}) });

      setDiscussionPoints(
        m.discussionPoints.length > 0
          ? m.discussionPoints
          : createDefaultDiscussionPoints(m.year || year)
      );
      setActionItems(m.actionItems || []);
      setGeneratedBanner(null);
      setFeedback(null);
      setEmailFeedback(null);
    },
    [units, year]
  );

  const startNewDraft = useCallback(
    (existingList: CondoMeetingDTO[] = savedMeetings) => {
      setMeetingId(null);
      setMeetingStatus('draft');
      setGeneratedAt(null);
      setActaNumber(suggestNextActaNumber(existingList));
      setAssemblyType('Ordinária');
      setMeetingDate(getDefaultMeetingDateIso());
      setStartTime('22:00');
      setEndTime('');
      setConvocationUsed('2.ª');
      setLocation('Parqueamento situado no Piso -4 do Edifício');
      setPresidedBy('Administração Cessante');
      setSecretaryBy('A designar na reunião');
      setNewAdminNames('_______________________________ e _______________________________');
      setGeneralNotes('');
      setAttendance(buildDefaultStatuses(units));
      setPermilagens(buildDefaultPermilagens(units));
      setRepresentatives({});
      setDiscussionPoints(createDefaultDiscussionPoints(year));
      setActionItems([]);
      setGeneratedBanner(null);
      setFeedback(null);
      setEmailFeedback(null);
    },
    [savedMeetings, units, year]
  );

  const hydrateRef = useRef(hydrateFromMeeting);
  hydrateRef.current = hydrateFromMeeting;
  const yearRef = useRef(year);
  yearRef.current = year;
  const pendingImportAtMountRef = useRef(Boolean(pendingImportDraft));

  useEffect(() => {
    let cancelled = false;
    async function loadMeetings() {
      setLoadingMeetings(true);
      try {
        const res = await fetch('/api/admin/meetings');
        if (!res.ok) return;
        const list = (await res.json()) as CondoMeetingDTO[];
        if (cancelled) return;
        setSavedMeetings(list);
        if (!initializedRef.current) {
          initializedRef.current = true;
          const matchingYear = list.find((m) => m.year === yearRef.current) || list[0];
          if (matchingYear && !pendingImportAtMountRef.current) {
            hydrateRef.current(matchingYear);
          }
        }
      } catch (err) {
        console.error('Failed to load condo meetings:', err);
      } finally {
        if (!cancelled) setLoadingMeetings(false);
      }
    }
    loadMeetings();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyConvocatoriaDraft = useCallback(
    (draft: ConvocatoriaDraft) => {
      setAssemblyType(draft.assemblyType);
      if (draft.meetingDate) setMeetingDate(draft.meetingDate);
      if (draft.meetingTime) setStartTime(draft.meetingTime);
      if (draft.location.trim()) setLocation(draft.location.trim());

      if (draft.agendaItems.length > 0) {
        setDiscussionPoints((prev) => {
          const existingBySection = new Map<MeetingLinkedSection, MeetingDiscussionPoint>();
          const existingByTitle = new Map<string, MeetingDiscussionPoint>();
          for (const pt of prev) {
            if (pt.linkedSection !== 'none' && !existingBySection.has(pt.linkedSection)) {
              existingBySection.set(pt.linkedSection, pt);
            }
            const norm = pt.title.trim().toLowerCase();
            if (norm) existingByTitle.set(norm, pt);
          }

          return draft.agendaItems.map((title) => {
            const inferred = inferLinkedSectionFromTitle(title);
            const matched =
              existingByTitle.get(title.trim().toLowerCase()) ||
              (inferred !== 'none' ? existingBySection.get(inferred) : undefined);

            if (matched) {
              return { ...matched, title };
            }
            return {
              id: createClientItemId('pt'),
              title,
              linkedSection: inferred,
              discussion: '',
              votingOutcome: 'Tomado conhecimento (sem votação)',
              votingDetails: '',
              decision: '',
            };
          });
        });
      }

      setFeedback({
        type: 'ok',
        text: 'Dados e ordem de trabalhos importados da Convocatória para a Reunião.',
      });
    },
    []
  );

  useEffect(() => {
    if (!pendingImportDraft) return;
    applyConvocatoriaDraft(pendingImportDraft);
    onPendingImportConsumed?.();
  }, [pendingImportDraft, applyConvocatoriaDraft, onPendingImportConsumed]);

  const { presentCount, totalPermilagem: totalPermilagemPresent } = useMemo(
    () =>
      computeMeetingQuorum(
        units.map((u) => u.id),
        { statuses: attendance, permilagens, representatives }
      ),
    [units, attendance, permilagens, representatives]
  );

  const quorumStatus =
    totalPermilagemPresent > 500
      ? 'Quórum para 1.ª Convocatória (> 500‰)'
      : totalPermilagemPresent >= 250
      ? 'Quórum para 2.ª Convocatória (≥ 250‰)'
      : 'Sem quórum mínimo legal (< 250‰)';

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

  const decisionsCount = useMemo(
    () => discussionPoints.filter((pt) => pt.decision.trim() || pt.votingOutcome.trim()).length,
    [discussionPoints]
  );

  function addDiscussionPoint() {
    setDiscussionPoints((prev) => [
      ...prev,
      {
        id: createClientItemId('pt'),
        title: `Novo Assunto Discutido (${prev.length + 1})`,
        linkedSection: 'none',
        discussion: '',
        votingOutcome: 'Aprovado por unanimidade',
        votingDetails: '',
        decision: '',
      },
    ]);
  }

  function updateDiscussionPoint(id: string, patch: Partial<MeetingDiscussionPoint>) {
    setDiscussionPoints((prev) => prev.map((pt) => (pt.id === id ? { ...pt, ...patch } : pt)));
  }

  function moveDiscussionPoint(idx: number, direction: -1 | 1) {
    setDiscussionPoints((prev) => {
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, item);
      return copy;
    });
  }

  function removeDiscussionPoint(id: string) {
    setDiscussionPoints((prev) => prev.filter((pt) => pt.id !== id));
    setActionItems((prev) =>
      prev.map((act) => (act.pointId === id ? { ...act, pointId: undefined } : act))
    );
  }

  function addActionItem(linkedPointId?: string) {
    setActionItems((prev) => [
      ...prev,
      {
        id: createClientItemId('act'),
        pointId: linkedPointId,
        title: '',
        responsible: 'Administração',
        dueDate: '',
        estimatedCost: '',
        priority: 'normal',
        status: 'pending',
        notes: '',
      },
    ]);
    if (linkedPointId) {
      setTimeout(() => {
        actionsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
  }

  function updateActionItem(id: string, patch: Partial<MeetingActionItem>) {
    setActionItems((prev) => prev.map((act) => (act.id === id ? { ...act, ...patch } : act)));
  }

  function removeActionItem(id: string) {
    setActionItems((prev) => prev.filter((act) => act.id !== id));
  }

  function setAllAttendance(statusValue: AttendanceStatus) {
    const next: Record<string, AttendanceStatus> = {};
    units.forEach((u) => {
      next[u.id] = statusValue;
    });
    setAttendance(next);
  }

  async function saveMeeting(
    targetStatus: 'draft' | 'finalized',
    opts?: { silentScroll?: boolean }
  ): Promise<CondoMeetingDTO | null> {
    setSaving(true);
    setFeedback(null);
    if (targetStatus === 'draft') {
      setGeneratedBanner(null);
    }

    const payload = {
      year,
      actaNumber,
      assemblyType,
      meetingDate,
      startTime,
      endTime,
      convocationUsed,
      location,
      presidedBy,
      secretaryBy,
      newAdminNames,
      status: targetStatus,
      regenerate: targetStatus === 'finalized',
      generalNotes,
      attendance: {
        statuses: attendance,
        permilagens,
        representatives,
      },
      discussionPoints,
      actionItems,
    };

    try {
      const url = meetingId ? `/api/admin/meetings/${meetingId}` : '/api/admin/meetings';
      const method = meetingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', text: data.error || 'Falha ao guardar reunião.' });
        return null;
      }

      const saved = data as CondoMeetingDTO;
      setMeetingId(saved.id);
      setMeetingStatus(saved.status);
      setGeneratedAt(saved.generatedAt);

      setSavedMeetings((prev) => {
        const exists = prev.some((m) => m.id === saved.id);
        return exists ? prev.map((m) => (m.id === saved.id ? saved : m)) : [saved, ...prev];
      });

      if (targetStatus === 'finalized') {
        setTemplateMode('filled');
        const msg = `Reunião / Ata N.º ${saved.actaNumber} gerada e guardada com sucesso (${discussionPoints.length} pontos discutidos, ${decisionsCount} decisões, ${actionItems.length} ações).`;
        setGeneratedBanner(msg);
        setFeedback({ type: 'ok', text: msg });
        if (!opts?.silentScroll) {
          setTimeout(() => {
            documentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 80);
        }
      } else {
        setFeedback({
          type: 'ok',
          text: `Rascunho da Acta N.º ${saved.actaNumber} guardado às ${new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}.`,
        });
      }

      return saved;
    } catch {
      setFeedback({ type: 'err', text: 'Erro de ligação ao servidor ao guardar reunião.' });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCurrent() {
    if (!meetingId) return;
    const confirmed = window.confirm(
      `Eliminar a reunião guardada "Acta N.º ${actaNumber}"? Esta ação não pode ser anulada.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/meetings/${meetingId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setFeedback({ type: 'err', text: data.error || 'Erro ao eliminar reunião.' });
        return;
      }

      const remaining = savedMeetings.filter((m) => m.id !== meetingId);
      setSavedMeetings(remaining);
      if (remaining.length > 0) {
        hydrateFromMeeting(remaining[0]);
      } else {
        startNewDraft([]);
      }
      setFeedback({ type: 'ok', text: 'Reunião eliminada com sucesso.' });
    } catch {
      setFeedback({ type: 'err', text: 'Erro ao eliminar reunião.' });
    }
  }

  async function handleSendEmail() {
    setSendingEmail(true);
    setEmailFeedback(null);

    try {
      let targetId = meetingId;
      if (!targetId) {
        const saved = await saveMeeting(meetingStatus, { silentScroll: true });
        if (!saved) {
          setEmailFeedback({
            type: 'err',
            text: 'Não foi possível guardar a reunião antes de enviar o email.',
          });
          return;
        }
        targetId = saved.id;
      }

      const res = await fetch(`/api/admin/meetings/${targetId}/send-email`, {
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
          text: data.reason || data.error || 'Não foi possível enviar o email.',
        });
      } else {
        setEmailFeedback({
          type: 'ok',
          text: `Resumo enviado para ${data.recipients.length} destinatário(s): ${data.recipients.join(', ')}.`,
        });
      }
    } catch {
      setEmailFeedback({ type: 'err', text: 'Erro ao enviar resumo por email.' });
    } finally {
      setSendingEmail(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Editor Controls (hidden on print) */}
      <div className="no-print space-y-6">
        {/* Top Bar: Saved Meetings + Primary Actions */}
        <div className="card space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Reunião de Condomínio, Pontos Discutidos, Ações &amp; Ata
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Registe presenças, adicione pontos discutidos com votação e decisões, defina o plano de ações e gere a Ata oficial.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-gray-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setTemplateMode('filled')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    templateMode === 'filled' ? 'bg-gray-900 text-white' : 'text-gray-600'
                  }`}
                >
                  Ata Preenchida ({year}/{nextYear})
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateMode('blank')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    templateMode === 'blank' ? 'bg-gray-900 text-white' : 'text-gray-600'
                  }`}
                >
                  Template em Branco
                </button>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => saveMeeting('draft')}
                className="btn-secondary text-xs h-9 px-3.5"
              >
                {saving ? 'A guardar...' : 'Guardar Rascunho'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => saveMeeting('finalized')}
                className="btn-primary text-xs h-9 px-4"
              >
                {saving ? 'A gerar...' : 'Gerar Reunião / Ata Final'}
              </button>
            </div>
          </div>

          {/* Saved meetings bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold text-gray-600">Reunião guardada:</label>
              <select
                className="input h-9 text-xs w-auto min-w-[260px]"
                disabled={loadingMeetings}
                value={meetingId || '__new__'}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__new__') {
                    startNewDraft(savedMeetings);
                    return;
                  }
                  const found = savedMeetings.find((m) => m.id === val);
                  if (found) hydrateFromMeeting(found);
                }}
              >
                <option value="__new__">
                  {meetingId ? '— Iniciar nova reunião (rascunho) —' : `Nova Reunião (Ata N.º ${actaNumber})`}
                </option>
                {savedMeetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    Acta N.º {m.actaNumber} ({m.assemblyType}) — {formatMeetingDateShort(m.meetingDate)} [
                    {m.status === 'finalized' ? 'Finalizada' : 'Rascunho'}]
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => startNewDraft(savedMeetings)}
                className="px-3 h-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700"
              >
                + Nova Reunião
              </button>

              {meetingId && (
                <button
                  type="button"
                  onClick={handleDeleteCurrent}
                  className="px-3 h-9 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-700"
                >
                  Eliminar
                </button>
              )}
            </div>

            {convocatoriaDraft && (
              <button
                type="button"
                onClick={() => applyConvocatoriaDraft(convocatoriaDraft)}
                className="px-3 h-9 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-xs font-semibold text-blue-800"
              >
                Importar Ordem de Trabalhos da Convocatória
              </button>
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
        </div>

        {/* Section 1: Metadata + Attendance */}
        <div className="card space-y-5">
          <h3 className="text-base font-bold text-gray-900">1. Dados da Sessão e Presenças</h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="label text-xs">N.º da Ata</label>
              <input
                type="text"
                className="input h-9 text-sm font-bold"
                value={actaNumber}
                onChange={(e) => setActaNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">Tipo</label>
              <select
                className="input h-9 text-sm"
                value={assemblyType}
                onChange={(e) => setAssemblyType(e.target.value as 'Ordinária' | 'Extraordinária')}
              >
                <option value="Ordinária">Ordinária</option>
                <option value="Extraordinária">Extraordinária</option>
              </select>
            </div>
            <div>
              <label className="label text-xs">Data</label>
              <input
                type="date"
                className="input h-9 text-sm"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label text-xs">Início</label>
                <input
                  type="time"
                  className="input h-9 px-2 text-xs"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <label className="label text-xs">Fim</label>
                <input
                  type="time"
                  className="input h-9 px-2 text-xs"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
              <div>
                <label className="label text-xs">Conv.</label>
                <select
                  className="input h-9 px-2 text-xs"
                  value={convocationUsed}
                  onChange={(e) => setConvocationUsed(e.target.value as '1.ª' | '2.ª')}
                >
                  <option value="1.ª">1.ª</option>
                  <option value="2.ª">2.ª</option>
                </select>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="label text-xs">Local</label>
              <input
                type="text"
                className="input h-9 text-sm"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">Presidente da Mesa</label>
              <input
                type="text"
                className="input h-9 text-sm"
                value={presidedBy}
                onChange={(e) => setPresidedBy(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">Secretário / Redator</label>
              <input
                type="text"
                className="input h-9 text-sm"
                value={secretaryBy}
                onChange={(e) => setSecretaryBy(e.target.value)}
              />
            </div>

            <div className="md:col-span-4">
              <label className="label text-xs">Administração Eleita para {nextYear}</label>
              <input
                type="text"
                className="input h-9 text-sm"
                placeholder="Ex.: Fração 2D (Rui Pereira) e Fração 4E (...)"
                value={newAdminNames}
                onChange={(e) => setNewAdminNames(e.target.value)}
              />
            </div>
          </div>

          {/* Interactive Attendance Selector */}
          <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50/70">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h4 className="text-sm font-bold text-gray-900">
                Controlo de Presenças e Permilagens
              </h4>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAllAttendance('presente')}
                  className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-[11px] font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Marcar Todos Presentes
                </button>
                <button
                  type="button"
                  onClick={() => setAllAttendance('ausente')}
                  className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-[11px] font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Limpar Presenças
                </button>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    totalPermilagemPresent >= 250
                      ? 'bg-green-100 text-green-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {presentCount}/{units.length} frações • {totalPermilagemPresent.toFixed(1)}‰ (
                  {(totalPermilagemPresent / 10).toFixed(1)}%) — {quorumStatus}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
              {units.map((u) => {
                const st = attendance[u.id] || 'ausente';
                return (
                  <div
                    key={u.id}
                    className={`p-2.5 rounded-xl border text-xs flex flex-col gap-1.5 ${
                      st !== 'ausente' ? 'bg-white border-green-300' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-gray-900">
                        {u.code} ({formatUnitLabel(u.code)})
                      </span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.5"
                          className="w-14 text-right border border-gray-200 rounded px-1 py-0.5 text-[11px]"
                          value={permilagens[u.id] ?? 62.5}
                          onChange={(e) =>
                            setPermilagens({
                              ...permilagens,
                              [u.id]: parseFloat(e.target.value) || 0,
                            })
                          }
                          title="Permilagem (‰)"
                        />
                        <span className="text-[10px] text-gray-400">‰</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500 truncate">
                      {u.currentOwner?.name || 'N/D'}
                    </p>
                    <div className="flex gap-1">
                      {(['presente', 'representado', 'ausente'] as AttendanceStatus[]).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setAttendance({ ...attendance, [u.id]: opt })}
                          className={`flex-1 py-1 rounded text-[10px] font-bold uppercase ${
                            st === opt
                              ? opt === 'ausente'
                                ? 'bg-gray-700 text-white'
                                : 'bg-green-600 text-white'
                              : 'bg-gray-200/70 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {opt === 'presente' ? 'Pres.' : opt === 'representado' ? 'Repr.' : 'Aus.'}
                        </button>
                      ))}
                    </div>
                    {st === 'representado' && (
                      <input
                        type="text"
                        className="border border-gray-200 rounded px-2 py-1 text-[11px] bg-white"
                        placeholder="Representado por..."
                        value={representatives[u.id] || ''}
                        onChange={(e) =>
                          setRepresentatives({ ...representatives, [u.id]: e.target.value })
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section 2: Pontos Discutidos & Decisões Tomadas */}
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                2. Pontos Discutidos &amp; Decisões Tomadas ({discussionPoints.length})
              </h3>
              <p className="text-xs text-gray-500">
                Documente o que foi discutido em cada ponto, o resultado da votação e a decisão tomada pela assembleia.
              </p>
            </div>
            <button
              type="button"
              onClick={addDiscussionPoint}
              className="btn-primary text-xs h-9 px-4"
            >
              + Adicionar Ponto Discutido
            </button>
          </div>

          {discussionPoints.length === 0 ? (
            <div className="border border-dashed border-gray-300 rounded-2xl p-6 text-center text-sm text-gray-500 space-y-2">
              <p>Ainda não existem pontos discutidos registados.</p>
              <button
                type="button"
                onClick={addDiscussionPoint}
                className="btn-secondary text-xs h-8 px-3"
              >
                + Adicionar Primeiro Ponto
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {discussionPoints.map((pt, idx) => {
                const isPresetVote = VOTING_OUTCOME_OPTIONS.includes(pt.votingOutcome);
                return (
                  <div
                    key={pt.id}
                    className="border border-gray-200 rounded-2xl p-4 bg-gray-50/50 space-y-3"
                  >
                    {/* Card Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-gray-900 text-white text-xs font-bold">
                          Ponto {idx + 1}
                        </span>
                        <select
                          className="input h-8 text-xs w-auto bg-white"
                          value={pt.linkedSection}
                          onChange={(e) =>
                            updateDiscussionPoint(pt.id, {
                              linkedSection: e.target.value as MeetingLinkedSection,
                            })
                          }
                          title="Anexar quadro financeiro automático"
                        >
                          {(Object.keys(LINKED_SECTION_LABELS) as MeetingLinkedSection[]).map(
                            (sec) => (
                              <option key={sec} value={sec}>
                                {LINKED_SECTION_LABELS[sec]}
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveDiscussionPoint(idx, -1)}
                          className="px-2 py-1 rounded border border-gray-200 bg-white text-xs text-gray-600 disabled:opacity-40 hover:bg-gray-100"
                          title="Mover para cima"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={idx === discussionPoints.length - 1}
                          onClick={() => moveDiscussionPoint(idx, 1)}
                          className="px-2 py-1 rounded border border-gray-200 bg-white text-xs text-gray-600 disabled:opacity-40 hover:bg-gray-100"
                          title="Mover para baixo"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDiscussionPoint(pt.id)}
                          className="px-2 py-1 rounded border border-red-200 bg-white text-xs text-red-600 hover:bg-red-50"
                          title="Remover ponto"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Title */}
                    <div>
                      <label className="label text-xs">Título / Assunto do Ponto</label>
                      <input
                        type="text"
                        className="input h-9 text-sm font-semibold bg-white"
                        value={pt.title}
                        placeholder="Ex.: Reparação da porta da garagem / Manutenção do telhado..."
                        onChange={(e) => updateDiscussionPoint(pt.id, { title: e.target.value })}
                      />
                    </div>

                    {/* Discussion */}
                    <div>
                      <label className="label text-xs">Resumo da Discussão / Intervenções</label>
                      <textarea
                        rows={3}
                        className="input h-auto py-2 text-xs bg-white"
                        value={pt.discussion}
                        placeholder="Registe os principais argumentos, esclarecimentos prestados e pontos levantados pelos condóminos..."
                        onChange={(e) =>
                          updateDiscussionPoint(pt.id, { discussion: e.target.value })
                        }
                      />
                    </div>

                    {/* Voting + Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="label text-xs">Resultado da Votação</label>
                        <select
                          className="input h-9 text-xs bg-white"
                          value={isPresetVote ? pt.votingOutcome : '__custom__'}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val !== '__custom__') {
                              updateDiscussionPoint(pt.id, { votingOutcome: val });
                            }
                          }}
                        >
                          {VOTING_OUTCOME_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                          {!isPresetVote && pt.votingOutcome && (
                            <option value="__custom__">{pt.votingOutcome}</option>
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="label text-xs">
                          Detalhes da Votação / Permilagem (opcional)
                        </label>
                        <input
                          type="text"
                          className="input h-9 text-xs bg-white"
                          placeholder="Ex.: 10 a favor, 0 contra, 1 abstenção (687,5‰)"
                          value={pt.votingDetails}
                          onChange={(e) =>
                            updateDiscussionPoint(pt.id, { votingDetails: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    {/* Decision */}
                    <div>
                      <label className="label text-xs text-emerald-900">
                        Decisão / Deliberação Tomada
                      </label>
                      <textarea
                        rows={2}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-emerald-300 bg-emerald-50/40 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none"
                        placeholder="Ex.: Aprovado pedir 3 orçamentos até ao final do mês e avançar com a reparação até 500 €..."
                        value={pt.decision}
                        onChange={(e) => updateDiscussionPoint(pt.id, { decision: e.target.value })}
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => addActionItem(pt.id)}
                        className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 text-xs font-semibold text-gray-800"
                      >
                        + Criar Ação para este Ponto
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 3: Plano de Ações */}
        <div ref={actionsSectionRef} className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                3. Plano de Ações &amp; Responsabilidades ({actionItems.length})
              </h3>
              <p className="text-xs text-gray-500">
                Defina tarefas concretas resultantes da assembleia, respetivo responsável, prazo e estado de execução.
              </p>
            </div>
            <button
              type="button"
              onClick={() => addActionItem()}
              className="btn-primary text-xs h-9 px-4"
            >
              + Adicionar Ação
            </button>
          </div>

          {actionItems.length === 0 ? (
            <div className="border border-dashed border-gray-300 rounded-2xl p-6 text-center text-sm text-gray-500 space-y-2">
              <p>Nenhuma ação registada ainda.</p>
              <button
                type="button"
                onClick={() => addActionItem()}
                className="btn-secondary text-xs h-8 px-3"
              >
                + Adicionar Primeira Ação
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {actionItems.map((act, idx) => (
                <div
                  key={act.id}
                  className="border border-gray-200 rounded-2xl p-4 bg-gray-50/50 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-gray-700">Ação #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeActionItem(act.id)}
                      className="px-2 py-0.5 rounded border border-red-200 bg-white text-xs text-red-600 hover:bg-red-50"
                      title="Remover ação"
                    >
                      ✕ Remover
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="label text-xs">Descrição da Ação / Tarefa</label>
                      <input
                        type="text"
                        className="input h-9 text-sm bg-white"
                        placeholder="Ex.: Solicitar orçamento para substituição da lâmpada da garagem"
                        value={act.title}
                        onChange={(e) => updateActionItem(act.id, { title: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Ponto Relacionado</label>
                      <select
                        className="input h-9 text-xs bg-white"
                        value={act.pointId || ''}
                        onChange={(e) =>
                          updateActionItem(act.id, {
                            pointId: e.target.value || undefined,
                          })
                        }
                      >
                        <option value="">Geral</option>
                        {discussionPoints.map((pt, pIdx) => (
                          <option key={pt.id} value={pt.id}>
                            Ponto {pIdx + 1} — {pt.title || 'Sem título'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                      <label className="label text-xs">Responsável</label>
                      <input
                        type="text"
                        className="input h-9 text-xs bg-white"
                        placeholder="Ex.: Administração / Fração 2D"
                        value={act.responsible}
                        onChange={(e) => updateActionItem(act.id, { responsible: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Prazo</label>
                      <input
                        type="date"
                        className="input h-9 text-xs bg-white"
                        value={act.dueDate}
                        onChange={(e) => updateActionItem(act.id, { dueDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Custo Est. (opcional)</label>
                      <input
                        type="text"
                        className="input h-9 text-xs bg-white"
                        placeholder="Ex.: ~150 €"
                        value={act.estimatedCost || ''}
                        onChange={(e) =>
                          updateActionItem(act.id, { estimatedCost: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Prioridade</label>
                      <select
                        className="input h-9 text-xs bg-white"
                        value={act.priority}
                        onChange={(e) =>
                          updateActionItem(act.id, {
                            priority: e.target.value as MeetingActionPriority,
                          })
                        }
                      >
                        {(Object.keys(ACTION_PRIORITY_LABELS) as MeetingActionPriority[]).map(
                          (prio) => (
                            <option key={prio} value={prio}>
                              {ACTION_PRIORITY_LABELS[prio]}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="label text-xs">Estado</label>
                      <select
                        className="input h-9 text-xs bg-white"
                        value={act.status}
                        onChange={(e) =>
                          updateActionItem(act.id, {
                            status: e.target.value as MeetingActionStatus,
                          })
                        }
                      >
                        {(Object.keys(ACTION_STATUS_LABELS) as MeetingActionStatus[]).map((st) => (
                          <option key={st} value={st}>
                            {ACTION_STATUS_LABELS[st]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="label text-xs">Notas / Observações da Ação (opcional)</label>
                    <input
                      type="text"
                      className="input h-8 text-xs bg-white"
                      placeholder="Contexto adicional, fornecedor preferencial ou condições aprovadas..."
                      value={act.notes || ''}
                      onChange={(e) => updateActionItem(act.id, { notes: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 4: General Notes & Generate Footer */}
        <div className="card space-y-4">
          <div>
            <label className="label text-xs font-bold text-gray-800">
              4. Observações Finais / Notas Gerais (opcional)
            </label>
            <textarea
              rows={2}
              className="input h-auto py-2 text-xs"
              placeholder="Notas complementares sobre a sessão ou próximos passos..."
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-600">
              <strong>{discussionPoints.length}</strong> ponto(s) discutido(s) •{' '}
              <strong>{decisionsCount}</strong> decisão(ões) registada(s) •{' '}
              <strong>{actionItems.length}</strong> ação(ões) no plano •{' '}
              Quórum: <strong>{totalPermilagemPresent.toFixed(1)}‰</strong>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => saveMeeting('draft')}
                className="btn-secondary text-sm h-10"
              >
                Guardar Rascunho
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => saveMeeting('finalized')}
                className="btn-primary text-sm h-10"
              >
                {saving ? 'A gerar...' : 'Gerar Reunião / Ata Final'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Generated Document Toolbar & Email Panel (hidden on print) */}
      <div ref={documentSectionRef} className="no-print max-w-4xl mx-auto space-y-3">
        {generatedBanner && (
          <div className="px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold">
            {generatedBanner}
          </div>
        )}

        <div className="card p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  meetingStatus === 'finalized'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {meetingStatus === 'finalized'
                  ? `Ata Finalizada${generatedAt ? ` em ${new Date(generatedAt).toLocaleString('pt-PT')}` : ''}`
                  : 'Rascunho — clique em "Gerar Reunião / Ata Final" para oficializar'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowEmailPanel((prev) => !prev)}
                className="btn-secondary text-xs h-9 px-3.5"
              >
                Enviar Resumo por Email
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-primary text-xs h-9 px-4"
              >
                Imprimir / Guardar PDF
              </button>
            </div>
          </div>

          {showEmailPanel && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="flex items-center gap-2 font-semibold text-gray-800 cursor-pointer">
                  <input
                    type="radio"
                    name="meetingEmailMode"
                    checked={emailMode === 'all_units'}
                    onChange={() => setEmailMode('all_units')}
                  />
                  Todos os condóminos com email ({unitIdsWithEmailCount} frações)
                </label>
                <label className="flex items-center gap-2 font-semibold text-gray-800 cursor-pointer">
                  <input
                    type="radio"
                    name="meetingEmailMode"
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
                <label className="label text-xs">Nota introdutória no email (opcional)</label>
                <textarea
                  rows={2}
                  className="input h-auto py-2 text-xs bg-white"
                  placeholder="Ex.: Segue em resumo a ata com as decisões tomadas e o plano de ações da assembleia..."
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
                  onClick={handleSendEmail}
                  className="btn-primary text-xs h-8 px-4"
                >
                  {sendingEmail ? 'A enviar...' : 'Confirmar Envio'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Printable Official Minutes (ACTA) */}
      <MeetingDocumentView
        year={year}
        buildingName={buildingName}
        units={units}
        annualReport={annualReport}
        budgetLines={budgetLines}
        feeSimConfig={feeSimConfig}
        templateMode={templateMode}
        actaNumber={actaNumber}
        assemblyType={assemblyType}
        meetingDate={meetingDate}
        startTime={startTime}
        endTime={endTime}
        convocationUsed={convocationUsed}
        location={location}
        presidedBy={presidedBy}
        secretaryBy={secretaryBy}
        newAdminNames={newAdminNames}
        generalNotes={generalNotes}
        attendance={attendance}
        permilagens={permilagens}
        representatives={representatives}
        discussionPoints={discussionPoints}
        actionItems={actionItems}
      />
    </div>
  );
}
