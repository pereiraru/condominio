import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';

export type IncidentNotificationEvent = 'created' | 'updated' | 'resolved';

export interface IncidentEmailPayload {
  id: string;
  code: string;
  title: string;
  description: string;
  immediateAction?: string | null;
  location: string;
  priority: string;
  status: string;
  reportedByName: string;
  reportedByEmail?: string | null;
  notifyEmails?: string | null;
  reportedAt: Date;
  assignedTo?: string | null;
  plannedDate?: Date | null;
  resolvedAt?: Date | null;
  resolutionNotes?: string | null;
  expenseAmount?: number | null;
  reportedByUnit?: { code: string } | null;
  creditor?: { name: string } | null;
}

export interface NotificationDispatchResult {
  sent: boolean;
  recipients: string[];
  reason?: string;
}

const LOCATION_LABELS: Record<string, string> = {
  elevator: 'Elevadores',
  garage: 'Garagem / Portão',
  lighting: 'Iluminação / Eletricidade',
  door: 'Porta de Entrada / Fechadura / Vídeo-Porteiro',
  water: 'Água / Bomba / Canalizações',
  roof: 'Cobertura / Fachada',
  cleaning: 'Limpeza / Zonas Comuns',
  other: 'Outro',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  normal: 'Normal',
  urgent: 'Urgente',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Registado',
  in_progress: 'Em Tratamento',
  scheduled: 'Agendado',
  resolved: 'Resolvido',
  closed: 'Encerrado',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmailList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const unique = new Set<string>();
  for (const part of raw.split(/[;,\n\s]+/)) {
    const cleaned = part.trim().toLowerCase();
    if (EMAIL_REGEX.test(cleaned) && !cleaned.endsWith('.local')) {
      unique.add(cleaned);
    }
  }
  return Array.from(unique);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return d.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

async function resolveTransportConfig() {
  const dbCfg = await prisma.notificationConfig.findUnique({
    where: { id: 'default' },
  });

  const enabled = dbCfg ? dbCfg.enabled : Boolean(process.env.SMTP_HOST);
  const smtpHost = dbCfg?.smtpHost || process.env.SMTP_HOST || '';
  const smtpPort = dbCfg?.smtpPort ?? (process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587);
  const smtpSecure = dbCfg ? dbCfg.smtpSecure : process.env.SMTP_SECURE === 'true';
  const smtpUser = dbCfg?.smtpUser || process.env.SMTP_USER || '';
  const smtpPass = dbCfg?.smtpPass || process.env.SMTP_PASS || '';
  const fromName =
    dbCfg?.fromName || process.env.SMTP_FROM_NAME || 'Condomínio Rua Vieira da Silva, 6';
  const fromEmail = dbCfg?.fromEmail || process.env.SMTP_FROM_EMAIL || smtpUser;
  const adminEmails = parseEmailList(dbCfg?.adminEmails || process.env.ADMIN_ALERT_EMAILS || '');

  return {
    enabled,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPass,
    fromName,
    fromEmail,
    adminEmails,
  };
}

function buildTransport(cfg: Awaited<ReturnType<typeof resolveTransportConfig>>) {
  return nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpSecure,
    auth: cfg.smtpUser
      ? {
          user: cfg.smtpUser,
          pass: cfg.smtpPass,
        }
      : undefined,
  });
}

export async function sendIncidentNotification(
  event: IncidentNotificationEvent,
  incident: IncidentEmailPayload
): Promise<NotificationDispatchResult> {
  try {
    const cfg = await resolveTransportConfig();

    const reporterEmails = new Set<string>([
      ...parseEmailList(incident.reportedByEmail),
      ...parseEmailList(incident.notifyEmails),
    ]);
    const adminEmails = new Set<string>(cfg.adminEmails);

    if (adminEmails.size === 0) {
      const admins = await prisma.user.findMany({
        where: { role: 'admin' },
        select: { email: true },
      });
      admins.forEach((a) => {
        parseEmailList(a.email).forEach((e) => adminEmails.add(e));
      });
    }

    const allRecipients = Array.from(
      new Set([...Array.from(reporterEmails), ...Array.from(adminEmails)])
    );

    if (!cfg.enabled) {
      return {
        sent: false,
        recipients: allRecipients,
        reason: 'Notificações por email desativadas na Administração.',
      };
    }

    if (!cfg.smtpHost || !cfg.fromEmail) {
      return {
        sent: false,
        recipients: allRecipients,
        reason: 'Servidor SMTP não configurado na Administração.',
      };
    }

    if (allRecipients.length === 0) {
      return {
        sent: false,
        recipients: [],
        reason: 'Sem destinatários de email válidos.',
      };
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'https://condominio.pereiraru.com';
    const portalUrl = `${baseUrl}/dashboard/incidents?id=${incident.id}`;
    const statusLabel = STATUS_LABELS[incident.status] || incident.status;
    const priorityLabel = PRIORITY_LABELS[incident.priority] || incident.priority;
    const locationLabel = LOCATION_LABELS[incident.location] || incident.location;

    const eventTitleMap: Record<IncidentNotificationEvent, string> = {
      created: `[${incident.code}] Nova Anomalia Registada: ${incident.title}`,
      updated: `[${incident.code}] Atualização de Anomalia (${statusLabel}): ${incident.title}`,
      resolved: `[${incident.code}] Anomalia Resolvida: ${incident.title}`,
    };

    const eventHeadlineMap: Record<IncidentNotificationEvent, string> = {
      created: 'Foi registada uma nova anomalia no condomínio',
      updated: `O estado da anomalia foi atualizado para "${statusLabel}"`,
      resolved: 'A anomalia foi dada como resolvida',
    };

    const rows: [string, string][] = [
      ['Código', incident.code],
      ['Estado', statusLabel],
      ['Zona', locationLabel],
      ['Prioridade', priorityLabel],
      [
        'Reportado por',
        incident.reportedByUnit?.code
          ? `${incident.reportedByName} (Fração ${incident.reportedByUnit.code})`
          : incident.reportedByName,
      ],
      ['Data do reporte', fmtDate(incident.reportedAt)],
      ['Descrição', incident.description],
    ];

    if (incident.immediateAction) {
      rows.push(['Ação imediata', incident.immediateAction]);
    }
    if (incident.assignedTo) {
      rows.push(['Responsável pelo tratamento', incident.assignedTo]);
    }
    if (incident.plannedDate) {
      rows.push(['Data planeada', fmtDate(incident.plannedDate)]);
    }
    if (incident.resolvedAt) {
      rows.push(['Data de resolução', fmtDate(incident.resolvedAt)]);
    }
    if (incident.resolutionNotes) {
      rows.push(['Notas da resolução', incident.resolutionNotes]);
    }
    if (incident.expenseAmount !== null && incident.expenseAmount !== undefined) {
      rows.push([
        'Despesa associada',
        `${incident.expenseAmount.toFixed(2)} €${incident.creditor ? ` (${incident.creditor.name})` : ''}`,
      ]);
    }

    const htmlRows = rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#4b5563;font-weight:600;width:190px;vertical-align:top;">${escapeHtml(k)}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#111827;">${escapeHtml(v)}</td></tr>`
      )
      .join('');

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;color:#111827;">
        <div style="background:#111827;color:#ffffff;padding:18px 24px;border-radius:12px 12px 0 0;">
          <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Condomínio Rua Vieira da Silva, 6</p>
          <h2 style="margin:6px 0 0;font-size:18px;">${escapeHtml(eventHeadlineMap[event])}</h2>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;padding:20px 24px;border-radius:0 0 12px 12px;background:#ffffff;">
          <p style="margin:0 0 14px;font-size:15px;font-weight:700;">${escapeHtml(incident.title)}</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            ${htmlRows}
          </table>
          <div style="margin-top:20px;">
            <a href="${escapeHtml(portalUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;">
              Acompanhar no Portal do Condomínio
            </a>
          </div>
        </div>
      </div>
    `;

    const text = [
      eventHeadlineMap[event],
      '',
      ...rows.map(([k, v]) => `${k}: ${v}`),
      '',
      `Portal: ${portalUrl}`,
    ].join('\n');

    const transporter = buildTransport(cfg);
    await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to: allRecipients.join(', '),
      subject: eventTitleMap[event],
      text,
      html,
    });

    return {
      sent: true,
      recipients: allRecipients,
    };
  } catch (error) {
    console.error('Error sending incident notification email:', error);
    return {
      sent: false,
      recipients: [],
      reason: error instanceof Error ? error.message : 'Erro desconhecido ao enviar email',
    };
  }
}

export async function sendTestNotificationEmail(
  toEmail: string
): Promise<NotificationDispatchResult> {
  const cleaned = parseEmailList(toEmail);
  if (cleaned.length === 0) {
    return { sent: false, recipients: [], reason: 'Endereço de email inválido.' };
  }

  try {
    const cfg = await resolveTransportConfig();
    if (!cfg.smtpHost || !cfg.fromEmail) {
      return {
        sent: false,
        recipients: [],
        reason: 'Preencha o servidor SMTP e o email remetente antes de testar.',
      };
    }

    const transporter = buildTransport(cfg);
    await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to: cleaned.join(', '),
      subject: '[Teste] Notificações do Portal do Condomínio',
      text: 'Este é um email de teste para confirmar que as notificações de anomalias do condomínio estão a funcionar corretamente.',
      html: '<p>Este é um email de teste para confirmar que as notificações de anomalias do <strong>Portal do Condomínio</strong> estão a funcionar corretamente.</p>',
    });

    return { sent: true, recipients: cleaned };
  } catch (error) {
    console.error('Error sending test email:', error);
    return {
      sent: false,
      recipients: [],
      reason: error instanceof Error ? error.message : 'Falha ao enviar email de teste.',
    };
  }
}
