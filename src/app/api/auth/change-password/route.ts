import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { isPlaceholderEmail } from '@/lib/accountEmails';
import { parseEmailList } from '@/lib/incidentNotifications';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
    const personalEmailRaw =
      typeof body.personalEmail === 'string' ? body.personalEmail.trim().toLowerCase() : '';

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'A nova password deve ter pelo menos 8 caracteres.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        unit: {
          include: { owners: { orderBy: { startMonth: 'asc' } } },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Utilizador não encontrado.' }, { status: 404 });
    }

    if (!user.mustChangePassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Indique a sua password atual.' },
          { status: 400 }
        );
      }
      const matches = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!matches) {
        return NextResponse.json(
          { error: 'A password atual está incorreta.' },
          { status: 400 }
        );
      }
    }

    const needsRealEmail =
      user.mustChangePassword && user.role !== 'admin' && isPlaceholderEmail(user.email);

    let nextEmail: string | undefined;
    if (personalEmailRaw) {
      const parsed = parseEmailList(personalEmailRaw);
      if (parsed.length !== 1 || isPlaceholderEmail(parsed[0])) {
        return NextResponse.json(
          { error: 'Indique um email pessoal real e válido (ex.: nome@gmail.com).' },
          { status: 400 }
        );
      }
      const cleanEmail = parsed[0];
      if (cleanEmail !== user.email.toLowerCase()) {
        const conflict = await prisma.user.findUnique({ where: { email: cleanEmail } });
        if (conflict && conflict.id !== user.id) {
          return NextResponse.json(
            { error: 'Este endereço de email já está associado a outra conta.' },
            { status: 400 }
          );
        }
        nextEmail = cleanEmail;
      }
    } else if (needsRealEmail) {
      return NextResponse.json(
        {
          error:
            'Indique o seu email pessoal real para concluir o primeiro acesso e permitir recuperação futura da password.',
        },
        { status: 400 }
      );
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        ...(nextEmail ? { email: nextEmail } : {}),
      },
      select: {
        id: true,
        email: true,
        mustChangePassword: true,
        unitId: true,
      },
    });

    const effectiveEmail = nextEmail || (!isPlaceholderEmail(user.email) ? user.email : null);
    if (effectiveEmail && user.unitId && user.unit) {
      if (!user.unit.email) {
        await prisma.unit.update({
          where: { id: user.unitId },
          data: { email: effectiveEmail },
        });
      }
      const currentOwner =
        user.unit.owners.find((o) => !o.endMonth) || user.unit.owners[0] || null;
      if (currentOwner && !currentOwner.email) {
        await prisma.owner.update({
          where: { id: currentOwner.id },
          data: { email: effectiveEmail },
        });
      }
    }

    return NextResponse.json({
      success: true,
      email: updated.email,
      mustChangePassword: updated.mustChangePassword,
      unitId: updated.unitId,
    });
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json(
      { error: 'Erro ao alterar a password.' },
      { status: 500 }
    );
  }
}
