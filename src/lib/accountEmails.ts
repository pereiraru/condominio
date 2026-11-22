import crypto from 'crypto';
import {
  buildTransport,
  escapeHtml,
  parseEmailList,
  resolveTransportConfig,
  type NotificationDispatchResult,
} from '@/lib/incidentNotifications';

const READABLE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  const lower = email.trim().toLowerCase();
  return lower.endsWith('@condominio.pt') || lower.endsWith('.local');
}

export function buildDefaultUnitLoginEmail(unitCode: string): string {
  const clean = unitCode
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
  return `${clean || 'fracao'}@condominio.pt`;
}

export function generateInitialPassword(unitCode?: string | null): string {
  const randomChars = (len: number) => {
    let out = '';
    for (let i = 0; i < len; i++) {
      out += READABLE_ALPHABET[crypto.randomInt(0, READABLE_ALPHABET.length)];
    }
    return out;
  };

  if (unitCode) {
    const cleanCode = unitCode
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8);
    if (cleanCode) {
      return `Condo-${cleanCode}-${randomChars(4)}`;
    }
  }
  return `Condo-${randomChars(6)}`;
}

export function hashResetToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function createResetTokenPair(): {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const rawToken = crypto.randomBytes(32).toString('hex');
  return {
    rawToken,
    tokenHash: hashResetToken(rawToken),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  };
}

export async function sendPasswordResetEmail({
  toEmail,
  userName,
  unitCode,
  resetUrl,
}: {
  toEmail: string;
  userName?: string | null;
  unitCode?: string | null;
  resetUrl: string;
}): Promise<NotificationDispatchResult> {
  const recipients = parseEmailList(toEmail);
  if (recipients.length === 0) {
    return {
      sent: false,
      recipients: [],
      reason: 'Endereço de email inválido para recuperação.',
    };
  }

  try {
    const cfg = await resolveTransportConfig();
    if (!cfg.smtpHost || !cfg.fromEmail) {
      return {
        sent: false,
        recipients,
        reason: 'Servidor SMTP não configurado em Administração → Notificações & Email.',
      };
    }

    const displayName = userName || (unitCode ? `Fração ${unitCode}` : 'Condómino');
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:580px;margin:0 auto;color:#111827;">
        <div style="background:#111827;color:#ffffff;padding:18px 24px;border-radius:12px 12px 0 0;">
          <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Condomínio Rua Vieira da Silva, 6</p>
          <h2 style="margin:6px 0 0;font-size:18px;">Reposição de Password</h2>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;padding:22px 24px;border-radius:0 0 12px 12px;background:#ffffff;">
          <p style="margin:0 0 12px;font-size:14px;">Olá <strong>${escapeHtml(displayName)}</strong>,</p>
          <p style="margin:0 0 16px;font-size:13px;color:#374151;line-height:1.5;">
            Foi pedido o restabelecimento da palavra-passe da sua conta no Portal do Condomínio.
            Clique no botão abaixo para definir uma nova password (este link é válido durante <strong>1 hora</strong>):
          </p>
          <div style="margin:20px 0;">
            <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:13px;font-weight:600;">
              Definir Nova Password
            </a>
          </div>
          <p style="margin:0;font-size:11px;color:#6b7280;line-height:1.4;">
            Se não solicitou esta alteração, pode ignorar este email com segurança.<br/>
            Link direto: ${escapeHtml(resetUrl)}
          </p>
        </div>
      </div>
    `;

    const text = [
      `Olá ${displayName},`,
      '',
      'Foi pedido o restabelecimento da palavra-passe da sua conta no Portal do Condomínio.',
      `Abra este link (válido durante 1 hora): ${resetUrl}`,
      '',
      'Se não solicitou esta alteração, ignore este email.',
    ].join('\n');

    const transporter = buildTransport(cfg);
    await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to: recipients.join(', '),
      subject: 'Reposição de Password — Portal do Condomínio',
      text,
      html,
    });

    return { sent: true, recipients };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return {
      sent: false,
      recipients,
      reason: error instanceof Error ? error.message : 'Erro ao enviar email de reposição.',
    };
  }
}

export async function sendAccountCredentialsEmail({
  toEmail,
  loginEmail,
  temporaryPassword,
  userName,
  unitCode,
}: {
  toEmail: string;
  loginEmail: string;
  temporaryPassword: string;
  userName?: string | null;
  unitCode?: string | null;
}): Promise<NotificationDispatchResult> {
  const recipients = parseEmailList(toEmail);
  if (recipients.length === 0) {
    return {
      sent: false,
      recipients: [],
      reason: 'Nenhum email válido fornecido para enviar credenciais.',
    };
  }

  try {
    const cfg = await resolveTransportConfig();
    if (!cfg.smtpHost || !cfg.fromEmail) {
      return {
        sent: false,
        recipients,
        reason: 'Servidor SMTP não configurado em Administração → Notificações & Email.',
      };
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'https://condominio.pereiraru.com';
    const loginUrl = `${baseUrl}/login`;
    const displayName = userName || (unitCode ? `Fração ${unitCode}` : 'Condómino');

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:580px;margin:0 auto;color:#111827;">
        <div style="background:#111827;color:#ffffff;padding:18px 24px;border-radius:12px 12px 0 0;">
          <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Condomínio Rua Vieira da Silva, 6</p>
          <h2 style="margin:6px 0 0;font-size:18px;">Acesso ao Portal do Condomínio${unitCode ? ` — Fração ${escapeHtml(unitCode)}` : ''}</h2>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;padding:22px 24px;border-radius:0 0 12px 12px;background:#ffffff;">
          <p style="margin:0 0 12px;font-size:14px;">Olá <strong>${escapeHtml(displayName)}</strong>,</p>
          <p style="margin:0 0 14px;font-size:13px;color:#374151;line-height:1.5;">
            A sua conta de acesso ao Portal do Condomínio foi criada pela Administração.
            No primeiro acesso ser-lhe-á pedido que defina uma nova palavra-passe pessoal e confirme o seu email.
          </p>
          <div style="padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:18px;font-size:13px;">
            <p style="margin:0 0 6px;"><strong>Email de entrada (Login):</strong> <code>${escapeHtml(loginEmail)}</code></p>
            <p style="margin:0;"><strong>Password Inicial Temporária:</strong> <code>${escapeHtml(temporaryPassword)}</code></p>
          </div>
          <div>
            <a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:13px;font-weight:600;">
              Aceder ao Portal do Condomínio
            </a>
          </div>
        </div>
      </div>
    `;

    const text = [
      `Olá ${displayName},`,
      '',
      'A sua conta no Portal do Condomínio foi criada.',
      `Email de entrada: ${loginEmail}`,
      `Password Inicial Temporária: ${temporaryPassword}`,
      '',
      'No 1.º acesso será obrigatório definir uma nova password e confirmar o seu email pessoal.',
      `Aceda em: ${loginUrl}`,
    ].join('\n');

    const transporter = buildTransport(cfg);
    await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to: recipients.join(', '),
      subject: `Acesso ao Portal do Condomínio${unitCode ? ` — Fração ${unitCode}` : ''}`,
      text,
      html,
    });

    return { sent: true, recipients };
  } catch (error) {
    console.error('Error sending credentials email:', error);
    return {
      sent: false,
      recipients,
      reason: error instanceof Error ? error.message : 'Erro ao enviar email com credenciais.',
    };
  }
}
