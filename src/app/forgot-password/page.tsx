'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Não foi possível processar o pedido.');
        return;
      }
      setSuccessMsg(
        data.message ||
          'Link de reposição enviado! Verifique o seu email (válido durante 1 hora).'
      );
    } catch {
      setError('Erro de ligação ao enviar pedido de reposição.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Recuperar Password</h1>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Indique o seu email pessoal ou o código da fração (ex.: <code>2E</code>,{' '}
            <code>RCD</code>) para receber um link seguro no email associado.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Email ou Código da Fração *</label>
            <input
              type="text"
              className="input"
              placeholder="seu@email.com ou 2E"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl">
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full"
          >
            {submitting ? 'A enviar...' : 'Enviar Link de Recuperação'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-xs font-semibold text-gray-600 hover:text-gray-900">
            ← Voltar ao Login
          </Link>
        </div>
      </div>
    </div>
  );
}
