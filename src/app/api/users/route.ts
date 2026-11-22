import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import {
  generateInitialPassword,
  isPlaceholderEmail,
  sendAccountCredentialsEmail,
} from '@/lib/accountEmails';

export const dynamic = 'force-dynamic';

// GET /api/users - List all users (admin only)
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
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
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// POST /api/users - Create new user (admin only)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const { name, role, unitId } = body;
    const mustChangePassword =
      body.mustChangePassword !== undefined ? Boolean(body.mustChangePassword) : true;
    const sendCredentialsEmail = Boolean(body.sendCredentialsEmail);
    const notifyEmail =
      typeof body.notifyEmail === 'string' && body.notifyEmail.trim()
        ? body.notifyEmail.trim().toLowerCase()
        : null;

    if (!email) {
      return NextResponse.json({ error: 'O email de login é obrigatório.' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Este email já está registado.' }, { status: 400 });
    }

    let unitCode: string | null = null;
    if (unitId) {
      const unitRecord = await prisma.unit.findUnique({
        where: { id: unitId },
        include: { user: { select: { id: true } } },
      });
      if (!unitRecord) {
        return NextResponse.json({ error: 'Fração não encontrada.' }, { status: 404 });
      }
      if (unitRecord.user) {
        return NextResponse.json(
          { error: 'Esta fração já tem um utilizador associado.' },
          { status: 400 }
        );
      }
      unitCode = unitRecord.code;
    }

    const rawPassword =
      typeof body.password === 'string' && body.password.trim()
        ? body.password.trim()
        : generateInitialPassword(unitCode);

    if (rawPassword.length < 6) {
      return NextResponse.json(
        { error: 'A password inicial deve ter pelo menos 6 caracteres.' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: typeof name === 'string' && name.trim() ? name.trim() : null,
        role: role === 'admin' ? 'admin' : 'user',
        unitId: unitId || null,
        mustChangePassword,
      },
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

    let notification = null;
    const deliveryTarget = notifyEmail || (!isPlaceholderEmail(email) ? email : null);
    if (sendCredentialsEmail && deliveryTarget) {
      notification = await sendAccountCredentialsEmail({
        toEmail: deliveryTarget,
        loginEmail: user.email,
        temporaryPassword: rawPassword,
        userName: user.name,
        unitCode: user.unit?.code || null,
      });
    }

    return NextResponse.json(
      {
        ...user,
        generatedPassword: rawPassword,
        notification,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
