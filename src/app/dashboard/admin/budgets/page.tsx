'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Budget } from '@/lib/types';
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

type AdminTab = 'budgets' | 'units' | 'convocatoria' | 'acta';

export default function AdministrationCenterPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<AdminTab>('budgets');
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [unitReportsData, setUnitReportsData] = useState<UnitReportsPayload | null>(null);
  const [annualReport, setAnnualReport] = useState<AnnualReportData | null>(null);
  const [loading, setLoading] = useState(true);

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
      const [budgetsRes, unitRepRes, annualRes] = await Promise.all([
        fetch('/api/budgets'),
        fetch(`/api/admin/unit-reports?year=${year}`),
        fetch(`/api/reports/annual-report?year=${year}`),
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
    <div className="print-page-wrapper flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 p-8 print:p-0">
        <div className="max-w-7xl mx-auto print:max-w-none">
          {/* Header & Tabs (hidden on print) */}
          <div className="no-print mb-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                  Administração
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Orçamentos anuais, simulação de quotas, extratos por fração, convocatória e ata de assembleia
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center bg-white border border-gray-200 rounded-xl px-2 py-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setSelectedYear((y) => Math.max(2024, y - 1))}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
                    title="Ano anterior"
                  >
                    ‹
                  </button>
                  <span className="px-3 text-sm font-bold text-gray-900">
                    Exercício {selectedYear}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedYear((y) => y + 1)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
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
            <div className="flex flex-wrap gap-1.5 bg-gray-200/70 p-1.5 rounded-2xl w-fit">
              {[
                { id: 'budgets' as const, label: 'Orçamento & Aumento de Quotas' },
                { id: 'units' as const, label: 'Relatório por Fração' },
                { id: 'convocatoria' as const, label: 'Convocatória' },
                { id: 'acta' as const, label: 'Ata da Reunião' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    activeTab === tab.id
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loading || !unitReportsData ? (
            <div className="no-print flex items-center justify-center py-24">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
              <span className="ml-3 text-gray-500 font-medium">
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
                  projectedAnnualImpact={feeSimSummary.annualImpact}
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
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
