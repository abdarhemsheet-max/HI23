-- =====================================================================
--  معرض الأعمال (Portfolio) — أرشيف روابط ما أنجزته:
--  فيديو منشور، منشور على منصة، تصميم/صورة، أو موقع تم إنشاؤه.
--
--  التشغيل: Supabase Dashboard → SQL Editor → New query → لصق → Run
-- =====================================================================

create table if not exists "Work" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  -- video: رابط فيديو | post: رابط منشور | design: تصميم/صورة | website: موقع
  type text not null default 'video' check (type in ('video','post','design','website')),
  url text not null,
  -- صورة الغلاف: تُملأ يدوياً، وتُشتق تلقائياً لروابط يوتيوب في الواجهة
  "coverUrl" text,
  description text,
  -- منصة النشر (يوتيوب، فيسبوك، Behance…) — نص حر لأن المنصات تتغير
  platform text not null default 'عام',
  "workDate" date,
  -- الأعمال المميزة تُثبّت في مقدمة المعرض
  "isPinned" boolean not null default false,
  "entityId" uuid references "WorkEntity"(id) on delete set null,
  "projectId" uuid references "Project"(id) on delete set null,
  "createdAt" timestamptz not null default now()
);

create index if not exists "Work_userId_createdAt_idx" on "Work" ("userId", "createdAt" desc);

alter table "Work" enable row level security;

drop policy if exists "owner_all" on "Work";
create policy "owner_all" on "Work" for all
  using (auth.uid() = "userId") with check (auth.uid() = "userId");
