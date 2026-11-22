'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import Sidebar from '@/components/Sidebar';
import {
  ACTION_PRIORITY_LABELS,
  ACTION_STATUS_LABELS,
  formatMeetingDateLong,
  formatMeetingDateShort,
  isPlaceholderAdminNames,
  MeetingActionItem,
  MeetingDiscussionPoint,
  MeetingQuorumSummary,
} from '@/lib/meetings';

interface ResidentActaItem {
  id: string;
  year: number;
  actaNumber: string;
  assemblyType: 'Ordinária' | 'Extraordinária';
  meetingDate: string;
  startTime: string;
  endTime: string;
  convocationUsed: '1.ª' | '2.ª';
  location: string;
  presidedBy: string;
  secretaryBy: string;
  newAdminNames: string;
  quorumMode: 'units' | 'permilagem';
  quorum: MeetingQuorumSummary;
  discussionPoints: MeetingDiscussionPoint[];
  actionItems: MeetingActionItem[];
  generalNotes: string;
  generatedAt: string | null;
}

interface ResidentMinuteDocument {
  id: string;
  name: string;
  filename: string;
  mimeType: string;
  size: number;
  description: string | null;
  uploadedAt: string;
}

interface AtasPayload {
  buildingName: string;
  meetings: ResidentActaItem[];
  documents: ResidentMinuteDocument[];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AtasPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  const [data, setData] = useState<AtasPayload | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/atas');
        if (!res.ok) {
          throw new Error('Não foi possível carregar as atas do condomínio.');
        }
        const json = (await res.json()) as AtasPayload;
        if (cancelled) return;
        setData(json);
        if (json.meetings.length > 0) {
          setSelectedId(json.meetings[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar atas.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedMeeting =
    data?.meetings.find((m) => m.id === selectedId) || data?.meetings[0] || null;

  const pointLabelById = new Map<string, string>();
  selectedMeeting?.discussionPoints.forEach((pt, idx) => {
    pointLabelById.set(pt.id, `Ponto ${idx + 1}`);
  });

  return (
    <div className="print-page-wrapper app-shell">
      <Sidebar />

      <main className="app-main">
        <div className="app-container space-y-6">
          {/* Page Header */}
          <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Atas de Assembleia
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Consulta das atas finalizadas, decisões aprovadas, plano de ações e documentos oficiais
              </p>
            </div>
            {isAdmin && (
              <Link
                href="/dashboard/admin/budgets?tab=acta"
                className="btn-secondary text-sm self-start sm:self-auto"
              >
                Gerir Reuniões &amp; Atas →
              </Link>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 font-medium">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 mb-3" />
              A carregar atas...
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-red-700 text-sm">
              {error}
            </div>
          ) : !data ? null : (
            <>
              {/* Section 1: Atas Digitais Finalizadas */}
              <section className="space-y-4">
                <div className="no-print flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">
                    Atas Digitais Finalizadas ({data.meetings.length})
                  </h2>
                </div>

                {data.meetings.length === 0 ? (
                  <div className="card text-center py-10 space-y-2">
                    <p className="text-sm font-medium text-slate-600">
                      Ainda não existem atas digitais finalizadas publicadas no portal.
                    </p>
                    <p className="text-xs text-slate-500">
                      Consulte abaixo os ficheiros de atas digitalizadas, se disponíveis.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left: Meetings list */}
                    <div className="no-print lg:col-span-4 space-y-2.5">
                      {data.meetings.map((m) => {
                        const active = selectedMeeting?.id === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setSelectedId(m.id)}
                            className={`w-full text-left p-4 rounded-2xl border transition-all ${
                              active
                                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-bold">
                                Acta N.º {m.actaNumber} · {m.assemblyType}
                              </span>
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                  active
                                    ? 'bg-white/15 text-white'
                                    : 'bg-emerald-50 text-emerald-700'
                                }`}
                              >
                                {formatMeetingDateShort(m.meetingDate)}
                              </span>
                            </div>
                            <p
                              className={`text-xs mt-1 truncate ${
                                active ? 'text-slate-300' : 'text-slate-500'
                              }`}
                            >
                              {m.location}
                            </p>
                            <p
                              className={`text-[11px] mt-1.5 ${
                                active ? 'text-slate-300' : 'text-slate-500'
                              }`}
                            >
                              {m.discussionPoints.length} pontos • {m.actionItems.length} ações • Quórum:{' '}
                              {m.quorum.shortSummary}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    {/* Right: Selected Acta Detail */}
                    {selectedMeeting && (
                      <div className="lg:col-span-8">
                        <div className="report-container card p-5 sm:p-8 print:p-2 space-y-6">
                          {/* Document Header */}
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 pb-4">
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                                {data.buildingName}
                              </p>
                              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                                ACTA N.º {selectedMeeting.actaNumber}
                              </h3>
                              <p className="text-xs font-semibold uppercase text-slate-500 mt-0.5">
                                Assembleia Geral {selectedMeeting.assemblyType} de Condóminos
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => window.print()}
                              className="no-print btn-primary text-xs h-9 px-4 self-start"
                            >
                              Imprimir / PDF
                            </button>
                          </div>

                          {/* Metadata Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                            <div>
                              <span className="text-slate-500">Data e Hora:</span>{' '}
                              <strong className="text-slate-900">
                                {formatMeetingDateLong(selectedMeeting.meetingDate)} ·{' '}
                                {selectedMeeting.startTime}
                                {selectedMeeting.endTime ? ` às ${selectedMeeting.endTime}` : ''} h (
                                {selectedMeeting.convocationUsed} Conv.)
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-500">Quórum:</span>{' '}
                              <strong className="text-slate-900">
                                {selectedMeeting.quorum.shortSummary}
                              </strong>
                            </div>
                            <div className="sm:col-span-2">
                              <span className="text-slate-500">Local:</span>{' '}
                              <strong className="text-slate-900">{selectedMeeting.location}</strong>
                            </div>
                            <div className="sm:col-span-2">
                              <span className="text-slate-500">Mesa da Assembleia:</span>{' '}
                              <span className="text-slate-800">
                                Presidente: <strong>{selectedMeeting.presidedBy}</strong> · Secretário:{' '}
                                <strong>{selectedMeeting.secretaryBy}</strong>
                              </span>
                            </div>
                          </div>

                          {/* Pontos Discutidos & Decisões */}
                          <div className="space-y-3">
                            <h4 className="text-sm font-black uppercase text-slate-900 border-b border-slate-300 pb-1">
                              Pontos Discutidos &amp; Decisões Tomadas
                            </h4>
                            {selectedMeeting.discussionPoints.length === 0 ? (
                              <p className="text-xs italic text-slate-500">
                                Sem pontos registados nesta ata.
                              </p>
                            ) : (
                              <div className="space-y-3">
                                {selectedMeeting.discussionPoints.map((pt, idx) => {
                                  const vote = [pt.votingOutcome, pt.votingDetails]
                                    .filter((v) => v && v.trim())
                                    .join(' — ');
                                  return (
                                    <div
                                      key={pt.id}
                                      className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-xs"
                                    >
                                      <p className="text-sm font-bold text-slate-900">
                                        Ponto {idx + 1} — {pt.title || `Assunto ${idx + 1}`}
                                      </p>
                                      {pt.discussion.trim() && (
                                        <p className="text-slate-700 whitespace-pre-line leading-relaxed">
                                          {pt.discussion.trim()}
                                        </p>
                                      )}
                                      {(vote || pt.decision.trim()) && (
                                        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 space-y-1 text-emerald-950">
                                          {vote && (
                                            <p>
                                              <strong>Votação:</strong> {vote}
                                            </p>
                                          )}
                                          {pt.decision.trim() && (
                                            <p className="whitespace-pre-line">
                                              <strong>Decisão:</strong> {pt.decision.trim()}
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Plano de Ações */}
                          <div className="space-y-3">
                            <h4 className="text-sm font-black uppercase text-slate-900 border-b border-slate-300 pb-1">
                              Plano de Ações e Responsabilidades
                            </h4>
                            {selectedMeeting.actionItems.length === 0 ? (
                              <p className="text-xs italic text-slate-500">
                                Não foram registadas ações pendentes nesta sessão.
                              </p>
                            ) : (
                              <div className="overflow-x-auto print:overflow-visible">
                                <table className="w-full text-xs border-collapse border border-slate-300">
                                  <thead>
                                    <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700">
                                      <th className="py-1.5 px-2 text-left">Ação</th>
                                      <th className="py-1.5 px-2 text-left">Ponto</th>
                                      <th className="py-1.5 px-2 text-left">Responsável</th>
                                      <th className="py-1.5 px-2 text-left">Prazo</th>
                                      <th className="py-1.5 px-2 text-left">Custo Est.</th>
                                      <th className="py-1.5 px-2 text-left">Estado</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {selectedMeeting.actionItems.map((act) => (
                                      <tr key={act.id} className="border-b border-slate-200 align-top">
                                        <td className="py-1.5 px-2">
                                          <div className="font-semibold text-slate-900">
                                            {act.priority === 'urgent' && (
                                              <span className="inline-block mr-1.5 px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-red-100 text-red-800">
                                                {ACTION_PRIORITY_LABELS.urgent}
                                              </span>
                                            )}
                                            {act.title || '—'}
                                          </div>
                                          {act.notes?.trim() && (
                                            <p className="text-[11px] text-slate-500 mt-0.5">
                                              {act.notes.trim()}
                                            </p>
                                          )}
                                        </td>
                                        <td className="py-1.5 px-2 text-slate-600">
                                          {act.pointId ? pointLabelById.get(act.pointId) || 'Geral' : 'Geral'}
                                        </td>
                                        <td className="py-1.5 px-2 text-slate-800">
                                          {act.responsible || 'Administração'}
                                        </td>
                                        <td className="py-1.5 px-2 whitespace-nowrap text-slate-700">
                                          {act.dueDate ? formatMeetingDateShort(act.dueDate) : 'A definir'}
                                        </td>
                                        <td className="py-1.5 px-2 whitespace-nowrap text-slate-700">
                                          {act.estimatedCost?.trim() || '—'}
                                        </td>
                                        <td className="py-1.5 px-2 whitespace-nowrap">
                                          <span
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                              act.status === 'done'
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : act.status === 'in_progress'
                                                ? 'bg-blue-100 text-blue-800'
                                                : 'bg-amber-100 text-amber-800'
                                            }`}
                                          >
                                            {ACTION_STATUS_LABELS[act.status] || act.status}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          {/* Eleição / Observações */}
                          {(!isPlaceholderAdminNames(selectedMeeting.newAdminNames) ||
                            selectedMeeting.generalNotes.trim()) && (
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                              {!isPlaceholderAdminNames(selectedMeeting.newAdminNames) && (
                                <p className="text-slate-900">
                                  <strong>Administração Eleita ({selectedMeeting.year + 1}):</strong>{' '}
                                  {selectedMeeting.newAdminNames}
                                </p>
                              )}
                              {selectedMeeting.generalNotes.trim() && (
                                <p className="text-slate-700 whitespace-pre-line">
                                  <strong>Observações Finais:</strong> {selectedMeeting.generalNotes.trim()}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Section 2: Documentos de Atas (PDF / Arquivo) */}
              <section className="no-print space-y-3 pt-2">
                <h2 className="text-base font-bold text-slate-900">
                  Documentos de Atas (PDF / Arquivo) ({data.documents.length})
                </h2>
                {data.documents.length === 0 ? (
                  <div className="card text-center py-8 text-xs text-slate-500">
                    Sem ficheiros de atas digitalizadas carregados.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.documents.map((doc) => (
                      <div key={doc.id} className="card flex flex-col justify-between gap-3">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-bold text-slate-900">{doc.name}</h3>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 shrink-0">
                              Ata
                            </span>
                          </div>
                          {doc.description && (
                            <p className="text-xs text-slate-600 mt-1">{doc.description}</p>
                          )}
                          <p className="text-[11px] text-slate-500 mt-2">
                            Carregado em {new Date(doc.uploadedAt).toLocaleDateString('pt-PT')} ·{' '}
                            {formatFileSize(doc.size)}
                          </p>
                        </div>

                        <a
                          href={`/api/documents/file?name=${encodeURIComponent(doc.filename)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-xs h-9 justify-center"
                        >
                          Abrir / Descarregar
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
