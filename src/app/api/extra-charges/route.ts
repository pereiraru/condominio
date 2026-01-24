import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// GET all extra charges (global and unit-specific)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const unitId = request.nextUrl.searchParams.get('unitId');

    const where: { unitId?: string | null } = {};
    if (unitId === 'global') {
      where.unitId = null;
    } else if (unitId) {
      // Return both global and unit-specific charges
      const extraCharges = await prisma.extraCharge.findMany({
        where: {
          OR: [{ unitId: null }, { unitId }],
        },
        include: { unit: { select: { code: true } } },
        orderBy: { effectiveFrom: 'desc' },
      });
      return NextResponse.json(extraCharges);
    }

    const extraCharges = await prisma.extraCharge.findMany({
      where,
      include: { unit: { select: { code: true } } },
      orderBy: { effectiveFrom: 'desc' },
    });

    return NextResponse.json(extraCharges);
  } catch (error) {
    console.error('Error fetching extra charges:', error);
    return NextResponse.json(
      { error: 'Failed to fetch extra charges' },
      { status: 500 }
    );
  }
}

// POST new extra charge (global or unit-specific)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();

    const extraCharge = await prisma.extraCharge.create({
      data: {
        unitId: body.unitId || null,
        description: body.description,
        amount: parseFloat(body.amount),
        effectiveFrom: body.effectiveFrom,
        effectiveTo: body.effectiveTo || null,
      },
      include: { unit: { select: { code: true } } },
    });

    return NextResponse.json(extraCharge, { status: 201 });
  } catch (error) {
    console.error('Error creating extra charge:', error);
    return NextResponse.json(
      { error: 'Failed to create extra charge' },
      { status: 500 }
    );
  }
}
