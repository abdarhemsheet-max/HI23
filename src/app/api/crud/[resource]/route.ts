import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/backend/prisma';
import { getResource, errorResponse, readBody } from '@/backend/resources';
import { ValidationError } from '@/backend/validate';

export const dynamic = 'force-dynamic';

// عميل Prisma بوصول ديناميكي — آمن لأن getResource يعمل بقائمة بيضاء فقط
const db = prisma as unknown as Record<
  string,
  {
    findMany: (args?: unknown) => Promise<unknown>;
    create: (args: { data: unknown }) => Promise<unknown>;
    upsert: (args: unknown) => Promise<unknown>;
  }
>;

/** GET /api/crud/[resource] — قائمة كاملة */
export async function GET(_req: NextRequest, { params }: { params: { resource: string } }) {
  try {
    const def = getResource(params.resource);
    const include = typeof def.include === 'function' ? def.include() : def.include;
    const rows = await db[def.model].findMany({
      ...(def.orderBy ? { orderBy: def.orderBy } : {}),
      ...(include ? { include } : {}),
    });
    return NextResponse.json(rows);
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/crud/[resource] — إنشاء (أو upsert للموارد الفريدة مثل تركيز الأسبوع) */
export async function POST(req: NextRequest, { params }: { params: { resource: string } }) {
  try {
    const def = getResource(params.resource);
    if (!def.create) throw new ValidationError('الإنشاء غير متاح لهذا المورد');
    const body = await readBody(req);
    const data = def.create(body) as Record<string, unknown>;

    let row: unknown;
    if (def.upsertOn && data[def.upsertOn] != null) {
      row = await db[def.model].upsert({
        where: { [def.upsertOn]: data[def.upsertOn] },
        create: data,
        update: data,
      });
    } else {
      row = await db[def.model].create({ data });
    }
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
