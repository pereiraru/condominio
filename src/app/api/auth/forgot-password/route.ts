import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createResetTokenPair,
  isPlaceholderEmail,
  sendPasswordResetEmail,
} from '@/lib/accountEmails';

export const dynamic = 'force-dynamic';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const identifier = typeof body.identifier === 'string' ? body.identifier.trim() : '';

    if (!identifier) {
      return NextResponse.json(
        { error: 'Indique o seu email ou código da fração (ex.: 2E, RCD).' },
        { status: 400 }
      );
    }

    const lower = identifier.toLowerCase();

    let user = await prisma.user.findUnique({
      where: { email: lower },
      include: {
        unit: {
          include: { owners: { orderBy: { startMonth: 'asc' } } },
        },
      },
    });

    if (!user) {
      const units = await prisma.unit.findMany({
        include: {
          owners: { orderBy: { startMonth: 'asc' } },
          user: {
            include: {
              unit: {
                include: { owners: { orderBy: { startMonth: 'asc' } } },
              },
            },
          },
        },
      });
      const matchedUnit = units.find(
        (u) =>
          u.code.toLowerCase() === lower ||
          (u.email && u.email.toLowerCase() === lower) ||
          u.owners.some((o) => o.email && o.email.toLowerCase() === lower)
      );
      if (matchedUnit?.user) {
        user = matchedUnit.user;
      }
    }

    if (!user) {
      return NextResponse.json(
        {
          error:
            'Não encontrámos nenhuma conta associada a esse email ou fração. Verifique os dados ou contacte a Administração.',
        },
        { status: 404 }
      );
    }

    const activeOwner =
      user.unit?.owners.find((o) => !o.endMonth) || user.unit?.owners[0] || null;

    const recoveryEmail = !isPlaceholderEmail(user.email)
      ? user.email
      : !isPlaceholderEmail(activeOwner?.email)
        ? activeOwner!.email!
        : !isPlaceholderEmail(user.unit?.email)
          ? user.unit!.email!
          : '';

    if (!recoveryEmail) {
      return NextResponse.json(
        {
          error:
            'Esta conta ainda não tem um email pessoal real associado para recuperação automática. Contacte a Administração.',
        },
        { status: 400 }
      );
    }

    const { rawToken, tokenHash, expiresAt } = createResetTokenPair();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: expiresAt,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL || 'https://condominio.pereiraru.com';
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

    const dispatch = await sendPasswordResetEmail({
      toEmail: recoveryEmail,
      userName: user.name,
      unitCode: user.unit?.code || null,
      resetUrl,
    });

    if (!dispatch.sent) {
      return NextResponse.json(
        {
          error:
            dispatch.reason ||
            'Não foi possível enviar o email de recuperação. Contacte a Administração.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sent: true,
      maskedEmail: maskEmail(recoveryEmail),
      message: `Enviámos um link de recuperação (válido por 1 hora) para ${maskEmail(recoveryEmail)}.`,
    });
  } catch (error) {
    console.error('Error in forgot-password:', error);
    return NextResponse.json(
      { error: 'Erro ao processar pedido de reposição.' },
      { status: 500 }
    );
  }
}
