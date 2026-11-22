'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Sidebar from '@/components/Sidebar';
import IncidentReportModal from '@/components/IncidentReportModal';
import IncidentDetailModal from '@/components/IncidentDetailModal';
import type { DashboardStats } from '@/lib/types';

function formatEur(value: number): string {
  return `${value.toLocaleString('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

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

const CATEGORY_LABELS: Record<string, string> = {
  elevator: 'Elevadores',
  electricity: 'Eletricidade',
  cleaning: 'Limpeza',
  maintenance: 'Manutenção',
  insurance: 'Seguro',
  water: 'Água',
  savings: 'Poupança',
  bank_fee: 'Banco',
  other: 'Encargos Gerais',
};

const CATEGORY_BAR_COLORS: Record<string, string> = {
  cleaning: 'bg-emerald-500',
  electricity: 'bg-amber-500',
  elevator: 'bg-blue-500',
  savings: 'bg-teal-500',
  bank_fee: 'bg-slate-400',
  maintenance: 'bg-purple-500',
  other: 'bg-gray-400',
};

export default function Dashboard() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [reportBanner, setReportBanner] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      if (!res.ok) {
        setError('Não foi possível carregar os dados do condomínio.');
        return;
      }
      const data: DashboardStats = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Erro de ligação ao carregar o dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const displayedActivities = stats
    ? showAllActivities
      ? stats.extraordinaryActivities
      : stats.extraordinaryActivities.slice(0, 5)
    : [];

  const openIssuesCount = stats
    ? stats.pendingIssues.filter((i) => i.status !== 'resolved').length
    : 0;

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />

      <main className="flex-1 p-5 md:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Portal do Condomínio
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Visão geral, finanças comuns, ocorrências e serviços do edifício
                {stats?.currentMonthLabel ? ` · ${stats.currentMonthLabel}` : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className="btn-secondary h-[38px] px-4 text-sm border-amber-300 bg-amber-50/70 text-amber-900 hover:bg-amber-100"
              >
                <svg className="w-4 h-4 shrink-0 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Reportar Anomalia</span>
              </button>
              {isAdmin ? (
                <>
                  <Link href="/dashboard/admin/budgets" className="btn-secondary h-[38px] px-4 text-sm">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                    <span>Administração</span>
                  </Link>
                  <Link href="/dashboard/relatorio-contas" className="btn-primary h-[38px] px-4 text-sm">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Relatório de Contas</span>
                  </Link>
                </>
              ) : (
                stats?.myUnit && (
                  <Link href={`/dashboard/units/${stats.myUnit.id}`} className="btn-primary h-[38px] px-4 text-sm">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    <span>Minha Fração ({stats.myUnit.code})</span>
                  </Link>
                )
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500 font-medium">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 mb-3"></div>
              A carregar visão geral do condomínio...
            </div>
          ) : error || !stats ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-red-700 text-sm">
              {error || 'Sem dados disponíveis.'}
            </div>
          ) : (
            <div className="space-y-5">
              {/* 1. Mural de Avisos Compacto */}
              <section>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {stats.announcements.map((item) => {
                    const styleMap = {
                      assembly: {
                        card: 'bg-blue-50/70 border-blue-200/80',
                        badge: 'bg-blue-100 text-blue-800',
                        title: 'text-blue-950',
                        text: 'text-blue-900/80',
                      },
                      maintenance: {
                        card: 'bg-emerald-50/60 border-emerald-200/80',
                        badge: 'bg-emerald-100 text-emerald-800',
                        title: 'text-emerald-950',
                        text: 'text-emerald-900/80',
                      },
                      notice: {
                        card: 'bg-amber-50/60 border-amber-200/80',
                        badge: 'bg-amber-100 text-amber-800',
                        title: 'text-amber-950',
                        text: 'text-amber-900/80',
                      },
                    }[item.category];

                    return (
                      <div
                        key={item.id}
                        className={`rounded-xl border px-4 py-3 shadow-sm ${styleMap.card}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className={`text-xs font-bold truncate ${styleMap.title}`}>
                            {item.title}
                          </h3>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${styleMap.badge}`}
                          >
                            {item.dateLabel}
                          </span>
                        </div>
                        <p className={`text-[11px] leading-snug line-clamp-2 ${styleMap.text}`}>
                          {item.message}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 2. Resumo Privado da Própria Fração (visível apenas para condómino com unitId) */}
              {stats.myUnit && (
                <section>
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            stats.myUnit.totalOwed > 0.01
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                              A Minha Fração
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              Privado
                            </span>
                          </div>
                          <p className="text-sm font-bold text-gray-900">
                            {stats.myUnit.code}
                            {stats.myUnit.ownerName ? ` · ${stats.myUnit.ownerName}` : ''}
                            {stats.myUnit.lastPaymentDate && (
                              <span className="font-normal text-xs text-gray-500 ml-2">
                                (Último pag.: {formatDatePt(stats.myUnit.lastPaymentDate)})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-5 ml-auto">
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 uppercase font-bold">Quota Mensal</p>
                          <p className="text-sm font-bold text-gray-900 tabular-nums">
                            {formatEur(stats.myUnit.monthlyFee)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 uppercase font-bold">
                            Pago {stats.currentYear}
                          </p>
                          <p className="text-sm font-bold text-gray-900 tabular-nums">
                            {formatEur(stats.myUnit.paidThisYear)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 uppercase font-bold">Situação</p>
                          <p
                            className={`text-sm font-bold tabular-nums ${
                              stats.myUnit.totalOwed > 0.01 ? 'text-red-600' : 'text-emerald-600'
                            }`}
                          >
                            {stats.myUnit.totalOwed > 0.01
                              ? `${formatEur(stats.myUnit.totalOwed)} em dívida`
                              : 'Regularizada'}
                          </p>
                        </div>
                        <Link
                          href={`/dashboard/units/${stats.myUnit.id}`}
                          className="btn-secondary text-xs h-[34px] px-3.5"
                        >
                          Ver Extrato →
                        </Link>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* 3. Saúde Financeira & Contas Bancárias do Prédio */}
              <section>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Disponibilidades Bancárias */}
                  <div className="bg-gray-900 text-white rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        Disponibilidades Bancárias Totais
                      </p>
                      <p className="text-2xl font-bold mt-1 tabular-nums">
                        {formatEur(stats.totalBankBalance)}
                      </p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
                      {stats.bankAccounts.map((acc) => (
                        <div key={acc.id} className="flex items-center justify-between text-xs">
                          <div>
                            <span className="font-medium text-gray-100">{acc.name}</span>
                            {acc.lastDate && (
                              <span className="text-[10px] text-gray-400 ml-1.5">
                                ({formatDatePt(acc.lastDate)})
                              </span>
                            )}
                          </div>
                          <span className="font-bold tabular-nums text-white">
                            {formatEur(acc.balance)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Balanço do Exercício */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          Movimento de {stats.currentYear}
                        </p>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          Extrato Bancário
                        </span>
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Receitas recebidas</span>
                          <span className="font-bold text-emerald-600 tabular-nums">
                            + {formatEur(stats.yearSummary.yearIncome)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Despesas operacionais</span>
                          <span className="font-bold text-red-600 tabular-nums">
                            - {formatEur(stats.yearSummary.yearOperationalExpenses)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Reforço Fundo Poupança</span>
                          <span className="font-semibold text-teal-700 tabular-nums">
                            {formatEur(stats.yearSummary.yearSavingsTransfers)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">Saldo operacional (Rec. - Desp.)</p>
                        {isAdmin && stats.yearSummary.pendingInvoicesCount > 0 && (
                          <p className="text-[10px] text-amber-700 font-medium">
                            Admin: {stats.yearSummary.pendingInvoicesCount} faturas por liquidar (
                            {formatEur(stats.yearSummary.pendingInvoicesTotal)})
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-sm font-bold tabular-nums ${
                          stats.yearSummary.yearNetBalance >= 0
                            ? 'text-emerald-700'
                            : 'text-red-600'
                        }`}
                      >
                        {stats.yearSummary.yearNetBalance >= 0 ? '+' : ''}
                        {formatEur(stats.yearSummary.yearNetBalance)}
                      </span>
                    </div>
                  </div>

                  {/* Cobrança Global Anónima */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          Cobrança Global ({stats.currentYear})
                        </p>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                          Dados Anónimos
                        </span>
                      </div>

                      <div className="mt-2.5 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-gray-900 tabular-nums">
                          {stats.unitCompliance.unitsUpToDateThisYear} /{' '}
                          {stats.unitCompliance.totalUnits}
                        </span>
                        <span className="text-xs text-gray-500">frações em dia no ano</span>
                      </div>

                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-500">Execução das quotas</span>
                          <span className="font-bold text-gray-900 tabular-nums">
                            {stats.unitCompliance.collectionRateYear.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, stats.unitCompliance.collectionRateYear)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <p className="mt-3 pt-2 border-t border-gray-100 text-[10px] text-gray-400">
                      Dados agregados sem exposição de informações individuais de outras frações.
                    </p>
                  </div>
                </div>
              </section>

              {/* 4. Lado a Lado: Assuntos Pendentes & Anomalias | Últimas Atividades Extraordinárias */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                {/* Coluna Esquerda: Assuntos Pendentes & Anomalias */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Assuntos Pendentes & Anomalias
                      </h2>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        {openIssuesCount} em aberto
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setReportOpen(true)}
                        className="text-[11px] font-bold text-amber-800 hover:text-amber-950"
                      >
                        + Reportar
                      </button>
                      <Link
                        href="/dashboard/incidents"
                        className="text-[11px] font-semibold text-gray-600 hover:text-gray-900"
                      >
                        Ver todas →
                      </Link>
                    </div>
                  </div>

                  {reportBanner && (
                    <div className="mb-2.5 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
                      <span>{reportBanner}</span>
                      <button
                        type="button"
                        onClick={() => setReportBanner(null)}
                        className="font-bold ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="divide-y divide-gray-100">
                      {stats.pendingIssues.map((issue) => {
                        const statusConfig = {
                          open: {
                            label: 'Registado',
                            pill: 'bg-amber-50 text-amber-800 border-amber-200',
                            iconBg: 'bg-amber-50 text-amber-600',
                          },
                          pending_payment: {
                            label: 'Pendente',
                            pill: 'bg-red-50 text-red-700 border-red-100',
                            iconBg: 'bg-red-50 text-red-600',
                          },
                          in_analysis: {
                            label: 'Em Tratamento',
                            pill: 'bg-blue-50 text-blue-700 border-blue-200',
                            iconBg: 'bg-blue-50 text-blue-600',
                          },
                          scheduled: {
                            label: 'Agendado',
                            pill: 'bg-purple-50 text-purple-700 border-purple-200',
                            iconBg: 'bg-purple-50 text-purple-600',
                          },
                          monitoring: {
                            label: 'Acompanhamento',
                            pill: 'bg-blue-50 text-blue-700 border-blue-100',
                            iconBg: 'bg-blue-50 text-blue-600',
                          },
                          resolved: {
                            label: 'Resolvido',
                            pill: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                            iconBg: 'bg-emerald-50 text-emerald-600',
                          },
                        }[issue.status];

                        return (
                          <div
                            key={issue.id}
                            onClick={() => {
                              if (issue.incidentId) {
                                setSelectedIncidentId(issue.incidentId);
                              }
                            }}
                            className={`px-4 py-3 ${
                              issue.incidentId ? 'hover:bg-gray-50/80 cursor-pointer transition-colors' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5 min-w-0">
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${statusConfig.iconBg}`}
                                >
                                  {issue.status === 'resolved' ? (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {issue.code && (
                                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                                        {issue.code}
                                      </span>
                                    )}
                                    <h3 className="text-xs font-bold text-gray-900">
                                      {issue.title}
                                    </h3>
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                      {issue.category}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">
                                    {issue.description}
                                  </p>
                                </div>
                              </div>

                              <div className="flex flex-col items-end shrink-0 gap-1">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusConfig.pill}`}
                                >
                                  {statusConfig.label}
                                </span>
                                {issue.dateLabel && (
                                  <span className="text-[10px] text-gray-400">
                                    {issue.dateLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="bg-gray-50/80 px-4 py-2.5 border-t border-gray-100 flex items-center justify-between gap-2 text-[11px] text-gray-500">
                      <span>
                        Detetou uma avaria? Registe uma anomalia para a Administração acompanhar.
                      </span>
                      <Link
                        href="/dashboard/incidents"
                        className="text-[11px] font-bold text-gray-800 hover:underline shrink-0"
                      >
                        Abrir Anomalias →
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Coluna Direita: Últimas Atividades Extraordinárias */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Últimas Atividades Extraordinárias
                    </h2>
                    {stats.extraordinaryActivities.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setShowAllActivities((prev) => !prev)}
                        className="text-[11px] font-semibold text-gray-600 hover:text-gray-900"
                      >
                        {showAllActivities
                          ? 'Mostrar menos'
                          : `Ver todas (${stats.extraordinaryActivities.length})`}
                      </button>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {displayedActivities.length === 0 ? (
                      <div className="p-6 text-center text-gray-500 text-xs">
                        Sem intervenções extraordinárias registadas.
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {displayedActivities.map((act) => (
                          <div key={act.id} className="px-4 py-2.5">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                </div>
                                <div className="min-w-0">
                                  <h3 className="text-xs font-bold text-gray-900 truncate">
                                    {act.creditorName}
                                  </h3>
                                  <p className="text-[11px] text-gray-500 truncate" title={act.description}>
                                    {act.description}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0 text-right">
                                <span className="text-[11px] text-gray-400 tabular-nums">
                                  {formatDatePt(act.date)}
                                </span>
                                <span className="text-xs font-bold text-gray-900 tabular-nums min-w-[68px]">
                                  {formatEur(act.amount)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* 5. Serviços Regulares & Para Onde Vão as Quotas */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Serviços Regulares */}
                <div className="lg:col-span-7">
                  <div className="flex items-center justify-between mb-2.5">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Serviços Regulares do Edifício
                    </h2>
                    {isAdmin && (
                      <Link
                        href="/dashboard/creditors"
                        className="text-xs font-semibold text-gray-700 hover:text-gray-900"
                      >
                        Gerir credores →
                      </Link>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">
                    {stats.regularServices.map((srv) => {
                      const statusStyle = {
                        regularized: {
                          label: 'Regularizado',
                          text: 'text-emerald-600',
                        },
                        pending: {
                          label:
                            srv.pendingAmount > 0.01
                              ? `${formatEur(srv.pendingAmount)} por pagar`
                              : 'Pendente',
                          text: 'text-red-600',
                        },
                        variable: {
                          label: 'Variável',
                          text: 'text-blue-600',
                        },
                      }[srv.status];

                      return (
                        <div
                          key={srv.id}
                          className={`px-4 py-2.5 transition-colors ${
                            isAdmin ? 'hover:bg-gray-50/80 cursor-pointer' : ''
                          }`}
                          onClick={() => {
                            if (isAdmin) router.push(`/dashboard/creditors/${srv.id}`);
                          }}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-xs font-bold text-gray-900">{srv.name}</h3>
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                  {CATEGORY_LABELS[srv.category] ?? srv.category}
                                </span>
                                <span
                                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                    srv.isFixed
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-blue-50 text-blue-700'
                                  }`}
                                >
                                  {srv.isFixed ? 'Fixo' : 'Variável'}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                Último pag.: {formatDatePt(srv.lastPaymentDate)}
                                {srv.lastPaymentAmount !== null &&
                                  ` (${formatEur(srv.lastPaymentAmount)})`}
                              </p>
                            </div>

                            <div className="flex items-center gap-4 ml-auto text-right">
                              <div>
                                <p className="text-[10px] text-gray-400 uppercase font-bold">
                                  {srv.isFixed ? 'Mensal' : 'Média/Mês'}
                                </p>
                                <p className="text-xs font-bold text-gray-900 tabular-nums">
                                  {formatEur(srv.monthlyAmount)}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-gray-400 uppercase font-bold">
                                  Pago {stats.currentYear}
                                </p>
                                <p className="text-xs font-bold text-gray-900 tabular-nums">
                                  {formatEur(srv.paidThisYear)}
                                </p>
                              </div>
                              <div className="min-w-[85px]">
                                <p className="text-[10px] text-gray-400 uppercase font-bold">
                                  Estado
                                </p>
                                <p className={`text-[11px] font-bold tabular-nums ${statusStyle.text}`}>
                                  {statusStyle.label}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Repartição das Despesas */}
                <div className="lg:col-span-5">
                  <div className="flex items-center justify-between mb-2.5">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Para Onde Vão as Quotas? ({stats.currentYear})
                    </h2>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
                    {stats.expenseBreakdown.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-6">
                        Sem despesas registadas em {stats.currentYear}.
                      </p>
                    ) : (
                      stats.expenseBreakdown.map((item) => (
                        <div key={item.category}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-semibold text-gray-800">{item.label}</span>
                            <span className="text-gray-600 tabular-nums">
                              <strong className="text-gray-900">{formatEur(item.amount)}</strong>{' '}
                              <span className="text-gray-400">({item.percentage.toFixed(1)}%)</span>
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                CATEGORY_BAR_COLORS[item.category] ?? 'bg-gray-500'
                              }`}
                              style={{ width: `${Math.min(100, item.percentage)}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}

                    <div className="pt-2.5 border-t border-gray-100 text-[10px] text-gray-400 leading-relaxed">
                      Percentagem calculada sobre saídas e reforços do Fundo de Reserva no extrato
                      de {stats.currentYear}.
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>

      <IncidentReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        onCreated={(inc, reason) => {
          setReportBanner(
            reason
              ? `Anomalia ${inc.code} registada (${reason}).`
              : `Anomalia ${inc.code} registada e notificações enviadas.`
          );
          fetchData();
        }}
      />

      <IncidentDetailModal
        incidentId={selectedIncidentId}
        onClose={() => setSelectedIncidentId(null)}
        onUpdated={() => fetchData()}
      />
    </div>
  );
}
