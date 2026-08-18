// ======================================================================
// طبقة توافق API — الواجهة الخارجية (api, getCached, notify) مطابقة
// تماماً للإصدار المبني على Next.js API routes، لذا لم تحتَج أي صفحة أو
// مكوّن لأي تعديل في منطقه: نفس المسارات (/api/crud/wallets، إلخ)
// تُوجَّه الآن داخلياً إلى Supabase/Backblaze B2 بدل fetch على خادم محلي.
// ======================================================================

import { toMessage } from '@/backend/services/errors';
import { listResource, createResource, updateResource, deleteResource } from '@/backend/services/crud';
import { listTransactions, createTransaction, confirmPendingTransaction, deleteTransaction, settleDebt, paySubscription } from '@/backend/services/finance';
import { toggleLog } from '@/backend/services/habits';
import { getQuranHeatmap, getMushafProgress, reviewSrsCard, getHosoonWeek, upsertHosoonField } from '@/backend/services/quran';
import { reorderProjectTasks, setTaskReportFlag } from '@/backend/services/projects';
import { generateReport } from '@/backend/services/reports';
import { addLearningLessons, updateLearningLesson, deleteLearningLesson } from '@/backend/services/learning';
import { listDocuments, uploadDocument, updateDocument, deleteDocument } from '@/backend/services/documents';
import { getSummary } from '@/backend/services/summary';

export type ToastType = 'success' | 'error';

type NotifyFn = (message: string, type: ToastType) => void;

let notifyFn: NotifyFn = () => {};

/** يسجله مكوّن Toaster عند التحميل */
export function registerNotify(fn: NotifyFn) {
  notifyFn = fn;
}

export function notify(message: string, type: ToastType = 'success') {
  notifyFn(message, type);
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** رسالة نجاح اختيارية تُعرض كـ Toast */
  ok?: string;
}

// ======================================================================
// كاش القراءات — سرعة التنقل بين الأقسام (سلوك مطابق للإصدار السابق)
// ======================================================================
const getCache = new Map<string, unknown>();

export function getCached<T>(path: string): T | null {
  return (getCache.get(path) as T | undefined) ?? null;
}

function asBody(body: unknown): Record<string, unknown> {
  return (body ?? {}) as Record<string, unknown>;
}

type Handler = (params: string[], opts: ApiOptions, query: URLSearchParams) => Promise<unknown>;

const ROUTES: { method: string; pattern: RegExp; handler: Handler }[] = [
  { method: 'GET', pattern: /^\/api\/summary$/, handler: () => getSummary() },

  { method: 'GET', pattern: /^\/api\/crud\/([^/]+)$/, handler: ([resource]) => listResource(resource) },
  { method: 'POST', pattern: /^\/api\/crud\/([^/]+)$/, handler: ([resource], opts) => createResource(resource, asBody(opts.body)) },
  { method: 'PATCH', pattern: /^\/api\/crud\/([^/]+)\/([^/]+)$/, handler: ([resource, id], opts) => updateResource(resource, id, asBody(opts.body)) },
  { method: 'DELETE', pattern: /^\/api\/crud\/([^/]+)\/([^/]+)$/, handler: ([resource, id]) => deleteResource(resource, id).then(() => ({ ok: true })) },

  { method: 'POST', pattern: /^\/api\/debts\/([^/]+)\/settle$/, handler: ([id], opts) => settleDebt(id, asBody(opts.body)) },
  { method: 'POST', pattern: /^\/api\/subscriptions\/([^/]+)\/pay$/, handler: ([id], opts) => paySubscription(id, asBody(opts.body)) },

  { method: 'GET', pattern: /^\/api\/transactions$/, handler: () => listTransactions() },
  { method: 'POST', pattern: /^\/api\/transactions$/, handler: (_p, opts) => createTransaction(asBody(opts.body)) },
  { method: 'PATCH', pattern: /^\/api\/transactions\/([^/]+)$/, handler: ([id], opts) => confirmPendingTransaction(id, asBody(opts.body)) },
  { method: 'DELETE', pattern: /^\/api\/transactions\/([^/]+)$/, handler: ([id]) => deleteTransaction(id).then(() => ({ ok: true })) },

  { method: 'POST', pattern: /^\/api\/toggle-log$/, handler: (_p, opts) => toggleLog(asBody(opts.body)) },

  { method: 'GET', pattern: /^\/api\/quran\/heatmap$/, handler: () => getQuranHeatmap() },
  { method: 'GET', pattern: /^\/api\/quran\/mushaf$/, handler: () => getMushafProgress() },
  { method: 'POST', pattern: /^\/api\/quran\/srs\/([^/]+)\/review$/, handler: ([id], opts) => reviewSrsCard(id, asBody(opts.body)) },
  { method: 'GET', pattern: /^\/api\/hosoon$/, handler: (_p, _o, query) => getHosoonWeek(query.get('date') ?? undefined) },
  { method: 'POST', pattern: /^\/api\/hosoon$/, handler: (_p, opts) => upsertHosoonField(asBody(opts.body)) },

  { method: 'POST', pattern: /^\/api\/projects\/reorder$/, handler: (_p, opts) => reorderProjectTasks(asBody(opts.body)) },
  { method: 'POST', pattern: /^\/api\/projects\/tasks\/([^/]+)\/report$/, handler: ([id], opts) => setTaskReportFlag(id, asBody(opts.body)) },

  { method: 'POST', pattern: /^\/api\/reports\/generate$/, handler: (_p, opts) => generateReport(asBody(opts.body)) },
  {
    method: 'POST',
    pattern: /^\/api\/reports\/manual\/([^/]+)\/export$/,
    // استيراد ديناميكي: html2pdf.js ثقيلة (jsPDF + html2canvas) ولا داعي
    // لتحميلها إلا عند فعلياً تصدير تقرير يدوي إلى PDF
    handler: async ([id]) => {
      const { exportManualReportPdf } = await import('@/backend/services/manualReportExport');
      return exportManualReportPdf(id);
    },
  },

  { method: 'POST', pattern: /^\/api\/learning\/lessons$/, handler: (_p, opts) => addLearningLessons(asBody(opts.body)) },
  { method: 'PATCH', pattern: /^\/api\/learning\/lessons\/([^/]+)$/, handler: ([id], opts) => updateLearningLesson(id, asBody(opts.body)) },
  { method: 'DELETE', pattern: /^\/api\/learning\/lessons\/([^/]+)$/, handler: ([id]) => deleteLearningLesson(id) },

  { method: 'GET', pattern: /^\/api\/documents$/, handler: () => listDocuments() },
  { method: 'POST', pattern: /^\/api\/documents$/, handler: (_p, opts) => uploadDocument(opts.body as FormData) },
  { method: 'PATCH', pattern: /^\/api\/documents\/([^/]+)$/, handler: ([id], opts) => updateDocument(id, asBody(opts.body)) },
  { method: 'DELETE', pattern: /^\/api\/documents\/([^/]+)$/, handler: ([id]) => deleteDocument(id) },
];

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T | null> {
  const method = opts.method ?? 'GET';
  try {
    const [pathname, queryStr] = path.split('?');
    const query = new URLSearchParams(queryStr ?? '');
    const route = ROUTES.find((r) => r.method === method && r.pattern.test(pathname));
    if (!route) throw new Error(`مسار غير معروف: ${method} ${path}`);
    const match = route.pattern.exec(pathname)?.slice(1) ?? [];

    const data = await route.handler(match, opts, query);

    if (method === 'GET') getCache.set(path, data);
    else getCache.clear();

    if (opts.ok) notifyFn(opts.ok, 'success');
    return data as T;
  } catch (e) {
    notifyFn(toMessage(e), 'error');
    return null;
  }
}
