import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const year = request.nextUrl.searchParams.get('year');
  const creditorId = request.nextUrl.searchParams.get('creditorId');
  const isPaid = request.nextUrl.searchParams.get('isPaid');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (year) {
    where.date = {
      gte: new Date(`${year}-01-01`),
      lte: new Date(`${year}-12-31T23:59:59`),
    };
  }
  if (creditorId) where.creditorId = creditorId;
  if (isPaid !== null && isPaid !== undefined) where.isPaid = isPaid === 'true';

  const invoices = await prisma.supplierInvoice.findMany({
    where,
    include: { creditor: { select: { name: true, category: true } } },
    orderBy: [{ date: 'desc' }],
  });

  return NextResponse.json(invoices);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  const invoice = await prisma.supplierInvoice.create({
    data: {
      invoiceNumber: body.invoiceNumber || null,
      entryNumber: body.entryNumber || null,
      date: new Date(body.date),
      creditorId: body.creditorId,
      description: body.description,
      category: body.category,
      amountDue: body.amountDue,
      amountPaid: body.amountPaid || 0,
      isPaid: body.isPaid || false,
      transactionId: body.transactionId || null,
    },
    include: { creditor: { select: { name: true, category: true } } },
  });

  return NextResponse.json(invoice, { status: 201 });
}
