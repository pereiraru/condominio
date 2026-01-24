import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const creditors = await prisma.creditor.findMany({
      orderBy: { name: 'asc' },
      include: {
        attachments: true,
        transactions: {
          select: { amount: true, date: true },
        },
      },
    });

    const result = creditors.map((creditor) => {
      const totalPaid = creditor.transactions.reduce(
        (sum, t) => sum + Math.abs(t.amount),
        0
      );
      const months = new Set(
        creditor.transactions.map((t) => {
          const d = new Date(t.date);
          return `${d.getFullYear()}-${d.getMonth()}`;
        })
      );
      const avgMonthly = months.size > 0 ? totalPaid / months.size : 0;

      return {
        id: creditor.id,
        name: creditor.name,
        description: creditor.description,
        category: creditor.category,
        amountDue: creditor.amountDue,
        email: creditor.email,
        telefone: creditor.telefone,
        nib: creditor.nib,
        attachments: creditor.attachments,
        totalPaid,
        avgMonthly,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching creditors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch creditors' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();

    const creditor = await prisma.creditor.create({
      data: {
        name: body.name,
        description: body.description || null,
        category: body.category,
        amountDue: body.amountDue ? parseFloat(body.amountDue) : null,
        email: body.email || null,
        telefone: body.telefone || null,
        nib: body.nib || null,
      },
      include: { attachments: true },
    });

    return NextResponse.json(creditor, { status: 201 });
  } catch (error) {
    console.error('Error creating creditor:', error);
    return NextResponse.json(
      { error: 'Failed to create creditor' },
      { status: 500 }
    );
  }
}
