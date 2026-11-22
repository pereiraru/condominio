'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';

interface ManagedUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  unitId: string | null;
  mustChangePassword?: boolean;
  lastLogin: string | null;
  createdAt: string;
  unit?: { id?: string; code: string; email?: string | null } | null;
}

interface UnitSummary {
  id: string;
  code: string;
  email?: string | null;
  owners?: { id: string; name: string; email?: string | null; endMonth?: string | null }[];
}

interface ProvisionedAccount {
  userId: string;
  unitId: string | null;
  unitCode: string;
  ownerName: string;
  email: string;
  temporaryPassword: string;
  isPlaceholderEmail?: boolean;
  emailSent?: boolean;
  emailReason?: string;
}

export default function UsersManagerPanel() {
  const { data: session, update: updateSession } = useSession();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [units, setUnits] = useState<UnitSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Provisioning state
  const [provisioning, setProvisioning] = useState(false);
  const [missingUnitEmails, setMissingUnitEmails] = useState<Record<string, string>>({});
  const [provisionedAccounts, setProvisionedAccounts] = useState<ProvisionedAccount[] | null>(null);
  const [rowEmailTargets, setRowEmailTargets] = useState<Record<string, string>>({});
  const [sendingRowId, setSendingRowId] = useState<string | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  // Create / edit modal state
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'user',
    unitId: '',
    mustChangePassword: true,
    sendCredentialsEmail: false,
  });
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, unitsRes] = await Promise.all([fetch('/api/users'), fetch('/api/units')]);
      if (uRes.ok) setUsers(await uRes.json());
      if (unitsRes.ok) {
        const unitsList: UnitSummary[] = await unitsRes.json();
        setUnits(unitsList);
        setMissingUnitEmails((prev) => {
          const next = { ...prev };
          for (const unit of unitsList) {
            if (next[unit.id] === undefined) {
              const activeOwner =
                unit.owners?.find((o) => !o.endMonth) || unit.owners?.[0];
              next[unit.id] = activeOwner?.email || unit.email || '';
            }
          }
          return next;
        });
      }
    } catch (error) {
      console.error('Error loading users/units:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const unassignedUnits = useMemo(
    () => units.filter((u) => !users.some((usr) => usr.unitId === u.id)),
    [units, users]
  );

  const availableUnitsForModal = useMemo(
    () =>
      units.filter(
        (unit) =>
          !users.some(
            (user) =>
              user.unitId === unit.id && (!editingUser || user.id !== editingUser.id)
          )
      ),
    [units, users, editingUser]
  );

  function openCreateModal() {
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      name: '',
      role: 'user',
      unitId: '',
      mustChangePassword: true,
      sendCredentialsEmail: false,
    });
    setModalError('');
    setShowModal(true);
  }

  function openEditModal(user: ManagedUser) {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      name: user.name || '',
      role: user.role,
      unitId: user.unitId || '',
      mustChangePassword: Boolean(user.mustChangePassword),
      sendCredentialsEmail: false,
    });
    setModalError('');
    setShowModal(true);
  }

  async function handleSubmitModal(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setModalError('');
    setBanner(null);

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';

      const body: Record<string, unknown> = {
        email: formData.email.trim().toLowerCase(),
        name: formData.name.trim() || null,
        role: formData.role,
        unitId: formData.unitId || null,
        mustChangePassword: formData.mustChangePassword,
        sendCredentialsEmail: formData.sendCredentialsEmail,
      };

      if (formData.password.trim()) {
        body.password = formData.password.trim();
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || 'Erro ao guardar utilizador.');
        return;
      }

      setShowModal(false);
      await loadAll();

      if (!editingUser && data.generatedPassword) {
        setProvisionedAccounts([
          {
            userId: data.id,
            unitId: data.unitId || null,
            unitCode: data.unit?.code || 'Geral',
            ownerName: data.name || data.email,
            email: data.email,
            temporaryPassword: data.generatedPassword,
            isPlaceholderEmail:
              data.email.endsWith('@condominio.pt') || data.email.endsWith('.local'),
            emailSent: Boolean(data.notification?.sent),
            emailReason: data.notification?.reason,
          },
        ]);
      } else {
        setBanner({ type: 'ok', text: `Utilizador ${data.email} atualizado com sucesso.` });
      }
    } catch {
      setModalError('Erro de ligação ao guardar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleAdmin(user: ManagedUser) {
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    const actionLabel =
      nextRole === 'admin'
        ? `Promover ${user.name || user.email} a Administrador?`
        : `Remover privilégios de Administrador a ${user.name || user.email}?`;
    if (!window.confirm(actionLabel)) return;

    setBanner(null);
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: nextRole }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBanner({ type: 'err', text: data.error || 'Não foi possível alterar o perfil.' });
      return;
    }

    if (user.id === session?.user?.id) {
      await updateSession();
    }
    await loadAll();
    setBanner({
      type: 'ok',
      text: `${data.email} é agora ${nextRole === 'admin' ? 'Administrador' : 'Condómino'}.`,
    });
  }

  async function handleProvisionMissing(targetUnitIds?: string[]) {
    setProvisioning(true);
    setBanner(null);
    try {
      const res = await fetch('/api/users/provision-missing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitIds: targetUnitIds,
          sendEmails: true,
          customEmails: missingUnitEmails,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: 'err', text: data.error || 'Erro ao criar contas em falta.' });
        return;
      }

      if (Array.isArray(data.accounts) && data.accounts.length > 0) {
        setProvisionedAccounts(data.accounts);
        const initTargets: Record<string, string> = {};
        for (const acc of data.accounts as ProvisionedAccount[]) {
          initTargets[acc.userId] = acc.isPlaceholderEmail ? '' : acc.email;
        }
        setRowEmailTargets(initTargets);
        setCopiedCreds(false);
        setBanner({
          type: 'ok',
          text: `${data.createdCount} conta(s) criada(s) com password inicial temporária (troca obrigatória no 1.º acesso).`,
        });
      } else {
        setBanner({ type: 'ok', text: 'Todas as frações selecionadas já possuem conta.' });
      }
      await loadAll();
    } catch {
      setBanner({ type: 'err', text: 'Erro de ligação ao criar contas em falta.' });
    } finally {
      setProvisioning(false);
    }
  }

  async function handleResetTempPassword(user: ManagedUser) {
    if (
      !window.confirm(
        `Gerar uma nova password temporária para ${user.email} e exigir troca no próximo acesso?`
      )
    ) {
      return;
    }

    setBanner(null);
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetTemporaryPassword: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBanner({ type: 'err', text: data.error || 'Erro ao gerar nova password.' });
      return;
    }

    if (data.generatedPassword) {
      setProvisionedAccounts([
        {
          userId: data.id,
          unitId: data.unitId || null,
          unitCode: data.unit?.code || 'Geral',
          ownerName: data.name || data.email,
          email: data.email,
          temporaryPassword: data.generatedPassword,
          isPlaceholderEmail:
            data.email.endsWith('@condominio.pt') || data.email.endsWith('.local'),
        },
      ]);
      setRowEmailTargets({
        [data.id]:
          data.email.endsWith('@condominio.pt') || data.email.endsWith('.local')
            ? data.unit?.email || ''
            : data.email,
      });
      setCopiedCreds(false);
    }
    await loadAll();
  }

  async function handleSendResetLink(user: ManagedUser) {
    setBanner(null);
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sendResetLink: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBanner({
        type: 'err',
        text: data.error || 'Não foi possível enviar o link de reposição.',
      });
      return;
    }

    if (data.notification?.sent) {
      setBanner({
        type: 'ok',
        text: `Link de reposição enviado para ${data.notification.recipients.join(', ')}.`,
      });
    } else {
      setBanner({
        type: 'err',
        text: data.notification?.reason || 'Email não enviado.',
      });
    }
  }

  async function handleSendSingleAccountEmail(acc: ProvisionedAccount) {
    const targetEmail = (rowEmailTargets[acc.userId] || '').trim();
    if (!targetEmail) {
      setBanner({
        type: 'err',
        text: `Indique um email válido para enviar os acessos da fração ${acc.unitCode}.`,
      });
      return;
    }

    setSendingRowId(acc.userId);
    try {
      const res = await fetch(`/api/users/${acc.userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resetTemporaryPassword: true,
          sendEmail: true,
          notifyEmail: targetEmail,
        }),
      });
      const data = await res.json();
      if (res.ok && data.generatedPassword) {
        setProvisionedAccounts((prev) =>
          prev
            ? prev.map((row) =>
                row.userId === acc.userId
                  ? {
                      ...row,
                      temporaryPassword: data.generatedPassword,
                      emailSent: Boolean(data.notification?.sent),
                      emailReason: data.notification?.reason,
                    }
                  : row
              )
            : prev
        );
      }
    } finally {
      setSendingRowId(null);
    }
  }

  async function handleDelete(user: ManagedUser) {
    if (!window.confirm(`Eliminar utilizador ${user.email}?`)) return;
    setBanner(null);
    const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBanner({ type: 'err', text: data.error || 'Erro ao eliminar utilizador.' });
      return;
    }
    await loadAll();
    setBanner({ type: 'ok', text: `Utilizador ${user.email} eliminado.` });
  }

  function handleCopyCredentials() {
    if (!provisionedAccounts) return;
    const portalUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/login` : 'https://condominio.pereiraru.com/login';
    const text = [
      `Credenciais de Acesso — Portal do Condomínio (${portalUrl})`,
      'No 1.º acesso será pedida a troca obrigatória da password e confirmação do email pessoal.',
      '',
      ...provisionedAccounts.map(
        (a) =>
          `Fração ${a.unitCode} (${a.ownerName}) | Login: ${a.email} | Password Inicial: ${a.temporaryPassword}`
      ),
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => setCopiedCreds(true));
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-sm text-gray-500">
        A carregar utilizadores e frações...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {banner && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 ${
            banner.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <span>{banner.text}</span>
          <button type="button" onClick={() => setBanner(null)} className="font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Provision Missing Units Section */}
      {unassignedUnits.length > 0 ? (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">
                  Frações sem Conta de Utilizador
                </h2>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  {unassignedUnits.length} por criar
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Se ainda não tiver o email pessoal de alguma fração, pode deixá-lo em branco: será
                criado login temporário (<code>fracao@condominio.pt</code>) com password inicial
                única, e o condómino confirmará o email pessoal e nova password no 1.º acesso.
              </p>
            </div>

            <button
              type="button"
              disabled={provisioning}
              onClick={() => handleProvisionMissing()}
              className="btn-primary text-sm"
            >
              {provisioning
                ? 'A criar contas...'
                : `Criar Todas as Contas em Falta (${unassignedUnits.length})`}
            </button>
          </div>

          <div className="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 sticky top-0">
                <tr>
                  <th className="py-2 px-3 text-left">Fração</th>
                  <th className="py-2 px-3 text-left">Condómino</th>
                  <th className="py-2 px-3 text-left">Email (opcional — senão usa @condominio.pt)</th>
                  <th className="py-2 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {unassignedUnits.map((unit) => {
                  const owner = unit.owners?.find((o) => !o.endMonth) || unit.owners?.[0];
                  return (
                    <tr key={unit.id} className="hover:bg-gray-50/70">
                      <td className="py-2 px-3 font-bold text-gray-900">{unit.code}</td>
                      <td className="py-2 px-3 text-gray-700">{owner?.name || '—'}</td>
                      <td className="py-2 px-3">
                        <input
                          type="email"
                          className="input h-8 text-xs px-2.5 bg-white"
                          placeholder={`${unit.code.toLowerCase().replace(/[^a-z0-9]/g, '')}@condominio.pt`}
                          value={missingUnitEmails[unit.id] || ''}
                          onChange={(e) =>
                            setMissingUnitEmails({
                              ...missingUnitEmails,
                              [unit.id]: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          disabled={provisioning}
                          onClick={() => handleProvisionMissing([unit.id])}
                          className="text-xs font-semibold text-gray-800 hover:text-gray-950 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg"
                        >
                          Criar Conta
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl px-5 py-3 text-xs font-semibold text-emerald-800">
          ✓ Todas as {units.length} frações do edifício já possuem conta de utilizador associada.
        </div>
      )}

      {/* Existing Users Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Utilizadores & Acessos ({users.length})
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Gerir permissões de Administrador, forçar troca de password ou enviar link de recuperação
            </p>
          </div>
          <button type="button" className="btn-primary text-sm" onClick={openCreateModal}>
            + Novo Utilizador
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
                <th className="pb-3 font-semibold">Email / Login</th>
                <th className="pb-3 font-semibold">Nome</th>
                <th className="pb-3 font-semibold">Fração</th>
                <th className="pb-3 font-semibold">Perfil</th>
                <th className="pb-3 font-semibold">Estado / Acesso</th>
                <th className="pb-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => {
                const isSelf = user.id === session?.user?.id;
                const isAdminRole = user.role === 'admin';
                return (
                  <tr key={user.id} className="hover:bg-gray-50/60">
                    <td className="py-3.5 pr-3 font-medium text-gray-900">
                      {user.email}
                      {isSelf && (
                        <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
                          Tu
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 pr-3 text-gray-600">{user.name || '—'}</td>
                    <td className="py-3.5 pr-3 font-semibold text-gray-800">
                      {user.unit?.code || '—'}
                    </td>
                    <td className="py-3.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isAdminRole
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {isAdminRole ? 'Admin' : 'Condómino'}
                        </span>
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => handleToggleAdmin(user)}
                            className="text-[11px] font-semibold text-purple-700 hover:text-purple-900 hover:underline"
                          >
                            {isAdminRole ? 'Remover Admin' : 'Tornar Admin'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 pr-3">
                      {user.mustChangePassword ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          1.º Acesso Pendente
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">
                          {user.lastLogin
                            ? `Último: ${new Date(user.lastLogin).toLocaleDateString('pt-PT')}`
                            : 'Ativo'}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 text-right whitespace-nowrap space-x-2.5 text-xs">
                      <button
                        type="button"
                        onClick={() => handleResetTempPassword(user)}
                        className="font-semibold text-amber-700 hover:text-amber-900"
                        title="Gerar nova password inicial e exigir troca no próximo login"
                      >
                        Nova Pass Temp.
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendResetLink(user)}
                        className="font-semibold text-blue-600 hover:text-blue-800"
                        title="Enviar link de recuperação de password por email"
                      >
                        Link Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(user)}
                        className="font-semibold text-gray-700 hover:text-gray-950"
                      >
                        Editar
                      </button>
                      {!isSelf && (
                        <button
                          type="button"
                          onClick={() => handleDelete(user)}
                          className="font-semibold text-red-600 hover:text-red-800"
                        >
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4">
              {editingUser ? 'Editar Utilizador' : 'Novo Utilizador'}
            </h2>

            <form onSubmit={handleSubmitModal} className="space-y-4">
              <div>
                <label className="label">Email / Login *</label>
                <input
                  type="email"
                  className="input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label">
                  Password{' '}
                  {editingUser
                    ? '(deixar vazio para manter)'
                    : '(vazio = gera password inicial automática)'}
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? '••••••' : 'Automática se vazio'}
                  minLength={6}
                />
              </div>

              <div>
                <label className="label">Nome</label>
                <input
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Perfil</label>
                  <select
                    className="input"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="user">Condómino</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                <div>
                  <label className="label">Fração Associada</label>
                  <select
                    className="input"
                    value={formData.unitId}
                    onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                  >
                    <option value="">-- Nenhuma --</option>
                    {availableUnitsForModal.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.mustChangePassword}
                  onChange={(e) =>
                    setFormData({ ...formData, mustChangePassword: e.target.checked })
                  }
                  className="rounded border-gray-300"
                />
                <span>Obrigar a alterar a password no próximo acesso</span>
              </label>

              {!editingUser && (
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.sendCredentialsEmail}
                    onChange={(e) =>
                      setFormData({ ...formData, sendCredentialsEmail: e.target.checked })
                    }
                    className="rounded border-gray-300"
                  />
                  <span>Enviar credenciais iniciais para o email (se for real)</span>
                </label>
              )}

              {modalError && (
                <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg">
                  {modalError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={saving}>
                  {saving ? 'A guardar...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Provisioned Credentials Sheet Modal */}
      {provisionedAccounts && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-4xl w-full overflow-hidden">
            <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Folha de Credenciais Iniciais</h3>
                <p className="text-xs text-gray-300 mt-0.5">
                  Guarde ou entregue estas credenciais. No 1.º acesso o portal obriga à troca da
                  password e confirmação do email pessoal.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProvisionedAccounts(null)}
                className="text-gray-300 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-gray-600 font-medium">
                  {provisionedAccounts.length} conta(s) preparada(s)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCopyCredentials}
                    className="btn-secondary text-xs h-[36px] px-4"
                  >
                    {copiedCreds ? '✓ Copiado!' : 'Copiar Todas as Credenciais'}
                  </button>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-[55vh] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Fração</th>
                      <th className="py-2.5 px-3 text-left">Condómino</th>
                      <th className="py-2.5 px-3 text-left">Email (Login)</th>
                      <th className="py-2.5 px-3 text-left">Password Inicial</th>
                      <th className="py-2.5 px-3 text-left">Enviar por Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {provisionedAccounts.map((acc) => (
                      <tr key={acc.userId}>
                        <td className="py-2.5 px-3 font-bold text-gray-900">{acc.unitCode}</td>
                        <td className="py-2.5 px-3 text-gray-700">{acc.ownerName}</td>
                        <td className="py-2.5 px-3 font-mono text-gray-800">{acc.email}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-gray-900 select-all">
                          {acc.temporaryPassword}
                        </td>
                        <td className="py-2.5 px-3">
                          {acc.emailSent ? (
                            <span className="text-emerald-700 font-bold">✓ Enviado</span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="email"
                                className="input h-7 text-[11px] px-2 w-44 bg-white"
                                placeholder="email@pessoal.com"
                                value={rowEmailTargets[acc.userId] ?? ''}
                                onChange={(e) =>
                                  setRowEmailTargets({
                                    ...rowEmailTargets,
                                    [acc.userId]: e.target.value,
                                  })
                                }
                              />
                              <button
                                type="button"
                                disabled={sendingRowId === acc.userId}
                                onClick={() => handleSendSingleAccountEmail(acc)}
                                className="px-2.5 py-1 rounded bg-gray-900 text-white text-[11px] font-semibold hover:bg-gray-800 shrink-0"
                              >
                                {sendingRowId === acc.userId ? '...' : 'Enviar'}
                              </button>
                            </div>
                          )}
                          {acc.emailReason && !acc.emailSent && (
                            <p className="text-[10px] text-red-600 mt-0.5">{acc.emailReason}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setProvisionedAccounts(null)}
                  className="btn-primary text-sm"
                >
                  Concluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
