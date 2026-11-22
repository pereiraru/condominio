import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { DEFAULT_BUILDING_NAME, serializeMeeting } from '@/lib/meetings';
import { generateConvocationPdf } from '@/lib/convocationPdf';
import { sendMeetingConvocatoriaEmail } from '@/lib/meetingEmail';
import { parseEmailList } from '@/lib/incidentNotifications';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const record = await prisma.condoMeeting.findUnique({
      where: { id: params.id },
      include: { convocationDocument: true },
    });
    if (!record) {
      return NextResponse.json({ error: 'Reunião não encontrada.' }, { status: 404 });
    }

    if (record.convocationStatus !== 'finalized') {
      return NextResponse.json(
        {
          sent: false,
          reason: 'Submeta primeiro a convocatória como final antes de enviar por email.',
        },
        { status: 400 }
      );
    }

    const body = (await request.json()) as {
      mode?: 'all_units' | 'custom';
      customEmails?: string;
      customNote?: string;
    };

    const mode = body.mode === 'custom' ? 'custom' : 'all_units';
    const meeting = serializeMeeting(record);

    let targetEmailsRaw = '';
    if (mode === 'all_units') {
      const units = await prisma.unit.findMany({
        include: {
          owners: { where: { endMonth: null } },
        },
        orderBy: { code: 'asc' },
      });
      const emailSet = new Set<string>();
      for (const u of units) {
        const candidates = [u.email, ...u.owners.map((o) => o.email)];
        for (const candidate of candidates) {
          parseEmailList(candidate).forEach((email) => emailSet.add(email));
        }
      }
      targetEmailsRaw = Array.from(emailSet).join(', ');
    } else {
      targetEmailsRaw = typeof body.customEmails === 'string' ? body.customEmails : '';
    }

    let pdfBuffer: Buffer | null = null;
    if (record.convocationDocument?.filename) {
      const diskPath = path.join(
        process.cwd(),
        'public',
        'uploads',
        path.basename(record.convocationDocument.filename)
      );
      if (existsSync(diskPath)) {
        pdfBuffer = await readFile(diskPath);
      }
    }
    if (!pdfBuffer) {
      const generated = await generateConvocationPdf({
        meeting,
        buildingName: DEFAULT_BUILDING_NAME,
      });
      pdfBuffer = Buffer.from(generated);
    }

    const safeActa = meeting.actaNumber.replace(/[^a-zA-Z0-9_-]/g, '') || 'sn';
    const attachmentFilename = `Convocatoria-Acta-${safeActa}-${meeting.meetingDate}.pdf`;

    const result = await sendMeetingConvocatoriaEmail({
      meeting,
      buildingName: DEFAULT_BUILDING_NAME,
      toEmails: targetEmailsRaw,
      customNote: typeof body.customNote === 'string' ? body.customNote : undefined,
      pdfAttachment: {
        filename: attachmentFilename,
        content: pdfBuffer,
      },
    });

    let convocationSentAt = meeting.convocationSentAt;
    if (result.sent) {
      const updated = await prisma.condoMeeting.update({
        where: { id: params.id },
        data: { convocationSentAt: new Date() },
      });
      convocationSentAt = updated.convocationSentAt
        ? updated.convocationSentAt.toISOString()
        : null;
    }

    return NextResponse.json({
      ...result,
      convocationSentAt,
    });
  } catch (error) {
    console.error('Error dispatching meeting convocatoria email:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar a convocatória por email.' },
      { status: 500 }
    );
  }
}
