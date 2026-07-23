// أنواع الواجهة — تطابق نماذج Prisma لكن التواريخ تصل كنصوص ISO عبر JSON

// ===== 1) المالية =====
export interface Wallet {
  id: string;
  name: string;
  type: 'cash' | 'bank';
  balance: number;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  status: 'completed' | 'pending';
  amount: number;
  category: string;
  description: string | null;
  date: string;
  walletId: string | null;
  createdAt: string;
}

export interface Debt {
  id: string;
  personName: string;
  direction: 'owed_to_me' | 'i_owe';
  amount: number;
  paidAmount: number;
  dueDate: string | null;
  notes: string | null;
  isSettled: boolean;
  createdAt: string;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  billingCycle: 'monthly' | 'yearly';
  nextRenewal: string;
  category: string;
  isActive: boolean;
  createdAt: string;
}

export interface Asset {
  id: string;
  name: string;
  category: string;
  estimatedValue: number;
  purchaseDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  color: string;
  createdAt: string;
}

// ===== 2) العادات والمهام =====
export interface DailyTask {
  id: string;
  title: string;
  kind: 'recurring' | 'once';
  date: string | null;
  isActive: boolean;
  createdAt: string;
  logs: { date: string }[];
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  isActive: boolean;
  createdAt: string;
  logs: { date: string }[];
}

export interface WeeklyFocus {
  id: string;
  title: string;
  description: string | null;
  weekStart: string;
  doneDates: string; // JSON نصي
  createdAt: string;
}

// ===== 3) الأعمال والمشاريع =====
export interface WorkEntity {
  id: string;
  name: string;
  brandColor: string;
  contactInfo: string | null;
  createdAt: string;
}

export interface ProjectTask {
  id: string;
  title: string;
  isCompleted: boolean;
  completedAt: string | null;
  /** تُدرج في تقرير الإنجاز الرسمي؟ — لا تُفعَّل إلا لمهمة منجزة (isCompleted) */
  includeInReport: boolean;
  sortOrder: number;
  projectId: string;
  createdAt: string;
  /** يُضاف في تبويب «كافة المهام» لعرض اسم/لون المشروع */
  project?: { id: string; name: string; color: string } | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  type: 'finite' | 'ongoing';
  status: 'active' | 'done' | 'archived';
  color: string;
  startDate: string;
  endDate: string | null;
  endedReason: string | null;
  endedAt: string | null;
  entityId: string | null;
  entity?: WorkEntity | null;
  /** المهام الظاهرة فقط (المنجزة تنتقل للأرشيف بعد 3 أيام) */
  tasks: ProjectTask[];
  /** إجمالي المهام في قاعدة البيانات (يشمل المؤرشفة) */
  _count?: { tasks: number };
  createdAt: string;
}

// ===== 4) التقارير =====
export interface ReportTaskSnapshot {
  project_name: string;
  title: string;
  completed_at: string;
}

export interface Report {
  id: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  tasksSnapshot: string; // JSON نصي — يُقرأ بـ parseSnapshot()
  status: 'archived';
  archivedAt: string;
  projectId: string | null;
  project?: { id: string; name: string; color: string } | null;
  entityId: string | null;
  entity?: WorkEntity | null;
  createdAt: string;
}

/** قراءة آمنة للقطة المهام — لا ترمي خطأ أبداً */
export function parseSnapshot(raw: string): ReportTaskSnapshot[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** تقرير يدوي حر — منفصل تماماً عن التقارير المؤتمتة */
export interface ManualReport {
  id: string;
  title: string;
  reportDate: string;
  content: string; // HTML من محرر TipTap
  entityId: string | null;
  entity?: WorkEntity | null;
  documentId: string | null;
  createdAt: string;
}

// ===== 5) أرشيف المستندات =====
export interface DocFolder {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  _count?: { documents: number };
}

export interface Document {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  size: number;
  folderId: string | null;
  createdAt: string;
}

// ===== 6) القرآن الكريم =====
export interface HosoonDay {
  id: string;
  date: string;
  fort1: boolean;
  fort2: boolean;
  fort3: boolean;
  fort4: boolean;
  fort5: boolean;
  notes: string | null;
}

export interface ShanqitiSession {
  id: string;
  date: string;
  verses: string;
  targetReps: number;
  currentReps: number;
  linkingDone: boolean;
  reviewDone: boolean;
  isDone: boolean;
  createdAt: string;
}

export interface QuranEntry {
  id: string;
  date: string;
  surah: string;
  surahNumber: number | null;
  fromAyah: number | null;
  toAyah: number | null;
  ayahCount: number;
  type: 'hifz' | 'murajaa';
  notes: string | null;
  createdAt: string;
}

// ===== د) نظام المراجعة الذكية (SRS) =====
export interface SrsReviewLog {
  id: string;
  cardId: string;
  date: string;
  rating: 'easy' | 'medium' | 'hard';
  createdAt: string;
}

export interface SrsCard {
  id: string;
  label: string;
  surahNumber: number | null;
  intervalDays: number;
  easeFactor: number;
  dueDate: string;
  reviewCount: number;
  isActive: boolean;
  createdAt: string;
  logs?: SrsReviewLog[];
}

// ===== 7) التعلم والقراءة =====
export interface LearningLesson {
  id: string;
  itemId: string;
  title: string;
  url: string | null;
  isDone: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface LearningItem {
  id: string;
  title: string;
  kind: 'course' | 'book';
  category: string;
  url: string | null;
  channel: string | null;
  totalUnits: number;
  doneUnits: number;
  status: 'in_progress' | 'done' | 'paused';
  notes: string | null;
  lessons: LearningLesson[];
  createdAt: string;
}
