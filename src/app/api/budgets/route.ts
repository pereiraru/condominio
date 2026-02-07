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
  const budget = await prisma.budget.create({
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

  return NextResponse.json(budget, { status: 201 });
}
