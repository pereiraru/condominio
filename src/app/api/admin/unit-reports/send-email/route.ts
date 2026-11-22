import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { buildUnitReportsData } from '@/lib/unitReportsBuilder';
import { sendUnitFinancialReportEmail } from '@/lib/unitReportEmail';
import { parseEmailList } from '@/lib/incidentNotifications';

export const dynamic = 'force-dynamic';

interface SendItemInput {
  unitId: string;
  email?: string;
  customNote?: string;
  saveAsDefaultEmail?: boolean;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = session.user.role === 'admin';

  try {
    const body = await request.json();
    const targetYear = Number(body.year) || new Date().getFullYear();
    const rawItems: SendItemInput[] = Array.isArray(body.items) ? body.items : [];

    if (rawItems.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma fração selecionada para envio.' },
        { status: 400 }
      );
    }

    if (!isAdmin) {
      if (!session.user.unitId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const hasOtherUnit = rawItems.some((item) => item.unitId !== session.user.unitId);
      if (hasOtherUnit) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const singleUnitId = rawItems.length === 1 ? rawItems[0].unitId : null;
    const reportData = await buildUnitReportsData({
      targetYear,
      targetUnitId: singleUnitId,
      isAdmin,
    });

    const results: {
      unitId: string;
      code: string;
      sent: boolean;
      recipients: string[];
      reason?: string;
      savedDefaultEmail?: string;
    }[] = [];

    for (const item of rawItems) {
      const unit = reportData.units.find((u) => u.id === item.unitId);
      if (!unit) {
        results.push({
          unitId: item.unitId,
          code: '—',
          sent: false,
          recipients: [],
          reason: 'Fração não encontrada.',
        });
        continue;
      }

      const targetEmailRaw =
        (typeof item.email === 'string' && item.email.trim()) ||
        unit.defaultEmail ||
        unit.currentOwner?.email ||
        '';

      const validEmails = parseEmailList(targetEmailRaw);
      let savedDefaultEmail: string | undefined;

      if (item.saveAsDefaultEmail && validEmails.length > 0) {
        const primaryEmail = validEmails[0];
        await prisma.unit.update({
          where: { id: unit.id },
          data: { email: primaryEmail },
        });
        if (unit.currentOwner?.id && !unit.currentOwner.email) {
          await prisma.owner.update({
            where: { id: unit.currentOwner.id },
            data: { email: primaryEmail },
          });
        }
        savedDefaultEmail = primaryEmail;
      }

      const dispatch = await sendUnitFinancialReportEmail({
        unit,
        year: reportData.year,
        buildingName: reportData.buildingName,
        toEmails: targetEmailRaw,
        customNote: isAdmin ? item.customNote : undefined,
      });

      results.push({
        unitId: unit.id,
        code: unit.code,
        sent: dispatch.sent,
        recipients: dispatch.recipients,
        reason: dispatch.reason,
        savedDefaultEmail,
      });
    }

    const sentCount = results.filter((r) => r.sent).length;

    return NextResponse.json({
      totalRequested: results.length,
      sentCount,
      results,
    });
  } catch (error) {
    console.error('Error sending unit financial report emails:', error);
    return NextResponse.json(
      { error: 'Falha ao enviar os emails de situação financeira.' },
      { status: 500 }
    );
  }
}
