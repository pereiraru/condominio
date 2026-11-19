import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { getCreditorDiscrepancies } from '@/lib/creditorDiscrepancies';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const creditorId = request.nextUrl.searchParams.get('creditorId') || undefined;
    const result = await getCreditorDiscrepancies(creditorId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching creditor discrepancies:', error);
    return NextResponse.json({ error: 'Failed to fetch discrepancies' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { discrepancyKey, creditorId, type, title, description, suggestedFix, resolved, notes } = body;

    if (!discrepancyKey || !creditorId) {
      return NextResponse.json({ error: 'discrepancyKey and creditorId are required' }, { status: 400 });
    }

    const resolvedBy = session.user.email || session.user.name || 'admin';
    const isResolved = Boolean(resolved);

    const record = await prisma.creditorDiscrepancyResolution.upsert({
      where: { discrepancyKey },
      update: {
        resolved: isResolved,
        resolvedAt: isResolved ? new Date() : null,
        resolvedBy: isResolved ? resolvedBy : null,
        notes: notes ?? undefined,
      },
      create: {
        creditorId,
        discrepancyKey,
        type: type || 'unreconciled_invoice',
        title: title || discrepancyKey,
        description: description || '',
        suggestedFix: suggestedFix || '',
        resolved: isResolved,
        resolvedAt: isResolved ? new Date() : null,
        resolvedBy: isResolved ? resolvedBy : null,
        notes: notes ?? null,
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error('Error updating discrepancy resolution:', error);
    return NextResponse.json({ error: 'Failed to update discrepancy' }, { status: 500 });
  }
}
