import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const pattern = request.nextUrl.searchParams.get('pattern');
    if (!pattern) {
      return NextResponse.json({ count: 0 });
    }

    const count = await prisma.transaction.count({
      where: { description: { contains: pattern } },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Error counting matches:', error);
    return NextResponse.json({ error: 'Failed to count matches' }, { status: 500 });
  }
}
