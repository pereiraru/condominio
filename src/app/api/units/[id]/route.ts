import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const unit = await prisma.unit.findUnique({
      where: { id: params.id },
      include: {
        owners: true,
        transactions: {
          orderBy: { date: 'desc' },
          take: 50,
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

    const monthlyPayments = unit.transactions.filter(
      (t) => t.type === 'payment' && t.referenceMonth === currentMonth
    );
    const totalPaid = monthlyPayments.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalOwed = Math.max(0, unit.monthlyFee - totalPaid);

    return NextResponse.json({
      ...unit,
      totalPaid,
      totalOwed,
    });
  } catch (error) {
    console.error('Error fetching unit:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unit' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // Update unit fields
    const unit = await prisma.unit.update({
      where: { id: params.id },
      data: {
        code: body.code,
        floor: body.floor != null ? parseInt(body.floor) : null,
        description: body.description || null,
        monthlyFee: parseFloat(body.monthlyFee ?? '45'),
        nib: body.nib || null,
        telefone: body.telefone || null,
        email: body.email || null,
      },
    });

    // Update owners: delete existing and recreate
    if (body.owners !== undefined) {
      await prisma.owner.deleteMany({ where: { unitId: params.id } });

      const validOwners = (body.owners as string[]).filter((name) => name.trim() !== '');
      if (validOwners.length > 0) {
        await prisma.owner.createMany({
          data: validOwners.map((name) => ({ name, unitId: params.id })),
        });
      }
    }

    const updated = await prisma.unit.findUnique({
      where: { id: params.id },
      include: { owners: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating unit:', error);
    return NextResponse.json(
      { error: 'Failed to update unit' },
      { status: 500 }
    );
  }
}
