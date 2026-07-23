import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/backend/prisma';
import { errorResponse, readBody } from '@/backend/resources';
import { ValidationError, optId, optStr } from '@/backend/validate';
import { UPLOAD_DIR } from '@/backend/uploads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: { id: string } };

/** PATCH /api/documents/[id] — إعادة تسمية أو نقل لمجلد آخر */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const b = await readBody(req);
    const data: Record<string, unknown> = {};
    if (b.name !== undefined) {
      const name = optStr(b, 'name', 200);
      if (!name) throw new ValidationError('اسم الملف مطلوب');
      data.name = name;
    }
    if (b.folderId !== undefined) data.folderId = optId(b, 'folderId');
    if (Object.keys(data).length === 0) throw new ValidationError('لا توجد تعديلات صالحة');

    const doc = await prisma.document.update({ where: { id: params.id }, data });
    return NextResponse.json(doc);
  } catch (e) {
    return errorResponse(e);
  }
}

/** DELETE /api/documents/[id] — حذف السجل والملف الفعلي من القرص */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const doc = await prisma.document.findUnique({ where: { id: params.id } });
    if (!doc) return NextResponse.json({ ok: true }); // محذوف مسبقاً

    await prisma.document.delete({ where: { id: doc.id } });
    // حذف الملف من القرص — فشله لا يُفشل العملية (السجل حُذف)
    await fs.unlink(path.join(UPLOAD_DIR, doc.fileName)).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
