'use client';

import { useEffect, useState } from 'react';
import type { NotificationConfigData } from '@/lib/types';

export default function NotificationConfigTab() {
  const [config, setConfig] = useState<NotificationConfigData>({
    id: 'default',
    enabled: false,
    adminEmails: '',
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPass: '',
    fromName: 'Condomínio Rua Vieira da Silva, 6',
    fromEmail: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/admin/notification-config');
        if (res.ok) {
          const data: NotificationConfigData = await res.json();
          setConfig(data);
        }
      } catch (error) {
        console.error('Error loading notification config:', error);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/notification-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', text: data.error || 'Erro ao guardar configuração.' });
        return;
      }
      setConfig(data);
      setFeedback({ type: 'ok', text: 'Configuração de notificações guardada com sucesso.' });
    } catch {
      setFeedback({ type: 'err', text: 'Erro de ligação ao guardar configuração.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestEmail() {
    if (!testEmail.trim()) {
      setFeedback({ type: 'err', text: 'Indique um email de destino para o teste.' });
      return;
    }
    setTesting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/notification-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmail: testEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.sent) {
        setFeedback({
          type: 'ok',
          text: `Email de teste enviado com sucesso para ${data.recipients?.join(', ')}.`,
        });
      } else {
        setFeedback({
          type: 'err',
          text: data.reason || 'Não foi possível enviar o email de teste.',
        });
      }
    } catch {
      setFeedback({ type: 'err', text: 'Erro ao contactar o servidor SMTP.' });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-sm text-gray-500">
        A carregar configurações de notificação...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {feedback.text}
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Notificações por Email (Anomalias & Incidentes)
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Defina os emails da Administração e o servidor SMTP para notificações automáticas na criação, atualização e resolução de incidentes.
            </p>
          </div>

          <label className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 cursor-pointer text-sm font-semibold text-gray-800">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              className="rounded border-gray-300"
            />
            <span>Envio Automático Ativo</span>
          </label>
        </div>

        <div>
          <label className="label">Emails da Administração (destinatários de alertas)</label>
          <input
            type="text"
            className="input"
            placeholder="admin@exemplo.com, pessoal@gmail.com (separados por vírgula)"
            value={config.adminEmails}
            onChange={(e) => setConfig({ ...config, adminEmails: e.target.value })}
          />
          <p className="text-[11px] text-gray-400 mt-1">
            Pode adicionar múltiplos emails pessoais separados por vírgula para receber alertas de novos incidentes e resoluções.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Servidor SMTP</label>
            <input
              type="text"
              className="input"
              placeholder="smtp.gmail.com"
              value={config.smtpHost}
              onChange={(e) => setConfig({ ...config, smtpHost: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Porta</label>
            <input
              type="number"
              className="input"
              placeholder="587"
              value={config.smtpPort}
              onChange={(e) => setConfig({ ...config, smtpPort: Number(e.target.value) || 587 })}
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={config.smtpSecure}
                onChange={(e) => setConfig({ ...config, smtpSecure: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span>Usar SSL/TLS direto (porta 465)</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Utilizador SMTP</label>
            <input
              type="text"
              className="input"
              placeholder="seu.email@gmail.com"
              value={config.smtpUser}
              onChange={(e) => setConfig({ ...config, smtpUser: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Password / App Password SMTP</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••••••"
              value={config.smtpPass}
              onChange={(e) => setConfig({ ...config, smtpPass: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Nome do Remetente</label>
            <input
              type="text"
              className="input"
              value={config.fromName}
              onChange={(e) => setConfig({ ...config, fromName: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Email do Remetente</label>
            <input
              type="email"
              className="input"
              placeholder="condominio@gmail.com"
              value={config.fromEmail}
              onChange={(e) => setConfig({ ...config, fromEmail: e.target.value })}
            />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/70 text-xs text-blue-900">
          <strong>Dica para Gmail:</strong> use <code>smtp.gmail.com</code>, porta <code>587</code> (SSL desmarcado), o seu email Gmail e uma <strong>Palavra-passe de Aplicação (App Password)</strong> gerada na conta Google em Segurança → Verificação em 2 passos.
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'A guardar...' : 'Guardar Configuração'}
          </button>
        </div>
      </form>

      {/* Test section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-bold text-gray-900 mb-1">Testar Envio de Email</h3>
        <p className="text-xs text-gray-500 mb-3">
          Guarde primeiro as definições acima e envie um email de teste para confirmar a ligação SMTP.
        </p>
        <div className="flex flex-wrap gap-3">
          <input
            type="email"
            className="input max-w-sm"
            placeholder="email.teste@gmail.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
          />
          <button
            type="button"
            disabled={testing}
            onClick={handleTestEmail}
            className="btn-secondary"
          >
            {testing ? 'A enviar teste...' : 'Enviar Email de Teste'}
          </button>
        </div>
      </div>
    </div>
  );
}
