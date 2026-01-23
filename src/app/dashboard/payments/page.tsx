'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { Unit, Transaction } from '@/lib/types';

interface PaymentStatus {
  unit: Unit;
  paid: boolean;
  amount: number;
  lastPayment?: Transaction;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    fetchPayments();
  }, [selectedMonth]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const [unitsRes, transRes] = await Promise.all([
        fetch('/api/units'),
        fetch(`/api/transactions?type=payment&startDate=${selectedMonth}-01&endDate=${selectedMonth}-31`),
      ]);

      if (unitsRes.ok && transRes.ok) {
        const units: Unit[] = await unitsRes.json();
        const { transactions } = await transRes.json();

        const statusMap = new Map<string, PaymentStatus>();

        // Initialize all units as unpaid
        for (const unit of units) {
          // Skip non-resident units
          if (['Gestao Conta', 'Luz', 'Conta Poupança'].includes(unit.code)) continue;

          statusMap.set(unit.id, {
            unit,
            paid: false,
            amount: 0,
          });
        }

        // Mark paid units
        for (const tx of transactions as Transaction[]) {
          if (tx.unitId && statusMap.has(tx.unitId)) {
            const status = statusMap.get(tx.unitId)!;
            status.paid = true;
            status.amount += tx.amount;
            status.lastPayment = tx;
          }
        }

        setPayments(Array.from(statusMap.values()).sort((a, b) =>
          a.unit.code.localeCompare(b.unit.code)
        ));
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const paidCount = payments.filter((p) => p.paid).length;
  const totalExpected = payments.reduce((sum, p) => sum + p.unit.monthlyFee, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">
          Pagamentos Mensais
        </h1>

        <div className="card mb-6">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <label className="label">Mês</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="input"
              />
            </div>
            <div className="flex-1" />
            <div className="text-right">
              <p className="text-sm text-gray-400">Pagamentos recebidos</p>
              <p className="text-2xl font-semibold text-green-600">
                {paidCount}/{payments.length}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Total recebido</p>
              <p className="text-2xl font-semibold text-gray-900">
                {totalPaid.toFixed(2)} / {totalExpected.toFixed(2)} EUR
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500">A carregar...</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {payments.map((p) => (
              <div
                key={p.unit.id}
                className={`rounded-2xl p-4 text-center cursor-pointer transition-all hover:scale-105 ${
                  p.paid
                    ? 'bg-green-50'
                    : 'bg-red-50'
                }`}
              >
                <h3 className="text-xl font-semibold text-gray-900">{p.unit.code}</h3>
                <p
                  className={`text-sm font-medium ${
                    p.paid ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {p.paid ? 'Pago' : 'Pendente'}
                </p>
                {p.paid && (
                  <p className="text-xs text-gray-500 mt-1">
                    {p.amount.toFixed(2)} EUR
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
