import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const budgets = await prisma.budget.findMany({
    include: { lines: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { year: 'desc' },
  });

  return NextResponse.json(budgets);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  const year = Number(body.year);
  if (!year || isNaN(year)) {
    return NextResponse.json({ error: 'Ano inválido' }, { status: 400 });
  }

  const linesData = (body.lines || []).map(
    (
      line: {
        category: string;
        description: string;
        monthlyAmount: number;
        annualAmount: number;
        percentage?: number;
        sortOrder?: number;
      },
      i: number
    ) => ({
      category: line.category || 'other',
      description: line.description,
      monthlyAmount: Number(line.monthlyAmount) || 0,
      annualAmount: Number(line.annualAmount) || 0,
      percentage: line.percentage != null ? Number(line.percentage) : null,
      sortOrder: line.sortOrder ?? i,
    })
  );

  const totalAnnual = linesData.reduce((sum: number, l: { annualAmount: number }) => sum + l.annualAmount, 0);
  const normalizedLines = linesData.map((l: { category: string; description: string; monthlyAmount: number; annualAmount: number; percentage: number | null; sortOrder: number }) => ({
    ...l,
    percentage: l.percentage ?? (totalAnnual > 0 ? Math.round((l.annualAmount / totalAnnual) * 1000) / 10 : 0),
  }));

  const budget = await prisma.$transaction(async (tx) => {
    const existing = await tx.budget.findUnique({ where: { year } });
    if (existing) {
      await tx.budgetLine.deleteMany({ where: { budgetId: existing.id } });
      return tx.budget.update({
        where: { id: existing.id },
        data: {
          notes: body.notes || null,
          lines: { create: normalizedLines },
        },
        include: { lines: { orderBy: { sortOrder: 'asc' } } },
      });
    }
    return tx.budget.create({
      data: {
        year,
        notes: body.notes || null,
        lines: { create: normalizedLines },
      },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
  });

  return NextResponse.json(budget, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const yearParam = request.nextUrl.searchParams.get('year');
  const idParam = request.nextUrl.searchParams.get('id');

  if (idParam) {
    await prisma.budget.delete({ where: { id: idParam } });
    return NextResponse.json({ ok: true });
  }
  if (yearParam) {
    await prisma.budget.delete({ where: { year: parseInt(yearParam, 10) } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'id ou year obrigatório' }, { status: 400 });
}
