import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    // Get all description mappings
    const mappings = await prisma.descriptionMapping.findMany();

    // Get all unassigned expense transactions (no creditorId, no unitId)
    const unassigned = await prisma.transaction.findMany({
      where: {
        creditorId: null,
        unitId: null,
        category: { not: 'savings' },
      },
      orderBy: { date: 'asc' },
    });

    let assignedCount = 0;
    let allocatedCount = 0;
    const details: { description: string; creditor: string; month: string }[] = [];

    for (const tx of unassigned) {
      // Check savings pattern first
      if (tx.description.includes('POUPANÇA') || tx.description.includes('027-15.010650-1')) {
        await prisma.transaction.update({
          where: { id: tx.id },
          data: { category: 'savings', type: 'transfer' },
        });
        assignedCount++;
        continue;
      }

      // Try to match description against mappings
      const mapping = mappings.find(m =>
        tx.description.toUpperCase().includes(m.pattern.toUpperCase())
      );

      if (!mapping) continue;

      const updateData: Record<string, string | null> = {};
      if (mapping.creditorId) updateData.creditorId = mapping.creditorId;
      if (mapping.unitId) updateData.unitId = mapping.unitId;

      // Update the transaction
      await prisma.transaction.update({
        where: { id: tx.id },
        data: updateData,
      });
      assignedCount++;

      // If it's an expense with a creditor, create a month allocation
      if (tx.amount < 0 && mapping.creditorId) {
        const txMonth = tx.date.toISOString().substring(0, 7);

        // Check if allocation already exists
        const existing = await prisma.transactionMonth.findFirst({
          where: { transactionId: tx.id },
        });

        if (!existing) {
          await prisma.transactionMonth.create({
            data: {
              transactionId: tx.id,
              month: txMonth,
              amount: tx.amount, // Keep negative for expenses
            },
          });
          allocatedCount++;

          const creditor = await prisma.creditor.findUnique({
            where: { id: mapping.creditorId },
            select: { name: true },
          });
          details.push({
            description: tx.description.substring(0, 40),
            creditor: creditor?.name || 'Unknown',
            month: txMonth,
          });
        }
      }

      // If it's income with a unit, create a month allocation
      if (tx.amount > 0 && mapping.unitId) {
        const txMonth = tx.date.toISOString().substring(0, 7);

        const existing = await prisma.transactionMonth.findFirst({
          where: { transactionId: tx.id },
        });

        if (!existing) {
          await prisma.transactionMonth.create({
            data: {
              transactionId: tx.id,
              month: txMonth,
              amount: tx.amount,
            },
          });
          allocatedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      totalUnassigned: unassigned.length,
      assigned: assignedCount,
      allocated: allocatedCount,
      details: details.slice(0, 20), // Return sample
    });
  } catch (error) {
    console.error('Error auto-assigning transactions:', error);
    return NextResponse.json({ error: 'Failed to auto-assign' }, { status: 500 });
  }
}
