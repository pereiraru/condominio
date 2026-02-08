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
    // Get all creditors to build pattern matching
    const creditors = await prisma.creditor.findMany();
    const creditorByName: Record<string, string> = {};
    for (const c of creditors) {
      creditorByName[c.name] = c.id;
    }

    // Get any existing description mappings
    const mappings = await prisma.descriptionMapping.findMany();

    // Built-in patterns for known creditor descriptions
    // Maps description patterns to creditor names
    const builtInPatterns: { pattern: string; creditorName: string; category?: string; type?: string }[] = [
      // Savings
      { pattern: 'POUPANÇA', creditorName: 'Conta Poupança', category: 'savings', type: 'transfer' },
      { pattern: '027-15.010650-1', creditorName: 'Conta Poupança', category: 'savings', type: 'transfer' },
      // Elevator
      { pattern: 'OTIS', creditorName: 'Otis Elevadores' },
      // Electricity
      { pattern: 'ENDESA', creditorName: 'Endesa Energia' },
      // Cleaning
      { pattern: 'LUAR', creditorName: 'Luar Limpeza' },
      // Bank fees
      { pattern: 'EMISS', creditorName: 'Despesas Bancárias' },
      { pattern: 'I.SELO', creditorName: 'Despesas Bancárias' },
      { pattern: 'IMP.SELO', creditorName: 'Despesas Bancárias' },
      { pattern: 'COMISS', creditorName: 'Despesas Bancárias' },
      { pattern: 'COM. MAN', creditorName: 'Despesas Bancárias' },
      { pattern: 'CONDOM', creditorName: 'Despesas Bancárias' },
      // Extinguishers
      { pattern: 'EXTINTORES', creditorName: 'JCSS Unipessoal - Extintores' },
    ];

    // Get all unassigned transactions (no creditorId, no unitId)
    const unassigned = await prisma.transaction.findMany({
      where: {
        creditorId: null,
        unitId: null,
      },
      include: {
        monthAllocations: { take: 1 },
      },
      orderBy: { date: 'asc' },
    });

    let assignedCount = 0;
    let allocatedCount = 0;
    let skippedSavings = 0;
    const details: { description: string; creditor: string; month: string }[] = [];

    for (const tx of unassigned) {
      const descUpper = tx.description.toUpperCase();

      // 1. Try built-in patterns first
      let matchedCreditorId: string | null = null;
      let matchedCategory: string | null = null;
      let matchedType: string | null = null;

      for (const bp of builtInPatterns) {
        if (descUpper.includes(bp.pattern.toUpperCase())) {
          matchedCreditorId = creditorByName[bp.creditorName] || null;
          matchedCategory = bp.category || null;
          matchedType = bp.type || null;
          break;
        }
      }

      // 2. Try description mappings as fallback
      if (!matchedCreditorId && !matchedCategory) {
        const mapping = mappings.find(m =>
          descUpper.includes(m.pattern.toUpperCase())
        );
        if (mapping) {
          matchedCreditorId = mapping.creditorId;
          if (mapping.unitId && tx.amount > 0) {
            // Income with unit mapping
            await prisma.transaction.update({
              where: { id: tx.id },
              data: { unitId: mapping.unitId },
            });
            assignedCount++;

            // Create allocation if none exists
            if (tx.monthAllocations.length === 0) {
              const txMonth = tx.date.toISOString().substring(0, 7);
              await prisma.transactionMonth.create({
                data: { transactionId: tx.id, month: txMonth, amount: tx.amount },
              });
              allocatedCount++;
            }
            continue;
          }
        }
      }

      if (!matchedCreditorId && !matchedCategory) continue;

      // Handle savings transfers
      if (matchedCategory === 'savings') {
        if (tx.category !== 'savings') {
          await prisma.transaction.update({
            where: { id: tx.id },
            data: {
              category: 'savings',
              type: matchedType || 'transfer',
              ...(matchedCreditorId ? { creditorId: matchedCreditorId } : {}),
            },
          });
          skippedSavings++;
          assignedCount++;
        }
        continue;
      }

      // Update the transaction with creditor
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = {};
      if (matchedCreditorId) updateData.creditorId = matchedCreditorId;
      if (matchedType) updateData.type = matchedType;

      await prisma.transaction.update({
        where: { id: tx.id },
        data: updateData,
      });
      assignedCount++;

      // Create month allocation if expense with creditor and no existing allocation
      if (tx.amount < 0 && matchedCreditorId && tx.monthAllocations.length === 0) {
        const txMonth = tx.date.toISOString().substring(0, 7);
        await prisma.transactionMonth.create({
          data: {
            transactionId: tx.id,
            month: txMonth,
            amount: tx.amount,
          },
        });
        allocatedCount++;

        const creditor = creditors.find(c => c.id === matchedCreditorId);
        details.push({
          description: tx.description.substring(0, 40),
          creditor: creditor?.name || 'Unknown',
          month: txMonth,
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalUnassigned: unassigned.length,
      assigned: assignedCount,
      allocated: allocatedCount,
      skippedSavings,
      details: details.slice(0, 30),
    });
  } catch (error) {
    console.error('Error auto-assigning transactions:', error);
    return NextResponse.json({ error: 'Failed to auto-assign' }, { status: 500 });
  }
}
