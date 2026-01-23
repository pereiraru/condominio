import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFeeForMonth } from '@/lib/feeHistory';

export async function GET() {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const units = await prisma.unit.findMany({
      orderBy: { code: 'asc' },
      include: {
        owners: true,
        feeHistory: { orderBy: { effectiveFrom: 'asc' } },
        transactions: {
          where: { type: 'payment' },
          select: {
            monthAllocations: { select: { month: true, amount: true } },
          },
        },
      },
    });

    const result = units.map((unit) => {
      // Flatten all month allocations for this unit
      const allAllocations = unit.transactions.flatMap((t) => t.monthAllocations);

      // Calculate expected YTD (current year, up to current month)
      let expectedYTD = 0;
      for (let m = 1; m <= currentMonth; m++) {
        const monthStr = `${currentYear}-${m.toString().padStart(2, '0')}`;
        expectedYTD += getFeeForMonth(unit.feeHistory, monthStr, unit.monthlyFee);
      }

      // Calculate paid YTD (current year)
      const paidYTD = allAllocations
        .filter((a) => a.month.startsWith(`${currentYear}-`))
        .reduce((sum, a) => sum + a.amount, 0);

      // Calculate past years debt
      const pastYears = new Set<number>();
      allAllocations.forEach((a) => {
        const year = parseInt(a.month.split('-')[0]);
        if (year < currentYear) pastYears.add(year);
      });

      let pastYearsDebt = 0;
      for (const year of Array.from(pastYears)) {
        let expectedForYear = 0;
        for (let m = 1; m <= 12; m++) {
          const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
          expectedForYear += getFeeForMonth(unit.feeHistory, monthStr, unit.monthlyFee);
        }
        const paidForYear = allAllocations
          .filter((a) => a.month.startsWith(`${year}-`))
          .reduce((sum, a) => sum + a.amount, 0);
        pastYearsDebt += Math.max(0, expectedForYear - paidForYear);
      }

      const yearDebt = Math.max(0, expectedYTD - paidYTD);
      const totalOwed = yearDebt + pastYearsDebt;

      return {
        id: unit.id,
        code: unit.code,
        floor: unit.floor,
        description: unit.description,
        monthlyFee: unit.monthlyFee,
        nib: unit.nib,
        telefone: unit.telefone,
        email: unit.email,
        owners: unit.owners,
        totalPaid: paidYTD,
        totalOwed,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching units:', error);
    return NextResponse.json(
      { error: 'Failed to fetch units' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const unit = await prisma.unit.create({
      data: {
        code: body.code,
        floor: body.floor,
        description: body.description,
        monthlyFee: parseFloat(body.monthlyFee ?? '45'),
        nib: body.nib || null,
        telefone: body.telefone || null,
        email: body.email || null,
        owners: body.owners?.length
          ? {
              create: body.owners.map((name: string) => ({ name })),
            }
          : undefined,
      },
      include: { owners: true },
    });

    return NextResponse.json(unit, { status: 201 });
  } catch (error) {
    console.error('Error creating unit:', error);
    return NextResponse.json(
      { error: 'Failed to create unit' },
      { status: 500 }
    );
  }
}
