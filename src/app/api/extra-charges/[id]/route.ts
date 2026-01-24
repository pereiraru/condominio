import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();

    const extraCharge = await prisma.extraCharge.update({
      where: { id: params.id },
      data: {
        unitId: body.unitId || null,
        description: body.description,
        amount: parseFloat(body.amount),
        effectiveFrom: body.effectiveFrom,
        effectiveTo: body.effectiveTo || null,
      },
      include: { unit: { select: { code: true } } },
    });

    return NextResponse.json(extraCharge);
  } catch (error) {
    console.error('Error updating extra charge:', error);
    return NextResponse.json(
      { error: 'Failed to update extra charge' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    await prisma.extraCharge.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting extra charge:', error);
    return NextResponse.json(
      { error: 'Failed to delete extra charge' },
      { status: 500 }
    );
  }
}
