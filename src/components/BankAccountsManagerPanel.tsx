'use client';

import { useEffect, useState } from 'react';

interface Snapshot {
  id: string;
  date: string;
  balance: number;
  description: string | null;
}

interface BankAccount {
  id: string;
  name: string;
  accountType: string;
  currentBalance: number;
  snapshots: Snapshot[];
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  current: 'Ordem (Corrente)',
  savings: 'Poupança',
  cash: 'Caixa (Numerário)',
};

function fmtEur(value: number): string {
  return `${value.toLocaleString('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

function formatDatePt(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default function BankAccountsManagerPanel() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [editingSnapshot, setEditingSnapshot] = useState<Snapshot | null>(null);
  const [saving, setSaving] = useState(false);

  const [accountForm, setAccountForm] = useState({
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
    setLoading(true);
    try {
      const res = await fetch('/api/bank-accounts');
      if (res.ok) setAccounts(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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
        setAccountForm({ name: '', accountType: 'current', description: '' });
        fetchAccounts();
      }
    } finally {
      setSaving(false);
    }
  }

  function openNewSnapshot(accountId: string) {
    setSelectedAccountId(accountId);
    setEditingSnapshot(null);
    setSnapshotForm({
      date: new Date().toISOString().split('T')[0],
      balance: '',
      description: '',
    });
    setShowSnapshotModal(true);
  }

  function openEditSnapshot(accountId: string, snapshot: Snapshot) {
    setSelectedAccountId(accountId);
    setEditingSnapshot(snapshot);
    setSnapshotForm({
      date: new Date(snapshot.date).toISOString().split('T')[0],
      balance: snapshot.balance.toString(),
      description: snapshot.description || '',
    });
    setShowSnapshotModal(true);
  }

  async function handleSnapshotSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAccountId) return;
    setSaving(true);
    try {
      if (editingSnapshot) {
        const res = await fetch(`/api/bank-accounts/${selectedAccountId}/snapshots`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            snapshotId: editingSnapshot.id,
            ...snapshotForm,
            balance: parseFloat(snapshotForm.balance),
          }),
        });
        if (res.ok) {
          setShowSnapshotModal(false);
          setEditingSnapshot(null);
          fetchAccounts();
        }
      } else {
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
          fetchAccounts();
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSnapshot(accountId: string, snapshotId: string) {
    if (!confirm('Tem a certeza que deseja apagar este registo de saldo?')) return;
    try {
      const res = await fetch(
        `/api/bank-accounts/${accountId}/snapshots?snapshotId=${snapshotId}`,
        { method: 'DELETE' }
      );
      if (res.ok) fetchAccounts();
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Contas Bancárias &amp; Saldos de Fecho</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Consulte saldos calculados e registe saldos oficiais de fecho por conta.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary text-sm self-start sm:self-auto"
          onClick={() => setShowAccountModal(true)}
        >
          + Nova Conta
        </button>
      </div>

      {loading ? (
        <div className="card py-12 text-center text-sm text-slate-500">
          A carregar contas bancárias...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {accounts.map((account) => (
            <div key={account.id} className="card">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{account.name}</h3>
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mt-0.5">
                    {ACCOUNT_TYPE_LABELS[account.accountType] || account.accountType}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="text-[11px] text-slate-500 font-bold uppercase mb-1">
                    Saldo Atual (Calculado)
                  </p>
                  <p className="text-2xl font-black text-blue-700">
                    {fmtEur(account.currentBalance)}
                  </p>
                  <button
                    type="button"
                    className="btn-secondary text-xs h-8 px-3 mt-2 font-bold"
                    onClick={() => openNewSnapshot(account.id)}
                  >
                    + Registar Saldo Fecho
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200 text-xs uppercase tracking-wider">
                      <th className="pb-2.5 pr-4 font-semibold">Data</th>
                      <th className="pb-2.5 pr-4 font-semibold">Saldo</th>
                      <th className="pb-2.5 pr-4 font-semibold">Variação</th>
                      <th className="pb-2.5 pr-4 font-semibold">Notas</th>
                      <th className="pb-2.5 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {account.snapshots?.map((snapshot, idx) => {
                      const prev = account.snapshots[idx + 1];
                      const delta = prev
                        ? Math.round((snapshot.balance - prev.balance) * 100) / 100
                        : null;
                      return (
                        <tr key={snapshot.id} className="group hover:bg-slate-50/70">
                          <td className="py-3 pr-4 text-slate-700 whitespace-nowrap">
                            {formatDatePt(snapshot.date)}
                          </td>
                          <td className="py-3 pr-4 font-bold text-slate-900 whitespace-nowrap">
                            {fmtEur(snapshot.balance)}
                          </td>
                          <td className="py-3 pr-4 whitespace-nowrap">
                            {delta !== null ? (
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                  delta > 0
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : delta < 0
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {delta > 0 ? `+${fmtEur(delta)}` : fmtEur(delta)}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-slate-500 italic">
                            {snapshot.description || '—'}
                          </td>
                          <td className="py-3 text-right whitespace-nowrap">
                            <div className="flex gap-2 justify-end opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                className="text-xs text-blue-700 hover:text-blue-900 font-semibold px-2 py-1 rounded hover:bg-blue-50"
                                onClick={() => openEditSnapshot(account.id, snapshot)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="text-xs text-red-700 hover:text-red-900 font-semibold px-2 py-1 rounded hover:bg-red-50"
                                onClick={() => handleDeleteSnapshot(account.id, snapshot.id)}
                              >
                                Apagar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {(!account.snapshots || account.snapshots.length === 0) && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500 text-sm">
                          Sem registos de saldo
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Nova Conta Bancária</h3>
            <form onSubmit={handleAccountSubmit} className="space-y-4">
              <div>
                <label className="label">Nome da Conta</label>
                <input
                  type="text"
                  className="input"
                  value={accountForm.name}
                  onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                  placeholder="Ex: Conta Corrente CGD"
                  required
                />
              </div>
              <div>
                <label className="label">Tipo</label>
                <select
                  className="input"
                  value={accountForm.accountType}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, accountType: e.target.value })
                  }
                >
                  <option value="current">Ordem (Corrente)</option>
                  <option value="savings">Poupança</option>
                  <option value="cash">Caixa (Dinheiro)</option>
                </select>
              </div>
              <div>
                <label className="label">Descrição (Opcional)</label>
                <input
                  type="text"
                  className="input"
                  value={accountForm.description}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, description: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAccountModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Snapshot Modal */}
      {showSnapshotModal && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-4">
              {editingSnapshot ? 'Editar Registo de Saldo' : 'Registar Saldo de Fecho'}
            </h3>
            <form onSubmit={handleSnapshotSubmit} className="space-y-4">
              <div>
                <label className="label">Data de Referência</label>
                <input
                  type="date"
                  className="input"
                  value={snapshotForm.date}
                  onChange={(e) => setSnapshotForm({ ...snapshotForm, date: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Saldo (€)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={snapshotForm.balance}
                  onChange={(e) =>
                    setSnapshotForm({ ...snapshotForm, balance: e.target.value })
                  }
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className="label">Notas</label>
                <input
                  type="text"
                  className="input"
                  value={snapshotForm.description}
                  onChange={(e) =>
                    setSnapshotForm({ ...snapshotForm, description: e.target.value })
                  }
                  placeholder="Ex: Saldo a 31 de Dezembro"
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowSnapshotModal(false);
                    setEditingSnapshot(null);
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {editingSnapshot ? 'Guardar Alterações' : 'Registar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
