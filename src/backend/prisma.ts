import { PrismaClient } from '@prisma/client';

// نسخة واحدة من عميل Prisma — تمنع استنزاف الاتصالات مع إعادة التحميل في وضع التطوير
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
