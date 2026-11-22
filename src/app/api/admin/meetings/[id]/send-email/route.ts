import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import {
  DEFAULT_BUILDING_NAME,
  computeMeetingQuorum,
  serializeMeeting,
} from '@/lib/meetings';
import { sendMeetingSummaryEmail } from '@/lib/meetingEmail';
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
    });
    if (!record) {
      return NextResponse.json({ error: 'Reunião não encontrada.' }, { status: 404 });
    }

    const body = (await request.json()) as {
      mode?: 'all_units' | 'custom';
      customEmails?: string;
      customNote?: string;
    };

    const mode = body.mode === 'custom' ? 'custom' : 'all_units';
    const meeting = serializeMeeting(record);

    const units = await prisma.unit.findMany({
      include: {
        owners: { where: { endMonth: null } },
      },
      orderBy: { code: 'asc' },
    });

    const { presentCount, totalPermilagem } = computeMeetingQuorum(
      units.map((u) => u.id),
      meeting.attendance
    );

    let targetEmailsRaw = '';
    if (mode === 'all_units') {
      const emailSet = new Set<string>();
      for (const u of units) {
        const candidates = [
          u.email,
          ...u.owners.map((o) => o.email),
        ];
        for (const candidate of candidates) {
          parseEmailList(candidate).forEach((email) => emailSet.add(email));
        }
      }
      targetEmailsRaw = Array.from(emailSet).join(', ');
    } else {
      targetEmailsRaw = typeof body.customEmails === 'string' ? body.customEmails : '';
    }

    const result = await sendMeetingSummaryEmail({
      meeting,
      buildingName: DEFAULT_BUILDING_NAME,
      presentCount,
      totalUnits: units.length,
      totalPermilagem,
      toEmails: targetEmailsRaw,
      customNote: typeof body.customNote === 'string' ? body.customNote : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error dispatching meeting summary email:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar o resumo da reunião por email.' },
      { status: 500 }
    );
  }
}
