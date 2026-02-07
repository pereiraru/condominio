import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const mappings = await prisma.descriptionMapping.findMany({
      include: { unit: true, creditor: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(mappings);
  } catch (error) {
    console.error('Error fetching mappings:', error);
    return NextResponse.json({ error: 'Failed to fetch mappings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pattern, unitId, creditorId } = body;

    if (!pattern || (!unitId && !creditorId)) {
      return NextResponse.json(
        { error: 'pattern and either unitId or creditorId required' },
        { status: 400 }
      );
    }

    // Create or update the mapping
    const mapping = await prisma.descriptionMapping.upsert({
      where: { pattern },
      update: { unitId: unitId || null, creditorId: creditorId || null },
      create: { pattern, unitId: unitId || null, creditorId: creditorId || null },
      include: { unit: true, creditor: true },
    });

    const updateData: Record<string, string | null> = {};
    if (unitId) updateData.unitId = unitId;
    if (creditorId) updateData.creditorId = creditorId;

    const updated = await prisma.transaction.updateMany({
      where: {
        description: { contains: pattern },
      },
      data: updateData,
    });

    return NextResponse.json({
      mapping,
      updatedCount: updated.count,
    });
  } catch (error) {
    console.error('Error creating mapping:', error);
    return NextResponse.json({ error: 'Failed to create mapping' }, { status: 500 });
  }
}
