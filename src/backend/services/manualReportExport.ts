// ======================================================================
// تصدير التقارير اليدوية إلى PDF — كان يتم سابقاً عبر Puppeteer على
// الخادم (غير متاح في SPA ثابتة). البديل: توليد PDF داخل المتصفح مباشرة
// (html2pdf.js) من نفس قالب HTML، ثم رفعه إلى B2 وأرشفته تلقائياً —
// بلا أي نافذة حفظ يدوية، تماماً كسلوك النسخة السابقة.
// ======================================================================

import html2pdf from 'html2pdf.js';
import { supabase } from '../config/supabaseClient';
import { unwrap } from './errors';
import { ValidationError } from '../validate';
import { uploadToB2 } from '../config/b2Storage';
import { fmtDate } from '@/shared/utils';

const MANUAL_REPORTS_FOLDER = 'التقارير اليدوية';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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

interface ManualReportRow {
  id: string;
  title: string;
  reportDate: string;
  content: string;
  entity: { name: string; brandColor: string; contactInfo: string | null } | null;
}

export async function exportManualReportPdf(reportId: string) {
  const report = unwrap(
    await supabase.from('ManualReport').select('*, entity:WorkEntity(*)').eq('id', reportId).maybeSingle()
  ) as ManualReportRow | null;
  if (!report) throw new ValidationError('التقرير غير موجود — أعد تحميل الصفحة');

  const html = buildReportHtml({
    title: report.title,
    entityName: report.entity?.name ?? null,
    brand: report.entity?.brandColor ?? '#38bdf8',
    contactInfo: report.entity?.contactInfo ?? null,
    reportDate: fmtDate(report.reportDate),
    content: report.content || '<p style="color:#94a3b8">لا يوجد محتوى بعد.</p>',
  });

  const blob: Blob = await html2pdf()
    .set({
      margin: 0,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
    })
    .from(html, 'string')
    .outputPdf('blob');

  const fileName = `${report.title}.pdf`;
  const pdfFile = new File([blob], fileName, { type: 'application/pdf' });
  const storedName = crypto.randomUUID() + '.pdf';
  const uploaded = await uploadToB2(pdfFile, storedName);

  let folder = unwrap(
    await supabase.from('DocFolder').select('*').eq('name', MANUAL_REPORTS_FOLDER).maybeSingle()
  ) as { id: string } | null;
  if (!folder) {
    folder = unwrap(
      await supabase.from('DocFolder').insert({ name: MANUAL_REPORTS_FOLDER, color: '#a78bfa' }).select('*').single()
    ) as { id: string };
  }

  const doc = unwrap(
    await supabase
      .from('Document')
      .insert({
        name: fileName,
        fileName: uploaded.fileName,
        bzFileId: uploaded.bzFileId,
        mimeType: 'application/pdf',
        size: uploaded.size,
        folderId: folder.id,
      })
      .select('*')
      .single()
  ) as { id: string };

  unwrap(await supabase.from('ManualReport').update({ documentId: doc.id }).eq('id', report.id));

  return doc;
}
