import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

export async function GET(request: NextRequest) {
  const filename = request.nextUrl.searchParams.get('name');

  if (!filename) {
    return NextResponse.json({ error: 'Missing filename' }, { status: 400 });
  }

  // Prevent path traversal
  const sanitized = path.basename(filename);
  const filePath = path.join(process.cwd(), 'public', 'uploads', 'attachments', sanitized);

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
