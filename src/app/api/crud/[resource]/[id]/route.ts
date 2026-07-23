import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/backend/prisma';
import { getResource, errorResponse, readBody } from '@/backend/resources';
import { ValidationError } from '@/backend/validate';

export const dynamic = 'force-dynamic';

const db = prisma as unknown as Record<
  string,
  {
    update: (args: { where: { id: string }; data: unknown }) => Promise<unknown>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  }
>;

type Ctx = { params: { resource: string; id: string } };

/** PATCH /api/crud/[resource]/[id] — تعديل جزئي */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const def = getResource(params.resource);
    if (!def.update) throw new ValidationError('التعديل غير متاح لهذا المورد');
    const body = await readBody(req);
    const data = def.update(body) as Record<string, unknown>;
    if (Object.keys(data).length === 0) throw new ValidationError('لا توجد تعديلات صالحة');
    const row = await db[def.model].update({ where: { id: params.id }, data });
    return NextResponse.json(row);
  } catch (e) {
    return errorResponse(e);
  }
}

/** DELETE /api/crud/[resource]/[id] */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const def = getResource(params.resource);
    await db[def.model].delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
