import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { parseMeetingWriteData, serializeMeeting } from '@/lib/meetings';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const yearParam = request.nextUrl.searchParams.get('year');
    const yearFilter = yearParam ? Number(yearParam) : undefined;
    const where =
      yearFilter && Number.isInteger(yearFilter) ? { year: yearFilter } : undefined;

    const meetings = await prisma.condoMeeting.findMany({
      where,
      include: { convocationDocument: true },
      orderBy: [{ meetingDate: 'desc' }, { updatedAt: 'desc' }],
    });

    return NextResponse.json(meetings.map(serializeMeeting));
  } catch (error) {
    console.error('Error listing condo meetings:', error);
    return NextResponse.json(
      { error: 'Erro ao carregar reuniões guardadas.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const data = parseMeetingWriteData(body);

    const created = await prisma.condoMeeting.create({
      data: {
        ...data,
        generatedAt: data.status === 'finalized' ? new Date() : null,
      },
      include: { convocationDocument: true },
    });

    return NextResponse.json(serializeMeeting(created), { status: 201 });
  } catch (error) {
    console.error('Error creating condo meeting:', error);
    return NextResponse.json(
      { error: 'Erro ao guardar a reunião.' },
      { status: 500 }
    );
  }
}
