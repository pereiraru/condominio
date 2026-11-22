import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { readFile } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const filename = request.nextUrl.searchParams.get('name');

  if (!filename) {
    return NextResponse.json({ error: 'Missing filename' }, { status: 400 });
  }

  // Prevent path traversal
  const sanitized = path.basename(filename);

  if (session.user.role !== 'admin') {
    const allowedMinuteDoc = await prisma.document.findFirst({
      where: { filename: sanitized, category: 'minutes' },
      select: { id: true },
    });
    if (!allowedMinuteDoc) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const filePath = path.join(process.cwd(), 'public', 'uploads', sanitized);

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  try {
    const buffer = await readFile(filePath);
    const ext = path.extname(sanitized).toLowerCase();

    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${sanitized}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
