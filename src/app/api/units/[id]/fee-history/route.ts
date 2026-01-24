import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions, canAccessUnit } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!canAccessUnit(session?.user?.role, session?.user?.unitId, params.id)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const feeHistory = await prisma.feeHistory.findMany({
      where: { unitId: params.id },
      orderBy: { effectiveFrom: 'desc' },
    });

    return NextResponse.json(feeHistory);
  } catch (error) {
    console.error('Error fetching fee history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fee history' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();

    const feeHistory = await prisma.feeHistory.create({
      data: {
        unitId: params.id,
        amount: parseFloat(body.amount),
        effectiveFrom: body.effectiveFrom,
        effectiveTo: body.effectiveTo || null,
      },
    });

    return NextResponse.json(feeHistory, { status: 201 });
  } catch (error) {
    console.error('Error creating fee history:', error);
    return NextResponse.json(
      { error: 'Failed to create fee history' },
      { status: 500 }
    );
  }
}
