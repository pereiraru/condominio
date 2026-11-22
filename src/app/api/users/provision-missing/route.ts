import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import {
  buildDefaultUnitLoginEmail,
  generateInitialPassword,
  isPlaceholderEmail,
  sendAccountCredentialsEmail,
} from '@/lib/accountEmails';

export const dynamic = 'force-dynamic';

function getUnitFloorOrder(code: string, floor: number | null): number {
  const upper = code.toUpperCase();
  if (upper === 'GARAGEM' || upper.startsWith('G')) return -20;
  if (upper === 'CV' || upper === 'CVD' || upper === 'CVE') {
    return -10 + (upper === 'CVE' ? 1 : 0);
  }
  if (upper === 'RCD') return 0;
  if (upper === 'RCE') return 1;
  if (floor !== null) return floor * 10 + (upper.endsWith('E') ? 1 : 0);
  const match = upper.match(/^(\d+)([DE]?)$/);
  if (match) return parseInt(match[1], 10) * 10 + (match[2] === 'E' ? 1 : 0);
  return 999;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const requestedUnitIds: string[] | null = Array.isArray(body.unitIds)
      ? body.unitIds
      : null;
    const sendEmails = Boolean(body.sendEmails);
    const customEmails: Record<string, string> =
      body.customEmails && typeof body.customEmails === 'object' ? body.customEmails : {};

    const units = await prisma.unit.findMany({
      include: {
        user: { select: { id: true, email: true } },
        owners: { orderBy: { startMonth: 'asc' } },
      },
    });

    const missingUnits = units
      .filter((u) => !u.user && (!requestedUnitIds || requestedUnitIds.includes(u.id)))
      .sort((a, b) => {
        const diff = getUnitFloorOrder(a.code, a.floor) - getUnitFloorOrder(b.code, b.floor);
        return diff !== 0 ? diff : a.code.localeCompare(b.code, 'pt-PT');
      });

    const existingUsers = await prisma.user.findMany({ select: { email: true } });
    const usedEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));

    const accounts: {
      userId: string;
      unitId: string;
      unitCode: string;
      ownerName: string;
      email: string;
      temporaryPassword: string;
      isPlaceholderEmail: boolean;
      emailSent: boolean;
      emailReason?: string;
    }[] = [];

    for (const unit of missingUnits) {
      const currentOwner =
        unit.owners.find((o) => !o.endMonth && Boolean(o.startMonth)) ||
        unit.owners.find((o) => !o.endMonth) ||
        unit.owners[0] ||
        null;

      const customEmail = (customEmails[unit.id] || '').trim().toLowerCase();
      const candidateRealEmail =
        customEmail ||
        (currentOwner?.email || '').trim().toLowerCase() ||
        (unit.email || '').trim().toLowerCase();

      let loginEmail = candidateRealEmail || buildDefaultUnitLoginEmail(unit.code);
      if (usedEmails.has(loginEmail)) {
        const baseFallback = buildDefaultUnitLoginEmail(unit.code);
        loginEmail = !usedEmails.has(baseFallback)
          ? baseFallback
          : `${unit.code.toLowerCase().replace(/[^a-z0-9]/g, '')}.${unit.id.slice(-4)}@condominio.pt`;
      }
      usedEmails.add(loginEmail);

      // Save custom email onto Unit & Owner if supplied
      if (customEmail && !isPlaceholderEmail(customEmail)) {
        if (!unit.email) {
          await prisma.unit.update({
            where: { id: unit.id },
            data: { email: customEmail },
          });
        }
        if (currentOwner && !currentOwner.email) {
          await prisma.owner.update({
            where: { id: currentOwner.id },
            data: { email: customEmail },
          });
        }
      }

      const temporaryPassword = generateInitialPassword(unit.code);
      const passwordHash = await bcrypt.hash(temporaryPassword, 10);
      const ownerName = currentOwner?.name || `Fração ${unit.code}`;

      const created = await prisma.user.create({
        data: {
          email: loginEmail,
          passwordHash,
          name: ownerName,
          role: 'user',
          unitId: unit.id,
          ownerId: currentOwner?.id || null,
          mustChangePassword: true,
        },
      });

      const placeholder = isPlaceholderEmail(loginEmail);
      let emailSent = false;
      let emailReason: string | undefined;

      if (sendEmails && !placeholder) {
        const dispatch = await sendAccountCredentialsEmail({
          toEmail: loginEmail,
          loginEmail,
          temporaryPassword,
          userName: ownerName,
          unitCode: unit.code,
        });
        emailSent = dispatch.sent;
        emailReason = dispatch.reason;
      }

      accounts.push({
        userId: created.id,
        unitId: unit.id,
        unitCode: unit.code,
        ownerName,
        email: loginEmail,
        temporaryPassword,
        isPlaceholderEmail: placeholder,
        emailSent,
        emailReason,
      });
    }

    return NextResponse.json({
      createdCount: accounts.length,
      accounts,
    });
  } catch (error) {
    console.error('Error provisioning missing unit users:', error);
    return NextResponse.json(
      { error: 'Falha ao criar contas de utilizador em falta.' },
      { status: 500 }
    );
  }
}
