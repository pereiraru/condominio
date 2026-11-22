import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { sendTestNotificationEmail } from '@/lib/incidentNotifications';

export const dynamic = 'force-dynamic';

const MASKED_PASS = '********';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    let config = await prisma.notificationConfig.findUnique({
      where: { id: 'default' },
    });

    if (!config) {
      config = await prisma.notificationConfig.create({
        data: { id: 'default' },
      });
    }

    return NextResponse.json({
      id: config.id,
      enabled: config.enabled,
      adminEmails: config.adminEmails || '',
      smtpHost: config.smtpHost || '',
      smtpPort: config.smtpPort ?? 587,
      smtpSecure: config.smtpSecure,
      smtpUser: config.smtpUser || '',
      smtpPass: config.smtpPass ? MASKED_PASS : '',
      fromName: config.fromName || 'Condomínio Rua Vieira da Silva, 6',
      fromEmail: config.fromEmail || '',
    });
  } catch (error) {
    console.error('Error fetching notification config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification configuration' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const existing = await prisma.notificationConfig.findUnique({
      where: { id: 'default' },
    });

    const nextPass =
      body.smtpPass === MASKED_PASS
        ? existing?.smtpPass ?? null
        : typeof body.smtpPass === 'string' && body.smtpPass.trim()
          ? body.smtpPass.trim()
          : null;

    const updated = await prisma.notificationConfig.upsert({
      where: { id: 'default' },
      update: {
        enabled: Boolean(body.enabled),
        adminEmails: typeof body.adminEmails === 'string' ? body.adminEmails.trim() || null : null,
        smtpHost: typeof body.smtpHost === 'string' ? body.smtpHost.trim() || null : null,
        smtpPort: Number(body.smtpPort) || 587,
        smtpSecure: Boolean(body.smtpSecure),
        smtpUser: typeof body.smtpUser === 'string' ? body.smtpUser.trim() || null : null,
        smtpPass: nextPass,
        fromName:
          typeof body.fromName === 'string' && body.fromName.trim()
            ? body.fromName.trim()
            : 'Condomínio Rua Vieira da Silva, 6',
        fromEmail: typeof body.fromEmail === 'string' ? body.fromEmail.trim() || null : null,
      },
      create: {
        id: 'default',
        enabled: Boolean(body.enabled),
        adminEmails: typeof body.adminEmails === 'string' ? body.adminEmails.trim() || null : null,
        smtpHost: typeof body.smtpHost === 'string' ? body.smtpHost.trim() || null : null,
        smtpPort: Number(body.smtpPort) || 587,
        smtpSecure: Boolean(body.smtpSecure),
        smtpUser: typeof body.smtpUser === 'string' ? body.smtpUser.trim() || null : null,
        smtpPass: nextPass,
        fromName:
          typeof body.fromName === 'string' && body.fromName.trim()
            ? body.fromName.trim()
            : 'Condomínio Rua Vieira da Silva, 6',
        fromEmail: typeof body.fromEmail === 'string' ? body.fromEmail.trim() || null : null,
      },
    });

    return NextResponse.json({
      id: updated.id,
      enabled: updated.enabled,
      adminEmails: updated.adminEmails || '',
      smtpHost: updated.smtpHost || '',
      smtpPort: updated.smtpPort ?? 587,
      smtpSecure: updated.smtpSecure,
      smtpUser: updated.smtpUser || '',
      smtpPass: updated.smtpPass ? MASKED_PASS : '',
      fromName: updated.fromName || 'Condomínio Rua Vieira da Silva, 6',
      fromEmail: updated.fromEmail || '',
    });
  } catch (error) {
    console.error('Error updating notification config:', error);
    return NextResponse.json(
      { error: 'Failed to save notification configuration' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const toEmail = String(body.toEmail || '').trim();
    const result = await sendTestNotificationEmail(toEmail);
    return NextResponse.json(result, { status: result.sent ? 200 : 400 });
  } catch (error) {
    console.error('Error sending test email:', error);
    return NextResponse.json(
      { sent: false, reason: 'Erro interno ao enviar email de teste.' },
      { status: 500 }
    );
  }
}
