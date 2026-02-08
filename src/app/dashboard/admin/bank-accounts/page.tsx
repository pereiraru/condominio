'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';

interface BankAccount {
  id: string;
  name: string;
  accountType: string;
  currentBalance: number;
  snapshots: {
    id: string;
    date: string;
    balance: number;
    description: string | null;
  }[];
}

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [accountForm, setAccountAccountForm] = useState({
    name: '',
    accountType: 'current',
    description: '',
  });

  const [snapshotForm, setSnapshotForm] = useState({
    date: new Date().toISOString().split('T')[0],
    balance: '',
    description: '',
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    try {
      const res = await fetch('/api/bank-accounts');
      if (res.ok) setAccounts(await res.json());
    } catch (e) {
      console.error(e);
    }
  }

  async function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountForm),
      });
      if (res.ok) {
        setShowAccountModal(false);
        setAccountAccountForm({ name: '', accountType: 'current', description: '' });
        fetchAccounts();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSnapshotSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAccountId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/bank-accounts/${selectedAccountId}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...snapshotForm,
          balance: parseFloat(snapshotForm.balance),
        }),
      });
      if (res.ok) {
        setShowSnapshotModal(false);
        setSnapshotForm({ date: new Date().toISOString().split('T')[0], balance: '', description: '' });
        fetchAccounts();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSnapshot(accountId: string, snapshotId: string) {
    if (!confirm('Tem certeza que deseja eliminar este registo de saldo?')) return;
    try {
      const res = await fetch(`/api/bank-accounts/${accountId}/snapshots?snapshotId=${snapshotId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchAccounts();
      } else {
        alert('Erro ao eliminar registo');
      }
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Contas Bancárias</h1>
            <button className="btn-primary" onClick={() => setShowAccountModal(true)}>+ Nova Conta</button>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {accounts.map(account => (
              <div key={account.id} className="card">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{account.name}</h2>
                    <p className="text-sm text-gray-500 uppercase font-bold tracking-wider">{account.accountType}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Saldo Atual (Calculado)</p>
                    <p className="text-2xl font-black text-primary-600">{account.currentBalance.toFixed(2)}€</p>
                    <button 
                      className="btn-secondary text-[10px] py-1 px-3 mt-2 uppercase tracking-widest font-bold"
                      onClick={() => { setSelectedAccountId(account.id); setShowSnapshotModal(true); }}
                    >
                      + Registar Saldo Fecho
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-100">
                        <th className="pb-2 font-medium">Data</th>
                        <th className="pb-2 font-medium">Saldo</th>
                        <th className="pb-2 font-medium">Notas</th>
                        <th className="pb-2 font-medium text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {account.snapshots?.map(snapshot => (
                        <tr key={snapshot.id}>
                          <td className="py-3 text-gray-600">{new Date(snapshot.date).toLocaleDateString('pt-PT')}</td>
                          <td className="py-3 font-bold text-gray-900">{snapshot.balance.toFixed(2)}€</td>
                          <td className="py-3 text-gray-500 italic">{snapshot.description || '-'}</td>
                          <td className="py-3 text-right">
                            <button 
                              className="text-red-500 hover:text-red-700 transition-colors p-1"
                              onClick={() => handleDeleteSnapshot(account.id, snapshot.id)}
                              title="Eliminar registo"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h14" /></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!account.snapshots || account.snapshots.length === 0) && (
                        <tr><td colSpan={4} className="py-4 text-center text-gray-400">Sem registos de saldo</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Account Modal */}
        {showAccountModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <h2 className="text-xl font-bold mb-4">Nova Conta Bancária</h2>
              <form onSubmit={handleAccountSubmit} className="space-y-4">
                <div>
                  <label className="label">Nome da Conta</label>
                  <input type="text" className="input" value={accountForm.name} onChange={e => setAccountAccountForm({...accountForm, name: e.target.value})} placeholder="Ex: Conta Corrente CGD" required />
                </div>
                <div>
                  <label className="label">Tipo</label>
                  <select className="input" value={accountForm.accountType} onChange={e => setAccountAccountForm({...accountForm, accountType: e.target.value})}>
                    <option value="current">Ordem (Corrente)</option>
                    <option value="savings">Poupança</option>
                    <option value="cash">Caixa (Dinheiro)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Descrição (Opcional)</label>
                  <input type="text" className="input" value={accountForm.description} onChange={e => setAccountAccountForm({...accountForm, description: e.target.value})} />
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <button type="button" className="btn-secondary" onClick={() => setShowAccountModal(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary" disabled={saving}>Guardar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Snapshot Modal */}
        {showSnapshotModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <h2 className="text-xl font-bold mb-4">Registar Saldo de Fecho</h2>
              <form onSubmit={handleSnapshotSubmit} className="space-y-4">
                <div>
                  <label className="label">Data de Referência</label>
                  <input type="date" className="input" value={snapshotForm.date} onChange={e => setSnapshotForm({...snapshotForm, date: e.target.value})} required />
                </div>
                <div>
                  <label className="label">Saldo (EUR)</label>
                  <input type="number" step="0.01" className="input" value={snapshotForm.balance} onChange={e => setSnapshotForm({...snapshotForm, balance: e.target.value})} placeholder="0.00" required />
                </div>
                <div>
                  <label className="label">Notas</label>
                  <input type="text" className="input" value={snapshotForm.description} onChange={e => setSnapshotForm({...snapshotForm, description: e.target.value})} placeholder="Ex: Saldo a 31 de Dezembro" />
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <button type="button" className="btn-secondary" onClick={() => setShowSnapshotModal(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary" disabled={saving}>Registar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
