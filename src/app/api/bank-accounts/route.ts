import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const accounts = await prisma.bankAccount.findMany({
    include: { snapshots: { orderBy: { date: 'desc' }, take: 5 } },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(accounts);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  const account = await prisma.bankAccount.create({
    data: {
      name: body.name,
      accountType: body.accountType,
      description: body.description || null,
    },
  });

  return NextResponse.json(account, { status: 201 });
}
