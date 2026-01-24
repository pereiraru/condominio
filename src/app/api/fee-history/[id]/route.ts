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

    const feeHistory = await prisma.feeHistory.update({
      where: { id: params.id },
      data: {
        amount: parseFloat(body.amount),
        effectiveFrom: body.effectiveFrom,
        effectiveTo: body.effectiveTo || null,
      },
    });

    return NextResponse.json(feeHistory);
  } catch (error) {
    console.error('Error updating fee history:', error);
    return NextResponse.json(
      { error: 'Failed to update fee history' },
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
    await prisma.feeHistory.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting fee history:', error);
    return NextResponse.json(
      { error: 'Failed to delete fee history' },
      { status: 500 }
    );
  }
}
