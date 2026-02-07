'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import MonthCalendar from '@/components/MonthCalendar';
import { Transaction, MonthPaymentStatus } from '@/lib/types';

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
  balance: number;
}

interface DebtSummaryUnit {
  id: string;
  code: string;
  name: string;
  years: Record<string | number, { expected: number; paid: number; debt: number }>;
  totalDebt: number;
  totalPaid: number;
  totalExpected: number;
}

interface DebtExtraCharge {
  id: string;
  description: string;
  yearlyTotals: Record<string | number, number>;
}

interface DebtSummaryData {
  startYear: number;
  endYear: number;
  years: (string | number)[];
  units: DebtSummaryUnit[];
  yearTotals: Record<string | number, { expected: number; paid: number; debt: number }>;
  yearBaseFees: Record<number, number>;
  extraCharges: DebtExtraCharge[];
  grandTotalDebt: number;
  grandTotalPaid: number;
  grandTotalExpected: number;
}

interface MonthTransaction {
  id: string;
  amount: number;
  date: string;
  description: string;
}

interface OverviewRow {
  id: string;
  code: string;
  name: string;
  months: Record<string, { paid: number; expected: number; transactions: MonthTransaction[] }>;
  totalPaid: number;
  totalExpected: number;
  yearDebt?: number;
  pastYearsDebt: number;
  totalDebt?: number;
}

interface OverviewData {
  year: number;
  units: OverviewRow[];
  creditors: OverviewRow[];
  totals: {
    receitas: number;
    despesas: number;
    saldo: number;
    totalDebt: number;
  };
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function ReportsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'resumo' | 'visao' | 'dividas'>('visao');
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [debtData, setDebtData] = useState<DebtSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [resumoYear, setResumoYear] = useState<number | 'all'>(new Date().getFullYear());
  const [resumoSortAsc, setResumoSortAsc] = useState(false);

  // Side panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<'create' | 'edit'>('create');
  const [panelType, setPanelType] = useState<'payment' | 'expense'>('payment');
  const [panelTargetId, setPanelTargetId] = useState('');
  const [panelTargetName, setPanelTargetName] = useState('');
  const [panelMonth, setPanelMonth] = useState('');
  const [panelAmount, setPanelAmount] = useState('');
  const [panelDescription, setPanelDescription] = useState('');
  const [panelDate, setPanelDate] = useState('');
  const [panelTransactionId, setPanelTransactionId] = useState('');
  const [panelSaving, setPanelSaving] = useState(false);
  const [panelFullAmount, setPanelFullAmount] = useState(0);
  const [panelSelectedMonths, setPanelSelectedMonths] = useState<string[]>([]);
  const [panelCustomAmounts, setPanelCustomAmounts] = useState<Record<string, string>>({});
  const [panelShowCustom, setPanelShowCustom] = useState(false);
  const [panelCalendarYear, setPanelCalendarYear] = useState(new Date().getFullYear());
  const [panelMonthStatus, setPanelMonthStatus] = useState<MonthPaymentStatus[]>([]);

  // Transaction selection modal state
  const [showTxModal, setShowTxModal] = useState(false);
  const [txModalTransactions, setTxModalTransactions] = useState<MonthTransaction[]>([]);
  const [txModalContext, setTxModalContext] = useState<{
    type: 'payment' | 'expense';
    targetId: string;
    targetName: string;
    month: string;
  } | null>(null);

  useEffect(() => {
    if (activeTab === 'resumo') {
      fetchMonthlyData();
    } else if (activeTab === 'dividas') {
      fetchDebtSummary();
    } else {
      fetchOverviewData();
    }
  }, [activeTab, selectedYear]);

  const fetchMonthlyData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/transactions?limit=1000');
      if (res.ok) {
        const { transactions } = await res.json();
        const monthMap = new Map<string, { income: number; expenses: number }>();

        for (const tx of transactions as Transaction[]) {
          const date = new Date(tx.date);
          const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

          if (!monthMap.has(month)) {
            monthMap.set(month, { income: 0, expenses: 0 });
          }

          const data = monthMap.get(month)!;
          if (tx.amount > 0) {
            data.income += tx.amount;
          } else {
            data.expenses += Math.abs(tx.amount);
          }
        }

        const data: MonthlyData[] = Array.from(monthMap.entries())
          .map(([month, { income, expenses }]) => ({
            month,
            income,
            expenses,
            balance: income - expenses,
          }));

        setMonthlyData(data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/overview?year=${selectedYear}`);
      if (res.ok) {
        setOverviewData(await res.json());
      }
    } catch (error) {
      console.error('Error fetching overview:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDebtSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reports/debt-summary?startYear=2024');
      if (res.ok) {
        setDebtData(await res.json());
      }
    } catch (error) {
      console.error('Error fetching debt summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatMonth = (month: string) => {
    const [year, m] = month.split('-');
    return `${MONTH_NAMES[parseInt(m) - 1]} ${year}`;
  };

  const handleCellClick = (
    type: 'payment' | 'expense',
    targetId: string,
    targetName: string,
    month: string,
    transactions: MonthTransaction[]
  ) => {
    if (transactions.length === 0) {
      // No transactions - open create panel
      openCreatePanel(type, targetId, targetName, month);
    } else if (transactions.length === 1) {
      // Single transaction - open edit panel
      openEditPanel(type, targetId, targetName, month, transactions[0]);
    } else {
      // Multiple transactions - show selection modal
      setTxModalTransactions(transactions);
      setTxModalContext({ type, targetId, targetName, month });
      setShowTxModal(true);
    }
  };

  const openCreatePanel = (
    type: 'payment' | 'expense',
    targetId: string,
    targetName: string,
    month: string
  ) => {
    setPanelMode('create');
    setPanelType(type);
    setPanelTargetId(targetId);
    setPanelTargetName(targetName);
    setPanelMonth(month);
    setPanelAmount('');
    setPanelDescription('');
    setPanelTransactionId('');
    const [y, m] = month.split('-');
    setPanelDate(`${y}-${m}-01`);
    setPanelOpen(true);
  };

  const openEditPanel = async (
    type: 'payment' | 'expense',
    targetId: string,
    targetName: string,
    month: string,
    transaction: MonthTransaction
  ) => {
    setPanelMode('edit');
    setPanelType(type);
    setPanelTargetId(targetId);
    setPanelTargetName(targetName);
    setPanelMonth(month);
    setPanelAmount(transaction.amount.toString());
    setPanelDescription(transaction.description);
    setPanelTransactionId(transaction.id);
    setPanelDate(transaction.date.split('T')[0]);
    setPanelShowCustom(false);
    setShowTxModal(false);

    // Fetch full transaction with allocations
    try {
      const res = await fetch(`/api/transactions/${transaction.id}`);
      if (res.ok) {
        const fullTx = await res.json();
        setPanelFullAmount(Math.abs(fullTx.amount));
        if (fullTx.monthAllocations && fullTx.monthAllocations.length > 0) {
          const months = fullTx.monthAllocations.map((a: { month: string }) => a.month);
          setPanelSelectedMonths(months);
          // Check if amounts are custom
          const equalAmount = Math.abs(fullTx.amount) / months.length;
          const isCustom = fullTx.monthAllocations.some(
            (a: { amount: number }) => Math.abs(a.amount - equalAmount) > 0.01
          );
          if (isCustom) {
            setPanelShowCustom(true);
            const amounts: Record<string, string> = {};
            fullTx.monthAllocations.forEach((a: { month: string; amount: number }) => {
              amounts[a.month] = a.amount.toFixed(2);
            });
            setPanelCustomAmounts(amounts);
          } else {
            setPanelCustomAmounts({});
          }
          setPanelCalendarYear(parseInt(months[0].split('-')[0]));
        } else {
          setPanelSelectedMonths([month]);
          setPanelCustomAmounts({});
          setPanelCalendarYear(parseInt(month.split('-')[0]));
        }
      } else {
        setPanelFullAmount(Math.abs(transaction.amount));
        setPanelSelectedMonths([month]);
        setPanelCustomAmounts({});
        setPanelCalendarYear(parseInt(month.split('-')[0]));
      }
    } catch {
      setPanelFullAmount(Math.abs(transaction.amount));
      setPanelSelectedMonths([month]);
      setPanelCustomAmounts({});
      setPanelCalendarYear(parseInt(month.split('-')[0]));
    }

    // Fetch monthly status for the target
    fetchPanelMonthlyStatus(targetId, type, parseInt(month.split('-')[0]));
    setPanelOpen(true);
  };

  const fetchPanelMonthlyStatus = async (targetId: string, type: 'payment' | 'expense', year: number) => {
    const paramName = type === 'payment' ? 'unitId' : 'creditorId';
    try {
      const res = await fetch(`/api/monthly-status?${paramName}=${targetId}&year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setPanelMonthStatus(data.months);
      }
    } catch (error) {
      console.error('Error fetching monthly status:', error);
    }
  };

  // Refetch panel monthly status when calendar year changes
  useEffect(() => {
    if (panelOpen && panelTargetId && panelMode === 'edit') {
      fetchPanelMonthlyStatus(panelTargetId, panelType, panelCalendarYear);
    }
  }, [panelCalendarYear]);

  const handlePanelToggleMonth = (month: string) => {
    setPanelSelectedMonths((prev) => {
      const next = prev.includes(month)
        ? prev.filter((m) => m !== month)
        : [...prev, month].sort();

      if (!prev.includes(month) && !panelCustomAmounts[month]) {
        const equalAmount = panelFullAmount / (next.length || 1);
        if (!panelShowCustom) {
          const amounts: Record<string, string> = {};
          next.forEach((m) => { amounts[m] = equalAmount.toFixed(2); });
          setPanelCustomAmounts(amounts);
        } else {
          setPanelCustomAmounts((ca) => ({ ...ca, [month]: equalAmount.toFixed(2) }));
        }
      } else if (prev.includes(month)) {
        setPanelCustomAmounts((ca) => {
          const copy = { ...ca };
          delete copy[month];
          return copy;
        });
      }
      return next;
    });
  };

  const getPanelAllocations = (): { month: string; amount: number }[] => {
    if (panelSelectedMonths.length === 0) return [];
    if (panelShowCustom) {
      return panelSelectedMonths.map((month) => ({
        month,
        amount: parseFloat(panelCustomAmounts[month] || '0'),
      }));
    }
    const perMonth = panelFullAmount / panelSelectedMonths.length;
    return panelSelectedMonths.map((month) => ({ month, amount: perMonth }));
  };

  const getPanelAllocationTotal = (): number => {
    return getPanelAllocations().reduce((sum, a) => sum + a.amount, 0);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setPanelTargetId('');
    setPanelTargetName('');
    setPanelMonth('');
    setPanelAmount('');
    setPanelDescription('');
    setPanelTransactionId('');
  };

  const handleSaveTransaction = async () => {
    if (!panelAmount || !panelTargetId || !panelMonth) return;

    setPanelSaving(true);
    try {
      const amount = parseFloat(panelAmount);
      const finalAmount = panelType === 'expense' ? -Math.abs(amount) : Math.abs(amount);

      if (panelMode === 'edit' && panelTransactionId) {
        // Update existing transaction with new allocations
        const allocations = getPanelAllocations();
        const res = await fetch(`/api/transactions/${panelTransactionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unitId: panelType === 'payment' ? panelTargetId : null,
            creditorId: panelType === 'expense' ? panelTargetId : null,
            monthAllocations: allocations,
          }),
        });

        if (res.ok) {
          closePanel();
          fetchOverviewData();
        } else {
          const data = await res.json();
          alert(`Erro: ${data.error}`);
        }
      } else {
        // Create new transaction
        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: panelDate,
            description: panelDescription || `${panelType === 'payment' ? 'Pagamento' : 'Despesa'} ${panelTargetName}`,
            amount: finalAmount,
            type: panelType,
            category: panelType === 'payment' ? 'monthly_fee' : null,
            unitId: panelType === 'payment' ? panelTargetId : null,
            creditorId: panelType === 'expense' ? panelTargetId : null,
            months: [panelMonth],
          }),
        });

        if (res.ok) {
          closePanel();
          fetchOverviewData();
        } else {
          const data = await res.json();
          alert(`Erro: ${data.error}`);
        }
      }
    } catch {
      alert('Erro ao guardar transação');
    } finally {
      setPanelSaving(false);
    }
  };

  const getCellColor = (paid: number, expected: number) => {
    if (paid <= 0) return 'bg-white hover:bg-gray-50';
    if (expected <= 0) return 'bg-green-100 hover:bg-green-200 text-green-700';
    if (paid >= expected) return 'bg-green-100 hover:bg-green-200 text-green-700';
    if (paid > 0) return 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700';
    return 'bg-red-100 hover:bg-red-200 text-red-700';
  };

  // Get available years from monthlyData
  const availableYears = Array.from(new Set(monthlyData.map(d => parseInt(d.month.split('-')[0])))).sort((a, b) => b - a);

  // Filter and sort monthly data
  const filteredMonthlyData = monthlyData
    .filter(d => resumoYear === 'all' || d.month.startsWith(`${resumoYear}-`))
    .sort((a, b) => resumoSortAsc ? a.month.localeCompare(b.month) : b.month.localeCompare(a.month));

  const totalIncome = filteredMonthlyData.reduce((sum, d) => sum + d.income, 0);
  const totalExpenses = filteredMonthlyData.reduce((sum, d) => sum + d.expenses, 0);

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Relatórios</h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'visao'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('visao')}
          >
            Visão Geral
          </button>
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'resumo'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('resumo')}
          >
            Resumo Mensal
          </button>
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'dividas'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('dividas')}
          >
            Dividas
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : activeTab === 'dividas' ? (
          <>
            {debtData && (
              <div className="space-y-6">
                {/* Summary cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="card">
                    <h3 className="text-sm font-medium text-gray-500">Total Esperado</h3>
                    <p className="text-2xl font-bold text-gray-900">{debtData.grandTotalExpected.toFixed(2)} EUR</p>
                  </div>
                  <div className="card">
                    <h3 className="text-sm font-medium text-gray-500">Total Pago</h3>
                    <p className="text-2xl font-bold text-green-600">{debtData.grandTotalPaid.toFixed(2)} EUR</p>
                  </div>
                  <div className="card">
                    <h3 className="text-sm font-medium text-gray-500">Divida Total</h3>
                    <p className={`text-2xl font-bold ${debtData.grandTotalDebt > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {debtData.grandTotalDebt.toFixed(2)} EUR
                    </p>
                  </div>
                </div>

                {/* Debt table */}
                <div className="card border border-gray-200 overflow-hidden !p-0">
                  <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                    <h2 className="text-lg font-bold text-gray-900">Divida por Ano</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px] border-collapse">
                      <thead>
                        {/* Expected breakdown header rows */}
                        <tr className="text-gray-400 text-[10px] bg-gray-50/30 uppercase tracking-widest">
                          <th className="py-2 px-4 font-normal text-left">Esperado</th>
                          {debtData.years.map((year) => {
                            const yearTotal = debtData.yearTotals[year];
                            return (
                              <th key={year} className="py-2 px-3 font-semibold text-center text-gray-600 border-l border-gray-100">
                                {yearTotal?.expected.toFixed(0)}€
                              </th>
                            );
                          })}
                          <th className="py-2 px-4 font-semibold text-right text-gray-600 border-l border-gray-100">
                            {debtData.grandTotalExpected.toFixed(0)}€
                          </th>
                        </tr>
                        {/* Main header */}
                        <tr className="text-left text-gray-700 bg-gray-100/50 uppercase text-[11px] tracking-wider border-b border-gray-200">
                          <th className="py-3 px-4 font-bold sticky left-0 bg-gray-100 z-10 border-r shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Fração</th>
                          {debtData.years.map((year) => (
                            <th key={year} className={`py-3 px-3 font-bold text-center border-r last:border-r-0 min-w-[100px] ${year === 'Anterior 2024' ? 'bg-orange-50 text-orange-800' : ''}`}>
                              {year}
                            </th>
                          ))}
                          <th className="py-3 px-4 font-bold text-right border-l bg-gray-100">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {debtData.units.map((unit) => (
                          <tr key={unit.id} className="hover:bg-blue-50/30 transition-colors">
                            <td className="py-3 px-4 font-bold text-gray-900 sticky left-0 bg-white z-10 border-r shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                              <button
                                className="hover:text-primary-600 transition-colors text-left"
                                onClick={() => router.push(`/dashboard/units/${unit.id}`)}
                              >
                                {unit.code}
                              </button>
                              <div className="text-[10px] text-gray-400 font-normal uppercase truncate max-w-[120px]">{unit.name}</div>
                            </td>
                            {debtData.years.map((year) => {
                              const yearInfo = unit.years[year];
                              if (!yearInfo || (yearInfo.paid === 0 && yearInfo.debt === 0)) {
                                return (
                                  <td key={year} className="py-3 px-3 text-center text-gray-300 border-r last:border-r-0">-</td>
                                );
                              }
                              return (
                                <td key={year} className={`py-3 px-3 text-center border-r last:border-r-0 ${year === 'Anterior 2024' ? 'bg-orange-50/20' : ''}`}>
                                  <div className="flex flex-col gap-0.5">
                                    {yearInfo.paid > 0 && (
                                      <span className="text-green-600 font-medium">{yearInfo.paid.toFixed(0)}€</span>
                                    )}
                                    {yearInfo.debt > 0 && (
                                      <span className="text-red-600 font-bold bg-red-50 rounded py-0.5 px-1">{yearInfo.debt.toFixed(0)}€</span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                            <td className="py-3 px-4 text-right border-l font-bold">
                              <div className="flex flex-col gap-0.5">
                                {unit.totalPaid > 0 && (
                                  <span className="text-green-600">{unit.totalPaid.toFixed(0)}€</span>
                                )}
                                {unit.totalDebt > 0 && (
                                  <span className="text-red-700 text-sm font-black">{unit.totalDebt.toFixed(0)}€</span>
                                )}
                                {unit.totalPaid === 0 && unit.totalDebt === 0 && (
                                  <span className="text-gray-300">-</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-900 text-white font-bold">
                          <td className="py-4 px-4 sticky left-0 bg-gray-900 z-10 border-r">TOTAL GERAL</td>
                          {debtData.years.map((year) => {
                            const yearTotal = debtData.yearTotals[year];
                            return (
                              <td key={year} className="py-4 px-3 text-center border-r border-gray-800">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-green-400 text-xs">{yearTotal.paid.toFixed(0)}€</span>
                                  <span className="text-red-400">{yearTotal.debt.toFixed(0)}€</span>
                                </div>
                              </td>
                            );
                          })}
                          <td className="py-4 px-4 text-right border-l border-gray-800">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-green-400 text-xs">{debtData.grandTotalPaid.toFixed(0)}€</span>
                              <span className="text-red-400 text-lg">{debtData.grandTotalDebt.toFixed(0)}€</span>
                            </div>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : activeTab === 'resumo' ? (
          <>
            {/* Resumo Mensal Tab */}
            {/* Year Filter */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-sm text-gray-500">Ano:</span>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                <button
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    resumoYear === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => setResumoYear('all')}
                </button>
                {availableYears.slice(0, 5).map(year => (
                  <button
                    key={year}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      resumoYear === year ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                    onClick={() => setResumoYear(year)}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="card">
                <h3 className="text-sm text-gray-500 mb-1">Total Receitas {resumoYear !== 'all' ? resumoYear : ''}</h3>
                <p className="text-2xl font-semibold text-green-600">{totalIncome.toFixed(2)} EUR</p>
              </div>
              <div className="card">
                <h3 className="text-sm text-gray-500 mb-1">Total Despesas {resumoYear !== 'all' ? resumoYear : ''}</h3>
                <p className="text-2xl font-semibold text-red-600">{totalExpenses.toFixed(2)} EUR</p>
              </div>
              <div className="card">
                <h3 className="text-sm text-gray-500 mb-1">Saldo Total {resumoYear !== 'all' ? resumoYear : ''}</h3>
                <p className={`text-2xl font-semibold ${totalIncome - totalExpenses >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                  {(totalIncome - totalExpenses).toFixed(2)} EUR
                </p>
              </div>
            </div>

            <div className="card border border-gray-200 overflow-hidden !p-0">
              <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                <h2 className="text-lg font-bold text-gray-900">Resumo Mensal</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-gray-500 bg-gray-50/50 uppercase text-[11px] tracking-wider border-b">
                      <th
                        className="py-3 px-6 font-bold cursor-pointer hover:text-gray-900 select-none"
                        onClick={() => setResumoSortAsc(!resumoSortAsc)}
                      >
                        <span className="flex items-center gap-1">
                          Mês
                          <svg className={`w-4 h-4 transition-transform ${resumoSortAsc ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </th>
                      <th className="py-3 px-6 font-bold text-right">Receitas</th>
                      <th className="py-3 px-6 font-bold text-right">Despesas</th>
                      <th className="py-3 px-6 font-bold text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredMonthlyData.map((d, i) => (
                      <tr key={d.month} className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-4 px-6 text-sm font-bold text-gray-900">{formatMonth(d.month)}</td>
                        <td className="py-4 px-6 text-sm text-right text-green-600 font-bold">+{d.income.toFixed(2)} EUR</td>
                        <td className="py-4 px-6 text-sm text-right text-red-500 font-bold">-{d.expenses.toFixed(2)} EUR</td>
                        <td className={`py-4 px-6 text-sm text-right font-black ${d.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                          {d.balance >= 0 ? '+' : ''}{d.balance.toFixed(2)} EUR
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Visao Geral Tab */}
            <div className="flex items-center gap-2 mb-6">
              <button
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-all"
                onClick={() => setSelectedYear(selectedYear - 1)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="font-semibold text-xl text-gray-900 min-w-[60px] text-center">{selectedYear}</span>
              <button
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-all"
                onClick={() => setSelectedYear(selectedYear + 1)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {overviewData && (
              <div className={`flex gap-6`}>
                <div className={`flex-1 space-y-6 ${panelOpen ? 'max-w-[calc(100%-340px)]' : ''}`}>
                  {/* Totals */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="card">
                      <h3 className="text-sm font-medium text-gray-500">Total Receitas {selectedYear}</h3>
                      <p className="text-2xl font-bold text-green-600">{overviewData.totals.receitas.toFixed(2)} EUR</p>
                    </div>
                    <div className="card">
                      <h3 className="text-sm font-medium text-gray-500">Total Despesas {selectedYear}</h3>
                      <p className="text-2xl font-bold text-red-600">{overviewData.totals.despesas.toFixed(2)} EUR</p>
                    </div>
                    <div className="card">
                      <h3 className="text-sm font-medium text-gray-500">Saldo {selectedYear}</h3>
                      <p className={`text-2xl font-bold ${overviewData.totals.saldo >= 0 ? 'text-primary-600' : 'text-red-600'}`}>
                        {overviewData.totals.saldo.toFixed(2)} EUR
                      </p>
                    </div>
                    <div className="card">
                      <h3 className="text-sm font-medium text-gray-500">Dívida Total Acumulada</h3>
                      <p className={`text-2xl font-bold ${overviewData.totals.totalDebt > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {overviewData.totals.totalDebt > 0 ? `${overviewData.totals.totalDebt.toFixed(2)} EUR` : '0.00 EUR'}
                      </p>
                    </div>
                  </div>

                  {/* Receitas Table */}
                  <div className="card !p-0 overflow-hidden border border-gray-200">
                    <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                      <h2 className="text-lg font-bold text-gray-900">Receitas (Quotas de Condomínio)</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[13px] border-collapse">
                        <thead>
                          <tr className="text-left text-gray-500 bg-gray-50/50 uppercase text-[11px] tracking-wider border-b">
                            <th className="py-3 px-4 font-bold sticky left-0 bg-gray-50 z-10 border-r shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Fração</th>
                            <th className="py-3 px-2 font-bold text-center bg-orange-50 text-orange-700 border-r">Div.Ant.</th>
                            {MONTH_NAMES.map((m) => (
                              <th key={m} className="py-3 px-1 font-bold text-center border-r last:border-r-0 min-w-[50px]">{m}</th>
                            ))}
                            <th className="py-3 px-3 font-bold text-right border-l bg-green-50 text-green-700">Pago</th>
                            <th className="py-3 px-3 font-bold text-right border-l text-gray-600">Prev.</th>
                            <th className="py-3 px-3 font-bold text-right border-l bg-red-50 text-red-700">Dív.Ano</th>
                            <th className="py-3 px-3 font-bold text-right border-l bg-red-100 text-red-800">TOTAL</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {overviewData.units.map((unit) => (
                            <tr key={unit.id} className="hover:bg-blue-50/30 transition-colors">
                              <td className="py-2 px-4 font-bold text-gray-900 sticky left-0 bg-white z-10 border-r shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                <button
                                  className="hover:text-primary-600 transition-colors text-left"
                                  onClick={() => router.push(`/dashboard/units/${unit.id}`)}
                                >
                                  {unit.code}
                                </button>
                              </td>
                              <td className={`py-2 px-2 text-center bg-orange-50/30 border-r ${unit.pastYearsDebt > 0 ? 'text-orange-600 font-bold' : 'text-gray-300'}`}>
                                {unit.pastYearsDebt > 0 ? `${unit.pastYearsDebt.toFixed(0)}€` : '-'}
                              </td>
                              {Array.from({ length: 12 }, (_, i) => {
                                const monthStr = `${selectedYear}-${(i + 1).toString().padStart(2, '0')}`;
                                const data = unit.months[monthStr] || { paid: 0, expected: 0, transactions: [] };
                                return (
                                  <td
                                    key={monthStr}
                                    className={`py-2 px-1 text-center cursor-pointer transition-colors border-r last:border-r-0 ${getCellColor(data.paid, data.expected)}`}
                                    onClick={() => handleCellClick('payment', unit.id, unit.code, monthStr, data.transactions || [])}
                                  >
                                    <div className="flex flex-col items-center">
                                      {data.paid > 0 ? (
                                        <span className="font-semibold">
                                          {Number.isInteger(data.paid) ? data.paid : data.paid.toFixed(1)}
                                        </span>
                                      ) : (
                                        <span className="text-gray-300">-</span>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="py-2 px-3 text-right bg-green-50/30 border-l text-green-700 font-bold">
                                {unit.totalPaid.toFixed(0)}€
                              </td>
                              <td className="py-2 px-3 text-right border-l text-gray-500">
                                {unit.totalExpected.toFixed(0)}€
                              </td>
                              <td className={`py-2 px-3 text-right border-l bg-red-50/30 font-bold ${(unit.yearDebt || 0) > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                                {(unit.yearDebt || 0) > 0 ? `${(unit.yearDebt || 0).toFixed(0)}€` : '-'}
                              </td>
                              <td className={`py-2 px-3 text-right border-l bg-red-100/20 font-black text-sm ${(unit.totalDebt || 0) > 0 ? 'text-red-700' : 'text-gray-300'}`}>
                                {(unit.totalDebt || 0) > 0 ? `${(unit.totalDebt || 0).toFixed(0)}€` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-900 text-white font-bold">
                            <td className="py-3 px-4 sticky left-0 bg-gray-900 z-10 border-r">TOTAL</td>
                            <td className="py-3 px-2 text-center bg-orange-900/50 border-r">
                              {overviewData.units.reduce((sum, u) => sum + u.pastYearsDebt, 0).toFixed(0)}€
                            </td>
                            {Array.from({ length: 12 }, (_, i) => {
                              const monthStr = `${selectedYear}-${(i + 1).toString().padStart(2, '0')}`;
                              const total = overviewData.units.reduce(
                                (sum, u) => sum + (u.months[monthStr]?.paid || 0),
                                0
                              );
                              return (
                                <td key={monthStr} className="py-3 px-1 text-center text-[11px] border-r last:border-r-0">
                                  {total > 0 ? `${total.toFixed(0)}€` : '-'}
                                </td>
                              );
                            })}
                            <td className="py-3 px-3 text-right bg-green-900/50 border-l">
                              {overviewData.totals.receitas.toFixed(0)}€
                            </td>
                            <td className="py-3 px-3 text-right border-l opacity-70">
                              {overviewData.units.reduce((sum, u) => sum + u.totalExpected, 0).toFixed(0)}€
                            </td>
                            <td className="py-3 px-3 text-right border-l bg-red-900/50">
                              {overviewData.units.reduce((sum, u) => sum + (u.yearDebt || 0), 0).toFixed(0)}€
                            </td>
                            <td className="py-3 px-3 text-right border-l bg-red-900/80 text-lg">
                              {overviewData.totals.totalDebt.toFixed(0)}€
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Despesas Table */}
                  <div className="card !p-0 overflow-hidden border border-gray-200">
                    <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                      <h2 className="text-lg font-bold text-gray-900">Despesas (Credores / Serviços)</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[13px] border-collapse">
                        <thead>
                          <tr className="text-left text-gray-500 bg-gray-50/50 uppercase text-[11px] tracking-wider border-b">
                            <th className="py-3 px-4 font-bold sticky left-0 bg-gray-50 z-10 border-r shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Credor</th>
                            <th className="py-3 px-2 font-bold text-center bg-orange-50 text-orange-700 border-r">Ant.</th>
                            {MONTH_NAMES.map((m) => (
                              <th key={m} className="py-3 px-1 font-bold text-center border-r last:border-r-0 min-w-[50px]">{m}</th>
                            ))}
                            <th className="py-3 px-3 font-bold text-right border-l bg-red-50 text-red-700">Pago</th>
                            <th className="py-3 px-3 font-bold text-right border-l text-gray-600">Prev.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {overviewData.creditors.map((creditor) => (
                            <tr key={creditor.id} className="hover:bg-red-50/20 transition-colors">
                              <td className="py-2 px-4 font-bold text-gray-900 sticky left-0 bg-white z-10 border-r shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                <button
                                  className="hover:text-primary-600 transition-colors text-left"
                                  onClick={() => router.push(`/dashboard/creditors/${creditor.id}`)}
                                >
                                  {creditor.name}
                                </button>
                              </td>
                              <td className={`py-2 px-2 text-center border-r ${creditor.pastYearsDebt > 0 ? 'text-orange-600 font-bold' : 'text-gray-300'}`}>
                                {creditor.pastYearsDebt > 0 ? `${creditor.pastYearsDebt.toFixed(0)}€` : '-'}
                              </td>
                              {Array.from({ length: 12 }, (_, i) => {
                                const monthStr = `${selectedYear}-${(i + 1).toString().padStart(2, '0')}`;
                                const data = creditor.months[monthStr] || { paid: 0, expected: 0, transactions: [] };
                                return (
                                  <td
                                    key={monthStr}
                                    className={`py-2 px-1 text-center cursor-pointer transition-colors border-r last:border-r-0 ${getCellColor(data.paid, data.expected)}`}
                                    onClick={() => handleCellClick('expense', creditor.id, creditor.name, monthStr, data.transactions || [])}
                                  >
                                    <span className="font-medium">
                                      {data.paid > 0 ? (Number.isInteger(data.paid) ? data.paid : data.paid.toFixed(0)) : '-'}
                                    </span>
                                  </td>
                                );
                              })}
                              <td className="py-2 px-3 text-right bg-red-50/30 border-l text-red-700 font-bold">
                                {creditor.totalPaid.toFixed(0)}€
                              </td>
                              <td className="py-2 px-3 text-right border-l text-gray-500">
                                {creditor.totalExpected.toFixed(0)}€
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-800 text-white font-bold">
                            <td className="py-3 px-4 sticky left-0 bg-gray-800 z-10 border-r">TOTAL DESPESAS</td>
                            <td className="py-3 px-2 text-center border-r">-</td>
                            {Array.from({ length: 12 }, (_, i) => {
                              const monthStr = `${selectedYear}-${(i + 1).toString().padStart(2, '0')}`;
                              const total = overviewData.creditors.reduce(
                                (sum, c) => sum + (c.months[monthStr]?.paid || 0),
                                0
                              );
                              return (
                                <td key={monthStr} className="py-3 px-1 text-center text-[11px] border-r last:border-r-0">
                                  {total > 0 ? `${total.toFixed(0)}€` : '-'}
                                </td>
                              );
                            })}
                            <td className="py-3 px-3 text-right bg-red-900/50 border-l">
                              {overviewData.totals.despesas.toFixed(0)}€
                            </td>
                            <td className="py-3 px-3 text-right border-l opacity-70">
                              {overviewData.creditors.reduce((sum, c) => sum + c.totalExpected, 0).toFixed(0)}€
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className="w-4 h-4 rounded bg-green-100 border border-green-300"></span> Pago
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-4 h-4 rounded bg-yellow-100 border border-yellow-300"></span> Parcial
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-4 h-4 rounded bg-white border border-gray-300"></span> Sem pagamento
                    </span>
                  </div>
                </div>

                {/* Side Panel */}
                {panelOpen && (
                  <div className="w-80 shrink-0">
                    <div className="card sticky top-8">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold">
                          {panelMode === 'edit'
                            ? `Editar ${panelType === 'payment' ? 'Pagamento' : 'Despesa'}`
                            : `${panelType === 'payment' ? 'Novo Pagamento' : 'Nova Despesa'}`}
                        </h3>
                        <button
                          className="text-gray-400 hover:text-gray-600 text-xl"
                          onClick={closePanel}
                        >
                          x
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="label">
                            {panelType === 'payment' ? 'Fração' : 'Credor'}
                          </label>
                          <p className="font-medium text-gray-900">{panelTargetName}</p>
                        </div>

                        <div>
                          <label className="label">Mês de Referência</label>
                          <p className="font-medium text-gray-900">{formatMonth(panelMonth)}</p>
                        </div>

                        {panelMode === 'edit' ? (
                          <>
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <p className="text-xs text-gray-500 mb-1">Valor da transação</p>
                              <p className="text-lg font-bold text-gray-900">{panelFullAmount.toFixed(2)} EUR</p>
                              <p className="text-xs text-gray-500 mt-1">{panelDescription}</p>
                              <p className="text-xs text-gray-400">{new Date(panelDate).toLocaleDateString('pt-PT')}</p>
                            </div>

                            <div>
                              <label className="label mb-2">Meses de referência</label>
                              <MonthCalendar
                                year={panelCalendarYear}
                                onYearChange={setPanelCalendarYear}
                                monthStatus={panelMonthStatus}
                                selectedMonths={panelSelectedMonths}
                                onToggleMonth={handlePanelToggleMonth}
                              />
                            </div>

                            {panelSelectedMonths.length > 0 && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-600">
                                    {panelSelectedMonths.length} mês(es) &mdash; {(panelFullAmount / panelSelectedMonths.length).toFixed(2)} EUR/mês
                                  </span>
                                  <button
                                    type="button"
                                    className={`text-xs px-2 py-1 rounded ${panelShowCustom ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                    onClick={() => {
                                      setPanelShowCustom(!panelShowCustom);
                                      if (!panelShowCustom) {
                                        const perMonth = panelFullAmount / panelSelectedMonths.length;
                                        const amounts: Record<string, string> = {};
                                        panelSelectedMonths.forEach((m) => { amounts[m] = perMonth.toFixed(2); });
                                        setPanelCustomAmounts(amounts);
                                      }
                                    }}
                                  >
                                    Personalizar
                                  </button>
                                </div>

                                {panelShowCustom && (
                                  <div className="space-y-1 p-2 bg-gray-50 rounded-lg">
                                    {panelSelectedMonths.map((month) => (
                                      <div key={month} className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 w-16">{month}</span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          className="input text-sm py-1 flex-1"
                                          value={panelCustomAmounts[month] || ''}
                                          onChange={(e) => setPanelCustomAmounts({ ...panelCustomAmounts, [month]: e.target.value })}
                                        />
                                        <span className="text-xs text-gray-400">EUR</span>
                                      </div>
                                    ))}
                                    <div className={`text-xs mt-1 ${getPanelAllocationTotal() > panelFullAmount + 0.01 ? 'text-red-500' : 'text-gray-500'}`}>
                                      Total: {getPanelAllocationTotal().toFixed(2)} / {panelFullAmount.toFixed(2)} EUR
                                      {getPanelAllocationTotal() > panelFullAmount + 0.01 && ' (excede o valor!)'}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            <button
                              className="btn-primary w-full"
                              onClick={handleSaveTransaction}
                              disabled={panelSaving || panelSelectedMonths.length === 0 || getPanelAllocationTotal() > panelFullAmount + 0.01}
                            >
                              {panelSaving ? 'A guardar...' : 'Guardar'}
                            </button>

                            <button
                              className="btn-secondary w-full text-sm"
                              onClick={() => router.push(`/dashboard/transactions?id=${panelTransactionId}`)}
                            >
                              Ver Transação Completa
                            </button>
                          </>
                        ) : (
                          <>
                            <div>
                              <label className="label">Data *</label>
                              <input
                                type="date"
                                className="input"
                                value={panelDate}
                                onChange={(e) => setPanelDate(e.target.value)}
                                required
                              />
                            </div>

                            <div>
                              <label className="label">Valor (EUR) *</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                className="input"
                                value={panelAmount}
                                onChange={(e) => setPanelAmount(e.target.value)}
                                placeholder="0.00"
                                required
                              />
                            </div>

                            <div>
                              <label className="label">Descrição</label>
                              <input
                                type="text"
                                className="input"
                                value={panelDescription}
                                onChange={(e) => setPanelDescription(e.target.value)}
                                placeholder={`${panelType === 'payment' ? 'Pagamento' : 'Despesa'} ${panelTargetName}`}
                              />
                            </div>

                            <button
                              className="btn-primary w-full"
                              onClick={handleSaveTransaction}
                              disabled={panelSaving || !panelAmount}
                            >
                              {panelSaving ? 'A guardar...' : 'Guardar'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Transaction Selection Modal */}
        {showTxModal && txModalContext && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h2 className="text-lg font-bold mb-4">Selecionar Transação</h2>
              <p className="text-sm text-gray-500 mb-4">
                Existem {txModalTransactions.length} transações para {txModalContext.targetName} em {formatMonth(txModalContext.month)}:
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {txModalTransactions.map((tx) => (
                  <button
                    key={tx.id}
                    className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-primary-500 hover:bg-primary-50 transition-colors"
                    onClick={() => openEditPanel(
                      txModalContext.type,
                      txModalContext.targetId,
                      txModalContext.targetName,
                      txModalContext.month,
                      tx
                    )}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{tx.amount.toFixed(2)}€</span>
                      <span className="text-sm text-gray-500">
                        {new Date(tx.date).toLocaleDateString('pt-PT')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">{tx.description}</p>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  className="btn-secondary flex-1"
                  onClick={() => setShowTxModal(false)}
                >
                  Cancelar
                </button>
                <button
                  className="btn-primary flex-1"
                  onClick={() => {
                    setShowTxModal(false);
                    openCreatePanel(
                      txModalContext.type,
                      txModalContext.targetId,
                      txModalContext.targetName,
                      txModalContext.month
                    );
                  }}
                >
                  + Nova
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
