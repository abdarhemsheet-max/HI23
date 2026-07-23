import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '@/backend/prisma';
import { errorResponse } from '@/backend/resources';
import { ValidationError } from '@/backend/validate';
import { UPLOAD_DIR } from '@/backend/uploads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_SIZE = 100 * 1024 * 1024; // 100MB

// أنواع MIME الاحتياطية عندما لا يرسلها المتصفح
const MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.txt': 'text/plain; charset=utf-8',
};

/** GET /api/documents — كل المستندات */
export async function GET() {
  try {
    const rows = await prisma.document.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(rows);
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/documents — رفع ملف (multipart/form-data) وحفظه في uploads/ */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData().catch(() => {
      throw new ValidationError('بيانات الرفع غير صالحة');
    });

    const file = form.get('file');
    if (!(file instanceof Blob) || !('name' in file)) {
      throw new ValidationError('لم يتم اختيار ملف');
    }
    const original = (file as File).name || 'ملف';
    if (file.size === 0) throw new ValidationError('الملف فارغ');
    if (file.size > MAX_SIZE) throw new ValidationError('حجم الملف يتجاوز 100MB');

    // اسم معروض مخصص من المستخدم (اختياري) — وإلا الاسم الأصلي
    const customRaw = form.get('name');
    const displayName =
      typeof customRaw === 'string' && customRaw.trim() !== ''
        ? customRaw.trim().slice(0, 200)
        : original.slice(0, 200);

    const folderIdRaw = form.get('folderId');
    const folderId = typeof folderIdRaw === 'string' && folderIdRaw !== '' ? folderIdRaw : null;
    if (folderId) {
      const folder = await prisma.docFolder.findUnique({ where: { id: folderId } });
      if (!folder) throw new ValidationError('المجلد غير موجود — أعد تحميل الصفحة');
    }

    // اسم تخزين آمن: uuid + الامتداد الأصلي فقط (لا مسارات ولا رموز)
    const ext = path.extname(original).toLowerCase().replace(/[^.\w]/g, '').slice(0, 10);
    const storedName = crypto.randomUUID() + ext;

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(UPLOAD_DIR, storedName), buffer);

    const doc = await prisma.document.create({
      data: {
        name: displayName,
        fileName: storedName,
        mimeType: file.type || MIME_BY_EXT[ext] || 'application/octet-stream',
        size: file.size,
        folderId,
      },
    });
    return NextResponse.json(doc, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
