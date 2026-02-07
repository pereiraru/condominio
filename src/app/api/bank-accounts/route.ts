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
    include: { snapshots: { orderBy: { date: 'desc' }, take: 1 } },
    orderBy: { name: 'asc' },
  });

  const now = new Date();
  const currentYear = now.getFullYear();

  const transactions = await prisma.transaction.findMany({
    where: {
      category: 'savings',
      date: { gte: new Date(`${currentYear}-01-01`) }
    }
  });

  const result = accounts.map(account => {
    const latestSnapshot = account.snapshots[0];
    let balance = latestSnapshot?.balance ?? 0;

    if (account.accountType === 'savings' && latestSnapshot) {
      // Add reinforcements since the last snapshot
      const reinforcements = transactions
        .filter(tx => new Date(tx.date) > new Date(latestSnapshot.date))
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      balance += reinforcements;
    }

    return {
      ...account,
      currentBalance: balance,
    };
  });

  return NextResponse.json(result);
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
