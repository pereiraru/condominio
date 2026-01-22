import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get latest balance
    const latestTransaction = await prisma.transaction.findFirst({
      orderBy: { date: 'desc' },
      where: { balance: { not: null } },
    });

    // Get this month's transactions
    const thisMonthTransactions = await prisma.transaction.findMany({
      where: { date: { gte: startOfMonth } },
    });

    // Get last month's transactions for comparison
    const lastMonthTransactions = await prisma.transaction.findMany({
      where: {
        date: {
          gte: startOfLastMonth,
          lte: endOfLastMonth,
        },
      },
    });

    // Calculate stats
    const monthlyIncome = thisMonthTransactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const monthlyExpenses = thisMonthTransactions
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const lastMonthIncome = lastMonthTransactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    // Balance trend
    const balanceTrend =
      lastMonthIncome > 0
        ? ((monthlyIncome - lastMonthIncome) / lastMonthIncome) * 100
        : 0;

    // Count units without payment this month
    const units = await prisma.unit.findMany();
    const paidUnitsThisMonth = new Set(
      thisMonthTransactions
        .filter((t) => t.amount > 0 && t.unitId)
        .map((t) => t.unitId)
    );
    const pendingPayments = units.filter(
      (u) => !paidUnitsThisMonth.has(u.id)
    ).length;

    return NextResponse.json({
      currentBalance: latestTransaction?.balance ?? 0,
      balanceTrend,
      monthlyIncome,
      monthlyExpenses,
      pendingPayments,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
