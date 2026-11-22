'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [checking, setChecking] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setChecking(false);
      setTokenValid(false);
      return;
    }

    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => setTokenValid(Boolean(data.valid)))
      .catch(() => setTokenValid(false))
      .finally(() => setChecking(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('A password deve ter pelo menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As passwords não coincidem.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Não foi possível redefinir a password.');
        return;
      }
      router.push('/login?reset=success');
    } catch {
      setError('Erro de ligação ao guardar nova password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Definir Nova Password</h1>

        {checking ? (
          <p className="text-sm text-gray-500 py-6">A validar link de recuperação...</p>
        ) : !tokenValid ? (
          <div className="space-y-4 mt-4">
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-xl">
              Este link é inválido ou já expirou (os links são válidos durante 1 hora).
            </div>
            <Link href="/forgot-password" className="btn-primary w-full">
              Pedir Novo Link
            </Link>
            <div className="text-center">
              <Link href="/login" className="text-xs font-semibold text-gray-600 hover:underline">
                ← Voltar ao Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <label className="label">Nova Password (mín. 8 caracteres) *</label>
              <input
                type="password"
                className="input"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoFocus
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
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full"
            >
              {submitting ? 'A guardar...' : 'Guardar Nova Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
