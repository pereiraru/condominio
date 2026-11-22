import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { prisma } from '@/lib/prisma';

export const INCIDENT_INCLUDE = {
  reportedByUnit: {
    select: { id: true, code: true, description: true },
  },
  creditor: {
    select: { id: true, name: true, category: true },
  },
  supplierInvoice: {
    select: { id: true, description: true, amountDue: true, isPaid: true },
  },
  attachments: {
    orderBy: { uploadedAt: 'asc' as const },
  },
  logs: {
    orderBy: { createdAt: 'desc' as const },
  },
};

export async function generateNextIncidentCode(year: number): Promise<string> {
  const prefix = `INC-${year}-`;
  const existing = await prisma.incident.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  });

  let maxNum = 0;
  for (const row of existing) {
    const suffix = parseInt(row.code.slice(prefix.length), 10);
    if (!Number.isNaN(suffix) && suffix > maxNum) {
      maxNum = suffix;
    }
  }

  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
}

export async function saveIncidentAttachments(
  files: File[],
  incidentId: string,
  phase: 'report' | 'resolution'
) {
  const validFiles = files.filter((f) => f && f.size > 0);
  if (validFiles.length === 0) return [];

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'attachments');
  await mkdir(uploadDir, { recursive: true });

  const created = [];
  for (let i = 0; i < validFiles.length; i++) {
    const file = validFiles[i];
    const ext = path.extname(file.name) || '.bin';
    const safeFilename = `inc-${incidentId}-${phase}-${Date.now()}-${i}${ext.toLowerCase()}`;
    const filepath = path.join(uploadDir, safeFilename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    const record = await prisma.incidentAttachment.create({
      data: {
        incidentId,
        phase,
        name: file.name,
        filename: safeFilename,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      },
    });
    created.push(record);
  }

  return created;
}

interface SessionViewer {
  role?: string;
  unitId?: string | null;
  email?: string | null;
}

export function canViewerSeeIncident(
  incident: { visibility: string; reportedByUnitId: string | null; reportedByEmail: string | null },
  viewer: SessionViewer
): boolean {
  if (viewer.role === 'admin') return true;
  if (incident.visibility !== 'unit_private') return true;
  if (viewer.unitId && incident.reportedByUnitId === viewer.unitId) return true;
  if (viewer.email && incident.reportedByEmail && viewer.email.toLowerCase() === incident.reportedByEmail.toLowerCase()) {
    return true;
  }
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sanitizeIncidentForViewer(incident: any, viewer: SessionViewer) {
  const isAdmin = viewer.role === 'admin';
  const isOwnUnit = Boolean(viewer.unitId && incident.reportedByUnitId === viewer.unitId);
  const isOwnEmail = Boolean(
    viewer.email &&
      incident.reportedByEmail &&
      viewer.email.toLowerCase() === incident.reportedByEmail.toLowerCase()
  );

  if (isAdmin || isOwnUnit || isOwnEmail) {
    return incident;
  }

  return {
    ...incident,
    reportedByUnitId: null,
    reportedByUnit: null,
    reportedByName: 'Condómino',
    reportedByEmail: null,
    notifyEmails: null,
    logs: Array.isArray(incident.logs)
      ? incident.logs.map((log: { actorRole: string; actorName: string; [k: string]: unknown }) => ({
          ...log,
          actorName: log.actorRole === 'admin' ? log.actorName : 'Condómino',
        }))
      : [],
  };
}
