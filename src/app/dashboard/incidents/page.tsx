'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import IncidentReportModal from '@/components/IncidentReportModal';
import IncidentDetailModal from '@/components/IncidentDetailModal';
import {
  LOCATION_LABEL_MAP,
  PRIORITY_STYLE_MAP,
  STATUS_STYLE_MAP,
} from '@/lib/incidentConstants';
import type { Incident } from '@/lib/types';

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

function IncidentsPageContent() {
  const searchParams = useSearchParams();
  const initialIncidentId = searchParams.get('id');

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'open' | 'in_progress' | 'scheduled' | 'resolved'>('all');
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(initialIncidentId);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/incidents');
      if (res.ok) {
        setIncidents(await res.json());
      }
    } catch (error) {
      console.error('Error loading incidents:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  useEffect(() => {
    if (initialIncidentId) {
      setSelectedIncidentId(initialIncidentId);
    }
  }, [initialIncidentId]);

  const filteredIncidents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return incidents.filter((inc) => {
      if (statusFilter === 'active') {
        if (!['open', 'in_progress', 'scheduled'].includes(inc.status)) return false;
      } else if (statusFilter !== 'all' && inc.status !== statusFilter) {
        return false;
      }

      if (!q) return true;
      return (
        inc.code.toLowerCase().includes(q) ||
        inc.title.toLowerCase().includes(q) ||
        inc.description.toLowerCase().includes(q) ||
        (inc.reportedByUnit?.code || '').toLowerCase().includes(q) ||
        inc.reportedByName.toLowerCase().includes(q) ||
        (LOCATION_LABEL_MAP[inc.location] || '').toLowerCase().includes(q)
      );
    });
  }, [incidents, searchTerm, statusFilter]);

  const activeCount = incidents.filter((i) =>
    ['open', 'in_progress', 'scheduled'].includes(i.status)
  ).length;
  const resolvedCount = incidents.filter((i) =>
    ['resolved', 'closed'].includes(i.status)
  ).length;

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="app-main">
        <div className="app-container">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                Anomalias & Incidentes
              </h1>
              <p className="text-gray-500 mt-1">
                Registo de ocorrências no edifício, acompanhamento técnico e histórico de resoluções
              </p>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={() => setReportOpen(true)}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Reportar Anomalia</span>
            </button>
          </div>

          {bannerMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center justify-between gap-2">
              <span>{bannerMsg}</span>
              <button
                type="button"
                onClick={() => setBannerMsg(null)}
                className="text-emerald-700 hover:text-emerald-900 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Filters & Search */}
          <div className="flex flex-col lg:flex-row justify-between gap-4 mb-6">
            <div className="relative group max-w-md w-full">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Procurar código, assunto, zona ou fração..."
                className="input pl-10 bg-white border-gray-200 shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex gap-1.5 bg-slate-200/70 p-1 rounded-xl overflow-x-auto max-w-full">
              {[
                { id: 'all' as const, label: `Todos (${incidents.length})` },
                { id: 'active' as const, label: `Em Aberto (${activeCount})` },
                { id: 'in_progress' as const, label: 'Em Tratamento' },
                { id: 'scheduled' as const, label: 'Agendados' },
                { id: 'resolved' as const, label: `Resolvidos (${resolvedCount})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    statusFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500 font-medium">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 mb-3"></div>
              A carregar anomalias...
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center space-y-3">
              <p className="text-gray-500 text-sm">
                Nenhuma anomalia encontrada com os filtros selecionados.
              </p>
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className="btn-secondary text-sm"
              >
                + Reportar primeira anomalia
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredIncidents.map((inc) => {
                const statusMeta = STATUS_STYLE_MAP[inc.status] || STATUS_STYLE_MAP.open;
                const priorityMeta = PRIORITY_STYLE_MAP[inc.priority] || PRIORITY_STYLE_MAP.normal;
                const locationLabel = LOCATION_LABEL_MAP[inc.location] || inc.location;
                const photoCount = inc.attachments?.length ?? 0;

                return (
                  <div
                    key={inc.id}
                    onClick={() => setSelectedIncidentId(inc.id)}
                    className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 cursor-pointer px-5 py-3.5"
                  >
                    {/* Line 1 */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${statusMeta.iconBgClass}`}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                              {inc.code}
                            </span>
                            <h3 className="text-base font-bold text-gray-900 group-hover:text-gray-700">
                              {inc.title}
                            </h3>
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              {locationLabel}
                            </span>
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${priorityMeta.badgeClass}`}
                            >
                              {priorityMeta.label}
                            </span>
                            {inc.visibility === 'unit_private' && (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                Privada
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-6 ml-auto">
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 uppercase font-bold">Responsável</p>
                          <p className="text-xs font-semibold text-gray-800">
                            {inc.assignedTo || 'Administração'}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 uppercase font-bold">
                            {inc.resolvedAt ? 'Resolvido' : 'Data Planeada'}
                          </p>
                          <p className="text-xs font-semibold text-gray-800 tabular-nums">
                            {inc.resolvedAt
                              ? formatDatePt(inc.resolvedAt)
                              : formatDatePt(inc.plannedDate)}
                          </p>
                        </div>

                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full border ${statusMeta.pillClass}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                    </div>

                    {/* Line 2 */}
                    <div className="mt-2.5 pt-2.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-xs text-gray-500">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0">
                        <span>
                          Reportado em{' '}
                          <strong className="text-gray-700">{formatDatePt(inc.reportedAt)}</strong>
                          {' · '}
                          {inc.reportedByUnit
                            ? `Fração ${inc.reportedByUnit.code} (${inc.reportedByName})`
                            : inc.reportedByName}
                        </span>
                        {photoCount > 0 && (
                          <span className="text-gray-600 font-medium">
                            📎 {photoCount} anexo{photoCount > 1 ? 's' : ''}
                          </span>
                        )}
                        {inc.expenseAmount !== null && inc.expenseAmount !== undefined && (
                          <span className="text-gray-700 font-semibold tabular-nums">
                            Custo: {inc.expenseAmount.toFixed(2)} €
                            {inc.creditor ? ` (${inc.creditor.name})` : ''}
                          </span>
                        )}
                      </div>

                      <span className="text-gray-700 font-semibold group-hover:translate-x-0.5 transition-transform ml-auto">
                        Ver detalhes →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <IncidentReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        onCreated={(inc, reason) => {
          setBannerMsg(
            reason
              ? `Anomalia ${inc.code} registada com sucesso (${reason}).`
              : `Anomalia ${inc.code} registada e notificações enviadas.`
          );
          fetchIncidents();
        }}
      />

      <IncidentDetailModal
        incidentId={selectedIncidentId}
        onClose={() => setSelectedIncidentId(null)}
        onUpdated={fetchIncidents}
      />
    </div>
  );
}

export default function IncidentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">A carregar...</div>}>
      <IncidentsPageContent />
    </Suspense>
  );
}
