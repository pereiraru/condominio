import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const data: Record<string, unknown> = {};
    if ('unitId' in body) data.unitId = body.unitId || null;
    if ('creditorId' in body) data.creditorId = body.creditorId || null;
    if ('referenceMonth' in body) data.referenceMonth = body.referenceMonth || null;
    if ('type' in body) data.type = body.type;
    if ('category' in body) data.category = body.category || null;

    const transaction = await prisma.transaction.update({
      where: { id: params.id },
      data,
      include: { unit: true, creditor: true },
    });

    return NextResponse.json(transaction);
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    );
  }
}
