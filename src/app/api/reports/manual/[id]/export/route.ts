import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '@/backend/prisma';
import { errorResponse } from '@/backend/resources';
import { ValidationError } from '@/backend/validate';
import { UPLOAD_DIR } from '@/backend/uploads';
import { fmtDate } from '@/shared/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MANUAL_REPORTS_FOLDER = 'التقارير اليدوية';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** يبني صفحة HTML كاملة بهوية الجهة البصرية تحيط بمحتوى المحرر */
function buildReportHtml(opts: {
  title: string;
  entityName: string | null;
  brand: string;
  contactInfo: string | null;
  reportDate: string;
  content: string;
}): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 0; color: #1e293b; }
  .header { background: ${opts.brand}; color: #fff; padding: 32px 40px; }
  .header .kicker { font-size: 12px; opacity: 0.85; font-weight: bold; }
  .header h1 { margin: 6px 0 0; font-size: 24px; }
  .header .meta { margin-top: 10px; font-size: 13px; opacity: 0.95; }
  .body { padding: 32px 40px; }
  .prose h1 { font-size: 22px; margin: 20px 0 10px; }
  .prose h2 { font-size: 18px; margin: 18px 0 8px; }
  .prose h3 { font-size: 15px; margin: 16px 0 6px; }
  .prose p { line-height: 1.9; margin: 8px 0; font-size: 14px; }
  .prose ul, .prose ol { margin: 8px 0; padding-inline-start: 24px; line-height: 1.9; }
  .prose table { border-collapse: collapse; width: 100%; margin: 14px 0; font-size: 13px; }
  .prose th, .prose td { border: 1px solid #cbd5e1; padding: 8px; text-align: right; }
  .prose th { background: #f1f5f9; }
  .prose img { max-width: 100%; border-radius: 8px; margin: 10px 0; }
  .footer { padding: 14px 40px; background: ${opts.brand}; color: #fff; text-align: center; font-size: 11px; }
</style>
</head>
<body>
  <div class="header">
    <p class="kicker">تقرير</p>
    <h1>${escapeHtml(opts.title)}</h1>
    <p class="meta">
      ${opts.entityName ? `<b>${escapeHtml(opts.entityName)}</b> · ` : ''}تاريخ التقرير: ${opts.reportDate}
    </p>
  </div>
  <div class="body">
    <div style="margin-bottom:20px; padding-bottom:14px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#475569;">
      <b>المُعِدّ: عبدالرحيم أحمد شيتة</b>
      ${opts.contactInfo ? `<div>${escapeHtml(opts.contactInfo)}</div>` : ''}
    </div>
    <div class="prose">${opts.content}</div>
  </div>
  <div class="footer">أُنشئ هذا التقرير عبر «نظام حياتي»</div>
</body>
</html>`;
}

/**
 * POST /api/reports/manual/[id]/export — يحوّل محتوى التقرير اليدوي إلى PDF
 * منسّق بهوية الجهة المختارة (لون + اسم)، ويحفظه تلقائياً في أرشيف
 * المستندات ضمن مجلد «التقارير اليدوية» — بدون أي تدخّل يدوي من المستخدم
 * لاختيار مكان الحفظ (بخلاف window.print المستخدم في التقارير المؤتمتة).
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  let browser: import('puppeteer').Browser | null = null;
  try {
    const report = await prisma.manualReport.findUnique({
      where: { id: params.id },
      include: { entity: true },
    });
    if (!report) throw new ValidationError('التقرير غير موجود — أعد تحميل الصفحة');

    const html = buildReportHtml({
      title: report.title,
      entityName: report.entity?.name ?? null,
      brand: report.entity?.brandColor ?? '#38bdf8',
      contactInfo: report.entity?.contactInfo ?? null,
      reportDate: fmtDate(report.reportDate),
      content: report.content || '<p style="color:#94a3b8">لا يوجد محتوى بعد.</p>',
    });

    const puppeteer = await import('puppeteer');
    browser = await puppeteer.default.launch({ headless: true });
    const page = await browser.newPage();
    // 'load' يضمن اكتمال تحميل الصور المُدرجة في المحتوى قبل توليد الـ PDF
    await page.setContent(html, { waitUntil: 'load' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
    await browser.close();
    browser = null;

    // مجلد أرشيف مخصص للتقارير اليدوية — يُنشأ تلقائياً أول مرة
    let folder = await prisma.docFolder.findFirst({ where: { name: MANUAL_REPORTS_FOLDER } });
    if (!folder) {
      folder = await prisma.docFolder.create({ data: { name: MANUAL_REPORTS_FOLDER, color: '#a78bfa' } });
    }

    const storedName = crypto.randomUUID() + '.pdf';
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, storedName), pdfBuffer);

    const doc = await prisma.document.create({
      data: {
        name: `${report.title}.pdf`,
        fileName: storedName,
        mimeType: 'application/pdf',
        size: pdfBuffer.length,
        folderId: folder.id,
      },
    });

    await prisma.manualReport.update({ where: { id: report.id }, data: { documentId: doc.id } });

    return NextResponse.json(doc, { status: 201 });
  } catch (e) {
    if (browser) await browser.close().catch(() => {});
    return errorResponse(e);
  }
}
