'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  unitId: string | null;
  lastLogin: string | null;
  createdAt: string;
  unit?: { code: string } | null;
}

interface Unit {
  id: string;
  code: string;
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'user',
    unitId: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    fetchUsers();
    fetchUnits();
  }, [session, status]);

  async function fetchUsers() {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUnits() {
    try {
      const res = await fetch('/api/units');
      if (res.ok) {
        setUnits(await res.json());
      }
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  }

  function openCreateModal() {
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      name: '',
      role: 'user',
      unitId: '',
    });
    setError('');
    setShowModal(true);
  }

  function openEditModal(user: User) {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      name: user.name || '',
      role: user.role,
      unitId: user.unitId || '',
    });
    setError('');
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';

      const body: Record<string, string | null> = {
        email: formData.email,
        name: formData.name || null,
        role: formData.role,
        unitId: formData.unitId || null,
      };

      // Only include password if creating or if provided when editing
      if (!editingUser || formData.password) {
        body.password = formData.password;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowModal(false);
        fetchUsers();
      } else {
        const data = await res.json();
        setError(data.error || 'Erro ao guardar');
      }
    } catch {
      setError('Erro ao guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user: User) {
    if (!confirm(`Eliminar utilizador ${user.email}?`)) return;

    try {
      const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao eliminar');
      }
    } catch {
      alert('Erro ao eliminar');
    }
  }

  // Get units that are not yet assigned
  const availableUnits = units.filter(
    (unit) =>
      !users.some(
        (user) =>
          user.unitId === unit.id &&
          (!editingUser || user.id !== editingUser.id)
      )
  );

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8">
          <p className="text-gray-500">A carregar...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            Gestao de Utilizadores
          </h1>
          <button className="btn-primary" onClick={openCreateModal}>
            + Novo Utilizador
          </button>
        </div>

        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-4 font-medium">Email</th>
                  <th className="pb-4 font-medium">Nome</th>
                  <th className="pb-4 font-medium">Role</th>
                  <th className="pb-4 font-medium">Fracao</th>
                  <th className="pb-4 font-medium">Ultimo Login</th>
                  <th className="pb-4 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="py-4 text-sm font-medium text-gray-900">
                      {user.email}
                    </td>
                    <td className="py-4 text-sm text-gray-600">
                      {user.name || '-'}
                    </td>
                    <td className="py-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {user.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="py-4 text-sm text-gray-600">
                      {user.unit?.code || '-'}
                    </td>
                    <td className="py-4 text-sm text-gray-500">
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleDateString('pt-PT')
                        : 'Nunca'}
                    </td>
                    <td className="py-4 text-sm text-right">
                      <button
                        className="text-primary-600 hover:text-primary-800 mr-3"
                        onClick={() => openEditModal(user)}
                      >
                        Editar
                      </button>
                      {user.id !== session?.user.id && (
                        <button
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleDelete(user)}
                        >
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h2 className="text-lg font-bold mb-4">
                {editingUser ? 'Editar Utilizador' : 'Novo Utilizador'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Email *</label>
                  <input
                    type="email"
                    className="input"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <label className="label">
                    Password {editingUser ? '(deixar vazio para manter)' : '*'}
                  </label>
                  <input
                    type="password"
                    className="input"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required={!editingUser}
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="label">Nome</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="label">Role</label>
                  <select
                    className="input"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="label">Fracao Associada</label>
                  <select
                    className="input"
                    value={formData.unitId}
                    onChange={(e) =>
                      setFormData({ ...formData, unitId: e.target.value })
                    }
                  >
                    <option value="">-- Nenhuma --</option>
                    {availableUnits.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.code}
                      </option>
                    ))}
                    {editingUser?.unit && (
                      <option value={editingUser.unitId!}>
                        {editingUser.unit.code} (atual)
                      </option>
                    )}
                  </select>
                </div>

                {error && (
                  <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                    {error}
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
                  <button
                    type="submit"
                    className="btn-primary flex-1"
                    disabled={saving}
                  >
                    {saving ? 'A guardar...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
