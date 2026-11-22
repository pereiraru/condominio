import path from 'path';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import {
  INCIDENT_INCLUDE,
  canViewerSeeIncident,
  sanitizeIncidentForViewer,
  saveIncidentAttachments,
} from '@/lib/incidents';
import { sendIncidentNotification } from '@/lib/incidentNotifications';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  open: 'Registado',
  in_progress: 'Em Tratamento',
  scheduled: 'Agendado',
  resolved: 'Resolvido',
  closed: 'Encerrado',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const viewer = {
    role: session.user.role,
    unitId: session.user.unitId,
    email: session.user.email,
  };

  try {
    const incident = await prisma.incident.findUnique({
      where: { id: params.id },
      include: INCIDENT_INCLUDE,
    });

    if (!incident) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    if (!canViewerSeeIncident(incident, viewer)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(sanitizeIncidentForViewer(incident, viewer));
  } catch (error) {
    console.error('Error fetching incident:', error);
    return NextResponse.json(
      { error: 'Failed to fetch incident' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const existing = await prisma.incident.findUnique({
      where: { id: params.id },
      include: INCIDENT_INCLUDE,
    });

    if (!existing) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    if (!canViewerSeeIncident(existing, viewer)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const contentType = request.headers.get('content-type') || '';
    let payload: Record<string, unknown> = {};
    let uploadedFiles: File[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        if (key !== 'files') {
          payload[key] = value;
        }
      });
      uploadedFiles = formData
        .getAll('files')
        .filter((entry): entry is File => entry instanceof File);
    } else {
      payload = await request.json();
    }

    const actorName = session.user.name || session.user.email || (isAdmin ? 'Administração' : 'Condómino');
    const actorRole = isAdmin ? 'admin' : 'user';
    const isOwnUnit = Boolean(session.user.unitId && existing.reportedByUnitId === session.user.unitId);

    const comment = typeof payload.comment === 'string' ? payload.comment.trim() : '';
    const uploadPhase =
      payload.phase === 'resolution' && isAdmin ? 'resolution' : 'report';

    const updateData: Record<string, unknown> = {};
    const logEntries: { actorName: string; actorRole: string; actionType: string; message: string }[] = [];

    if (!isAdmin) {
      if (!isOwnUnit && !comment) {
        return NextResponse.json(
          { error: 'Apenas a administração pode alterar o tratamento desta anomalia.' },
          { status: 403 }
        );
      }

      if (isOwnUnit && existing.status === 'open') {
        if (typeof payload.description === 'string' && payload.description.trim()) {
          updateData.description = payload.description.trim();
        }
        if (typeof payload.immediateAction === 'string') {
          updateData.immediateAction = payload.immediateAction.trim() || null;
        }
      }
    } else {
      // Admin updates (ITIL resolution, assignment, creditor, expense, invoice)
      if (typeof payload.title === 'string' && payload.title.trim()) {
        updateData.title = payload.title.trim();
      }
      if (typeof payload.description === 'string' && payload.description.trim()) {
        updateData.description = payload.description.trim();
      }
      if (typeof payload.immediateAction === 'string') {
        updateData.immediateAction = payload.immediateAction.trim() || null;
      }
      if (typeof payload.location === 'string' && payload.location.trim()) {
        updateData.location = payload.location.trim();
      }
      if (typeof payload.priority === 'string' && payload.priority.trim()) {
        updateData.priority = payload.priority.trim();
      }
      if (typeof payload.visibility === 'string') {
        updateData.visibility = payload.visibility === 'unit_private' ? 'unit_private' : 'public';
      }
      if (typeof payload.notifyEmails === 'string') {
        updateData.notifyEmails = payload.notifyEmails.trim() || null;
      }

      if (typeof payload.assignedTo === 'string') {
        const nextAssignee = payload.assignedTo.trim() || null;
        if (nextAssignee !== existing.assignedTo) {
          updateData.assignedTo = nextAssignee;
          logEntries.push({
            actorName,
            actorRole,
            actionType: 'assignment',
            message: nextAssignee
              ? `Responsável atribuído: ${nextAssignee}`
              : 'Atribuição de responsável removida.',
          });
        }
      }

      if (typeof payload.plannedDate === 'string') {
        const nextPlanned = payload.plannedDate.trim()
          ? new Date(payload.plannedDate.trim())
          : null;
        const nextIso = nextPlanned && !Number.isNaN(nextPlanned.getTime()) ? nextPlanned.toISOString().slice(0, 10) : null;
        const prevIso = existing.plannedDate ? existing.plannedDate.toISOString().slice(0, 10) : null;
        if (nextIso !== prevIso) {
          updateData.plannedDate = nextPlanned && !Number.isNaN(nextPlanned.getTime()) ? nextPlanned : null;
          if (nextIso) {
            logEntries.push({
              actorName,
              actorRole,
              actionType: 'status_change',
              message: `Data planeada para intervenção definida: ${new Date(nextIso).toLocaleDateString('pt-PT')}`,
            });
          }
        }
      }

      if (typeof payload.resolutionNotes === 'string') {
        updateData.resolutionNotes = payload.resolutionNotes.trim() || null;
      }

      const nextStatus = typeof payload.status === 'string' ? payload.status.trim() : existing.status;
      if (nextStatus !== existing.status) {
        updateData.status = nextStatus;
        logEntries.push({
          actorName,
          actorRole,
          actionType: nextStatus === 'resolved' || nextStatus === 'closed' ? 'resolution' : 'status_change',
          message: `Estado alterado de "${STATUS_LABELS[existing.status] || existing.status}" para "${STATUS_LABELS[nextStatus] || nextStatus}".`,
        });
      }

      if (typeof payload.resolvedAt === 'string') {
        const trimmed = payload.resolvedAt.trim();
        updateData.resolvedAt = trimmed ? new Date(trimmed) : null;
      } else if ((nextStatus === 'resolved' || nextStatus === 'closed') && !existing.resolvedAt) {
        updateData.resolvedAt = new Date();
      }

      // Expense & Creditor linking (or inline creation of new creditor)
      let targetCreditorId = existing.creditorId;
      let targetCreditorCategory = existing.creditor?.category || 'maintenance';

      const newCreditorName =
        typeof payload.newCreditorName === 'string' ? payload.newCreditorName.trim() : '';
      const newCreditorCategory =
        typeof payload.newCreditorCategory === 'string' && payload.newCreditorCategory.trim()
          ? payload.newCreditorCategory.trim()
          : 'maintenance';

      if (newCreditorName) {
        const createdCreditor = await prisma.creditor.create({
          data: {
            name: newCreditorName,
            category: newCreditorCategory,
            isFixed: false,
            description: `Criado a partir do incidente ${existing.code}: ${existing.title}`,
          },
        });
        targetCreditorId = createdCreditor.id;
        targetCreditorCategory = createdCreditor.category;
        updateData.creditorId = createdCreditor.id;
        logEntries.push({
          actorName,
          actorRole,
          actionType: 'resolution',
          message: `Novo credor criado e associado: ${createdCreditor.name}`,
        });
      } else if (payload.creditorId !== undefined) {
        const nextCreditorId =
          typeof payload.creditorId === 'string' && payload.creditorId.trim()
            ? payload.creditorId.trim()
            : null;
        if (nextCreditorId !== existing.creditorId) {
          updateData.creditorId = nextCreditorId;
          targetCreditorId = nextCreditorId;
          if (nextCreditorId) {
            const cred = await prisma.creditor.findUnique({
              where: { id: nextCreditorId },
              select: { name: true, category: true },
            });
            if (cred) {
              targetCreditorCategory = cred.category;
              logEntries.push({
                actorName,
                actorRole,
                actionType: 'resolution',
                message: `Credor associado à resolução: ${cred.name}`,
              });
            }
          }
        }
      }

      let nextExpenseAmount = existing.expenseAmount ?? null;
      if (payload.expenseAmount !== undefined) {
        const rawExpense = String(payload.expenseAmount ?? '').trim();
        if (rawExpense === '') {
          nextExpenseAmount = null;
          updateData.expenseAmount = null;
        } else {
          const parsedExpense = Number(rawExpense);
          if (!Number.isNaN(parsedExpense) && parsedExpense >= 0) {
            nextExpenseAmount = Math.round(parsedExpense * 100) / 100;
            if (nextExpenseAmount !== existing.expenseAmount) {
              updateData.expenseAmount = nextExpenseAmount;
              logEntries.push({
                actorName,
                actorRole,
                actionType: 'resolution',
                message: `Despesa registada: ${nextExpenseAmount.toFixed(2)} €`,
              });
            }
          }
        }
      }

      const shouldCreateInvoice =
        payload.createSupplierInvoice === true || payload.createSupplierInvoice === 'true';

      if (
        shouldCreateInvoice &&
        targetCreditorId &&
        nextExpenseAmount &&
        nextExpenseAmount > 0 &&
        !existing.supplierInvoiceId
      ) {
        const invoiceDate =
          (updateData.resolvedAt instanceof Date ? updateData.resolvedAt : null) ||
          existing.resolvedAt ||
          new Date();
        const invoice = await prisma.supplierInvoice.create({
          data: {
            date: invoiceDate,
            creditorId: targetCreditorId,
            description: `[${existing.code}] ${(updateData.title as string) || existing.title}`,
            category: targetCreditorCategory,
            amountDue: nextExpenseAmount,
            amountPaid: 0,
            isPaid: false,
          },
        });
        updateData.supplierInvoiceId = invoice.id;
        logEntries.push({
          actorName,
          actorRole,
          actionType: 'resolution',
          message: `Fatura de fornecedor criada no valor de ${nextExpenseAmount.toFixed(2)} € para reconciliação bancária.`,
        });
      }
    }

    if (comment) {
      logEntries.push({
        actorName,
        actorRole,
        actionType: 'comment',
        message: comment,
      });
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.incident.update({
        where: { id: existing.id },
        data: updateData,
      });
    }

    const savedAttachments = await saveIncidentAttachments(
      uploadedFiles,
      existing.id,
      uploadPhase
    );
    if (savedAttachments.length > 0) {
      logEntries.push({
        actorName,
        actorRole,
        actionType: 'attachment',
        message: `${savedAttachments.length} anexo(s) adicionado(s) (${uploadPhase === 'resolution' ? 'resolução' : 'reporte'}).`,
      });
    }

    if (logEntries.length > 0) {
      await prisma.incidentLog.createMany({
        data: logEntries.map((entry) => ({
          incidentId: existing.id,
          ...entry,
        })),
      });
    }

    const updated = await prisma.incident.findUnique({
      where: { id: existing.id },
      include: INCIDENT_INCLUDE,
    });

    let notification = null;
    if (updated && isAdmin) {
      const statusChanged = updated.status !== existing.status;
      const sendNotificationFlag =
        payload.sendNotification === true || payload.sendNotification === 'true';

      if (statusChanged && (updated.status === 'resolved' || updated.status === 'closed')) {
        notification = await sendIncidentNotification('resolved', updated);
      } else if (statusChanged || sendNotificationFlag) {
        notification = await sendIncidentNotification('updated', updated);
      }
    }

    return NextResponse.json({
      incident: updated ? sanitizeIncidentForViewer(updated, viewer) : null,
      notification,
    });
  } catch (error) {
    console.error('Error updating incident:', error);
    return NextResponse.json(
      { error: 'Failed to update incident' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = session.user.role === 'admin';

  try {
    const existing = await prisma.incident.findUnique({
      where: { id: params.id },
      include: { attachments: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    const isOwnOpen =
      Boolean(session.user.unitId && existing.reportedByUnitId === session.user.unitId) &&
      existing.status === 'open';

    if (!isAdmin && !isOwnOpen) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    for (const att of existing.attachments) {
      const filePath = path.join(
        process.cwd(),
        'public',
        'uploads',
        'attachments',
        path.basename(att.filename)
      );
      if (existsSync(filePath)) {
        await unlink(filePath).catch(() => undefined);
      }
    }

    await prisma.incident.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting incident:', error);
    return NextResponse.json(
      { error: 'Failed to delete incident' },
      { status: 500 }
    );
  }
}
