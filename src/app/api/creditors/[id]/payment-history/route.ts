import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { getTotalFeeForMonth, FeeHistoryRecord } from '@/lib/feeHistory';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const creditor = await prisma.creditor.findUnique({
      where: { id: params.id },
      include: {
        feeHistory: { orderBy: { effectiveFrom: 'asc' } },
      },
    });

    if (!creditor) {
      return NextResponse.json({ error: 'Creditor not found' }, { status: 404 });
    }

    // Get all month allocations for this creditor
    const allocations = await prisma.transactionMonth.findMany({
      where: {
        transaction: { creditorId: params.id },
      },
      select: { month: true, amount: true },
    });

    const currentYear = new Date().getFullYear();
    const payments: Record<string, number> = {};
    const expected: Record<string, number> = {};

    // Group paid amounts by month (using absolute value since expenses are negative)
    allocations.forEach((a) => {
      payments[a.month] = (payments[a.month] || 0) + Math.abs(a.amount);
    });

    // Determine years to cover
    const years = new Set<number>();
    allocations.forEach((a) => {
      const year = parseInt(a.month.split('-')[0]);
      years.add(year);
    });
    
    // Add years from fee history
    creditor.feeHistory.forEach(fh => {
      const startYear = parseInt(fh.effectiveFrom.split('-')[0]);
      const endYear = fh.effectiveTo ? parseInt(fh.effectiveTo.split('-')[0]) : currentYear;
      for (let y = startYear; y <= endYear; y++) years.add(y);
    });
    
    years.add(currentYear);
    years.add(2024); // System start

    const sortedYears = Array.from(years).sort((a, b) => a - b);
    const yearlyData = [];
    let accumulatedDebt = 0;

    for (const year of sortedYears) {
      let yearPaid = 0;
      let yearExpected = 0;

      for (let m = 1; m <= 12; m++) {
        const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
        
        // Only calculate expected for fixed expenses
        let monthExpected = 0;
        if (creditor.isFixed) {
          const feeData = getTotalFeeForMonth(
            creditor.feeHistory as FeeHistoryRecord[],
            [],
            monthStr,
            creditor.amountDue || 0
          );
          monthExpected = feeData.total;
        }

        expected[monthStr] = monthExpected;
        yearExpected += monthExpected;
        yearPaid += payments[monthStr] || 0;
      }

      accumulatedDebt = Math.max(0, accumulatedDebt + yearExpected - yearPaid);
      yearlyData.push({
        year,
        paid: yearPaid,
        expected: yearExpected,
        debt: Math.max(0, yearExpected - yearPaid),
        accumulatedDebt,
      });
    }

    return NextResponse.json({
      payments,
      expected,
      yearlyData,
    });
  } catch (error) {
    console.error('Error fetching creditor payment history:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
