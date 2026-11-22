import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { getFeeForMonth, FeeHistoryRecord } from '@/lib/feeHistory';

const round2 = (value: number) => Math.round(value * 100) / 100;

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const creditors = await prisma.creditor.findMany({
      orderBy: { name: 'asc' },
      include: {
        attachments: true,
        feeHistory: { orderBy: { effectiveFrom: 'asc' } },
        supplierInvoices: {
          select: { id: true, amountDue: true, amountPaid: true, isPaid: true },
        },
        transactions: {
          select: { amount: true, date: true, monthAllocations: { select: { amount: true, month: true } } },
        },
      },
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentYearPrefix = `${currentYear}-`;
    const currentMonthStr = `${currentYear}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

    const result = creditors.map((creditor) => {
      const totalPaid = round2(
        creditor.transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0)
      );

      let paidThisMonthRaw = 0;
      let paidThisYearRaw = 0;

      for (const t of creditor.transactions) {
        if (t.monthAllocations.length > 0) {
          for (const a of t.monthAllocations) {
            if (a.month === currentMonthStr) paidThisMonthRaw += a.amount;
            if (a.month.startsWith(currentYearPrefix)) paidThisYearRaw += a.amount;
          }
        } else {
          const d = new Date(t.date);
          const txMonth = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
          if (txMonth === currentMonthStr) paidThisMonthRaw += t.amount;
          if (d.getFullYear() === currentYear) paidThisYearRaw += t.amount;
        }
      }

      const paidThisMonth = round2(Math.abs(paidThisMonthRaw));
      const paidThisYear = round2(Math.abs(paidThisYearRaw));

      const months = new Set(
        creditor.transactions.map((t) => {
          const d = new Date(t.date);
          return `${d.getFullYear()}-${d.getMonth()}`;
        })
      );
      const avgMonthly = round2(months.size > 0 ? totalPaid / months.size : 0);

      const currentAmountDue = creditor.isFixed
        ? round2(
            getFeeForMonth(
              creditor.feeHistory as FeeHistoryRecord[],
              currentMonthStr,
              creditor.amountDue || 0
            )
          )
        : creditor.amountDue !== null && creditor.amountDue !== undefined
          ? round2(creditor.amountDue)
          : null;

      const pendingInvoices = creditor.supplierInvoices.filter((inv) => !inv.isPaid);
      const pendingInvoicesCount = pendingInvoices.length;
      const pendingInvoicesTotal = round2(
        pendingInvoices.reduce(
          (sum, inv) => sum + Math.max(0, (inv.amountDue ?? 0) - (inv.amountPaid ?? 0)),
          0
        )
      );
      const totalInvoicesCount = creditor.supplierInvoices.length;

      return {
        id: creditor.id,
        name: creditor.name,
        description: creditor.description,
        category: creditor.category,
        amountDue: creditor.amountDue,
        currentAmountDue,
        isFixed: creditor.isFixed,
        email: creditor.email,
        telefone: creditor.telefone,
        nib: creditor.nib,
        attachments: creditor.attachments,
        totalPaid,
        avgMonthly,
        paidThisMonth,
        paidThisYear,
        pendingInvoicesCount,
        pendingInvoicesTotal,
        totalInvoicesCount,
      };
    });

    const getSortTier = (c: (typeof result)[number]) => {
      if (c.isFixed) return 0;
      if (c.pendingInvoicesCount > 0 || c.paidThisYear > 0) return 1;
      return 2;
    };

    result.sort((a, b) => {
      const tierDiff = getSortTier(a) - getSortTier(b);
      if (tierDiff !== 0) return tierDiff;
      return a.name.localeCompare(b.name, 'pt-PT');
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching creditors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch creditors' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();

    const creditor = await prisma.creditor.create({
      data: {
        name: body.name,
        description: body.description || null,
        category: body.category,
        amountDue: body.amountDue ? parseFloat(body.amountDue) : null,
        isFixed: body.isFixed ?? false,
        email: body.email || null,
        telefone: body.telefone || null,
        nib: body.nib || null,
      },
      include: { attachments: true },
    });

    return NextResponse.json(creditor, { status: 201 });
  } catch (error) {
    console.error('Error creating creditor:', error);
    return NextResponse.json(
      { error: 'Failed to create creditor' },
      { status: 500 }
    );
  }
}
