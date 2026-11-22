'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import Sidebar from '@/components/Sidebar';
import IncidentReportModal from '@/components/IncidentReportModal';
import IncidentDetailModal from '@/components/IncidentDetailModal';
import {
  BankBalanceSparkline,
  ComplianceDonutChart,
} from '@/components/DashboardCharts';
import type { DashboardPendingIssue, DashboardStats } from '@/lib/types';

type IssueFilter = 'all' | 'critical' | 'in_progress' | 'resolved';

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
  elevator: 'bg-sky-500',
  savings: 'bg-teal-500',
  bank_fee: 'bg-slate-400',
  maintenance: 'bg-purple-500',
  other: 'bg-slate-400',
};

function getIssueBadge(issue: DashboardPendingIssue): {
  label: string;
  pill: string;
  iconBg: string;
} {
  if (issue.status === 'resolved') {
    return {
      label: 'Resolvido',
      pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      iconBg: 'bg-emerald-50 text-emerald-600',
    };
  }
  if (issue.priority === 'high') {
    return {
      label: 'Alta',
      pill: 'bg-rose-50 text-rose-700 border-rose-200',
      iconBg: 'bg-amber-50 text-amber-600',
    };
  }
  if (issue.status === 'monitoring') {
    return {
      label: 'Acompanhamento',
      pill: 'bg-sky-50 text-sky-700 border-sky-200',
      iconBg: 'bg-sky-50 text-sky-600',
    };
  }
  if (issue.status === 'scheduled') {
    return {
      label: 'Agendado',
      pill: 'bg-purple-50 text-purple-700 border-purple-200',
      iconBg: 'bg-purple-50 text-purple-600',
    };
  }
  if (issue.status === 'in_analysis') {
    return {
      label: 'Em Progresso',
      pill: 'bg-blue-50 text-blue-700 border-blue-200',
      iconBg: 'bg-blue-50 text-blue-600',
    };
  }
  if (issue.status === 'pending_payment') {
    return {
      label: 'Pendente',
      pill: 'bg-red-50 text-red-700 border-red-200',
      iconBg: 'bg-red-50 text-red-600',
    };
  }
  if (issue.priority === 'medium') {
    return {
      label: 'Média',
      pill: 'bg-amber-50 text-amber-800 border-amber-200',
      iconBg: 'bg-amber-50 text-amber-600',
    };
  }
  return {
    label: 'Baixa',
    pill: 'bg-slate-100 text-slate-700 border-slate-200',
    iconBg: 'bg-slate-100 text-slate-600',
  };
}

export default function Dashboard() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  const notifPopoverId = useId();
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const notifTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [fallbackPopoverOpen, setFallbackPopoverOpen] = useState(false);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issueFilter, setIssueFilter] = useState<IssueFilter>('all');
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

  useEffect(() => {
    if (!fallbackPopoverOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFallbackPopoverOpen(false);
    };
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (
        target &&
        !popoverRef.current?.contains(target) &&
        !notifTriggerRef.current?.contains(target)
      ) {
        setFallbackPopoverOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [fallbackPopoverOpen]);

  const closeNotificationsPopover = useCallback(() => {
    setFallbackPopoverOpen(false);
    const el = popoverRef.current as (HTMLDivElement & { hidePopover?: () => void }) | null;
    try {
      el?.hidePopover?.();
    } catch {
      // Ignore if popover is not open or unsupported
    }
  }, []);

  const handleNotifTriggerClick = () => {
    if (typeof HTMLElement !== 'undefined' && !('popover' in HTMLElement.prototype)) {
      setFallbackPopoverOpen((prev) => !prev);
    }
  };

  const openIncidents = stats
    ? stats.pendingIssues.filter((i) => i.incidentId && i.status !== 'resolved')
    : [];
  const adminInvoiceAlertCount =
    isAdmin && stats && stats.yearSummary.pendingInvoicesCount > 0 ? 1 : 0;
  const residentDebtAlertCount =
    stats?.myUnit && stats.myUnit.totalOwed > 0.01 ? 1 : 0;
  const notificationCount =
    openIncidents.length + adminInvoiceAlertCount + residentDebtAlertCount;

  const filteredIssues = stats
    ? stats.pendingIssues.filter((issue) => {
        if (issueFilter === 'all') return true;
        if (issueFilter === 'critical') {
          return issue.priority === 'high' && issue.status !== 'resolved';
        }
        if (issueFilter === 'in_progress') {
          return ['open', 'pending_payment', 'in_analysis', 'scheduled', 'monitoring'].includes(
            issue.status
          );
        }
        return issue.status === 'resolved';
      })
    : [];

  const displayedActivities = stats
    ? showAllActivities
      ? stats.extraordinaryActivities
      : stats.extraordinaryActivities.slice(0, 5)
    : [];

  const filterOptions: { key: IssueFilter; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'critical', label: 'Críticas' },
    { key: 'in_progress', label: 'Em progresso' },
    { key: 'resolved', label: 'Resolvidas' },
  ];

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="app-main">
        <div className="app-container">
          {/* Header */}
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
            <div>
              <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight">
                Portal do Condomínio
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Visão geral, finanças comuns, ocorrências e serviços do edifício
                {stats?.currentMonthLabel ? ` · ${stats.currentMonthLabel}` : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-stretch sm:self-auto">
              <div className="bg-white border border-slate-200/90 shadow-sm rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 inline-flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-slate-500 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                <span className="truncate max-w-[210px] sm:max-w-none">
                  {stats?.buildingName || 'Rua Vieira da Silva, n.º 6'}
                </span>
              </div>

              <button
                ref={notifTriggerRef}
                type="button"
                onClick={handleNotifTriggerClick}
                {...({ popovertarget: notifPopoverId } as Record<string, string>)}
                className="relative bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-4 py-2 text-xs font-semibold shadow-sm inline-flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                <span>Notificações</span>
                {notificationCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold tabular-nums">
                    {notificationCount}
                  </span>
                )}
              </button>

              {/* Viewport-aware Notifications Popover (explicitly a disclosure panel, NOT role="menu") */}
              <div
                id={notifPopoverId}
                ref={popoverRef}
                {...({ popover: 'auto' } as Record<string, string>)}
                data-fallback-open={fallbackPopoverOpen ? 'true' : undefined}
                className="notifications-popover"
              >
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Notificações
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 tabular-nums">
                      {notificationCount} ativo(s)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={closeNotificationsPopover}
                    className="text-slate-400 hover:text-slate-700 text-xs font-semibold px-1.5 py-0.5 rounded-md"
                    aria-label="Fechar notificações"
                  >
                    ✕
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {isAdmin && stats && stats.yearSummary.pendingInvoicesCount > 0 && (
                    <Link
                      href="/dashboard/creditors"
                      onClick={closeNotificationsPopover}
                      className="block px-4 py-3 hover:bg-amber-50/60 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-amber-900">
                          Faturas de fornecedores por liquidar
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">
                          {stats.yearSummary.pendingInvoicesCount}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Total pendente: {formatEur(stats.yearSummary.pendingInvoicesTotal)} · Gerir
                        credores →
                      </p>
                    </Link>
                  )}

                  {stats?.myUnit && stats.myUnit.totalOwed > 0.01 && (
                    <Link
                      href={`/dashboard/units/${stats.myUnit.id}`}
                      onClick={closeNotificationsPopover}
                      className="block px-4 py-3 hover:bg-rose-50/60 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-rose-800">
                          Fração {stats.myUnit.code}: saldo por regularizar
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 shrink-0 tabular-nums">
                          {formatEur(stats.myUnit.totalOwed)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Consultar extrato detalhado da fração →
                      </p>
                    </Link>
                  )}

                  {openIncidents.map((issue) => {
                    const badge = getIssueBadge(issue);
                    return (
                      <button
                        key={`notif-${issue.id}`}
                        type="button"
                        onClick={() => {
                          closeNotificationsPopover();
                          if (issue.incidentId) {
                            setSelectedIncidentId(issue.incidentId);
                          }
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {issue.code && (
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
                                {issue.code}
                              </span>
                            )}
                            <span className="text-xs font-semibold text-slate-900 truncate">
                              {issue.title}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badge.pill}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                          {issue.category}
                          {issue.dateLabel ? ` · ${issue.dateLabel}` : ''}
                        </p>
                      </button>
                    );
                  })}

                  {notificationCount === 0 && (
                    <div className="px-4 py-6 text-center text-xs text-slate-500">
                      Sem notificações pendentes neste momento.
                    </div>
                  )}
                </div>

                <div className="px-4 py-3 bg-slate-50/90 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      closeNotificationsPopover();
                      setReportOpen(true);
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors"
                  >
                    + Reportar Anomalia
                  </button>
                  {isAdmin ? (
                    <>
                      <Link
                        href="/dashboard/admin/budgets"
                        onClick={closeNotificationsPopover}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        Administração
                      </Link>
                      <Link
                        href="/dashboard/relatorio-contas"
                        onClick={closeNotificationsPopover}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        Rel. Contas
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/dashboard/atas"
                        onClick={closeNotificationsPopover}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        Atas
                      </Link>
                      {stats?.myUnit && (
                        <Link
                          href={`/dashboard/units/${stats.myUnit.id}`}
                          onClick={closeNotificationsPopover}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          Minha Fração
                        </Link>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </header>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 font-medium">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 mb-3"></div>
              A carregar visão geral do condomínio...
            </div>
          ) : error || !stats ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-red-700 text-sm">
              {error || 'Sem dados disponíveis.'}
            </div>
          ) : (
            <div className="space-y-5">
              {/* 1. Mural de Avisos Compacto */}
              <section aria-label="Avisos do condomínio">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {stats.announcements.map((item) => {
                    const styleMap = {
                      assembly: {
                        card: 'bg-blue-50/80 border-blue-200/75',
                        badge: 'bg-blue-100 text-blue-800 hover:bg-blue-200/80',
                        title: 'text-blue-950',
                        text: 'text-blue-900/80',
                      },
                      maintenance: {
                        card: 'bg-emerald-50/75 border-emerald-200/75',
                        badge: 'bg-emerald-100 text-emerald-800',
                        title: 'text-emerald-950',
                        text: 'text-emerald-900/80',
                      },
                      notice: {
                        card: 'bg-amber-50/75 border-amber-200/75',
                        badge: 'bg-amber-100 text-amber-800',
                        title: 'text-amber-950',
                        text: 'text-amber-900/80',
                      },
                    }[item.category];

                    return (
                      <article
                        key={item.id}
                        className={`rounded-2xl border px-4 py-3.5 shadow-card ${styleMap.card}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <h2 className={`text-xs font-bold truncate ${styleMap.title}`}>
                            {item.title}
                          </h2>
                          {item.category === 'assembly' ? (
                            <Link
                              href={
                                isAdmin
                                  ? '/dashboard/admin/budgets?tab=convocatoria'
                                  : '/dashboard/atas'
                              }
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 transition-colors ${styleMap.badge}`}
                            >
                              {isAdmin ? 'Gerir Convocatória' : 'Ver Atas / Detalhes'}
                            </Link>
                          ) : (
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${styleMap.badge}`}
                            >
                              {item.dateLabel}
                            </span>
                          )}
                        </div>
                        <p className={`text-[11px] leading-snug line-clamp-2 ${styleMap.text}`}>
                          {item.message}
                        </p>
                      </article>
                    );
                  })}
                </div>
              </section>

              {/* 2. Resumo Privado da Própria Fração (apenas para condómino com unitId) */}
              {stats.myUnit && (
                <section aria-label="Resumo da própria fração">
                  <article className="bg-white rounded-2xl border border-slate-200/80 shadow-card px-5 py-3.5">
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
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                            />
                          </svg>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              A Minha Fração
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              Privado
                            </span>
                          </div>
                          <p className="text-sm font-bold text-slate-900">
                            {stats.myUnit.code}
                            {stats.myUnit.ownerName ? ` · ${stats.myUnit.ownerName}` : ''}
                            {stats.myUnit.lastPaymentDate && (
                              <span className="font-normal text-xs text-slate-500 ml-2">
                                (Último pag.: {formatDatePt(stats.myUnit.lastPaymentDate)})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-5 ml-auto">
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 uppercase font-bold">
                            Quota Mensal
                          </p>
                          <p className="text-sm font-bold text-slate-900 tabular-nums">
                            {formatEur(stats.myUnit.monthlyFee)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 uppercase font-bold">
                            Pago {stats.currentYear}
                          </p>
                          <p className="text-sm font-bold text-slate-900 tabular-nums">
                            {formatEur(stats.myUnit.paidThisYear)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Situação</p>
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
                  </article>
                </section>
              )}

              {/* 3. Saúde Financeira & Cobrança Global */}
              <section aria-label="Indicadores financeiros do edifício">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Card 1: Dark Hero Disponibilidades Bancárias */}
                  <article className="hero-bank-card text-white rounded-2xl p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                          {stats.bankAccounts.some((a) => a.accountType === 'cash')
                            ? 'Disponibilidades Totais (Banco & Caixa)'
                            : 'Disponibilidades Bancárias Totais'}
                        </p>
                        {isAdmin ? (
                          <Link
                            href="/dashboard/transactions"
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-100 transition-colors shrink-0"
                          >
                            Ver Histórico
                          </Link>
                        ) : (
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white/10 text-slate-200 shrink-0">
                            {stats.balanceHistory.length > 0
                              ? `${stats.balanceHistory.length} meses`
                              : 'Saldos Atuais'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 mt-2">
                        <p className="text-2xl sm:text-[28px] font-bold tracking-tight tabular-nums text-white">
                          {formatEur(stats.totalBankBalance)}
                        </p>
                        <BankBalanceSparkline points={stats.balanceHistory} />
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
                      {stats.bankAccounts.map((acc) => (
                        <div key={acc.id} className="flex items-center justify-between text-xs">
                          <div className="min-w-0 truncate">
                            <span className="font-medium text-slate-100">{acc.name}</span>
                            {acc.lastDate && (
                              <span className="text-[10px] text-slate-400 ml-1.5">
                                ({formatDatePt(acc.lastDate)})
                              </span>
                            )}
                          </div>
                          <span className="font-bold tabular-nums text-white shrink-0 ml-2">
                            {formatEur(acc.balance)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>

                  {/* Card 2: Movimento do Exercício */}
                  <article className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Movimento de {stats.currentYear}
                        </p>
                        {isAdmin ? (
                          <Link
                            href="/dashboard/relatorio-contas"
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0"
                          >
                            Relatório / PDF
                          </Link>
                        ) : (
                          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 shrink-0">
                            Extrato Bancário
                          </span>
                        )}
                      </div>

                      <div className="mt-3.5 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Receitas recebidas</span>
                          <span className="font-bold text-emerald-600 tabular-nums">
                            + {formatEur(stats.yearSummary.yearIncome)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Despesas operacionais</span>
                          <span className="font-bold text-red-600 tabular-nums">
                            - {formatEur(stats.yearSummary.yearOperationalExpenses)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Reforço Fundo Poupança</span>
                          <span className="font-semibold text-teal-700 tabular-nums">
                            {formatEur(stats.yearSummary.yearSavingsTransfers)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium text-slate-600">
                          Saldo operacional (Rec. - Desp.)
                        </p>
                        {isAdmin && stats.yearSummary.pendingInvoicesCount > 0 && (
                          <p className="text-[10px] text-amber-700 font-medium mt-0.5">
                            Admin: {stats.yearSummary.pendingInvoicesCount} faturas por liquidar (
                            {formatEur(stats.yearSummary.pendingInvoicesTotal)})
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-sm sm:text-base font-bold tabular-nums shrink-0 ${
                          stats.yearSummary.yearNetBalance >= 0
                            ? 'text-emerald-700'
                            : 'text-red-600'
                        }`}
                      >
                        {stats.yearSummary.yearNetBalance >= 0 ? '+' : ''}
                        {formatEur(stats.yearSummary.yearNetBalance)}
                      </span>
                    </div>
                  </article>

                  {/* Card 3: Cobrança Global Anónima */}
                  <article className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Cobrança Global ({stats.currentYear})
                        </p>
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 shrink-0 tabular-nums">
                          {stats.unitCompliance.collectionRateYear.toFixed(0)}% cobrado
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                        <div className="min-w-0">
                          <div className="text-2xl sm:text-[26px] font-bold text-slate-900 tabular-nums leading-none">
                            {stats.unitCompliance.unitsUpToDateThisYear}{' '}
                            <span className="text-slate-400 font-medium text-lg">
                              / {stats.unitCompliance.totalUnits}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1.5">Frações em dia no ano</p>
                        </div>

                        <ComplianceDonutChart
                          paid={stats.unitCompliance.unitsUpToDateThisYear}
                          overdue={stats.unitCompliance.unitsOverdueThisYear}
                          pending={stats.unitCompliance.unitsPendingCurrent}
                          total={stats.unitCompliance.totalUnits}
                        />
                      </div>
                    </div>

                    <p className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                      Dados agregados sem exposição de informações individuais de outras frações.
                    </p>
                  </article>
                </div>
              </section>

              {/* 4. Lado a Lado: Assuntos Pendentes & Anomalias | Últimas Atividades Extraordinárias */}
              <section className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                {/* Coluna Esquerda: Assuntos Pendentes & Anomalias */}
                <div className="xl:col-span-7">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Assuntos Pendentes & Anomalias
                      </h2>
                      <div className="inline-flex items-center gap-1 flex-wrap" role="group" aria-label="Filtrar anomalias">
                        {filterOptions.map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setIssueFilter(opt.key)}
                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
                              issueFilter === opt.key
                                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setReportOpen(true)}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm inline-flex items-center gap-1 transition-colors shrink-0"
                    >
                      + Novo Registo
                    </button>
                  </div>

                  {reportBanner && (
                    <div className="mb-2.5 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
                      <span>{reportBanner}</span>
                      <button
                        type="button"
                        onClick={() => setReportBanner(null)}
                        className="font-bold ml-2"
                        aria-label="Fechar aviso"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
                    {filteredIssues.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        Sem ocorrências neste filtro.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {filteredIssues.map((issue) => {
                          const badge = getIssueBadge(issue);
                          const rowInner = (
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5 min-w-0">
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${badge.iconBg}`}
                                >
                                  {issue.status === 'resolved' ? (
                                    <svg
                                      className="w-4 h-4"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                  ) : (
                                    <svg
                                      className="w-4 h-4"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                      />
                                    </svg>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {issue.code && (
                                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                        {issue.code}
                                      </span>
                                    )}
                                    <h3 className="text-xs font-bold text-slate-900">
                                      {issue.title}
                                    </h3>
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                      {issue.category}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2">
                                    {issue.description}
                                  </p>
                                </div>
                              </div>

                              <div className="flex flex-col items-end shrink-0 gap-1">
                                <span
                                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${badge.pill}`}
                                >
                                  {badge.label}
                                </span>
                                {issue.dateLabel && (
                                  <span className="text-[10px] text-slate-400">
                                    {issue.dateLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                          );

                          if (issue.incidentId) {
                            return (
                              <button
                                key={issue.id}
                                type="button"
                                onClick={() => setSelectedIncidentId(issue.incidentId!)}
                                className="w-full text-left px-4 py-3 hover:bg-slate-50/80 transition-colors"
                              >
                                {rowInner}
                              </button>
                            );
                          }

                          return (
                            <div key={issue.id} className="px-4 py-3">
                              {rowInner}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="bg-slate-50/80 px-4 py-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span>
                        Detetou uma avaria? Registe uma anomalia para a Administração acompanhar.
                      </span>
                      <Link
                        href="/dashboard/incidents"
                        className="text-[11px] font-bold text-slate-800 hover:underline shrink-0"
                      >
                        Abrir Anomalias →
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Coluna Direita: Últimas Atividades Extraordinárias */}
                <div className="xl:col-span-5">
                  <div className="flex items-center justify-between mb-2.5">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Últimas Atividades Extraordinárias
                    </h2>
                    {stats.extraordinaryActivities.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setShowAllActivities((prev) => !prev)}
                        className="text-[11px] font-semibold text-slate-600 hover:text-slate-900"
                      >
                        {showAllActivities
                          ? 'Mostrar menos'
                          : `Ver todas (${stats.extraordinaryActivities.length})`}
                      </button>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
                    {displayedActivities.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 text-xs">
                        Sem intervenções extraordinárias registadas.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {displayedActivities.map((act) => (
                          <div key={act.id} className="px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={1.8}
                                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                    />
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={1.8}
                                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                  </svg>
                                </div>
                                <div className="min-w-0">
                                  <h3 className="text-xs font-bold text-slate-900 truncate">
                                    {act.creditorName}
                                  </h3>
                                  <p className="text-[11px] text-slate-500 truncate" title={act.description}>
                                    {act.description}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0 text-right">
                                <span className="text-[11px] text-slate-400 tabular-nums">
                                  {formatDatePt(act.date)}
                                </span>
                                <span className="text-xs font-bold text-slate-900 tabular-nums min-w-[68px]">
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
              <section className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                {/* Serviços Regulares */}
                <div className="xl:col-span-7">
                  <div className="flex items-center justify-between mb-2.5">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Serviços Regulares do Edifício
                    </h2>
                    {isAdmin && (
                      <Link
                        href="/dashboard/creditors"
                        className="text-xs font-semibold text-slate-700 hover:text-slate-900"
                      >
                        Gerir credores →
                      </Link>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card divide-y divide-slate-100 overflow-hidden">
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

                      const serviceContent = (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-xs font-bold text-slate-900">{srv.name}</h3>
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
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
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Último pag.: {formatDatePt(srv.lastPaymentDate)}
                              {srv.lastPaymentAmount !== null &&
                                ` (${formatEur(srv.lastPaymentAmount)})`}
                            </p>
                          </div>

                          <div className="flex items-center gap-4 ml-auto text-right">
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase font-bold">
                                {srv.isFixed ? 'Mensal' : 'Média/Mês'}
                              </p>
                              <p className="text-xs font-bold text-slate-900 tabular-nums">
                                {formatEur(srv.monthlyAmount)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase font-bold">
                                Pago {stats.currentYear}
                              </p>
                              <p className="text-xs font-bold text-slate-900 tabular-nums">
                                {formatEur(srv.paidThisYear)}
                              </p>
                            </div>
                            <div className="min-w-[88px]">
                              <p className="text-[10px] text-slate-400 uppercase font-bold">
                                Estado
                              </p>
                              <p className={`text-[11px] font-bold tabular-nums ${statusStyle.text}`}>
                                {statusStyle.label}
                              </p>
                            </div>
                          </div>
                        </div>
                      );

                      if (isAdmin) {
                        return (
                          <Link
                            key={srv.id}
                            href={`/dashboard/creditors/${srv.id}`}
                            className="block px-4 py-3 hover:bg-slate-50/80 transition-colors"
                          >
                            {serviceContent}
                          </Link>
                        );
                      }

                      return (
                        <div key={srv.id} className="px-4 py-3">
                          {serviceContent}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Repartição das Despesas */}
                <div className="xl:col-span-5">
                  <div className="flex items-center justify-between mb-2.5">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Para Onde Vão as Quotas? ({stats.currentYear})
                    </h2>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 space-y-3">
                    {stats.expenseBreakdown.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-6">
                        Sem despesas registadas em {stats.currentYear}.
                      </p>
                    ) : (
                      stats.expenseBreakdown.map((item) => (
                        <div key={item.category}>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="font-semibold text-slate-800">{item.label}</span>
                            <span className="text-slate-600 tabular-nums">
                              <strong className="text-slate-900">{formatEur(item.amount)}</strong>{' '}
                              <span className="text-slate-400">
                                (
                                {item.percentage.toLocaleString('pt-PT', {
                                  minimumFractionDigits: 1,
                                  maximumFractionDigits: 1,
                                })}
                                %)
                              </span>
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                CATEGORY_BAR_COLORS[item.category] ?? 'bg-slate-400'
                              }`}
                              style={{ width: `${Math.min(100, item.percentage)}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}

                    <div className="pt-2.5 border-t border-slate-100 text-[11px] text-slate-400 leading-relaxed">
                      Valores reais imputados ao exercício de {stats.currentYear} (alocações
                      mensais de despesas e reforços do Fundo de Reserva, excluindo levantamentos
                      ATM ou acertos de outros anos).
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
