import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions, canAccessUnit } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!canAccessUnit(session?.user?.role, session?.user?.unitId, params.id)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const unit = await prisma.unit.findUnique({
      where: { id: params.id },
      include: {
        owners: true,
        descriptionMappings: true,
        transactions: {
          orderBy: { date: 'desc' },
          take: 50,
          include: { monthAllocations: true },
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

    // Calculate paid for current month using monthAllocations
    const totalPaidCurrentMonth = unit.transactions
      .filter((t) => t.type === 'payment')
      .flatMap((t) => t.monthAllocations)
      .filter((a) => a.month === currentMonth)
      .reduce((sum, a) => sum + a.amount, 0);
    const totalOwedCurrentMonth = Math.max(0, unit.monthlyFee - totalPaidCurrentMonth);

    // Calculate Pre-2024 Debt details
    const pre2024InitialDebt = unit.owners.reduce((sum, o) => sum + (o.previousDebt || 0), 0);
    
    // Fetch all PREV-DEBT allocations for this unit
    const prevDebtAllocations = await prisma.transactionMonth.findMany({
      where: {
        month: 'PREV-DEBT',
        transaction: { unitId: params.id }
      },
      select: { amount: true }
    });
    const pre2024Paid = prevDebtAllocations.reduce((sum, a) => sum + a.amount, 0);
    const pre2024Remaining = Math.max(0, pre2024InitialDebt - pre2024Paid);

    return NextResponse.json({
      ...unit,
      totalPaid: totalPaidCurrentMonth,
      totalOwed: totalOwedCurrentMonth,
      pre2024: {
        initial: pre2024InitialDebt,
        paid: pre2024Paid,
        remaining: pre2024Remaining
      }
    });
  } catch (error) {
    console.error('Error fetching unit:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unit' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const newFee = parseFloat(body.monthlyFee ?? '45');

    // Check if monthlyFee has changed
    const existingUnit = await prisma.unit.findUnique({ where: { id: params.id } });
    if (existingUnit && existingUnit.monthlyFee !== newFee) {
      const now = new Date();
      const effectiveFrom = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
      await prisma.feeHistory.create({
        data: {
          unitId: params.id,
          amount: newFee,
          effectiveFrom,
        },
      });
    }

    // Update unit fields
    await prisma.unit.update({
      where: { id: params.id },
      data: {
        code: body.code,
        floor: body.floor != null ? parseInt(body.floor) : null,
        description: body.description || null,
        monthlyFee: newFee,
        nib: body.nib || null,
        telefone: body.telefone || null,
        email: body.email || null,
      },
    });

    // Update owners as objects with period fields
    if (body.owners !== undefined) {
      const incomingOwners = body.owners as {
        id?: string;
        name: string;
        email?: string | null;
        telefone?: string | null;
        nib?: string | null;
        startMonth?: string | null;
        endMonth?: string | null;
        previousDebt?: number;
      }[];

      // Get existing owner IDs
      const existingOwners = await prisma.owner.findMany({
        where: { unitId: params.id },
        select: { id: true },
      });
      const existingIds = new Set(existingOwners.map((o) => o.id));
      const incomingIds = new Set(incomingOwners.filter((o) => o.id).map((o) => o.id!));

      // Delete owners that are no longer present
      const toDelete = Array.from(existingIds).filter((id) => !incomingIds.has(id));
      if (toDelete.length > 0) {
        await prisma.owner.deleteMany({
          where: { id: { in: toDelete } },
        });
      }

      // Update existing and create new
      for (const owner of incomingOwners) {
        if (!owner.name.trim()) continue;
        const data = {
          name: owner.name.trim(),
          email: owner.email || null,
          telefone: owner.telefone || null,
          nib: owner.nib || null,
          startMonth: owner.startMonth || null,
          endMonth: owner.endMonth || null,
          previousDebt: owner.previousDebt != null ? owner.previousDebt : 0,
          unitId: params.id,
        };

        if (owner.id && existingIds.has(owner.id)) {
          await prisma.owner.update({
            where: { id: owner.id },
            data,
          });
        } else {
          await prisma.owner.create({ data });
        }
      }
    }

    const updated = await prisma.unit.findUnique({
      where: { id: params.id },
      include: { owners: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating unit:', error);
    return NextResponse.json(
      { error: 'Failed to update unit' },
      { status: 500 }
    );
  }
}
