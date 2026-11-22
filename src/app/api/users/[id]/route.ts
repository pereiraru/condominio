import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import {
  createResetTokenPair,
  generateInitialPassword,
  isPlaceholderEmail,
  sendAccountCredentialsEmail,
  sendPasswordResetEmail,
} from '@/lib/accountEmails';

export const dynamic = 'force-dynamic';

// GET /api/users/[id] - Get user by ID (admin only)
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        unitId: true,
        mustChangePassword: true,
        lastLogin: true,
        createdAt: true,
        unit: {
          select: {
            id: true,
            code: true,
            email: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

// PUT /api/users/[id] - Update user, toggle admin, reset temp password or send reset link
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, role, unitId, mustChangePassword, resetTemporaryPassword, sendResetLink } = body;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined;
    const notifyEmail =
      typeof body.notifyEmail === 'string' && body.notifyEmail.trim()
        ? body.notifyEmail.trim().toLowerCase()
        : null;

    const existing = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        unit: {
          include: { owners: { orderBy: { startMonth: 'asc' } } },
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Utilizador não encontrado.' }, { status: 404 });
    }

    // Prevent removing own admin role or removing last admin
    if (role !== undefined && role !== existing.role && existing.role === 'admin') {
      if (session.user.id === existing.id) {
        return NextResponse.json(
          { error: 'Não pode remover o seu próprio perfil de Administrador.' },
          { status: 400 }
        );
      }
      const adminCount = await prisma.user.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Tem de existir pelo menos um Administrador no sistema.' },
          { status: 400 }
        );
      }
    }

    if (email && email !== existing.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken) {
        return NextResponse.json({ error: 'Este email já está associado a outro utilizador.' }, { status: 400 });
      }
    }

    if (unitId && unitId !== existing.unitId) {
      const unitUser = await prisma.user.findUnique({ where: { unitId } });
      if (unitUser) {
        return NextResponse.json(
          { error: 'Esta fração já tem um utilizador associado.' },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (email !== undefined) updateData.email = email;
    if (name !== undefined) updateData.name = typeof name === 'string' && name.trim() ? name.trim() : null;
    if (role !== undefined) updateData.role = role === 'admin' ? 'admin' : 'user';
    if (unitId !== undefined) updateData.unitId = unitId || null;
    if (mustChangePassword !== undefined) {
      updateData.mustChangePassword = Boolean(mustChangePassword);
    }

    let generatedPassword: string | undefined;
    if (resetTemporaryPassword) {
      generatedPassword = generateInitialPassword(existing.unit?.code);
      updateData.passwordHash = await bcrypt.hash(generatedPassword, 10);
      updateData.mustChangePassword = true;
    } else if (typeof body.password === 'string' && body.password.trim()) {
      updateData.passwordHash = await bcrypt.hash(body.password.trim(), 10);
      if (mustChangePassword === undefined) {
        updateData.mustChangePassword = true;
      }
    }

    let notification = null;
    const ownerEmail =
      existing.unit?.owners.find((o) => !o.endMonth)?.email ||
      existing.unit?.owners[0]?.email ||
      null;
    const bestEmail =
      notifyEmail ||
      (!isPlaceholderEmail(email || existing.email) ? email || existing.email : null) ||
      (!isPlaceholderEmail(ownerEmail) ? ownerEmail : null) ||
      (!isPlaceholderEmail(existing.unit?.email) ? existing.unit?.email : null);

    if (sendResetLink) {
      if (!bestEmail) {
        return NextResponse.json(
          { error: 'Indique um email pessoal válido para enviar o link de reposição.' },
          { status: 400 }
        );
      }
      const { rawToken, tokenHash, expiresAt } = createResetTokenPair();
      updateData.passwordResetTokenHash = tokenHash;
      updateData.passwordResetExpiresAt = expiresAt;
      const baseUrl = process.env.NEXTAUTH_URL || 'https://condominio.pereiraru.com';
      notification = await sendPasswordResetEmail({
        toEmail: bestEmail,
        userName: existing.name,
        unitCode: existing.unit?.code || null,
        resetUrl: `${baseUrl}/reset-password?token=${rawToken}`,
      });
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        unitId: true,
        mustChangePassword: true,
        lastLogin: true,
        createdAt: true,
        unit: {
          select: {
            id: true,
            code: true,
            email: true,
          },
        },
      },
    });

    if (generatedPassword && body.sendEmail && bestEmail) {
      notification = await sendAccountCredentialsEmail({
        toEmail: bestEmail,
        loginEmail: user.email,
        temporaryPassword: generatedPassword,
        userName: user.name,
        unitCode: user.unit?.code || null,
      });
    }

    return NextResponse.json({
      ...user,
      generatedPassword,
      notification,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// DELETE /api/users/[id] - Delete user (admin only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (session.user.id === params.id) {
    return NextResponse.json(
      { error: 'Não pode eliminar a sua própria conta.' },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.user.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: 'Utilizador não encontrado.' }, { status: 404 });
    }
    if (existing.role === 'admin') {
      const adminCount = await prisma.user.count({ where: { role: 'admin' } });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Não é possível eliminar o único Administrador do sistema.' },
          { status: 400 }
        );
      }
    }

    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
