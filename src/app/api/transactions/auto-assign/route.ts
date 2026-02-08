import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// Normalize a name for fuzzy matching: remove accents, lowercase, strip prefixes
function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

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

    // Get all owners (current and past) to match income transactions
    const owners = await prisma.owner.findMany({
      include: { unit: true },
    });

    // Build owner name patterns: map normalized name fragments to unitId
    // We use the first 3+ words of the name for matching against bank descriptions
    const ownerPatterns: { pattern: string; unitId: string; ownerName: string; unitCode: string }[] = [];
    for (const owner of owners) {
      if (!owner.unit) continue;
      const normalized = normalizeName(owner.name);
      // Use full normalized name
      ownerPatterns.push({
        pattern: normalized,
        unitId: owner.unitId,
        ownerName: owner.name,
        unitCode: owner.unit.code,
      });
      // Also add individual significant words (3+ chars) for partial matching
      // Bank descriptions often truncate names
    }

    // Get any existing description mappings
    const mappings = await prisma.descriptionMapping.findMany();

    // Built-in patterns for known creditor descriptions
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
    let ownerMatchCount = 0;
    const details: { description: string; assignedTo: string; month: string }[] = [];

    for (const tx of unassigned) {
      const descUpper = tx.description.toUpperCase();
      const descNormalized = normalizeName(tx.description);

      // 1. Try built-in creditor patterns first (for expenses)
      let matchedCreditorId: string | null = null;
      let matchedCategory: string | null = null;
      let matchedType: string | null = null;
      let matchedUnitId: string | null = null;

      for (const bp of builtInPatterns) {
        if (descUpper.includes(bp.pattern.toUpperCase())) {
          matchedCreditorId = creditorByName[bp.creditorName] || null;
          matchedCategory = bp.category || null;
          matchedType = bp.type || null;
          break;
        }
      }

      // 2. Try owner name matching for income transactions
      if (!matchedCreditorId && !matchedCategory && tx.amount > 0) {
        // Strip common bank transfer prefixes to get the name part
        const nameFromDesc = descNormalized
          .replace(/^TR-IPS-/, '')
          .replace(/^TRF\.DE\s+/, '')
          .replace(/^TRF\.CRED\s+/, '')
          .replace(/^TRF\.\s+/, '')
          .replace(/^TR-/, '')
          .trim();

        // Try to match against owner names
        // Sort patterns by length descending to match longest (most specific) first
        const sortedPatterns = [...ownerPatterns].sort((a, b) => b.pattern.length - a.pattern.length);

        for (const op of sortedPatterns) {
          // Check if the bank description name starts with the owner name
          // (bank descriptions often truncate long names)
          if (nameFromDesc.startsWith(op.pattern) || op.pattern.startsWith(nameFromDesc)) {
            // Ensure a minimum match quality (at least 3 characters matching)
            const minLen = Math.min(nameFromDesc.length, op.pattern.length);
            if (minLen >= 3) {
              matchedUnitId = op.unitId;
              details.push({
                description: tx.description.substring(0, 40),
                assignedTo: `${op.unitCode} (${op.ownerName})`,
                month: tx.date.toISOString().substring(0, 7),
              });
              break;
            }
          }
        }
      }

      // 3. Try description mappings as fallback
      if (!matchedCreditorId && !matchedCategory && !matchedUnitId) {
        const mapping = mappings.find(m =>
          descUpper.includes(m.pattern.toUpperCase())
        );
        if (mapping) {
          if (mapping.unitId && tx.amount > 0) {
            matchedUnitId = mapping.unitId;
          } else if (mapping.creditorId) {
            matchedCreditorId = mapping.creditorId;
          }
        }
      }

      // Apply unit match (income from owner)
      if (matchedUnitId) {
        await prisma.transaction.update({
          where: { id: tx.id },
          data: { unitId: matchedUnitId, type: 'payment' },
        });
        assignedCount++;
        ownerMatchCount++;

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
          assignedTo: creditor?.name || 'Unknown',
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
      ownerMatches: ownerMatchCount,
      details: details.slice(0, 50),
    });
  } catch (error) {
    console.error('Error auto-assigning transactions:', error);
    return NextResponse.json({ error: 'Failed to auto-assign' }, { status: 500 });
  }
}
