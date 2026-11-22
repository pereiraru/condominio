import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  computeQuorumSummary,
  DEFAULT_BUILDING_NAME,
  serializeMeeting,
} from '@/lib/meetings';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [meetingRecords, units, documents] = await Promise.all([
      prisma.condoMeeting.findMany({
        where: { status: 'finalized' },
        orderBy: [{ meetingDate: 'desc' }, { updatedAt: 'desc' }],
      }),
      prisma.unit.findMany({
        select: { id: true },
      }),
      prisma.document.findMany({
        where: { category: 'minutes' },
        orderBy: { uploadedAt: 'desc' },
      }),
    ]);

    const unitIds = units.map((u) => u.id);

    const meetings = meetingRecords.map((record) => {
      const dto = serializeMeeting(record);
      const quorum = computeQuorumSummary({
        unitIds,
        attendance: dto.attendance,
        quorumMode: dto.quorumMode,
      });

      return {
        id: dto.id,
        year: dto.year,
        actaNumber: dto.actaNumber,
        assemblyType: dto.assemblyType,
        meetingDate: dto.meetingDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
        convocationUsed: dto.convocationUsed,
        location: dto.location,
        presidedBy: dto.presidedBy,
        secretaryBy: dto.secretaryBy,
        newAdminNames: dto.newAdminNames,
        quorumMode: dto.quorumMode,
        quorum,
        discussionPoints: dto.discussionPoints,
        actionItems: dto.actionItems,
        generalNotes: dto.generalNotes,
        generatedAt: dto.generatedAt,
      };
    });

    return NextResponse.json({
      buildingName: DEFAULT_BUILDING_NAME,
      meetings,
      documents: documents.map((doc) => ({
        id: doc.id,
        name: doc.name,
        filename: doc.filename,
        mimeType: doc.mimeType,
        size: doc.size,
        description: doc.description,
        uploadedAt: doc.uploadedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error loading resident atas:', error);
    return NextResponse.json(
      { error: 'Erro ao carregar as atas do condomínio.' },
      { status: 500 }
    );
  }
}
