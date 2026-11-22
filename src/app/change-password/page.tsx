'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function ChangePasswordPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isForced = Boolean(session?.user?.mustChangePassword);
  const loginEmail = session?.user?.email || '';
  const hasPlaceholderEmail =
    loginEmail.endsWith('@condominio.pt') || loginEmail.endsWith('.local');
  const needsEmailConfirmation =
    isForced && session?.user?.role !== 'admin' && hasPlaceholderEmail;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (loginEmail && !hasPlaceholderEmail && !personalEmail) {
      setPersonalEmail(loginEmail);
    }
  }, [status, loginEmail, hasPlaceholderEmail, personalEmail, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('A nova password deve ter pelo menos 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As novas passwords não coincidem.');
      return;
    }

    if (needsEmailConfirmation && !personalEmail.trim()) {
      setError('Indique o seu email pessoal real para concluir o primeiro acesso.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: isForced ? undefined : currentPassword,
          newPassword,
          personalEmail: personalEmail.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao alterar a password.');
        return;
      }

      await update({
        mustChangePassword: false,
        email: data.email,
      });

      setSuccess('Password atualizada com sucesso! A redirecionar...');
      const dest =
        session?.user?.role !== 'admin' && session?.user?.unitId
          ? `/dashboard/units/${session.user.unitId}`
          : '/dashboard';
      router.push(dest);
      router.refresh();
    } catch {
      setError('Erro de ligação ao atualizar a password.');
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-sm text-gray-500">
        A carregar...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <div className="mb-6">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-gray-900 text-white">
              {isForced ? 'Primeiro Acesso Obrigatório' : 'Segurança da Conta'}
            </span>
            {session?.user?.unitCode && (
              <span className="text-xs font-bold text-gray-600">
                Fração {session.user.unitCode}
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {isForced ? 'Configure a Sua Conta' : 'Alterar Password'}
          </h1>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            {isForced
              ? 'Por motivos de segurança, defina a sua própria palavra-passe pessoal antes de aceder ao portal.'
              : 'Atualize a sua palavra-passe de acesso ao Portal do Condomínio.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isForced && (
            <div>
              <label className="label">Password Atual *</label>
              <input
                type="password"
                className="input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
          )}

          {(needsEmailConfirmation || (session?.user?.role !== 'admin' && isForced)) && (
            <div>
              <label className="label">
                Seu Email Pessoal {needsEmailConfirmation ? '*' : '(opcional)'}
              </label>
              <input
                type="email"
                className="input"
                placeholder="exemplo@gmail.com"
                value={personalEmail}
                onChange={(e) => setPersonalEmail(e.target.value)}
                required={needsEmailConfirmation}
              />
              <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                Substitui o login temporário ({loginEmail}) e passa a ser usado para
                avisos financeiros, anomalias e recuperação de password.
              </p>
            </div>
          )}

          <div>
            <label className="label">Nova Password (mín. 8 caracteres) *</label>
            <input
              type="password"
              className="input"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <div>
            <label className="label">Confirmar Nova Password *</label>
            <input
              type="password"
              className="input"
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full"
          >
            {saving ? 'A guardar...' : 'Guardar e Entrar no Portal'}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          {!isForced ? (
            <Link href="/dashboard" className="font-semibold text-gray-700 hover:underline">
              ← Voltar ao Portal
            </Link>
          ) : (
            <span className="truncate max-w-[220px]" title={loginEmail}>
              Conta: {loginEmail}
            </span>
          )}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="font-semibold text-gray-500 hover:text-gray-800"
          >
            Terminar Sessão
          </button>
        </div>
      </div>
    </div>
  );
}
