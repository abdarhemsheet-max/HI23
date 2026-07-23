import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ===================== إعدادات =====================
const BACKUP_PATH = resolve(__dirname, '..', process.argv[2] || 'hayati-backup-2026-07-23 (2).json');
const UPLOADS_DIR = resolve(__dirname, '..', 'uploads');
const USER_ID = 'e7b9e1ea-6a1a-4094-a584-832b39f8ab64';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yruoooslxppvsoqdbgxc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlydW9vb3NseHBwdnNvcWRiZ3hjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDc0NzUyNSwiZXhwIjoyMTAwMzIzNTI1fQ.rZkhyl6_7QqNyL-dPAiKnQoc1g2hxY2uSMxKb9C2WdI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

// خرائط تحويل IDs القديم → UUID الجديد
const idMap = {};

function newId(oldId) {
  if (!idMap[oldId]) idMap[oldId] = randomUUID();
  return idMap[oldId];
}

// ===================== قراءة الملف =====================
const raw = readFileSync(BACKUP_PATH, 'utf8');
const backup = JSON.parse(raw);
const { data } = backup;

console.log(`🚀 بدء هجرة البيانات إلى Supabase`);
console.log(`📂 المستخدم: ${USER_ID}`);
console.log(`📦 عدد السجلات: ${Object.values(data).flat().length}\n`);

// ===================== الحذف أولاً =====================
async function clearAll() {
  const tables = [
    'LearningLesson', 'SrsReviewLog', 'ProjectTask', 'TaskLog', 'HabitLog',
    'Document', 'DocFolder', 'ManualReport', 'Report',
    'LearningItem', 'SrsCard', 'QuranEntry', 'ShanqitiSession', 'HosoonDay',
    'Transaction', 'Debt', 'Subscription', 'Asset', 'SavingsGoal', 'Wallet',
    'WeeklyFocus', 'Habit', 'DailyTask', 'Project', 'WorkEntity',
  ];
  for (const t of tables) {
    const { error } = await supabase.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error && !error.message.includes('does not exist')) {
      console.log(`  ⚠️  ${t}: ${error.message}`);
    } else {
      console.log(`  ✅ تم مسح ${t}`);
    }
  }
}

// ===================== الإدراج =====================
async function insertAll() {
  let count = 0;

  // 1. Wallets
  for (const w of data.wallets) {
    const { error } = await supabase.from('Wallet').insert({
      id: newId(w.id), userId: USER_ID, name: w.name,
      type: w.type, balance: w.balance, createdAt: w.createdAt,
    });
    if (error) console.error(`  ❌ Wallet ${w.name}: ${error.message}`);
    else count++;
  }
  console.log(`✅ Wallets: ${count}`); count = 0;

  // 2. Transactions
  for (const t of data.transactions) {
    const { error } = await supabase.from('Transaction').insert({
      id: newId(t.id), userId: USER_ID,
      type: t.type, status: t.status, amount: t.amount,
      category: t.category, description: t.description,
      date: t.date, walletId: t.walletId ? newId(t.walletId) : null,
      createdAt: t.createdAt,
    });
    if (error) console.error(`  ❌ Transaction: ${error.message}`);
    else count++;
  }
  console.log(`✅ Transactions: ${count}`); count = 0;

  // 3. Debts
  for (const d of data.debts) {
    const { error } = await supabase.from('Debt').insert({
      id: newId(d.id), userId: USER_ID,
      personName: d.personName, direction: d.direction,
      amount: d.amount, paidAmount: d.paidAmount,
      dueDate: d.dueDate, notes: d.notes,
      isSettled: d.isSettled, createdAt: d.createdAt,
    });
    if (error) console.error(`  ❌ Debt: ${error.message}`);
    else count++;
  }
  console.log(`✅ Debts: ${count}`); count = 0;

  // 4. Subscriptions
  for (const s of data.subscriptions) {
    const { error } = await supabase.from('Subscription').insert({
      id: newId(s.id), userId: USER_ID,
      name: s.name, amount: s.amount,
      billingCycle: s.billingCycle, nextRenewal: s.nextRenewal,
      category: s.category, isActive: s.isActive, createdAt: s.createdAt,
    });
    if (error) console.error(`  ❌ Subscription: ${error.message}`);
    else count++;
  }
  console.log(`✅ Subscriptions: ${count}`); count = 0;

  // 5. Assets
  for (const a of data.assets) {
    const { error } = await supabase.from('Asset').insert({
      id: newId(a.id), userId: USER_ID,
      name: a.name, category: a.category,
      estimatedValue: a.estimatedValue,
      purchaseDate: a.purchaseDate, notes: a.notes, createdAt: a.createdAt,
    });
    if (error) console.error(`  ❌ Asset: ${error.message}`);
    else count++;
  }
  console.log(`✅ Assets: ${count}`); count = 0;

  // 6. DailyTasks
  for (const t of data.dailyTasks) {
    const { error } = await supabase.from('DailyTask').insert({
      id: newId(t.id), userId: USER_ID,
      title: t.title, kind: t.kind, date: t.date,
      isActive: t.isActive, createdAt: t.createdAt,
    });
    if (error) console.error(`  ❌ DailyTask: ${error.message}`);
    else count++;
  }
  console.log(`✅ DailyTasks: ${count}`); count = 0;

  // 7. TaskLogs
  for (const l of data.taskLogs) {
    const { error } = await supabase.from('TaskLog').insert({
      id: randomUUID(), taskId: newId(l.taskId), date: l.date,
    });
    if (error) console.error(`  ❌ TaskLog: ${error.message}`);
    else count++;
  }
  console.log(`✅ TaskLogs: ${count}`); count = 0;

  // 8. Habits
  for (const h of data.habits) {
    const { error } = await supabase.from('Habit').insert({
      id: newId(h.id), userId: USER_ID,
      name: h.name, icon: h.icon, color: h.color,
      isActive: h.isActive, createdAt: h.createdAt,
    });
    if (error) console.error(`  ❌ Habit: ${error.message}`);
    else count++;
  }
  console.log(`✅ Habits: ${count}`); count = 0;

  // 9. WeeklyFocus
  for (const w of data.weeklyFocus) {
    const { error } = await supabase.from('WeeklyFocus').insert({
      id: newId(w.id), userId: USER_ID,
      title: w.title, description: w.description,
      weekStart: w.weekStart, doneDates: w.doneDates,
      createdAt: w.createdAt,
    });
    if (error) console.error(`  ❌ WeeklyFocus: ${error.message}`);
    else count++;
  }
  console.log(`✅ WeeklyFocus: ${count}`); count = 0;

  // 10. WorkEntities
  for (const e of data.workEntities) {
    const { error } = await supabase.from('WorkEntity').insert({
      id: newId(e.id), userId: USER_ID,
      name: e.name, brandColor: e.brandColor,
      contactInfo: e.contactInfo, createdAt: e.createdAt,
    });
    if (error) console.error(`  ❌ WorkEntity: ${error.message}`);
    else count++;
  }
  console.log(`✅ WorkEntities: ${count}`); count = 0;

  // 11. Projects
  for (const p of data.projects) {
    const { error } = await supabase.from('Project').insert({
      id: newId(p.id), userId: USER_ID,
      name: p.name, description: p.description,
      type: p.type, status: p.status, color: p.color,
      startDate: p.startDate, endDate: p.endDate,
      endedReason: p.endedReason, endedAt: p.endedAt,
      entityId: p.entityId ? newId(p.entityId) : null,
      createdAt: p.createdAt,
    });
    if (error) console.error(`  ❌ Project ${p.name}: ${error.message}`);
    else count++;
  }
  console.log(`✅ Projects: ${count}`); count = 0;

  // 12. ProjectTasks
  for (const t of data.projectTasks) {
    const { error } = await supabase.from('ProjectTask').insert({
      id: newId(t.id), title: t.title,
      isCompleted: t.isCompleted, completedAt: t.completedAt,
      includeInReport: t.includeInReport, sortOrder: t.sortOrder,
      projectId: newId(t.projectId), createdAt: t.createdAt,
    });
    if (error) console.error(`  ❌ ProjectTask: ${error.message}`);
    else count++;
  }
  console.log(`✅ ProjectTasks: ${count}`); count = 0;

  // 13. DocFolders
  for (const f of data.docFolders) {
    const { error } = await supabase.from('DocFolder').insert({
      id: newId(f.id), userId: USER_ID,
      name: f.name, color: f.color, createdAt: f.createdAt,
    });
    if (error) console.error(`  ❌ DocFolder: ${error.message}`);
    else count++;
  }
  console.log(`✅ DocFolders: ${count}`); count = 0;

  // 14. Documents — رفع الملفات إلى B2 أولاً ثم إدراجها
  console.log(`\n📁 رفع ${data.documents.length} ملف إلى B2...`);
  for (const d of data.documents) {
    const oldPath = resolve(UPLOADS_DIR, d.fileName);
    if (!existsSync(oldPath)) {
      console.log(`  ⚠️  الملف غير موجود: ${d.fileName}`);
      continue;
    }

    const fileBuffer = readFileSync(oldPath);
    const newFileName = `abdarhemsh-${d.fileName}`;
    const blob = new Blob([fileBuffer], { type: d.mimeType });
    const file = new File([blob], newFileName, { type: d.mimeType });

    // رفع عبر Edge Function
    const form = new FormData();
    form.append('file', file);
    form.append('fileName', newFileName);

    const res = await fetch(`${FUNCTIONS_URL}/b2-upload`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      body: form,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`  ❌ فشل رفع ${d.fileName}: ${err}`);
      continue;
    }

    const result = await res.json();
    if (!result.upload) {
      console.error(`  ❌ فشل رفع ${d.fileName}: استجابة غير متوقعة`);
      continue;
    }

    // إدراج سجل المستند
    const { error } = await supabase.from('Document').insert({
      id: newId(d.id), userId: USER_ID,
      name: d.name, fileName: newFileName,
      bzFileId: result.upload.fileId,
      mimeType: d.mimeType, size: d.size,
      folderId: d.folderId ? newId(d.folderId) : null,
      createdAt: d.createdAt,
    });

    if (error) {
      console.error(`  ❌ Document DB ${d.name}: ${error.message}`);
    } else {
      count++;
      console.log(`  ✅ ${d.name}`);
    }
  }
  console.log(`✅ Documents: ${count}`); count = 0;

  // 15. HosoonDays
  for (const h of data.hosoonDays) {
    const { error } = await supabase.from('HosoonDay').insert({
      id: newId(h.id), userId: USER_ID,
      date: h.date, fort1: h.fort1, fort2: h.fort2,
      fort3: h.fort3, fort4: h.fort4, fort5: h.fort5,
      notes: h.notes,
    });
    if (error) console.error(`  ❌ HosoonDay: ${error.message}`);
    else count++;
  }
  console.log(`✅ HosoonDays: ${count}`);
}

// ===================== التشغيل =====================
(async () => {
  console.log('🗑️  مسح البيانات القديمة...');
  await clearAll();

  console.log('\n📥 إدراج البيانات الجديدة...');
  await insertAll();

  console.log('\n🎉 تمت الهجرة بنجاح!');
})().catch(console.error);
