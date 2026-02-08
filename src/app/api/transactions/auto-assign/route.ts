import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { getFeeForMonth, FeeHistoryRecord } from '@/lib/feeHistory';

// Normalize a name for fuzzy matching: remove accents, garbled chars, uppercase, collapse spaces
function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove combining diacritical marks
    .replace(/[^\w\s.\-]/g, '')      // remove garbled CP1252 chars (¸¶¿ø etc.), keep dots/hyphens
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if two words are similar (handles garbled encoding, truncation)
function wordSimilar(a: string, b: string): boolean {
  if (a === b) return true;
  // Prefix match (handles truncation like "SIL" for "SILVA")
  if (a.startsWith(b) || b.startsWith(a)) return true;
  // Substring containment (handles garbled chars removing middle letters)
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length >= 3 && longer.includes(shorter)) return true;
  // Subsequence check: all chars of shorter appear in order in longer
  // Handles cases like "CONCEIO" matching "CONCEICAO" (missing chars from garbled encoding)
  if (shorter.length >= 3) {
    let j = 0;
    for (let i = 0; i < longer.length && j < shorter.length; i++) {
      if (longer[i] === shorter[j]) j++;
    }
    if (j === shorter.length && shorter.length >= longer.length * 0.6) return true;
  }
  return false;
}

// Check if two names match using word overlap (handles truncation, garbled chars, middle-name differences)
function namesMatch(bankName: string, ownerPattern: string): boolean {
  // Direct prefix match
  if (bankName.startsWith(ownerPattern) || ownerPattern.startsWith(bankName)) {
    const minLen = Math.min(bankName.length, ownerPattern.length);
    if (minLen >= 3) return true;
  }

  const bankWords = bankName.split(' ').filter(w => w.length >= 2);
  const ownerWords = ownerPattern.split(' ').filter(w => w.length >= 2);

  if (bankWords.length < 2 || ownerWords.length < 2) return false;

  // First word must be similar (not exact — handles garbled first names like LUS→LUIS)
  if (!wordSimilar(bankWords[0], ownerWords[0])) return false;

  // Count matching words beyond the first name
  const shorter = bankWords.length <= ownerWords.length ? bankWords : ownerWords;
  const longer = bankWords.length <= ownerWords.length ? ownerWords : bankWords;

  let wordMatches = 0;
  for (const word of shorter.slice(1)) {
    if (longer.some(w => wordSimilar(word, w))) {
      wordMatches++;
    }
  }

  // Need at least 2 matching words for 3+ word names, 1 for 2-word names
  const threshold = shorter.length <= 2 ? 1 : 2;
  return wordMatches >= threshold;
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

    // Get all units with fee history for expected fee calculation
    const units = await prisma.unit.findMany({
      include: { feeHistory: true },
    });
    const unitById: Record<string, typeof units[0]> = {};
    for (const u of units) {
      unitById[u.id] = u;
    }

    // Get all owners (current and past) to match income transactions
    const owners = await prisma.owner.findMany({
      include: { unit: true },
    });

    // Build owner name patterns: map normalized name to unitId
    const ownerPatterns: { pattern: string; unitId: string; ownerName: string; unitCode: string }[] = [];
    for (const owner of owners) {
      if (!owner.unit) continue;
      const normalized = normalizeName(owner.name);
      ownerPatterns.push({
        pattern: normalized,
        unitId: owner.unitId,
        ownerName: owner.name,
        unitCode: owner.unit.code,
      });
    }

    // Get all existing month allocations for income (to know which months are already paid)
    const existingAllocations = await prisma.transactionMonth.findMany({
      where: {
        transaction: { amount: { gt: 0 } },
        month: { not: 'PREV-DEBT' },
      },
      include: {
        transaction: { select: { unitId: true } },
      },
    });

    // Build a set of paid month keys: "unitId|YYYY-MM" -> total paid
    const paidMonthTotals: Record<string, number> = {};
    for (const alloc of existingAllocations) {
      if (!alloc.transaction.unitId) continue;
      const key = `${alloc.transaction.unitId}|${alloc.month}`;
      paidMonthTotals[key] = (paidMonthTotals[key] || 0) + alloc.amount;
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
    let needsManualAllocation = 0;
    const details: { description: string; assignedTo: string; month: string; status: string }[] = [];

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

        // Sort patterns by length descending to match longest (most specific) first
        const sortedPatterns = [...ownerPatterns].sort((a, b) => b.pattern.length - a.pattern.length);

        for (const op of sortedPatterns) {
          if (namesMatch(nameFromDesc, op.pattern)) {
            matchedUnitId = op.unitId;
            break;
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
        const unit = unitById[matchedUnitId];
        const txMonth = tx.date.toISOString().substring(0, 7);
        const unitCode = unit?.code || '?';
        const ownerMatch = ownerPatterns.find(op => op.unitId === matchedUnitId);
        const ownerName = ownerMatch?.ownerName || '';

        // Get expected fee for this month
        const feeHistory = (unit?.feeHistory || []) as FeeHistoryRecord[];
        const expectedFee = getFeeForMonth(feeHistory, txMonth, unit?.monthlyFee || 0);

        // Assign to unit
        await prisma.transaction.update({
          where: { id: tx.id },
          data: { unitId: matchedUnitId, type: 'payment' },
        });
        assignedCount++;
        ownerMatchCount++;

        // Only auto-allocate if:
        // 1. No existing allocation
        // 2. Amount matches expected fee (within 0.01€ tolerance)
        // 3. That month is not already fully paid
        if (tx.monthAllocations.length === 0) {
          const amountMatchesFee = Math.abs(tx.amount - expectedFee) < 0.01;
          const paidKey = `${matchedUnitId}|${txMonth}`;
          const alreadyPaid = (paidMonthTotals[paidKey] || 0) >= expectedFee - 0.01;

          if (amountMatchesFee && !alreadyPaid) {
            // Amount matches expected fee → auto-allocate to this month
            await prisma.transactionMonth.create({
              data: { transactionId: tx.id, month: txMonth, amount: tx.amount },
            });
            allocatedCount++;
            // Update our tracking so subsequent transactions for same unit/month know it's paid
            paidMonthTotals[paidKey] = (paidMonthTotals[paidKey] || 0) + tx.amount;

            details.push({
              description: tx.description.substring(0, 40),
              assignedTo: `${unitCode} (${ownerName})`,
              month: txMonth,
              status: 'auto-alocado',
            });
          } else {
            // Amount doesn't match expected fee → needs manual allocation
            needsManualAllocation++;
            details.push({
              description: tx.description.substring(0, 40),
              assignedTo: `${unitCode} (${ownerName})`,
              month: txMonth,
              status: amountMatchesFee ? 'mês já pago' : `valor ≠ esperado (${expectedFee}€)`,
            });
          }
        }
        continue;
      }

      if (!matchedCreditorId && !matchedCategory) continue;

      // Handle savings transfers
      if (matchedCategory === 'savings') {
        const needsUpdate = tx.category !== 'savings' || (!tx.creditorId && matchedCreditorId);
        if (needsUpdate) {
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
          status: 'auto-alocado',
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
      needsManualAllocation,
      details: details.slice(0, 50),
    });
  } catch (error) {
    console.error('Error auto-assigning transactions:', error);
    return NextResponse.json({ error: 'Failed to auto-assign' }, { status: 500 });
  }
}
