import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const budget = await prisma.budget.findUnique({
    where: { id: params.id },
    include: { lines: { orderBy: { sortOrder: 'asc' } } },
  });

  if (!budget) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(budget);
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();

  // Delete existing lines and recreate
  await prisma.budgetLine.deleteMany({ where: { budgetId: params.id } });

  const budget = await prisma.budget.update({
    where: { id: params.id },
    data: {
      year: body.year,
      notes: body.notes || null,
      lines: {
        create: (body.lines || []).map((line: { category: string; description: string; monthlyAmount: number; annualAmount: number; percentage?: number; sortOrder?: number }, i: number) => ({
          category: line.category,
          description: line.description,
          monthlyAmount: line.monthlyAmount,
          annualAmount: line.annualAmount,
          percentage: line.percentage || null,
          sortOrder: line.sortOrder ?? i,
        })),
      },
    },
    include: { lines: { orderBy: { sortOrder: 'asc' } } },
  });

  return NextResponse.json(budget);
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  await prisma.budget.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
