'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Sidebar from '@/components/Sidebar';
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

  useEffect(() => {
    async function fetchData() {
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
    }
    fetchData();
  }, []);

  const displayedActivities = stats
    ? showAllActivities
      ? stats.extraordinaryActivities
      : stats.extraordinaryActivities.slice(0, 6)
    : [];

  return (
    <div className="flex min-h-screen bg-gray-50/50">
      <Sidebar />

      <main className="flex-1 p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                Portal do Condomínio
              </h1>
              <p className="text-gray-500 mt-1">
                Visão geral, contas comuns, serviços e atividades do edifício
                {stats?.currentMonthLabel ? ` · ${stats.currentMonthLabel}` : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isAdmin ? (
                <>
                  <Link href="/dashboard/admin/budgets" className="btn-secondary">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                    <span>Administração</span>
                  </Link>
                  <Link href="/dashboard/relatorio-contas" className="btn-primary">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Relatório de Contas</span>
                  </Link>
                </>
              ) : (
                stats?.myUnit && (
                  <Link href={`/dashboard/units/${stats.myUnit.id}`} className="btn-primary">
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
            <div className="flex flex-col items-center justify-center py-24 text-gray-500 font-medium">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
              A carregar visão geral do condomínio...
            </div>
          ) : error || !stats ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700">
              {error || 'Sem dados disponíveis.'}
            </div>
          ) : (
            <div className="space-y-8">
              {/* 1. Mural de Avisos & Próxima Assembleia */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                    </svg>
                    Avisos & Comunicações do Prédio
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                        className={`rounded-2xl border p-4 shadow-sm ${styleMap.card}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${styleMap.badge}`}
                          >
                            {item.dateLabel}
                          </span>
                        </div>
                        <h3 className={`text-sm font-bold mb-1 ${styleMap.title}`}>
                          {item.title}
                        </h3>
                        <p className={`text-xs leading-relaxed ${styleMap.text}`}>
                          {item.message}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 2. Resumo Privado da Própria Fração (visível apenas para o próprio condómino) */}
              {stats.myUnit && (
                <section>
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                            stats.myUnit.totalOwed > 0.01
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                              A Minha Fração
                            </span>
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                              Acesso Privado
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-gray-900">
                            {stats.myUnit.code}
                            {stats.myUnit.description ? ` — ${stats.myUnit.description}` : ''}
                            {stats.myUnit.ownerName ? ` · ${stats.myUnit.ownerName}` : ''}
                          </h3>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-6 sm:gap-8 ml-auto">
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                            Quota Mensal
                          </p>
                          <p className="text-sm font-bold text-gray-900 tabular-nums">
                            {formatEur(stats.myUnit.monthlyFee)}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                            Pago {stats.currentYear}
                          </p>
                          <p className="text-sm font-bold text-gray-900 tabular-nums">
                            {formatEur(stats.myUnit.paidThisYear)}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                            Situação da Fração
                          </p>
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
                          className="btn-secondary text-sm h-[38px] px-4"
                        >
                          Ver Extrato →
                        </Link>
                      </div>
                    </div>

                    {stats.myUnit.lastPaymentDate && (
                      <div className="mt-2.5 pt-2.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                        <span>
                          Último pagamento registado:{' '}
                          <strong className="text-gray-700 font-semibold">
                            {formatDatePt(stats.myUnit.lastPaymentDate)}
                          </strong>
                          {stats.myUnit.lastPaymentAmount !== null &&
                            ` (${formatEur(stats.myUnit.lastPaymentAmount)})`}
                        </span>
                        <span className="text-gray-400">
                          Apenas visível para o titular desta fração.
                        </span>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* 3. Saúde Financeira & Contas Bancárias do Prédio */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                    Saúde Financeira do Condomínio ({stats.currentYear})
                  </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Disponibilidades Bancárias */}
                  <div className="bg-gray-900 text-white rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Disponibilidades Bancárias Totais
                      </p>
                      <p className="text-3xl font-bold mt-2 tabular-nums">
                        {formatEur(stats.totalBankBalance)}
                      </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-white/10 space-y-2.5">
                      {stats.bankAccounts.map((acc) => (
                        <div key={acc.id} className="flex items-center justify-between text-sm">
                          <div>
                            <p className="font-medium text-gray-100">{acc.name}</p>
                            {acc.lastDate && (
                              <p className="text-[11px] text-gray-400">
                                Saldo a {formatDatePt(acc.lastDate)}
                              </p>
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
                  <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                          Movimento do Ano ({stats.currentYear})
                        </p>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          Extrato Bancário
                        </span>
                      </div>

                      <div className="mt-4 space-y-2.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Receitas recebidas</span>
                          <span className="font-bold text-emerald-600 tabular-nums">
                            + {formatEur(stats.yearSummary.yearIncome)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Despesas operacionais</span>
                          <span className="font-bold text-red-600 tabular-nums">
                            - {formatEur(stats.yearSummary.yearOperationalExpenses)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Transf. Fundo Poupança</span>
                          <span className="font-semibold text-teal-700 tabular-nums">
                            {formatEur(stats.yearSummary.yearSavingsTransfers)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3.5 border-t border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">Saldo operacional (Rec. - Desp.)</p>
                        {stats.yearSummary.pendingInvoicesCount > 0 && (
                          <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                            {stats.yearSummary.pendingInvoicesCount} faturas por liquidar:{' '}
                            {formatEur(stats.yearSummary.pendingInvoicesTotal)}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-base font-bold tabular-nums ${
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

                  {/* Regularização Global Anónima */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                          Cobrança de Quotas ({stats.currentYear})
                        </p>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                          Dados Anónimos
                        </span>
                      </div>

                      <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-gray-900 tabular-nums">
                          {stats.unitCompliance.unitsUpToDateThisYear} /{' '}
                          {stats.unitCompliance.totalUnits}
                        </span>
                        <span className="text-sm text-gray-500">frações em dia no ano</span>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-gray-500 font-medium">
                            Taxa de execução das quotas {stats.currentYear}
                          </span>
                          <span className="font-bold text-gray-900 tabular-nums">
                            {stats.unitCompliance.collectionRateYear.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, stats.unitCompliance.collectionRateYear)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <p className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-400 leading-relaxed">
                      Indicadores agregados do edifício. Nenhuma informação individual de outros
                      condóminos é apresentada neste painel.
                    </p>
                  </div>
                </div>
              </section>

              {/* 4. Assuntos Pendentes & Anomalias (preparado para futura ticket tool) */}
              <section>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                      Assuntos Pendentes & Anomalias do Edifício
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 normal-case tracking-normal">
                        {stats.pendingIssues.filter((i) => i.status !== 'resolved').length} em aberto
                      </span>
                    </h2>
                  </div>
                  <span className="text-xs text-gray-400">
                    Registo de ocorrências, faturas por liquidar e ações de manutenção
                  </span>
                </div>

                <div className="space-y-3">
                  {stats.pendingIssues.map((issue) => {
                    const statusConfig = {
                      pending_payment: {
                        label: 'A aguardar pagamento',
                        pill: 'bg-red-50 text-red-700 border-red-100',
                        iconBg: 'bg-red-50 text-red-600',
                      },
                      in_analysis: {
                        label: 'Em análise / Orçamento',
                        pill: 'bg-amber-50 text-amber-800 border-amber-200',
                        iconBg: 'bg-amber-50 text-amber-600',
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
                        className={`bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3.5 transition-all ${
                          isAdmin && issue.status === 'pending_payment'
                            ? 'hover:shadow-md hover:border-primary-200 cursor-pointer'
                            : ''
                        }`}
                        onClick={() => {
                          if (isAdmin && issue.status === 'pending_payment') {
                            router.push('/dashboard/creditors');
                          }
                        }}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${statusConfig.iconBg}`}
                            >
                              {issue.status === 'resolved' ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : issue.status === 'pending_payment' ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-bold text-gray-900">
                                  {issue.title}
                                </h3>
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                  {issue.category}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 ml-auto">
                            {issue.amount !== null && issue.amount !== undefined && (
                              <span className="text-sm font-bold text-gray-900 tabular-nums">
                                {formatEur(issue.amount)}
                              </span>
                            )}
                            <span
                              className={`text-xs font-bold px-3 py-1 rounded-full border ${statusConfig.pill}`}
                            >
                              {statusConfig.label}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                          <span>{issue.description}</span>
                          {issue.dateLabel && (
                            <span className="text-gray-400 font-medium">{issue.dateLabel}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 5. Últimas Atividades Extraordinárias & Intervenções no Edifício */}
              <section>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                      Últimas Atividades Extraordinárias & Intervenções
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Inspeções camarárias, extintores, reparações e trabalhos pontuais no prédio
                    </p>
                  </div>

                  {stats.extraordinaryActivities.length > 6 && (
                    <button
                      type="button"
                      onClick={() => setShowAllActivities((prev) => !prev)}
                      className="text-xs font-semibold text-gray-700 hover:text-gray-900 px-3 py-1.5 rounded-lg bg-white border border-gray-200 shadow-sm"
                    >
                      {showAllActivities
                        ? 'Mostrar menos'
                        : `Ver todas (${stats.extraordinaryActivities.length})`}
                    </button>
                  )}
                </div>

                {displayedActivities.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500 text-sm">
                    Sem intervenções extraordinárias registadas.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayedActivities.map((act) => (
                      <div
                        key={act.id}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-bold text-gray-900">
                                  {act.creditorName}
                                </h3>
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                  {CATEGORY_LABELS[act.category] ?? act.category}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-6 ml-auto">
                            <div className="text-right">
                              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                                Data
                              </p>
                              <p className="text-xs font-semibold text-gray-700 tabular-nums">
                                {formatDatePt(act.date)}
                              </p>
                            </div>
                            <div className="text-right min-w-[90px]">
                              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                                Valor
                              </p>
                              <p className="text-sm font-bold text-gray-900 tabular-nums">
                                {formatEur(act.amount)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                          <span>
                            Descrição: <strong className="text-gray-700 font-medium">{act.description}</strong>
                          </span>
                          <span className="text-[11px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                            Despesa Extraordinária
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 6. Serviços Regulares & Para Onde Vão as Quotas */}
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Serviços Regulares */}
                <div className="lg:col-span-2">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
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

                  <div className="space-y-3">
                    {stats.regularServices.map((srv) => {
                      const statusStyle = {
                        regularized: {
                          label: 'Regularizado',
                          text: 'text-emerald-600',
                          pill: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                        },
                        pending: {
                          label:
                            srv.pendingAmount > 0.01
                              ? `${formatEur(srv.pendingAmount)} por pagar`
                              : 'Pagamento Pendente',
                          text: 'text-red-600',
                          pill: 'bg-red-50 text-red-700 border-red-100',
                        },
                        variable: {
                          label: 'Consumo Variável',
                          text: 'text-blue-600',
                          pill: 'bg-blue-50 text-blue-700 border-blue-100',
                        },
                      }[srv.status];

                      return (
                        <div
                          key={srv.id}
                          className={`bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3.5 transition-all ${
                            isAdmin ? 'hover:shadow-md hover:border-primary-200 cursor-pointer' : ''
                          }`}
                          onClick={() => {
                            if (isAdmin) router.push(`/dashboard/creditors/${srv.id}`);
                          }}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="text-sm font-bold text-gray-900">
                                    {srv.name}
                                  </h3>
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                    {CATEGORY_LABELS[srv.category] ?? srv.category}
                                  </span>
                                  <span
                                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                                      srv.isFixed
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                        : 'bg-blue-50 text-blue-700 border-blue-100'
                                    }`}
                                  >
                                    {srv.isFixed ? 'Avença Fixa' : 'Variável'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-5 ml-auto">
                              <div className="text-right">
                                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                                  {srv.isFixed ? 'Mensal' : 'Média/Mês'}
                                </p>
                                <p className="text-sm font-bold text-gray-900 tabular-nums">
                                  {formatEur(srv.monthlyAmount)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                                  Pago {stats.currentYear}
                                </p>
                                <p className="text-sm font-bold text-gray-900 tabular-nums">
                                  {formatEur(srv.paidThisYear)}
                                </p>
                              </div>
                              <div className="text-right min-w-[120px]">
                                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                                  Estado
                                </p>
                                <p className={`text-xs font-bold tabular-nums ${statusStyle.text}`}>
                                  {statusStyle.label}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                            <span>
                              Último pagamento:{' '}
                              <strong className="text-gray-700 font-semibold">
                                {formatDatePt(srv.lastPaymentDate)}
                              </strong>
                              {srv.lastPaymentAmount !== null &&
                                ` (${formatEur(srv.lastPaymentAmount)})`}
                            </span>
                            {isAdmin && (
                              <span className="text-primary-600 font-semibold">Ver →</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Repartição das Despesas */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                      Para Onde Vão as Quotas? ({stats.currentYear})
                    </h2>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                    {stats.expenseBreakdown.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-6">
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
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
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

                    <div className="pt-3 border-t border-gray-100 text-[11px] text-gray-400 leading-relaxed">
                      Percentagem calculada sobre o total de saídas e reforços do Fundo de Reserva
                      registados no extrato de {stats.currentYear}.
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
