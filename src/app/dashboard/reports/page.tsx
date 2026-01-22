'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { Transaction } from '@/lib/types';

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
  balance: number;
}

export default function ReportsPage() {
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/transactions?limit=1000');
      if (res.ok) {
        const { transactions } = await res.json();

        // Group by month
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

        // Convert to array and sort
        const data: MonthlyData[] = Array.from(monthMap.entries())
          .map(([month, { income, expenses }]) => ({
            month,
            income,
            expenses,
            balance: income - expenses,
          }))
          .sort((a, b) => a.month.localeCompare(b.month));

        setMonthlyData(data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatMonth = (month: string) => {
    const [year, m] = month.split('-');
    const months = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
    ];
    return `${months[parseInt(m) - 1]} ${year}`;
  };

  const totalIncome = monthlyData.reduce((sum, d) => sum + d.income, 0);
  const totalExpenses = monthlyData.reduce((sum, d) => sum + d.expenses, 0);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Relatorios</h1>

        {loading ? (
          <p className="text-gray-500">A carregar...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="card">
                <h3 className="text-sm font-medium text-gray-500">
                  Total Receitas
                </h3>
                <p className="text-2xl font-bold text-green-600">
                  {totalIncome.toFixed(2)} EUR
                </p>
              </div>
              <div className="card">
                <h3 className="text-sm font-medium text-gray-500">
                  Total Despesas
                </h3>
                <p className="text-2xl font-bold text-red-600">
                  {totalExpenses.toFixed(2)} EUR
                </p>
              </div>
              <div className="card">
                <h3 className="text-sm font-medium text-gray-500">
                  Saldo Total
                </h3>
                <p className={`text-2xl font-bold ${
                  totalIncome - totalExpenses >= 0 ? 'text-primary-600' : 'text-red-600'
                }`}>
                  {(totalIncome - totalExpenses).toFixed(2)} EUR
                </p>
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Resumo Mensal
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500 border-b">
                      <th className="pb-3 font-medium">Mes</th>
                      <th className="pb-3 font-medium text-right">Receitas</th>
                      <th className="pb-3 font-medium text-right">Despesas</th>
                      <th className="pb-3 font-medium text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {monthlyData.map((d) => (
                      <tr key={d.month} className="hover:bg-gray-50">
                        <td className="py-3 text-sm font-medium text-gray-900">
                          {formatMonth(d.month)}
                        </td>
                        <td className="py-3 text-sm text-right text-green-600">
                          +{d.income.toFixed(2)} EUR
                        </td>
                        <td className="py-3 text-sm text-right text-red-600">
                          -{d.expenses.toFixed(2)} EUR
                        </td>
                        <td
                          className={`py-3 text-sm text-right font-medium ${
                            d.balance >= 0 ? 'text-primary-600' : 'text-red-600'
                          }`}
                        >
                          {d.balance >= 0 ? '+' : ''}
                          {d.balance.toFixed(2)} EUR
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
