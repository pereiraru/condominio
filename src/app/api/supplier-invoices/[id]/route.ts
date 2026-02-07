import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const invoice = await prisma.supplierInvoice.findUnique({
    where: { id: params.id },
    include: { creditor: { select: { name: true, category: true } } },
  });

  if (!invoice) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(invoice);
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  const invoice = await prisma.supplierInvoice.update({
    where: { id: params.id },
    data: {
      invoiceNumber: body.invoiceNumber,
      entryNumber: body.entryNumber,
      date: body.date ? new Date(body.date) : undefined,
      description: body.description,
      category: body.category,
      amountDue: body.amountDue,
      amountPaid: body.amountPaid,
      isPaid: body.isPaid,
      transactionId: body.transactionId,
    },
    include: { creditor: { select: { name: true, category: true } } },
  });

  return NextResponse.json(invoice);
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  await prisma.supplierInvoice.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
