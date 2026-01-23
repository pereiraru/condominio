import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') ?? '50');
    const offset = parseInt(searchParams.get('offset') ?? '0');
    const unitId = searchParams.get('unitId');
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const creditorId = searchParams.get('creditorId');
    const unassigned = searchParams.get('unassigned');

    const where: Record<string, unknown> = {};

    if (unassigned === 'true') {
      where.unitId = null;
      where.creditorId = null;
    } else {
      if (unitId) where.unitId = unitId;
      if (creditorId) where.creditorId = creditorId;
    }
    if (type) where.type = type;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) (where.date as Record<string, Date>).gte = new Date(startDate);
      if (endDate) (where.date as Record<string, Date>).lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { unit: true, creditor: true, monthAllocations: true },
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.transaction.count({ where }),
    ]);

    return NextResponse.json({ transactions, total, limit, offset });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const months: string[] = body.months || [];
    const totalAmount = parseFloat(body.amount);

    // Create a single transaction
    const transaction = await prisma.transaction.create({
      data: {
        date: new Date(body.date),
        valueDate: body.valueDate ? new Date(body.valueDate) : null,
        description: body.description,
        amount: totalAmount,
        balance: body.balance ? parseFloat(body.balance) : null,
        type: body.type,
        category: body.category || null,
        referenceMonth: months.length === 1 ? months[0] : (body.referenceMonth || null),
        unitId: body.unitId || null,
        creditorId: body.creditorId || null,
      },
    });

    // Create month allocations if months specified
    if (months.length > 0) {
      const perMonth = Math.abs(totalAmount) / months.length;
      await prisma.transactionMonth.createMany({
        data: months.map((month) => ({
          transactionId: transaction.id,
          month,
          amount: perMonth,
        })),
      });
    }

    const result = await prisma.transaction.findUnique({
      where: { id: transaction.id },
      include: { unit: true, creditor: true, monthAllocations: true },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}
