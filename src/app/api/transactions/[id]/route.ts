import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: { unit: true, creditor: true, monthAllocations: true },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const data: Record<string, unknown> = {};
    if ('date' in body) data.date = new Date(body.date);
    if ('description' in body) data.description = body.description;
    if ('type' in body) data.type = body.type;
    if ('category' in body) data.category = body.category || null;
    if ('unitId' in body) data.unitId = body.unitId || null;
    if ('creditorId' in body) data.creditorId = body.creditorId || null;
    if ('referenceMonth' in body) data.referenceMonth = body.referenceMonth || null;

    // Update the transaction
    const transaction = await prisma.transaction.update({
      where: { id: params.id },
      data,
      include: { unit: true, creditor: true, monthAllocations: true },
    });

    // Handle month allocations if provided
    if ('monthAllocations' in body) {
      const allocations: { month: string; amount: number }[] = body.monthAllocations || [];

      // Delete existing allocations
      await prisma.transactionMonth.deleteMany({
        where: { transactionId: params.id },
      });

      // Create new allocations
      if (allocations.length > 0) {
        await prisma.transactionMonth.createMany({
          data: allocations.map((a) => ({
            transactionId: params.id,
            month: a.month,
            amount: a.amount,
          })),
        });
      }

      // Fetch updated transaction with new allocations
      const updated = await prisma.transaction.findUnique({
        where: { id: params.id },
        include: { unit: true, creditor: true, monthAllocations: true },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.transaction.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json(
      { error: 'Failed to delete transaction' },
      { status: 500 }
    );
  }
}
