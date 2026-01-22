'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TransactionList from '@/components/TransactionList';
import { Transaction } from '@/lib/types';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: '', startDate: '', endDate: '' });

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.type) params.set('type', filter.type);
      if (filter.startDate) params.set('startDate', filter.startDate);
      if (filter.endDate) params.set('endDate', filter.endDate);

      const res = await fetch(`/api/transactions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTransactions();
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Transacoes</h1>
          <button className="btn-primary">+ Nova Transacao</button>
        </div>

        <form onSubmit={handleFilter} className="card mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Tipo</label>
              <select
                value={filter.type}
                onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                className="input"
              >
                <option value="">Todos</option>
                <option value="payment">Pagamento</option>
                <option value="expense">Despesa</option>
                <option value="fee">Taxa</option>
                <option value="transfer">Transferencia</option>
              </select>
            </div>
            <div>
              <label className="label">Data Inicio</label>
              <input
                type="date"
                value={filter.startDate}
                onChange={(e) =>
                  setFilter({ ...filter, startDate: e.target.value })
                }
                className="input"
              />
            </div>
            <div>
              <label className="label">Data Fim</label>
              <input
                type="date"
                value={filter.endDate}
                onChange={(e) =>
                  setFilter({ ...filter, endDate: e.target.value })
                }
                className="input"
              />
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn-secondary w-full">
                Filtrar
              </button>
            </div>
          </div>
        </form>

        <div className="card">
          {loading ? (
            <p className="text-gray-500">A carregar...</p>
          ) : (
            <TransactionList transactions={transactions} />
          )}
        </div>
      </main>
    </div>
  );
}
