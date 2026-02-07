import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const snapshots = await prisma.bankAccountSnapshot.findMany({
    where: { bankAccountId: params.id },
    orderBy: { date: 'desc' },
  });

  return NextResponse.json(snapshots);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  const snapshot = await prisma.bankAccountSnapshot.create({
    data: {
      bankAccountId: params.id,
      date: new Date(body.date),
      balance: body.balance,
      description: body.description || null,
    },
  });

  return NextResponse.json(snapshot, { status: 201 });
}
