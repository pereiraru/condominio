import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    // Get all allocations grouped by month
    const allAllocations = await prisma.transactionMonth.findMany({
      include: {
        transaction: {
          select: { id: true, amount: true, creditorId: true, unitId: true, category: true, date: true },
        },
      },
    });

    // Build monthly summary from allocations
    const monthMap: Record<string, { income: number; expenses: number }> = {};

    // Track which transactions have allocations to avoid double-counting
    const transactionsWithAllocations = new Set<string>();

    for (const alloc of allAllocations) {
      const month = alloc.month;
      if (!month || month === 'PREV-DEBT') continue;

      if (!monthMap[month]) {
        monthMap[month] = { income: 0, expenses: 0 };
      }

      transactionsWithAllocations.add(alloc.transaction.id);

      if (alloc.transaction.amount > 0) {
        // Income allocation
        monthMap[month].income += alloc.amount;
      } else {
        // Expense allocation
        monthMap[month].expenses += Math.abs(alloc.amount);
      }
    }

    // Also include expense transactions without allocations
    // Group them by their transaction date month
    const unallocatedExpenses = await prisma.transaction.findMany({
      where: {
        amount: { lt: 0 },
        monthAllocations: { none: {} },
      },
    });

    // Build a set of assigned expense keys for deduplication
    // (transactions with creditorId or category that have a matching unassigned copy)
    const allExpenses = await prisma.transaction.findMany({
      where: { amount: { lt: 0 } },
      select: { id: true, date: true, amount: true, creditorId: true, category: true },
    });

    const assignedExpenseKeys = new Set<string>();
    for (const tx of allExpenses) {
      if (tx.creditorId || tx.category) {
        const dateKey = tx.date.toISOString().split('T')[0];
        assignedExpenseKeys.add(`${dateKey}|${tx.amount}`);
      }
    }

    for (const tx of unallocatedExpenses) {
      // Skip if this is an unassigned duplicate of an assigned transaction
      if (!tx.creditorId && !tx.category) {
        const dateKey = tx.date.toISOString().split('T')[0];
        if (assignedExpenseKeys.has(`${dateKey}|${tx.amount}`)) continue;
      }

      // Skip savings
      if (tx.category === 'savings') continue;

      const month = tx.date.toISOString().substring(0, 7);
      if (!monthMap[month]) {
        monthMap[month] = { income: 0, expenses: 0 };
      }
      monthMap[month].expenses += Math.abs(tx.amount);
    }

    // Also include unallocated income transactions
    const unallocatedIncome = await prisma.transaction.findMany({
      where: {
        amount: { gt: 0 },
        monthAllocations: { none: {} },
      },
    });

    for (const tx of unallocatedIncome) {
      const month = tx.date.toISOString().substring(0, 7);
      if (!monthMap[month]) {
        monthMap[month] = { income: 0, expenses: 0 };
      }
      monthMap[month].income += tx.amount;
    }

    // Convert to sorted array
    const data = Object.entries(monthMap)
      .map(([month, { income, expenses }]) => ({
        month,
        income: Math.round(income * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
        balance: Math.round((income - expenses) * 100) / 100,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error generating monthly summary:', error);
    return NextResponse.json({ error: 'Failed to generate monthly summary' }, { status: 500 });
  }
}
