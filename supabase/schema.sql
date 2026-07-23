-- =====================================================================
--  نظام حياتي — مخطط قاعدة بيانات Supabase (Postgres)
--  يحل محل prisma/schema.prisma (SQLite) بعد الهجرة إلى Vite + Supabase.
--
--  ملاحظات تصميم:
--  - أسماء الجداول والأعمدة بصيغة camelCase مقتبسة (مطابقة تماماً لأسماء
--    حقول Prisma الأصلية) حتى تبقى استجابات Supabase JS متوافقة تماماً
--    مع كود الواجهة الحالي دون أي تعديل في أسماء الحقول.
--  - كل جدول يحمل عمود "userId" (افتراضياً auth.uid()) وسياسة RLS تقصر
--    الوصول على صاحب البيانات فقط — ضروري لأن الموقع سيُنشر كرابط عام.
--  - المبالغ المالية numeric(14,2) بدل float لتفادي أخطاء التقريب.
--  - حقول "اليوم" (YYYY-MM-DD) من نوع date بدل النص — تبقى تُعاد كنص
--    بنفس الصيغة عبر PostgREST فتظل متوافقة مع دوال shared/utils.ts.
--  - القيود oneOf الأصلية أصبحت check constraints صريحة في القاعدة.
--
--  طريقة التشغيل: انسخ محتوى هذا الملف في Supabase Dashboard →
--  SQL Editor → New query → Run. مرة واحدة فقط بعد إنشاء المشروع.
-- =====================================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------
-- 1) المالية (Finance & Wealth)
-- ------------------------------------------------------------------

create table "Wallet" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'cash' check (type in ('cash','bank')),
  balance numeric(14,2) not null default 0,
  "createdAt" timestamptz not null default now()
);

create table "Transaction" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense')),
  status text not null default 'completed' check (status in ('completed','pending')),
  amount numeric(14,2) not null,
  category text not null default 'عام',
  description text,
  date timestamptz not null default now(),
  "walletId" uuid references "Wallet"(id) on delete set null,
  "createdAt" timestamptz not null default now()
);
create index "Transaction_walletId_idx" on "Transaction"("walletId");

create table "Debt" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "personName" text not null,
  direction text not null check (direction in ('owed_to_me','i_owe')),
  amount numeric(14,2) not null,
  "paidAmount" numeric(14,2) not null default 0,
  "dueDate" timestamptz,
  notes text,
  "isSettled" boolean not null default false,
  "createdAt" timestamptz not null default now()
);

create table "Subscription" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(14,2) not null default 0,
  "billingCycle" text not null default 'monthly' check ("billingCycle" in ('monthly','yearly')),
  "nextRenewal" timestamptz not null,
  category text not null default 'أدوات',
  "isActive" boolean not null default true,
  "createdAt" timestamptz not null default now()
);

create table "Asset" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  category text not null default 'عام',
  "estimatedValue" numeric(14,2) not null default 0,
  "purchaseDate" timestamptz,
  notes text,
  "createdAt" timestamptz not null default now()
);

create table "SavingsGoal" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  "targetAmount" numeric(14,2) not null,
  "currentAmount" numeric(14,2) not null default 0,
  deadline timestamptz,
  color text not null default '#34d399',
  "createdAt" timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- 2) العادات والمهام (Habits & Tasks)
-- ------------------------------------------------------------------

create table "DailyTask" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  kind text not null default 'recurring' check (kind in ('recurring','once')),
  date date,
  "isActive" boolean not null default true,
  "createdAt" timestamptz not null default now()
);

create table "TaskLog" (
  id uuid primary key default gen_random_uuid(),
  "taskId" uuid not null references "DailyTask"(id) on delete cascade,
  date date not null,
  unique ("taskId", date)
);

create table "Habit" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default '🔥',
  color text not null default '#34d399',
  "isActive" boolean not null default true,
  "createdAt" timestamptz not null default now()
);

create table "HabitLog" (
  id uuid primary key default gen_random_uuid(),
  "habitId" uuid not null references "Habit"(id) on delete cascade,
  date date not null,
  unique ("habitId", date)
);

create table "WeeklyFocus" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  "weekStart" date not null,
  "doneDates" text not null default '[]',
  "createdAt" timestamptz not null default now(),
  unique ("userId", "weekStart")
);

-- ------------------------------------------------------------------
-- 3) الأعمال والمشاريع (Work & Projects)
-- ------------------------------------------------------------------

create table "WorkEntity" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  "brandColor" text not null default '#38bdf8',
  "contactInfo" text,
  "createdAt" timestamptz not null default now()
);

create table "Project" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  description text,
  type text not null default 'finite' check (type in ('finite','ongoing')),
  status text not null default 'active' check (status in ('active','done','archived')),
  color text not null default '#a78bfa',
  "startDate" timestamptz not null default now(),
  "endDate" timestamptz,
  "endedReason" text,
  "endedAt" timestamptz,
  "entityId" uuid references "WorkEntity"(id) on delete set null,
  "createdAt" timestamptz not null default now()
);

create table "ProjectTask" (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  "isCompleted" boolean not null default false,
  "completedAt" timestamptz,
  "includeInReport" boolean not null default false,
  "sortOrder" integer not null default 0,
  "projectId" uuid not null references "Project"(id) on delete cascade,
  "createdAt" timestamptz not null default now()
);
create index "ProjectTask_sortOrder_idx" on "ProjectTask"("sortOrder");

-- ------------------------------------------------------------------
-- 4) التقارير (Reports)
-- ------------------------------------------------------------------

create table "Report" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  "periodStart" timestamptz not null,
  "periodEnd" timestamptz not null,
  "tasksSnapshot" text not null default '[]',
  status text not null default 'archived' check (status = 'archived'),
  "archivedAt" timestamptz not null default now(),
  "projectId" uuid references "Project"(id) on delete set null,
  "entityId" uuid references "WorkEntity"(id) on delete set null,
  "createdAt" timestamptz not null default now()
);

create table "ManualReport" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  "reportDate" timestamptz not null default now(),
  content text not null default '',
  "entityId" uuid references "WorkEntity"(id) on delete set null,
  "documentId" uuid,
  "createdAt" timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- 5) أرشيف المستندات (Document Archive)
-- ------------------------------------------------------------------

create table "DocFolder" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#38bdf8',
  "createdAt" timestamptz not null default now()
);

-- الملف الفعلي يُحفظ الآن في Backblaze B2 (لا قرص محلي):
-- "fileName" = مفتاح التخزين داخل الحاوية (bucket) — يماثل دور fileName
-- الأصلي على القرص. "bzFileId" لازم لحذف الملف من B2 عند حذف السجل.
create table "Document" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  "fileName" text not null,
  "bzFileId" text not null default '',
  "mimeType" text not null default 'application/octet-stream',
  size bigint not null default 0,
  "folderId" uuid references "DocFolder"(id) on delete set null,
  "createdAt" timestamptz not null default now()
);

alter table "ManualReport" add constraint "ManualReport_documentId_fkey"
  foreign key ("documentId") references "Document"(id) on delete set null;

-- ------------------------------------------------------------------
-- 6) القرآن الكريم
-- ------------------------------------------------------------------

create table "HosoonDay" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  fort1 boolean not null default false,
  fort2 boolean not null default false,
  fort3 boolean not null default false,
  fort4 boolean not null default false,
  fort5 boolean not null default false,
  notes text,
  unique ("userId", date)
);

create table "ShanqitiSession" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  verses text not null,
  "targetReps" integer not null default 50,
  "currentReps" integer not null default 0,
  "linkingDone" boolean not null default false,
  "reviewDone" boolean not null default false,
  "isDone" boolean not null default false,
  "createdAt" timestamptz not null default now()
);

create table "QuranEntry" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  surah text not null,
  "surahNumber" integer check ("surahNumber" is null or ("surahNumber" between 1 and 114)),
  "fromAyah" integer,
  "toAyah" integer,
  "ayahCount" integer not null default 0,
  type text not null default 'hifz' check (type in ('hifz','murajaa')),
  notes text,
  "createdAt" timestamptz not null default now()
);

create table "SrsCard" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null,
  "surahNumber" integer check ("surahNumber" is null or ("surahNumber" between 1 and 114)),
  "intervalDays" integer not null default 1,
  "easeFactor" numeric(4,2) not null default 2.5,
  "dueDate" date not null,
  "reviewCount" integer not null default 0,
  "isActive" boolean not null default true,
  "createdAt" timestamptz not null default now()
);
create index "SrsCard_dueDate_idx" on "SrsCard"("dueDate");

create table "SrsReviewLog" (
  id uuid primary key default gen_random_uuid(),
  "cardId" uuid not null references "SrsCard"(id) on delete cascade,
  date date not null,
  rating text not null check (rating in ('easy','medium','hard')),
  "createdAt" timestamptz not null default now()
);
create index "SrsReviewLog_date_idx" on "SrsReviewLog"(date);

-- ------------------------------------------------------------------
-- 7) التعلم والقراءة (Courses & Books)
-- ------------------------------------------------------------------

create table "LearningItem" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  kind text not null default 'course' check (kind in ('course','book')),
  category text not null default 'عام',
  url text,
  channel text,
  "totalUnits" integer not null default 1,
  "doneUnits" integer not null default 0,
  status text not null default 'in_progress' check (status in ('in_progress','done','paused')),
  notes text,
  "createdAt" timestamptz not null default now()
);

create table "LearningLesson" (
  id uuid primary key default gen_random_uuid(),
  "itemId" uuid not null references "LearningItem"(id) on delete cascade,
  title text not null,
  url text,
  "isDone" boolean not null default false,
  "sortOrder" integer not null default 0,
  "createdAt" timestamptz not null default now()
);

-- =====================================================================
--  أمان: تفعيل RLS + سياسة "المالك فقط" على كل جدول يحمل userId مباشرة.
--  الجداول التابعة (TaskLog, HabitLog, ProjectTask, SrsReviewLog,
--  LearningLesson) تُحمى عبر ربطها بالجدول الأب (نفس المبدأ، سياسة
--  تتحقق من ملكية الصف الأب عبر subquery).
-- =====================================================================

alter table "Wallet" enable row level security;
alter table "Transaction" enable row level security;
alter table "Debt" enable row level security;
alter table "Subscription" enable row level security;
alter table "Asset" enable row level security;
alter table "SavingsGoal" enable row level security;
alter table "DailyTask" enable row level security;
alter table "Habit" enable row level security;
alter table "WeeklyFocus" enable row level security;
alter table "WorkEntity" enable row level security;
alter table "Project" enable row level security;
alter table "Report" enable row level security;
alter table "ManualReport" enable row level security;
alter table "DocFolder" enable row level security;
alter table "Document" enable row level security;
alter table "HosoonDay" enable row level security;
alter table "ShanqitiSession" enable row level security;
alter table "QuranEntry" enable row level security;
alter table "SrsCard" enable row level security;
alter table "LearningItem" enable row level security;
alter table "TaskLog" enable row level security;
alter table "HabitLog" enable row level security;
alter table "ProjectTask" enable row level security;
alter table "SrsReviewLog" enable row level security;
alter table "LearningLesson" enable row level security;

create policy "owner_all" on "Wallet" for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "owner_all" on "Transaction" for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "owner_all" on "Debt" for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "owner_all" on "Subscription" for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "owner_all" on "Asset" for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "owner_all" on "SavingsGoal" for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "owner_all" on "DailyTask" for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "owner_all" on "Habit" for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "owner_all" on "WeeklyFocus" for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "owner_all" on "WorkEntity" for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "owner_all" on "Project" for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "owner_all" on "Report" for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "owner_all" on "ManualReport" for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "owner_all" on "DocFolder" for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "owner_all" on "Document" for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "owner_all" on "HosoonDay" for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "owner_all" on "ShanqitiSession" for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "owner_all" on "QuranEntry" for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "owner_all" on "SrsCard" for all using (auth.uid() = "userId") with check (auth.uid() = "userId");
create policy "owner_all" on "LearningItem" for all using (auth.uid() = "userId") with check (auth.uid() = "userId");

create policy "owner_all" on "TaskLog" for all
  using (exists (select 1 from "DailyTask" t where t.id = "taskId" and t."userId" = auth.uid()))
  with check (exists (select 1 from "DailyTask" t where t.id = "taskId" and t."userId" = auth.uid()));

create policy "owner_all" on "HabitLog" for all
  using (exists (select 1 from "Habit" h where h.id = "habitId" and h."userId" = auth.uid()))
  with check (exists (select 1 from "Habit" h where h.id = "habitId" and h."userId" = auth.uid()));

create policy "owner_all" on "ProjectTask" for all
  using (exists (select 1 from "Project" p where p.id = "projectId" and p."userId" = auth.uid()))
  with check (exists (select 1 from "Project" p where p.id = "projectId" and p."userId" = auth.uid()));

create policy "owner_all" on "SrsReviewLog" for all
  using (exists (select 1 from "SrsCard" c where c.id = "cardId" and c."userId" = auth.uid()))
  with check (exists (select 1 from "SrsCard" c where c.id = "cardId" and c."userId" = auth.uid()));

create policy "owner_all" on "LearningLesson" for all
  using (exists (select 1 from "LearningItem" i where i.id = "itemId" and i."userId" = auth.uid()))
  with check (exists (select 1 from "LearningItem" i where i.id = "itemId" and i."userId" = auth.uid()));

-- =====================================================================
--  دوال RPC — العمليات التي تلمس أكثر من جدول تُنفَّذ هنا لضمان الذرّية
--  (تنجح كاملة أو تفشل كاملة) تماماً كما كانت مع prisma.$transaction.
--  SECURITY INVOKER (الافتراضي) — تعمل بصلاحيات المستخدم المتصل فتبقى
--  سياسات RLS سارية بالكامل داخل الدالة، لا حاجة لـ SECURITY DEFINER.
-- =====================================================================

-- ----- تسديد/تحصيل دين -----
create or replace function settle_debt(p_debt_id uuid, p_wallet_id uuid)
returns "Debt" language plpgsql as $$
declare
  v_debt "Debt";
  v_wallet "Wallet";
  v_remaining numeric(14,2);
  v_collecting boolean;
begin
  select * into v_debt from "Debt" where id = p_debt_id and "userId" = auth.uid() for update;
  if not found then raise exception 'الدين غير موجود — أعد تحميل الصفحة'; end if;
  if v_debt."isSettled" then raise exception 'هذا الدين مسدد بالفعل'; end if;

  v_remaining := v_debt.amount - v_debt."paidAmount";
  if v_remaining <= 0 then raise exception 'لا يوجد مبلغ متبقٍ على هذا الدين'; end if;

  select * into v_wallet from "Wallet" where id = p_wallet_id and "userId" = auth.uid() for update;
  if not found then raise exception 'المحفظة غير موجودة'; end if;

  v_collecting := v_debt.direction = 'owed_to_me';
  if not v_collecting and v_wallet.balance < v_remaining then
    raise exception 'رصيد "%" غير كافٍ لسداد %', v_wallet.name, v_remaining;
  end if;

  insert into "Transaction"(type, status, amount, category, description, "walletId")
  values (
    case when v_collecting then 'income' else 'expense' end,
    'completed',
    v_remaining,
    case when v_collecting then 'تحصيل دين' else 'سداد دين' end,
    (case when v_collecting then 'تحصيل دين من ' else 'سداد دين إلى ' end) || v_debt."personName",
    v_wallet.id
  );

  update "Wallet" set balance = balance + (case when v_collecting then v_remaining else -v_remaining end)
    where id = v_wallet.id;

  update "Debt" set "isSettled" = true, "paidAmount" = v_debt.amount
    where id = v_debt.id returning * into v_debt;

  return v_debt;
end;
$$;

-- ----- دفع اشتراك + ترحيل التجديد -----
create or replace function pay_subscription(p_subscription_id uuid, p_wallet_id uuid)
returns "Subscription" language plpgsql as $$
declare
  v_sub "Subscription";
  v_wallet "Wallet";
begin
  select * into v_sub from "Subscription" where id = p_subscription_id and "userId" = auth.uid() for update;
  if not found then raise exception 'الاشتراك غير موجود — أعد تحميل الصفحة'; end if;
  if not v_sub."isActive" then raise exception 'هذا الاشتراك موقوف'; end if;
  if v_sub.amount <= 0 then raise exception 'قيمة الاشتراك غير صالحة'; end if;

  select * into v_wallet from "Wallet" where id = p_wallet_id and "userId" = auth.uid() for update;
  if not found then raise exception 'المحفظة غير موجودة'; end if;
  if v_wallet.balance < v_sub.amount then
    raise exception 'رصيد "%" غير كافٍ لدفع %', v_wallet.name, v_sub.amount;
  end if;

  insert into "Transaction"(type, status, amount, category, description, "walletId")
  values ('expense', 'completed', v_sub.amount, 'اشتراكات', 'دفع اشتراك ' || v_sub.name, v_wallet.id);

  update "Wallet" set balance = balance - v_sub.amount where id = v_wallet.id;

  update "Subscription" set "nextRenewal" =
    case when "billingCycle" = 'monthly'
      then "nextRenewal" + interval '1 month'
      else "nextRenewal" + interval '1 year'
    end
    where id = v_sub.id returning * into v_sub;

  return v_sub;
end;
$$;

-- ----- إنشاء حركة مالية (دخل/مصروف/ربح معلق) + تحديث الرصيد -----
create or replace function create_transaction(
  p_type text, p_status text, p_amount numeric, p_category text,
  p_description text, p_date timestamptz, p_wallet_id uuid
) returns "Transaction" language plpgsql as $$
declare
  v_wallet "Wallet";
  v_txn "Transaction";
begin
  if p_status = 'pending' and p_type <> 'income' then
    raise exception 'الأرباح المعلقة تكون دخلاً فقط';
  end if;
  if p_status = 'completed' and p_wallet_id is null then
    raise exception 'اختر المحفظة — كل دخل أو مصروف يرتبط بمحفظة';
  end if;

  if p_wallet_id is not null then
    select * into v_wallet from "Wallet" where id = p_wallet_id and "userId" = auth.uid() for update;
    if not found then raise exception 'المحفظة المحددة غير موجودة'; end if;
    if p_status = 'completed' and p_type = 'expense' and v_wallet.balance < p_amount then
      raise exception 'رصيد "%" غير كافٍ لهذا المصروف', v_wallet.name;
    end if;
  end if;

  insert into "Transaction"(type, status, amount, category, description, date, "walletId")
  values (p_type, p_status, p_amount, coalesce(nullif(p_category, ''), 'عام'), p_description,
          coalesce(p_date, now()), p_wallet_id)
  returning * into v_txn;

  if p_status = 'completed' and p_wallet_id is not null then
    update "Wallet" set balance = balance + (case when p_type = 'income' then p_amount else -p_amount end)
      where id = p_wallet_id;
  end if;

  return v_txn;
end;
$$;

-- ----- تحصيل ربح معلّق (تأكيد حركة pending -> completed + إدخال للمحفظة) -----
create or replace function confirm_pending_transaction(p_txn_id uuid, p_wallet_id uuid)
returns "Transaction" language plpgsql as $$
declare
  v_txn "Transaction";
  v_wallet_id uuid;
begin
  select * into v_txn from "Transaction" where id = p_txn_id and "userId" = auth.uid() for update;
  if not found then raise exception 'الحركة غير موجودة'; end if;
  if v_txn.status <> 'pending' then raise exception 'هذه الحركة محصّلة بالفعل'; end if;

  v_wallet_id := coalesce(p_wallet_id, v_txn."walletId");
  if v_wallet_id is null then raise exception 'اختر المحفظة التي سيدخل إليها المبلغ'; end if;
  if not exists (select 1 from "Wallet" where id = v_wallet_id and "userId" = auth.uid()) then
    raise exception 'المحفظة المحددة غير موجودة';
  end if;

  update "Transaction" set status = 'completed', "walletId" = v_wallet_id
    where id = v_txn.id returning * into v_txn;

  update "Wallet" set balance = balance + v_txn.amount where id = v_wallet_id;

  return v_txn;
end;
$$;

-- ----- حذف حركة مالية مع عكس أثرها على رصيد المحفظة -----
create or replace function delete_transaction(p_txn_id uuid)
returns void language plpgsql as $$
declare
  v_txn "Transaction";
begin
  select * into v_txn from "Transaction" where id = p_txn_id and "userId" = auth.uid() for update;
  if not found then return; end if;

  if v_txn.status = 'completed' and v_txn."walletId" is not null then
    update "Wallet" set balance = balance - (case when v_txn.type = 'income' then v_txn.amount else -v_txn.amount end)
      where id = v_txn."walletId";
  end if;

  delete from "Transaction" where id = v_txn.id;
end;
$$;

-- ----- مراجعة بطاقة SRS (خوارزمية SM-2 مبسّطة) -----
create or replace function review_srs_card(p_card_id uuid, p_rating text, p_today date)
returns "SrsCard" language plpgsql as $$
declare
  v_card "SrsCard";
  v_interval integer;
  v_ease numeric(4,2);
begin
  select * into v_card from "SrsCard" where id = p_card_id and "userId" = auth.uid() for update;
  if not found then raise exception 'البطاقة غير موجودة — أعد تحميل الصفحة'; end if;
  if not v_card."isActive" then raise exception 'هذه البطاقة موقوفة'; end if;

  if p_rating = 'hard' then
    v_interval := 1;
    v_ease := greatest(1.3, v_card."easeFactor" - 0.2);
  elsif p_rating = 'medium' then
    v_interval := greatest(1, case when v_card."reviewCount" = 0 then 3 else round(v_card."intervalDays" * 1.3) end);
    v_ease := v_card."easeFactor";
  else -- easy
    v_interval := greatest(1, case when v_card."reviewCount" = 0 then 10 else round(v_card."intervalDays" * v_card."easeFactor") end);
    v_ease := least(3.0, v_card."easeFactor" + 0.15);
  end if;

  update "SrsCard" set
    "intervalDays" = v_interval,
    "easeFactor" = v_ease,
    "dueDate" = p_today + (v_interval || ' days')::interval,
    "reviewCount" = v_card."reviewCount" + 1
    where id = v_card.id returning * into v_card;

  insert into "SrsReviewLog"("cardId", date, rating) values (v_card.id, p_today, p_rating);

  return v_card;
end;
$$;

-- ----- إعادة ترتيب مهام المشاريع (سحب وإفلات) -----
create or replace function reorder_project_tasks(p_ids uuid[])
returns void language plpgsql as $$
begin
  update "ProjectTask" t set "sortOrder" = x.idx - 1
  from unnest(p_ids) with ordinality as x(id, idx)
  where t.id = x.id
    and exists (select 1 from "Project" p where p.id = t."projectId" and p."userId" = auth.uid());
end;
$$;

-- ----- تبديل «إدراج في التقرير الرسمي» مع التحقق من الإنجاز -----
create or replace function set_task_report_flag(p_task_id uuid, p_include boolean)
returns "ProjectTask" language plpgsql as $$
declare
  v_task "ProjectTask";
begin
  select t.* into v_task from "ProjectTask" t
    join "Project" p on p.id = t."projectId"
    where t.id = p_task_id and p."userId" = auth.uid() for update;
  if not found then raise exception 'المهمة غير موجودة — أعد تحميل الصفحة'; end if;

  if p_include and not v_task."isCompleted" then
    raise exception 'لا يمكن إضافة مهمة غير منجزة إلى التقرير — أنجزها أولاً';
  end if;

  update "ProjectTask" set "includeInReport" = p_include where id = v_task.id returning * into v_task;
  return v_task;
end;
$$;

-- ----- توليد تقرير إنجاز مؤتمت (اعتماد وأرشفة فورية) -----
create or replace function generate_report(p_project_id uuid, p_period_start timestamptz, p_period_end timestamptz, p_title text)
returns "Report" language plpgsql as $$
declare
  v_project "Project";
  v_end_inclusive timestamptz;
  v_snapshot jsonb;
  v_report "Report";
begin
  select * into v_project from "Project" where id = p_project_id and "userId" = auth.uid();
  if not found then raise exception 'المشروع غير موجود — أعد تحميل الصفحة'; end if;

  v_end_inclusive := date_trunc('day', p_period_end) + interval '23 hours 59 minutes 59 seconds';

  select coalesce(jsonb_agg(jsonb_build_object(
      'project_name', v_project.name,
      'title', t.title,
      'completed_at', to_char(t."completedAt" at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ) order by t."completedAt" asc), '[]'::jsonb)
    into v_snapshot
    from "ProjectTask" t
    where t."projectId" = p_project_id
      and t."isCompleted" = true
      and t."includeInReport" = true
      and t."completedAt" between p_period_start and v_end_inclusive;

  insert into "Report"(title, "periodStart", "periodEnd", "tasksSnapshot", "projectId", "entityId")
  values (coalesce(nullif(p_title, ''), 'تقرير إنجاز — ' || v_project.name), p_period_start, p_period_end,
          v_snapshot::text, v_project.id, v_project."entityId")
  returning * into v_report;

  return v_report;
end;
$$;

-- ----- تسجيل/إلغاء إنجاز يومي (عادة أو مهمة) -----
create or replace function toggle_log(p_kind text, p_id uuid, p_date date, p_done boolean)
returns void language plpgsql as $$
begin
  if p_kind = 'habit' then
    if p_done then
      insert into "HabitLog"("habitId", date) values (p_id, p_date)
        on conflict ("habitId", date) do nothing;
    else
      delete from "HabitLog" where "habitId" = p_id and date = p_date;
    end if;
  else
    if p_done then
      insert into "TaskLog"("taskId", date) values (p_id, p_date)
        on conflict ("taskId", date) do nothing;
    else
      delete from "TaskLog" where "taskId" = p_id and date = p_date;
    end if;
  end if;
end;
$$;

-- ----- مزامنة عدادات عنصر التعلم مع دروسه -----
create or replace function sync_learning_item(p_item_id uuid)
returns void language plpgsql as $$
declare
  v_total integer;
  v_done integer;
begin
  select count(*), count(*) filter (where "isDone") into v_total, v_done
    from "LearningLesson" where "itemId" = p_item_id;
  if v_total = 0 then return; end if;

  update "LearningItem" set
    "totalUnits" = v_total,
    "doneUnits" = v_done,
    status = case when v_done = v_total then 'done' else 'in_progress' end
    where id = p_item_id;
end;
$$;

-- ----- إضافة دروس دفعة واحدة (لصق قائمة تشغيل يوتيوب) -----
create or replace function add_learning_lessons(p_item_id uuid, p_titles text[])
returns integer language plpgsql as $$
declare
  v_base integer;
  v_added integer;
begin
  if not exists (select 1 from "LearningItem" where id = p_item_id and "userId" = auth.uid()) then
    raise exception 'الكورس غير موجود — أعد تحميل الصفحة';
  end if;

  select coalesce(max("sortOrder"), 0) + 1 into v_base from "LearningLesson" where "itemId" = p_item_id;

  insert into "LearningLesson"("itemId", title, "sortOrder")
  select p_item_id, t, v_base + (row_number() over () - 1)
  from unnest(p_titles) as t;
  get diagnostics v_added = row_count;

  perform sync_learning_item(p_item_id);
  return v_added;
end;
$$;

-- ----- تعديل/إنجاز درس + مزامنة -----
create or replace function update_learning_lesson(p_lesson_id uuid, p_is_done boolean default null, p_title text default null)
returns "LearningLesson" language plpgsql as $$
declare
  v_lesson "LearningLesson";
begin
  select l.* into v_lesson from "LearningLesson" l
    join "LearningItem" i on i.id = l."itemId"
    where l.id = p_lesson_id and i."userId" = auth.uid();
  if not found then raise exception 'الدرس غير موجود'; end if;

  update "LearningLesson" set
    "isDone" = coalesce(p_is_done, "isDone"),
    title = coalesce(p_title, title)
    where id = p_lesson_id returning * into v_lesson;

  perform sync_learning_item(v_lesson."itemId");
  return v_lesson;
end;
$$;

-- ----- حذف درس + مزامنة -----
create or replace function delete_learning_lesson(p_lesson_id uuid)
returns void language plpgsql as $$
declare
  v_item_id uuid;
begin
  select l."itemId" into v_item_id from "LearningLesson" l
    join "LearningItem" i on i.id = l."itemId"
    where l.id = p_lesson_id and i."userId" = auth.uid();
  if v_item_id is null then return; end if;

  delete from "LearningLesson" where id = p_lesson_id;
  perform sync_learning_item(v_item_id);
end;
$$;
