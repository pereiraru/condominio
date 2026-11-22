'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import BankAccountsManagerPanel from '@/components/BankAccountsManagerPanel';
import UsersManagerPanel from '@/components/UsersManagerPanel';
import { Budget } from '@/lib/types';
import type { CondoMeetingDTO } from '@/lib/meetings';
import {
  AnnualReportData,
  BudgetLineInput,
  FeeSimulationConfig,
  UnitReportsPayload,
} from './types';
import { computeFeeSimulation } from './utils';
import BudgetAndFeeSimulatorTab from './components/BudgetAndFeeSimulatorTab';
import UnitReportTab from './components/UnitReportTab';
import ConvocatoriaTab from './components/ConvocatoriaTab';
import ActaTab from './components/ActaTab';
import NotificationConfigTab from './components/NotificationConfigTab';

type AdminTab =
  | 'budgets'
  | 'units'
  | 'convocatoria'
  | 'acta'
  | 'contas'
  | 'utilizadores'
  | 'notificacoes';

const VALID_TABS = new Set<AdminTab>([
  'budgets',
  'units',
  'convocatoria',
  'acta',
  'contas',
  'utilizadores',
  'notificacoes',
]);

function AdministrationCenterContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as AdminTab | null;

  const [activeTab, setActiveTab] = useState<AdminTab>(() =>
    tabParam && VALID_TABS.has(tabParam) ? tabParam : 'budgets'
  );
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [unitReportsData, setUnitReportsData] = useState<UnitReportsPayload | null>(null);
  const [annualReport, setAnnualReport] = useState<AnnualReportData | null>(null);
  const [meetings, setMeetings] = useState<CondoMeetingDTO[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedMeetingSelectionRef = useRef(false);

  useEffect(() => {
    if (tabParam && VALID_TABS.has(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleMeetingSaved = useCallback((saved: CondoMeetingDTO) => {
    setMeetings((prev) => {
      const exists = prev.some((m) => m.id === saved.id);
      return exists ? prev.map((m) => (m.id === saved.id ? saved : m)) : [saved, ...prev];
    });
    setSelectedMeetingId(saved.id);
    initializedMeetingSelectionRef.current = true;
  }, []);

  const handleMeetingDeleted = useCallback((deletedId: string) => {
    setMeetings((prev) => {
      const remaining = prev.filter((m) => m.id !== deletedId);
      setSelectedMeetingId(remaining[0]?.id || null);
      return remaining;
    });
  }, []);

  const [feeSimConfig, setFeeSimConfig] = useState<FeeSimulationConfig>({
    mode: 'percentage',
    value: 0,
    rounding: 'exact',
    rcdAdminMode: 'proportional',
    customOverrides: {},
  });

  const fetchAllData = useCallback(async (year: number) => {
    setLoading(true);
    try {
      const [budgetsRes, unitRepRes, annualRes, meetingsRes] = await Promise.all([
        fetch('/api/budgets'),
        fetch(`/api/admin/unit-reports?year=${year}`),
        fetch(`/api/reports/annual-report?year=${year}`),
        fetch('/api/admin/meetings'),
      ]);

      if (budgetsRes.ok) {
        setBudgets(await budgetsRes.json());
      }
      if (unitRepRes.ok) {
        setUnitReportsData(await unitRepRes.json());
      }
      if (annualRes.ok) {
        setAnnualReport(await annualRes.json());
      }
      if (meetingsRes.ok) {
        const list = (await meetingsRes.json()) as CondoMeetingDTO[];
        setMeetings(list);
        if (!initializedMeetingSelectionRef.current && list.length > 0) {
          initializedMeetingSelectionRef.current = true;
          const matchingYear = list.find((m) => m.year === year) || list[0];
          setSelectedMeetingId(matchingYear?.id || null);
        }
      }
    } catch (error) {
      console.error('Error loading administration data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    fetchAllData(selectedYear);
  }, [session, status, selectedYear, router, fetchAllData]);

  const refreshBudgets = async () => {
    const res = await fetch('/api/budgets');
    if (res.ok) setBudgets(await res.json());
  };

  const nextBudgetLines: BudgetLineInput[] = useMemo(() => {
    const nextYear = selectedYear + 1;
    const saved = budgets.find((b) => b.year === nextYear);
    if (saved?.lines && saved.lines.length > 0) {
      return saved.lines.map((l) => ({
        category: l.category,
        description: l.description,
        monthlyAmount: l.monthlyAmount,
        annualAmount: l.annualAmount,
      }));
    }
    return unitReportsData?.suggestedBudgetLines || [];
  }, [budgets, unitReportsData, selectedYear]);

  const feeSimSummary = useMemo(() => {
    if (!unitReportsData) return { annualImpact: 0 };
    return computeFeeSimulation(unitReportsData.units, feeSimConfig);
  }, [unitReportsData, feeSimConfig]);

  if (status === 'loading' || (session && session.user.role !== 'admin')) {
    return null;
  }

  return (
    <div className="print-page-wrapper app-shell">
      <Sidebar />

      <main className="app-main">
        <div className="app-container">
          {/* Header & Tabs (hidden on print) */}
          <div className="no-print mb-6 sm:mb-8 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  Administração
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Orçamentos, extratos em massa, convocatória, atas, contas bancárias, utilizadores e notificações
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center bg-white border border-slate-200 rounded-xl px-2 py-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setSelectedYear((y) => Math.max(2024, y - 1))}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
                    title="Ano anterior"
                  >
                    ‹
                  </button>
                  <span className="px-3 text-sm font-bold text-slate-900">
                    Exercício {selectedYear}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedYear((y) => y + 1)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
                    title="Ano seguinte"
                  >
                    ›
                  </button>
                </div>

                {activeTab === 'budgets' && (
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="btn-secondary text-sm flex items-center gap-2"
                  >
                    Imprimir Simulação
                  </button>
                )}
              </div>
            </div>

            {/* Tab Bar */}
            <div className="flex gap-1.5 bg-slate-200/70 p-1.5 rounded-2xl overflow-x-auto max-w-full">
              {[
                { id: 'budgets' as const, label: 'Orçamento & Quotas' },
                { id: 'units' as const, label: 'Extratos & Envios' },
                { id: 'convocatoria' as const, label: 'Convocatória' },
                { id: 'acta' as const, label: 'Reunião & Ata' },
                { id: 'contas' as const, label: 'Contas Bancárias' },
                { id: 'utilizadores' as const, label: 'Utilizadores & Acessos' },
                { id: 'notificacoes' as const, label: 'Notificações & Email' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'contas' ? (
            <BankAccountsManagerPanel />
          ) : activeTab === 'utilizadores' ? (
            <UsersManagerPanel />
          ) : activeTab === 'notificacoes' ? (
            <NotificationConfigTab />
          ) : loading || !unitReportsData ? (
            <div className="no-print flex items-center justify-center py-24">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900"></div>
              <span className="ml-3 text-slate-500 font-medium">
                A carregar dados de administração...
              </span>
            </div>
          ) : (
            <>
              {activeTab === 'budgets' && (
                <BudgetAndFeeSimulatorTab
                  budgets={budgets}
                  units={unitReportsData.units}
                  suggestedBudgetLines={unitReportsData.suggestedBudgetLines}
                  baseYear={selectedYear}
                  feeSimConfig={feeSimConfig}
                  onFeeSimConfigChange={setFeeSimConfig}
                  onBudgetsUpdated={refreshBudgets}
                />
              )}

              {activeTab === 'units' && (
                <UnitReportTab
                  units={unitReportsData.units}
                  year={selectedYear}
                  buildingName={unitReportsData.buildingName}
                />
              )}

              {activeTab === 'convocatoria' && (
                <ConvocatoriaTab
                  year={selectedYear}
                  buildingName={unitReportsData.buildingName}
                  units={unitReportsData.units}
                  projectedAnnualImpact={feeSimSummary.annualImpact}
                  meetings={meetings}
                  selectedMeetingId={selectedMeetingId}
                  onSelectMeetingId={setSelectedMeetingId}
                  onMeetingSaved={handleMeetingSaved}
                  onGoToActa={() => setActiveTab('acta')}
                />
              )}

              {activeTab === 'acta' && (
                <ActaTab
                  year={selectedYear}
                  buildingName={unitReportsData.buildingName}
                  units={unitReportsData.units}
                  annualReport={annualReport}
                  budgetLines={nextBudgetLines}
                  feeSimConfig={feeSimConfig}
                  meetings={meetings}
                  selectedMeetingId={selectedMeetingId}
                  onSelectMeetingId={setSelectedMeetingId}
                  onMeetingSaved={handleMeetingSaved}
                  onMeetingDeleted={handleMeetingDeleted}
                  onGoToConvocatoria={() => setActiveTab('convocatoria')}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AdministrationCenterPage() {
  return (
    <Suspense
      fallback={
        <div className="app-shell">
          <Sidebar />
          <main className="app-main" />
        </div>
      }
    >
      <AdministrationCenterContent />
    </Suspense>
  );
}
