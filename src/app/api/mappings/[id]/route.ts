import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.descriptionMapping.delete({
      where: { id: params.id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting mapping:', error);
    return NextResponse.json({ error: 'Failed to delete mapping' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { pattern, unitId, creditorId } = body;

    const mapping = await prisma.descriptionMapping.update({
      where: { id: params.id },
      data: {
        ...(pattern !== undefined && { pattern }),
        ...(unitId !== undefined && { unitId: unitId || null }),
        ...(creditorId !== undefined && { creditorId: creditorId || null }),
      },
      include: { unit: true, creditor: true },
    });

    return NextResponse.json(mapping);
  } catch (error) {
    console.error('Error updating mapping:', error);
    return NextResponse.json({ error: 'Failed to update mapping' }, { status: 500 });
  }
}
