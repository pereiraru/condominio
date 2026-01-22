import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const creditor = await prisma.creditor.findUnique({
      where: { id: params.id },
      include: {
        attachments: true,
        transactions: {
          orderBy: { date: 'desc' },
          take: 50,
        },
      },
    });

    if (!creditor) {
      return NextResponse.json({ error: 'Creditor not found' }, { status: 404 });
    }

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

    return NextResponse.json({
      ...creditor,
      totalPaid,
      avgMonthly,
    });
  } catch (error) {
    console.error('Error fetching creditor:', error);
    return NextResponse.json(
      { error: 'Failed to fetch creditor' },
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

    const creditor = await prisma.creditor.update({
      where: { id: params.id },
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

    return NextResponse.json(creditor);
  } catch (error) {
    console.error('Error updating creditor:', error);
    return NextResponse.json(
      { error: 'Failed to update creditor' },
      { status: 500 }
    );
  }
}
