import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { parseMeetingWriteData, serializeMeeting } from '@/lib/meetings';

export const dynamic = 'force-dynamic';

export async function GET(
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
    const meeting = await prisma.condoMeeting.findUnique({
      where: { id: params.id },
      include: { convocationDocument: true },
    });

    if (!meeting) {
      return NextResponse.json({ error: 'Reunião não encontrada.' }, { status: 404 });
    }

    return NextResponse.json(serializeMeeting(meeting));
  } catch (error) {
    console.error('Error fetching condo meeting:', error);
    return NextResponse.json({ error: 'Erro ao carregar reunião.' }, { status: 500 });
  }
}

export async function PUT(
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
    const existing = await prisma.condoMeeting.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Reunião não encontrada.' }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const data = parseMeetingWriteData(body, existing.year);
    const shouldStampGenerated =
      data.status === 'finalized' && (Boolean(body.regenerate) || !existing.generatedAt);

    const updated = await prisma.condoMeeting.update({
      where: { id: params.id },
      data: {
        ...data,
        generatedAt:
          data.status === 'finalized'
            ? shouldStampGenerated
              ? new Date()
              : existing.generatedAt
            : null,
      },
      include: { convocationDocument: true },
    });

    return NextResponse.json(serializeMeeting(updated));
  } catch (error) {
    console.error('Error updating condo meeting:', error);
    return NextResponse.json({ error: 'Erro ao atualizar reunião.' }, { status: 500 });
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

    await prisma.condoMeeting.delete({ where: { id: params.id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Error deleting condo meeting:', error);
    return NextResponse.json({ error: 'Erro ao eliminar reunião.' }, { status: 500 });
  }
}
