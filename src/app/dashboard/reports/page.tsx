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
  const [activeTab, setActiveTab] = useState<'resumo' | 'visao'>('visao');
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
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
        </div>

        {loading ? (
          <p className="text-gray-500">A carregar...</p>
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
                >
                  Todos
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

            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Resumo Mensal</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500">
                      <th
                        className="pb-4 font-medium cursor-pointer hover:text-gray-900 select-none"
                        onClick={() => setResumoSortAsc(!resumoSortAsc)}
                      >
                        <span className="flex items-center gap-1">
                          Mês
                          <svg className={`w-4 h-4 transition-transform ${resumoSortAsc ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </th>
                      <th className="pb-4 font-medium text-right">Receitas</th>
                      <th className="pb-4 font-medium text-right">Despesas</th>
                      <th className="pb-4 font-medium text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMonthlyData.map((d, i) => (
                      <tr key={d.month} className={`hover:bg-gray-50 transition-colors ${i !== filteredMonthlyData.length - 1 ? 'border-b border-gray-100' : ''}`}>
                        <td className="py-4 text-sm font-medium text-gray-900">{formatMonth(d.month)}</td>
                        <td className="py-4 text-sm text-right text-green-600 font-medium">+{d.income.toFixed(2)} EUR</td>
                        <td className="py-4 text-sm text-right text-red-500 font-medium">-{d.expenses.toFixed(2)} EUR</td>
                        <td className={`py-4 text-sm text-right font-semibold ${d.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
                  <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Receitas (Frações)</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 border-b">
                            <th className="pb-2 pr-2 font-medium sticky left-0 bg-white">Fração</th>
                            <th className="pb-2 px-1 font-medium text-center min-w-[70px] text-orange-600">Div.Ant.</th>
                            {MONTH_NAMES.map((m) => (
                              <th key={m} className="pb-2 px-1 font-medium text-center min-w-[55px]">{m}</th>
                            ))}
                            <th className="pb-2 px-2 font-medium text-right">Pago</th>
                            <th className="pb-2 px-2 font-medium text-right">Esperado</th>
                            <th className="pb-2 px-2 font-medium text-right text-red-600">Dív.Ano</th>
                            <th className="pb-2 px-2 font-medium text-right text-red-600">Dív.Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {overviewData.units.map((unit) => (
                            <tr key={unit.id}>
                              <td className="py-2 pr-2 font-medium text-gray-900 sticky left-0 bg-white">
                                <button
                                  className="hover:text-primary-600 hover:underline text-left"
                                  onClick={() => router.push(`/dashboard/units/${unit.id}`)}
                                >
                                  {unit.code}
                                </button>
                              </td>
                              <td className={`py-1 px-1 text-center text-xs ${unit.pastYearsDebt > 0 ? 'text-orange-600 font-medium' : 'text-gray-300'}`}>
                                {unit.pastYearsDebt > 0 ? `${unit.pastYearsDebt.toFixed(2)}€` : '-'}
                              </td>
                              {Array.from({ length: 12 }, (_, i) => {
                                const monthStr = `${selectedYear}-${(i + 1).toString().padStart(2, '0')}`;
                                const data = unit.months[monthStr] || { paid: 0, expected: 0, transactions: [] };
                                return (
                                  <td
                                    key={monthStr}
                                    className={`py-1 px-1 text-center cursor-pointer transition-colors ${getCellColor(data.paid, data.expected)}`}
                                    onClick={() => handleCellClick('payment', unit.id, unit.code, monthStr, data.transactions || [])}
                                  >
                                    {data.paid > 0 ? (
                                      <span className="text-xs">
                                        {Number.isInteger(data.paid) ? data.paid : data.paid.toFixed(2)}€
                                      </span>
                                    ) : (
                                      <span className="text-xs text-gray-300">-</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="py-2 px-2 text-right text-green-600 font-medium">
                                {unit.totalPaid.toFixed(2)}€
                              </td>
                              <td className="py-2 px-2 text-right text-gray-500">
                                {unit.totalExpected.toFixed(2)}€
                              </td>
                              <td className={`py-2 px-2 text-right font-medium ${(unit.yearDebt || 0) > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                                {(unit.yearDebt || 0) > 0 ? `${(unit.yearDebt || 0).toFixed(2)}€` : '-'}
                              </td>
                              <td className={`py-2 px-2 text-right font-medium ${(unit.totalDebt || 0) > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                                {(unit.totalDebt || 0) > 0 ? `${(unit.totalDebt || 0).toFixed(2)}€` : '-'}
                              </td>
                            </tr>
                          ))}
                          {/* Totals row */}
                          <tr className="bg-gray-50 font-bold">
                            <td className="py-2 pr-2 sticky left-0 bg-gray-50">Total Receitas</td>
                            <td className="py-2 px-1 text-center text-xs text-orange-600">
                              {overviewData.units.reduce((sum, u) => sum + u.pastYearsDebt, 0) > 0
                                ? `${overviewData.units.reduce((sum, u) => sum + u.pastYearsDebt, 0).toFixed(2)}€`
                                : '-'}
                            </td>
                            {Array.from({ length: 12 }, (_, i) => {
                              const monthStr = `${selectedYear}-${(i + 1).toString().padStart(2, '0')}`;
                              const total = overviewData.units.reduce(
                                (sum, u) => sum + (u.months[monthStr]?.paid || 0),
                                0
                              );
                              return (
                                <td key={monthStr} className="py-2 px-1 text-center text-xs text-green-600">
                                  {total > 0 ? `${total.toFixed(2)}€` : '-'}
                                </td>
                              );
                            })}
                            <td className="py-2 px-2 text-right text-green-600">
                              {overviewData.totals.receitas.toFixed(2)}€
                            </td>
                            <td className="py-2 px-2 text-right text-gray-500">
                              {overviewData.units.reduce((sum, u) => sum + u.totalExpected, 0).toFixed(2)}€
                            </td>
                            <td className="py-2 px-2 text-right text-red-600">
                              {overviewData.units.reduce((sum, u) => sum + (u.yearDebt || 0), 0) > 0
                                ? `${overviewData.units.reduce((sum, u) => sum + (u.yearDebt || 0), 0).toFixed(2)}€`
                                : '-'}
                            </td>
                            <td className="py-2 px-2 text-right text-red-600">
                              {overviewData.totals.totalDebt > 0 ? `${overviewData.totals.totalDebt.toFixed(2)}€` : '-'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Despesas Table */}
                  <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Despesas (Credores)</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 border-b">
                            <th className="pb-2 pr-2 font-medium sticky left-0 bg-white">Credor</th>
                            <th className="pb-2 px-1 font-medium text-center min-w-[70px] text-orange-600">Div.Ant.</th>
                            {MONTH_NAMES.map((m) => (
                              <th key={m} className="pb-2 px-1 font-medium text-center min-w-[55px]">{m}</th>
                            ))}
                            <th className="pb-2 px-2 font-medium text-right">Pago</th>
                            <th className="pb-2 px-2 font-medium text-right">Esperado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {overviewData.creditors.map((creditor) => (
                            <tr key={creditor.id}>
                              <td className="py-2 pr-2 font-medium text-gray-900 sticky left-0 bg-white">
                                <button
                                  className="hover:text-primary-600 hover:underline text-left"
                                  onClick={() => router.push(`/dashboard/creditors/${creditor.id}`)}
                                >
                                  {creditor.name}
                                </button>
                              </td>
                              <td className={`py-1 px-1 text-center text-xs ${creditor.pastYearsDebt > 0 ? 'text-orange-600 font-medium' : 'text-gray-300'}`}>
                                {creditor.pastYearsDebt > 0 ? `${creditor.pastYearsDebt.toFixed(2)}€` : '-'}
                              </td>
                              {Array.from({ length: 12 }, (_, i) => {
                                const monthStr = `${selectedYear}-${(i + 1).toString().padStart(2, '0')}`;
                                const data = creditor.months[monthStr] || { paid: 0, expected: 0, transactions: [] };
                                return (
                                  <td
                                    key={monthStr}
                                    className={`py-1 px-1 text-center cursor-pointer transition-colors ${getCellColor(data.paid, data.expected)}`}
                                    onClick={() => handleCellClick('expense', creditor.id, creditor.name, monthStr, data.transactions || [])}
                                  >
                                    {data.paid > 0 ? (
                                      <span className="text-xs">
                                        {Number.isInteger(data.paid) ? data.paid : data.paid.toFixed(2)}€
                                      </span>
                                    ) : (
                                      <span className="text-xs text-gray-300">-</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="py-2 px-2 text-right text-red-600 font-medium">
                                {creditor.totalPaid.toFixed(2)}€
                              </td>
                              <td className="py-2 px-2 text-right text-gray-500">
                                {creditor.totalExpected.toFixed(2)}€
                              </td>
                            </tr>
                          ))}
                          {/* Totals row */}
                          <tr className="bg-gray-50 font-bold">
                            <td className="py-2 pr-2 sticky left-0 bg-gray-50">Total Despesas</td>
                            <td className="py-2 px-1 text-center text-xs text-orange-600">
                              {overviewData.creditors.reduce((sum, c) => sum + c.pastYearsDebt, 0) > 0
                                ? `${overviewData.creditors.reduce((sum, c) => sum + c.pastYearsDebt, 0).toFixed(2)}€`
                                : '-'}
                            </td>
                            {Array.from({ length: 12 }, (_, i) => {
                              const monthStr = `${selectedYear}-${(i + 1).toString().padStart(2, '0')}`;
                              const total = overviewData.creditors.reduce(
                                (sum, c) => sum + (c.months[monthStr]?.paid || 0),
                                0
                              );
                              return (
                                <td key={monthStr} className="py-2 px-1 text-center text-xs text-red-600">
                                  {total > 0 ? `${total.toFixed(2)}€` : '-'}
                                </td>
                              );
                            })}
                            <td className="py-2 px-2 text-right text-red-600">
                              {overviewData.totals.despesas.toFixed(2)}€
                            </td>
                            <td className="py-2 px-2 text-right text-gray-500">
                              {overviewData.creditors.reduce((sum, c) => sum + c.totalExpected, 0).toFixed(2)}€
                            </td>
                          </tr>
                        </tbody>
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
