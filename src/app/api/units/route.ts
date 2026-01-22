import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

    const units = await prisma.unit.findMany({
      orderBy: { code: 'asc' },
      include: {
        owners: true,
        transactions: {
          where: {
            type: 'payment',
            referenceMonth: currentMonth,
          },
          select: { amount: true },
        },
      },
    });

    const result = units.map((unit) => {
      const totalPaid = unit.transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const totalOwed = Math.max(0, unit.monthlyFee - totalPaid);
      return {
        id: unit.id,
        code: unit.code,
        floor: unit.floor,
        description: unit.description,
        monthlyFee: unit.monthlyFee,
        nib: unit.nib,
        telefone: unit.telefone,
        email: unit.email,
        owners: unit.owners,
        totalPaid,
        totalOwed,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching units:', error);
    return NextResponse.json(
      { error: 'Failed to fetch units' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const unit = await prisma.unit.create({
      data: {
        code: body.code,
        floor: body.floor,
        description: body.description,
        monthlyFee: parseFloat(body.monthlyFee ?? '45'),
        nib: body.nib || null,
        telefone: body.telefone || null,
        email: body.email || null,
        owners: body.owners?.length
          ? {
              create: body.owners.map((name: string) => ({ name })),
            }
          : undefined,
      },
      include: { owners: true },
    });

    return NextResponse.json(unit, { status: 201 });
  } catch (error) {
    console.error('Error creating unit:', error);
    return NextResponse.json(
      { error: 'Failed to create unit' },
      { status: 500 }
    );
  }
}
