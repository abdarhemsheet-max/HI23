import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/backend/prisma';
import { errorResponse } from '@/backend/resources';
import { UPLOAD_DIR } from '@/backend/uploads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/documents/[id]/file — بث الملف داخل التطبيق (inline).
 * هذا ما يتيح فتح PDF داخل عارض النظام دون تحميل أو تبويب جديد.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const doc = await prisma.document.findUnique({ where: { id: params.id } });
    if (!doc) return NextResponse.json({ error: 'المستند غير موجود' }, { status: 404 });

    const filePath = path.join(UPLOAD_DIR, doc.fileName);
    const buffer = await fs.readFile(filePath).catch(() => null);
    if (!buffer) {
      return NextResponse.json({ error: 'الملف غير موجود على القرص' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': doc.mimeType,
        'Content-Length': String(buffer.length),
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
