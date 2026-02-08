'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import ReportHeader from './components/ReportHeader';
import Section1Balancete from './components/Section1Balancete';
import Section2DebtByUnit from './components/Section2DebtByUnit';
import Section3CreditNotes from './components/Section3CreditNotes';
import Section4PaidInvoices from './components/Section4PaidInvoices';
import Section5UnpaidInvoices from './components/Section5UnpaidInvoices';
import Section6DetailedDebt from './components/Section6DetailedDebt';
import Section7Budget from './components/Section7Budget';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReportData = any;

export default function RelatorioContasPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReport() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/reports/annual-report?year=${year}`);
        if (!res.ok) throw new Error('Erro ao carregar relatório');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [year]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 print:p-4">
        {/* Controls - hidden on print */}
        <div className="no-print mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setYear(year - 1)}
              className="btn-secondary px-3 py-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold min-w-[120px] text-center">
              {year}
            </h1>
            <button
              onClick={() => setYear(year + 1)}
              className="btn-secondary px-3 py-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <button
            onClick={() => window.print()}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimir / PDF
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <span className="ml-3 text-gray-600">A carregar relatório...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Report Content */}
        {data && !loading && (
          <div className="report-container bg-white print:shadow-none rounded-lg shadow-sm p-8 print:p-0">
            <ReportHeader
              buildingName={data.buildingName}
              title="BALANCETE DE RECEITAS E DESPESAS"
              subtitle={`RELATÓRIO DE CONTAS — PERÍODO: 01 DE JANEIRO A 31 DE DEZEMBRO DE ${data.year}`}
            />

            <Section1Balancete data={data.balancete} year={data.year} />

            <Section2DebtByUnit data={data.debtByUnit} year={data.year} />

            <Section3CreditNotes data={data.creditNotes} year={data.year} />

            <Section4PaidInvoices
              data={data.paidExpenses}
              totalPaid={data.totalPaidExpenses}
              year={data.year}
            />

            <Section5UnpaidInvoices
              data={data.unpaidInvoices}
              totalUnpaid={data.totalUnpaidInvoices}
              year={data.year}
            />

            <Section6DetailedDebt data={data.detailedDebtByUnit} year={data.year} />

            <Section7Budget
              budget={data.budget}
              feeSchedule={data.feeSchedule}
              year={data.year}
            />

            {/* Signature Section */}
            <div className="mt-20 grid grid-cols-2 gap-20 report-section">
              <div className="text-center">
                <div className="border-t border-gray-800 pt-2 mx-auto w-64">
                  <p className="text-sm font-bold uppercase">A Administração</p>
                  <p className="text-xs text-gray-500 mt-1">(Assinatura e Carimbo)</p>
                </div>
              </div>
              <div className="text-center">
                <div className="border-t border-gray-800 pt-2 mx-auto w-64">
                  <p className="text-sm font-bold uppercase">Conselho Consultivo</p>
                  <p className="text-xs text-gray-500 mt-1">(Visto)</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-12 pt-4 border-t border-gray-300 text-xs text-gray-500 text-center">
              <p>Relatório gerado automaticamente — Condomínio {data.buildingName}</p>
              <p>{new Date().toLocaleDateString('pt-PT')}</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
