import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { buildUnitReportsData } from '@/lib/unitReportsBuilder';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = session.user.role === 'admin';
  const requestedUnitId = request.nextUrl.searchParams.get('unitId');

  if (!isAdmin) {
    if (!session.user.unitId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (requestedUnitId && requestedUnitId !== session.user.unitId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const targetUnitId = isAdmin ? requestedUnitId : session.user.unitId!;

  try {
    const currentYear = new Date().getFullYear();
    const targetYear = parseInt(
      request.nextUrl.searchParams.get('year') ?? currentYear.toString(),
      10
    );

    const payload = await buildUnitReportsData({
      targetYear,
      targetUnitId,
      isAdmin,
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error building admin unit reports:', error);
    return NextResponse.json({ error: 'Failed to load unit reports' }, { status: 500 });
  }
}
