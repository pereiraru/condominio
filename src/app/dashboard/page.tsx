'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import StatsCard from '@/components/StatsCard';
import TransactionList from '@/components/TransactionList';
import { DashboardStats, Transaction } from '@/lib/types';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, transRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/transactions?limit=10'),
        ]);

        if (statsRes.ok) setStats(await statsRes.json());
        if (transRes.ok) {
          const data = await transRes.json();
          setTransactions(data.transactions || []);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

        {loading ? (
          <div className="text-gray-500">A carregar...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatsCard
                title="Saldo Atual"
                value={`${stats?.currentBalance?.toFixed(2) ?? '0.00'} EUR`}
                trend={stats?.balanceTrend}
              />
              <StatsCard
                title="Receitas (Mes)"
                value={`${stats?.monthlyIncome?.toFixed(2) ?? '0.00'} EUR`}
                color="green"
              />
              <StatsCard
                title="Despesas (Mes)"
                value={`${Math.abs(stats?.monthlyExpenses ?? 0).toFixed(2)} EUR`}
                color="red"
              />
              <StatsCard
                title="Pagamentos Pendentes"
                value={`${stats?.pendingPayments ?? 0}`}
                color="yellow"
              />
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Ultimas Transacoes
              </h2>
              <TransactionList transactions={transactions} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
