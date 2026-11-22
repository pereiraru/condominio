import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import {
  INCIDENT_INCLUDE,
  canViewerSeeIncident,
  generateNextIncidentCode,
  sanitizeIncidentForViewer,
  saveIncidentAttachments,
} from '@/lib/incidents';
import { sendIncidentNotification } from '@/lib/incidentNotifications';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = session.user.role === 'admin';
  const viewer = {
    role: session.user.role,
    unitId: session.user.unitId,
    email: session.user.email,
  };

  try {
    const searchParams = request.nextUrl.searchParams;
    const unitId = searchParams.get('unitId');
    const status = searchParams.get('status');

    if (unitId && !isAdmin && unitId !== session.user.unitId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const where: Record<string, unknown> = {};
    if (unitId) where.reportedByUnitId = unitId;
    if (status && status !== 'all') where.status = status;

    const incidents = await prisma.incident.findMany({
      where,
      include: INCIDENT_INCLUDE,
      orderBy: [{ reportedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const visible = incidents
      .filter((inc) => canViewerSeeIncident(inc, viewer))
      .map((inc) => sanitizeIncidentForViewer(inc, viewer));

    return NextResponse.json(visible);
  } catch (error) {
    console.error('Error fetching incidents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch incidents' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = session.user.role === 'admin';

  try {
    const formData = await request.formData();
    const title = String(formData.get('title') || '').trim();
    const description = String(formData.get('description') || '').trim();
    const immediateAction = String(formData.get('immediateAction') || '').trim() || null;
    const location = String(formData.get('location') || 'other').trim();
    const priority = String(formData.get('priority') || 'normal').trim();
    const visibility = String(formData.get('visibility') || 'public').trim();
    const notifyEmails = String(formData.get('notifyEmails') || '').trim() || null;
    const reportedAtRaw = String(formData.get('reportedAt') || '').trim();

    let reportedByUnitId = String(formData.get('reportedByUnitId') || '').trim() || null;
    if (!isAdmin && session.user.unitId) {
      reportedByUnitId = session.user.unitId;
    }

    let reportedByName = String(formData.get('reportedByName') || '').trim();
    let reportedByEmail = String(formData.get('reportedByEmail') || '').trim() || null;

    if (!title || !description) {
      return NextResponse.json(
        { error: 'Título e descrição são obrigatórios.' },
        { status: 400 }
      );
    }

    if (reportedByUnitId) {
      const unit = await prisma.unit.findUnique({
        where: { id: reportedByUnitId },
        include: { owners: { orderBy: { createdAt: 'desc' } } },
      });
      if (unit) {
        const currentOwner = unit.owners.find((o) => !o.endMonth) || unit.owners[0];
        if (!reportedByName) {
          reportedByName = currentOwner?.name
            ? `${currentOwner.name} (${unit.code})`
            : `Fração ${unit.code}`;
        }
        if (!reportedByEmail) {
          reportedByEmail = currentOwner?.email || unit.email || session.user.email || null;
        }
      }
    }

    if (!reportedByName) {
      reportedByName = session.user.name || session.user.email || 'Condómino';
    }
    if (!reportedByEmail && session.user.email && !session.user.email.endsWith('.local')) {
      reportedByEmail = session.user.email;
    }

    const reportedAt = reportedAtRaw ? new Date(reportedAtRaw) : new Date();
    const safeReportedAt = Number.isNaN(reportedAt.getTime()) ? new Date() : reportedAt;
    const code = await generateNextIncidentCode(safeReportedAt.getFullYear());

    const created = await prisma.incident.create({
      data: {
        code,
        title,
        description,
        immediateAction,
        location,
        priority,
        visibility: visibility === 'unit_private' ? 'unit_private' : 'public',
        status: 'open',
        reportedByUnitId,
        reportedByName,
        reportedByEmail,
        notifyEmails,
        reportedAt: safeReportedAt,
        logs: {
          create: {
            actorName: reportedByName,
            actorRole: isAdmin ? 'admin' : 'user',
            actionType: 'created',
            message: `Anomalia registada (${code}).${immediateAction ? ` Ação imediata: ${immediateAction}` : ''}`,
          },
        },
      },
    });

    const files = formData
      .getAll('files')
      .filter((entry): entry is File => entry instanceof File);

    await saveIncidentAttachments(files, created.id, 'report');

    const fullIncident = await prisma.incident.findUnique({
      where: { id: created.id },
      include: INCIDENT_INCLUDE,
    });

    const notification = fullIncident
      ? await sendIncidentNotification('created', fullIncident)
      : { sent: false, recipients: [] };

    return NextResponse.json(
      { incident: fullIncident, notification },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating incident:', error);
    return NextResponse.json(
      { error: 'Failed to create incident' },
      { status: 500 }
    );
  }
}
