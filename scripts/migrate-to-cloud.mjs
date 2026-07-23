// ======================================================================
// سكربت هجرة لمرة واحدة: prisma/dev.db (SQLite) + uploads/ (ملفات محلية)
// → Supabase (Postgres) + Backblaze B2.
//
// يُشغَّل يدوياً من جهازك بعد إنشاء مشروع Supabase وحاوية B2 (راجع README):
//
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   SUPABASE_USER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
//   VITE_B2_KEY_ID=xxxx VITE_B2_APPLICATION_KEY=xxxx \
//   VITE_B2_BUCKET_ID=xxxx VITE_B2_BUCKET_NAME=xxxx \
//   npm run migrate:data
//
// SUPABASE_SERVICE_ROLE_KEY: من Supabase Dashboard → Project Settings → API
//   (المفتاح السرّي — لا تضعه أبداً في كود الواجهة أو .env الخاص بـ Vite).
// SUPABASE_USER_ID: من Authentication → Users → انسخ UUID المستخدم الذي
//   أنشأته لتسجيل الدخول — كل البيانات المهاجَرة تُنسب إليه.
//
// السكربت يقرأ dev.db للقراءة فقط (readonly) ولا يمسّه أو يمسّ uploads/ —
// يمكن تشغيله أكثر من مرة بأمان نسبي، لكنه لا يتحقق من التكرار، لذا
// شغّله مرة واحدة على قاعدة Supabase فارغة.
//
// يستخدم وحدة node:sqlite المدمجة في Node (يتطلب Node 22.5+ — لا حزمة
// خارجية تحتاج تصريف Native/Visual Studio على ويندوز).
// ======================================================================

import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@supabase/supabase-js';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_ID = process.env.SUPABASE_USER_ID;
const B2_KEY_ID = process.env.VITE_B2_KEY_ID;
const B2_APP_KEY = process.env.VITE_B2_APPLICATION_KEY;
const B2_BUCKET_ID = process.env.VITE_B2_BUCKET_ID;
const B2_BUCKET_NAME = process.env.VITE_B2_BUCKET_NAME;

if (!SUPABASE_URL || !SERVICE_KEY || !USER_ID) {
  console.error('❌ اضبط SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY و SUPABASE_USER_ID كمتغيرات بيئة قبل التشغيل (راجع التعليق أعلى الملف).');
  process.exit(1);
}
const skipFiles = !B2_KEY_ID || !B2_APP_KEY || !B2_BUCKET_ID || !B2_BUCKET_NAME;
if (skipFiles) {
  console.warn('⚠ لم تُضبط متغيرات B2 — سيُهاجَر سجل المستندات بلا ملفات فعلية (تخطّي الرفع).');
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(root, 'prisma', 'dev.db'), { readOnly: true });
const uploadDir = path.join(root, 'uploads');

const idMap = new Map();
function remap(oldId) {
  if (oldId == null) return null;
  if (!idMap.has(oldId)) idMap.set(oldId, randomUUID());
  return idMap.get(oldId);
}

async function insertBatch(table, rows) {
  if (rows.length === 0) {
    console.log(`· ${table}: لا سجلات`);
    return;
  }
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + CHUNK));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`✓ ${table}: ${rows.length} صف`);
}

// ----- Backblaze B2: نسخة Node مطابقة لـ src/backend/config/b2Storage.ts -----
let b2Auth = null;
async function b2Authorize() {
  if (b2Auth) return b2Auth;
  const res = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    headers: { Authorization: 'Basic ' + Buffer.from(`${B2_KEY_ID}:${B2_APP_KEY}`).toString('base64') },
  });
  if (!res.ok) throw new Error('فشل الاتصال بـ B2 — تحقق من المفاتيح');
  b2Auth = await res.json();
  return b2Auth;
}

async function uploadFileToB2(filePath, storedName, mimeType) {
  const auth = await b2Authorize();
  const uploadUrlRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: 'POST',
    headers: { Authorization: auth.authorizationToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucketId: B2_BUCKET_ID }),
  });
  if (!uploadUrlRes.ok) throw new Error('تعذّر تجهيز رابط الرفع في B2');
  const { uploadUrl, authorizationToken } = await uploadUrlRes.json();

  const buffer = readFileSync(filePath);
  const sha1 = createHash('sha1').update(buffer).digest('hex');
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: authorizationToken,
      'X-Bz-File-Name': encodeURIComponent(storedName),
      'Content-Type': mimeType || 'b2/x-auto',
      'X-Bz-Content-Sha1': sha1,
    },
    body: buffer,
  });
  if (!uploadRes.ok) throw new Error(`فشل رفع ${storedName} إلى B2`);
  const json = await uploadRes.json();
  return json.fileId;
}

async function main() {
  console.log('🚀 بدء الهجرة من prisma/dev.db إلى Supabase' + (skipFiles ? '' : ' + Backblaze B2') + '...\n');

  // 1) المالية — المحافظ أولاً (لا تعتمد على شيء)
  await insertBatch('Wallet', db.prepare('SELECT * FROM Wallet').all().map((w) => ({
    id: remap(w.id), userId: USER_ID, name: w.name, type: w.type, balance: w.balance, createdAt: w.createdAt,
  })));

  await insertBatch('Transaction', db.prepare('SELECT * FROM Transaction').all().map((t) => ({
    id: remap(t.id), userId: USER_ID, type: t.type, status: t.status, amount: t.amount,
    category: t.category, description: t.description, date: t.date, walletId: remap(t.walletId), createdAt: t.createdAt,
  })));

  await insertBatch('Debt', db.prepare('SELECT * FROM Debt').all().map((d) => ({
    id: remap(d.id), userId: USER_ID, personName: d.personName, direction: d.direction, amount: d.amount,
    paidAmount: d.paidAmount, dueDate: d.dueDate, notes: d.notes, isSettled: !!d.isSettled, createdAt: d.createdAt,
  })));

  await insertBatch('Subscription', db.prepare('SELECT * FROM Subscription').all().map((s) => ({
    id: remap(s.id), userId: USER_ID, name: s.name, amount: s.amount, billingCycle: s.billingCycle,
    nextRenewal: s.nextRenewal, category: s.category, isActive: !!s.isActive, createdAt: s.createdAt,
  })));

  await insertBatch('Asset', db.prepare('SELECT * FROM Asset').all().map((a) => ({
    id: remap(a.id), userId: USER_ID, name: a.name, category: a.category, estimatedValue: a.estimatedValue,
    purchaseDate: a.purchaseDate, notes: a.notes, createdAt: a.createdAt,
  })));

  await insertBatch('SavingsGoal', db.prepare('SELECT * FROM SavingsGoal').all().map((g) => ({
    id: remap(g.id), userId: USER_ID, name: g.name, targetAmount: g.targetAmount, currentAmount: g.currentAmount,
    deadline: g.deadline, color: g.color, createdAt: g.createdAt,
  })));

  // 2) العادات والمهام
  await insertBatch('DailyTask', db.prepare('SELECT * FROM DailyTask').all().map((t) => ({
    id: remap(t.id), userId: USER_ID, title: t.title, kind: t.kind, date: t.date, isActive: !!t.isActive, createdAt: t.createdAt,
  })));
  await insertBatch('TaskLog', db.prepare('SELECT * FROM TaskLog').all().map((l) => ({
    id: remap(l.id), taskId: remap(l.taskId), date: l.date,
  })));

  await insertBatch('Habit', db.prepare('SELECT * FROM Habit').all().map((h) => ({
    id: remap(h.id), userId: USER_ID, name: h.name, icon: h.icon, color: h.color, isActive: !!h.isActive, createdAt: h.createdAt,
  })));
  await insertBatch('HabitLog', db.prepare('SELECT * FROM HabitLog').all().map((l) => ({
    id: remap(l.id), habitId: remap(l.habitId), date: l.date,
  })));

  await insertBatch('WeeklyFocus', db.prepare('SELECT * FROM WeeklyFocus').all().map((f) => ({
    id: remap(f.id), userId: USER_ID, title: f.title, description: f.description, weekStart: f.weekStart,
    doneDates: f.doneDates, createdAt: f.createdAt,
  })));

  // 3) الأعمال والمشاريع
  await insertBatch('WorkEntity', db.prepare('SELECT * FROM WorkEntity').all().map((e) => ({
    id: remap(e.id), userId: USER_ID, name: e.name, brandColor: e.brandColor, contactInfo: e.contactInfo, createdAt: e.createdAt,
  })));

  await insertBatch('Project', db.prepare('SELECT * FROM Project').all().map((p) => ({
    id: remap(p.id), userId: USER_ID, name: p.name, description: p.description, type: p.type, status: p.status,
    color: p.color, startDate: p.startDate, endDate: p.endDate, endedReason: p.endedReason, endedAt: p.endedAt,
    entityId: remap(p.entityId), createdAt: p.createdAt,
  })));

  await insertBatch('ProjectTask', db.prepare('SELECT * FROM ProjectTask').all().map((t) => ({
    id: remap(t.id), title: t.title, isCompleted: !!t.isCompleted, completedAt: t.completedAt,
    includeInReport: !!t.includeInReport, sortOrder: t.sortOrder, projectId: remap(t.projectId), createdAt: t.createdAt,
  })));

  // 4) أرشيف المستندات (يجب قبل التقارير لأن ManualReport.documentId يشير إليه)
  await insertBatch('DocFolder', db.prepare('SELECT * FROM DocFolder').all().map((f) => ({
    id: remap(f.id), userId: USER_ID, name: f.name, color: f.color, createdAt: f.createdAt,
  })));

  const documents = db.prepare('SELECT * FROM Document').all();
  const docRows = [];
  for (const d of documents) {
    if (skipFiles) {
      docRows.push({
        id: remap(d.id), userId: USER_ID, name: d.name, fileName: d.fileName, bzFileId: '',
        mimeType: d.mimeType, size: d.size, folderId: remap(d.folderId), createdAt: d.createdAt,
      });
      continue;
    }
    const localPath = path.join(uploadDir, d.fileName);
    if (!existsSync(localPath)) {
      console.warn(`  ⚠ تخطّي رفع «${d.name}» — الملف غير موجود في uploads/`);
      docRows.push({
        id: remap(d.id), userId: USER_ID, name: d.name, fileName: d.fileName, bzFileId: '',
        mimeType: d.mimeType, size: d.size, folderId: remap(d.folderId), createdAt: d.createdAt,
      });
      continue;
    }
    const storedName = randomUUID() + path.extname(d.fileName);
    const bzFileId = await uploadFileToB2(localPath, storedName, d.mimeType);
    docRows.push({
      id: remap(d.id), userId: USER_ID, name: d.name, fileName: storedName, bzFileId,
      mimeType: d.mimeType, size: d.size, folderId: remap(d.folderId), createdAt: d.createdAt,
    });
    console.log(`  ↑ رُفع: ${d.name}`);
  }
  await insertBatch('Document', docRows);

  // 5) التقارير
  await insertBatch('Report', db.prepare('SELECT * FROM Report').all().map((r) => ({
    id: remap(r.id), userId: USER_ID, title: r.title, periodStart: r.periodStart, periodEnd: r.periodEnd,
    tasksSnapshot: r.tasksSnapshot, status: r.status, archivedAt: r.archivedAt,
    projectId: remap(r.projectId), entityId: remap(r.entityId), createdAt: r.createdAt,
  })));

  await insertBatch('ManualReport', db.prepare('SELECT * FROM ManualReport').all().map((r) => ({
    id: remap(r.id), userId: USER_ID, title: r.title, reportDate: r.reportDate, content: r.content,
    entityId: remap(r.entityId), documentId: remap(r.documentId), createdAt: r.createdAt,
  })));

  // 6) القرآن الكريم
  await insertBatch('HosoonDay', db.prepare('SELECT * FROM HosoonDay').all().map((h) => ({
    id: remap(h.id), userId: USER_ID, date: h.date, fort1: !!h.fort1, fort2: !!h.fort2, fort3: !!h.fort3,
    fort4: !!h.fort4, fort5: !!h.fort5, notes: h.notes,
  })));

  await insertBatch('ShanqitiSession', db.prepare('SELECT * FROM ShanqitiSession').all().map((s) => ({
    id: remap(s.id), userId: USER_ID, date: s.date, verses: s.verses, targetReps: s.targetReps,
    currentReps: s.currentReps, linkingDone: !!s.linkingDone, reviewDone: !!s.reviewDone, isDone: !!s.isDone, createdAt: s.createdAt,
  })));

  await insertBatch('QuranEntry', db.prepare('SELECT * FROM QuranEntry').all().map((e) => ({
    id: remap(e.id), userId: USER_ID, date: e.date, surah: e.surah, surahNumber: e.surahNumber,
    fromAyah: e.fromAyah, toAyah: e.toAyah, ayahCount: e.ayahCount, type: e.type, notes: e.notes, createdAt: e.createdAt,
  })));

  await insertBatch('SrsCard', db.prepare('SELECT * FROM SrsCard').all().map((c) => ({
    id: remap(c.id), userId: USER_ID, label: c.label, surahNumber: c.surahNumber, intervalDays: c.intervalDays,
    easeFactor: c.easeFactor, dueDate: c.dueDate, reviewCount: c.reviewCount, isActive: !!c.isActive, createdAt: c.createdAt,
  })));

  await insertBatch('SrsReviewLog', db.prepare('SELECT * FROM SrsReviewLog').all().map((l) => ({
    id: remap(l.id), cardId: remap(l.cardId), date: l.date, rating: l.rating, createdAt: l.createdAt,
  })));

  // 7) التعلم والقراءة
  await insertBatch('LearningItem', db.prepare('SELECT * FROM LearningItem').all().map((i) => ({
    id: remap(i.id), userId: USER_ID, title: i.title, kind: i.kind, category: i.category, url: i.url,
    channel: i.channel, totalUnits: i.totalUnits, doneUnits: i.doneUnits, status: i.status, notes: i.notes, createdAt: i.createdAt,
  })));

  await insertBatch('LearningLesson', db.prepare('SELECT * FROM LearningLesson').all().map((l) => ({
    id: remap(l.id), itemId: remap(l.itemId), title: l.title, url: l.url, isDone: !!l.isDone,
    sortOrder: l.sortOrder, createdAt: l.createdAt,
  })));

  console.log('\n✅ اكتملت الهجرة بنجاح.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('\n❌ فشلت الهجرة:', e.message);
    process.exit(1);
  });
