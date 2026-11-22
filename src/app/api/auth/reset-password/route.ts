import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';
import { hashResetToken } from '@/lib/accountEmails';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim() || '';
  if (!token) {
    return NextResponse.json({ valid: false });
  }

  const tokenHash = hashResetToken(token);
  const user = await prisma.user.findUnique({
    where: { passwordResetTokenHash: tokenHash },
    select: { id: true, passwordResetExpiresAt: true },
  });

  const valid = Boolean(
    user && user.passwordResetExpiresAt && user.passwordResetExpiresAt > new Date()
  );

  return NextResponse.json({ valid });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!token) {
      return NextResponse.json({ error: 'Token em falta.' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'A nova password deve ter pelo menos 8 caracteres.' },
        { status: 400 }
      );
    }

    const tokenHash = hashResetToken(token);
    const user = await prisma.user.findUnique({
      where: { passwordResetTokenHash: tokenHash },
    });

    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt <= new Date()) {
      return NextResponse.json(
        { error: 'Este link de reposição é inválido ou já expirou. Peça um novo link.' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json(
      { error: 'Erro ao redefinir a password.' },
      { status: 500 }
    );
  }
}
