import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import {
  DEFAULT_BUILDING_NAME,
  formatMeetingDateShort,
  parseMeetingWriteData,
  serializeMeeting,
} from '@/lib/meetings';
import { generateConvocationPdf } from '@/lib/convocationPdf';

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
    let existing = await prisma.condoMeeting.findUnique({
      where: { id: params.id },
      include: { convocationDocument: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Reunião não encontrada.' }, { status: 404 });
    }

    let body: Record<string, unknown> = {};
    try {
      const parsed = await request.json();
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      // Optional body
    }

    if (Object.keys(body).length > 0) {
      const writeData = parseMeetingWriteData(body, existing.year);
      existing = await prisma.condoMeeting.update({
        where: { id: params.id },
        data: {
          ...writeData,
          // Submitting the convocation never alters the Ata lifecycle state
          status: existing.status,
          generatedAt: existing.generatedAt,
        },
        include: { convocationDocument: true },
      });
    }

    const meetingDto = serializeMeeting(existing);
    const hasAgenda = meetingDto.discussionPoints.some((pt) => pt.title.trim().length > 0);
    if (!meetingDto.meetingDate.trim() || !hasAgenda) {
      return NextResponse.json(
        {
          error:
            'Defina a data da reunião e pelo menos um ponto na Ordem de Trabalhos antes de submeter a convocatória.',
        },
        { status: 400 }
      );
    }

    const pdfBytes = await generateConvocationPdf({
      meeting: meetingDto,
      buildingName: DEFAULT_BUILDING_NAME,
    });
    const pdfBuffer = Buffer.from(pdfBytes);

    const safeActa = meetingDto.actaNumber.replace(/[^a-zA-Z0-9_-]/g, '') || 'sn';
    const filename = `convocatoria-acta-${safeActa}-${meetingDto.meetingDate}-${Date.now()}.pdf`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), pdfBuffer);

    const docName = `Convocatória — Assembleia Geral ${meetingDto.assemblyType} (Acta N.º ${meetingDto.actaNumber} · ${formatMeetingDateShort(meetingDto.meetingDate)})`;
    const docDescription = `Convocatória oficial emitida em ${formatMeetingDateShort(meetingDto.issueDate)} para ${formatMeetingDateShort(meetingDto.meetingDate)} às ${meetingDto.firstConvocationTime} (${meetingDto.location}).`;

    let doc;
    if (existing.convocationDocumentId && existing.convocationDocument) {
      const oldFilename = path.basename(existing.convocationDocument.filename);
      if (oldFilename && oldFilename !== filename) {
        try {
          await unlink(path.join(uploadDir, oldFilename));
        } catch {
          // Best-effort cleanup of superseded PDF file
        }
      }
      doc = await prisma.document.update({
        where: { id: existing.convocationDocumentId },
        data: {
          name: docName,
          filename,
          mimeType: 'application/pdf',
          size: pdfBuffer.length,
          category: 'convocation',
          description: docDescription,
          uploadedAt: new Date(),
        },
      });
    } else {
      doc = await prisma.document.create({
        data: {
          name: docName,
          filename,
          mimeType: 'application/pdf',
          size: pdfBuffer.length,
          category: 'convocation',
          description: docDescription,
        },
      });
    }

    const updated = await prisma.condoMeeting.update({
      where: { id: params.id },
      data: {
        convocationStatus: 'finalized',
        convocationFinalizedAt: new Date(),
        convocationDocumentId: doc.id,
      },
      include: { convocationDocument: true },
    });

    return NextResponse.json({
      meeting: serializeMeeting(updated),
      document: doc,
    });
  } catch (error) {
    console.error('Error submitting final convocatoria:', error);
    return NextResponse.json(
      { error: 'Erro ao submeter e arquivar a convocatória final.' },
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
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const existing = await prisma.condoMeeting.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Reunião não encontrada.' }, { status: 404 });
    }

    const updated = await prisma.condoMeeting.update({
      where: { id: params.id },
      data: { convocationStatus: 'draft' },
      include: { convocationDocument: true },
    });

    return NextResponse.json({ meeting: serializeMeeting(updated) });
  } catch (error) {
    console.error('Error reopening convocatoria:', error);
    return NextResponse.json(
      { error: 'Erro ao reabrir a convocatória para alterações.' },
      { status: 500 }
    );
  }
}
