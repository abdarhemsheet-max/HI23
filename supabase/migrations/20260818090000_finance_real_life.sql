-- =====================================================================
--  ترحيل: المالية — محافظ الأمانات + تصنيفات مُقنّنة + التحويلات الداخلية
--
--  يغطي السيناريوهات الواقعية التالية:
--   • مرتب شهري من عمل خارجي            → categoryKey = 'salary'
--   • نثريات يومية متكررة                → categoryKey = 'petty_cash'
--   • مال الوالد المحفوظ عندي كأمانة     → محفظة "isPersonal = false"
--   • أخذ مبلغ من أمانة الوالد لأصرف منه → transfer_between_wallets()
--       - كسلفة  (mode='debt')  → يُنشئ ديناً "عليّ" مرتبطاً بالتحويل
--       - كمنحة  (mode='gift')  → يُسجَّل دخلاً بتصنيف 'allowance'
--       - كتحويل (mode='transfer') → محايد تماماً لا يمس الدخل/المصروف
--
--  ويضيف كذلك مرونة الحياة اليومية:
--   • تصنيفات واقعية للدخل والمصروف (أكل، مواصلات، فواتير، شغل حر، بيع…)
--   • سقف إنفاق شهري لكل تصنيف — جدول "Budget"
--   • الدخل المتأخر: تاريخ متوقّع، ويُسجَّل في شهر استلامه الفعلي
--
--  آمن للتكرار (idempotent) — يمكن تشغيله أكثر من مرة دون ضرر.
--  طريقة التشغيل: Supabase Dashboard → SQL Editor → New query → Run.
-- =====================================================================

-- ------------------------------------------------------------------
-- 1) المحافظ: تمييز المحفظة الشخصية عن محفظة الأمانة
-- ------------------------------------------------------------------
alter table "Wallet" add column if not exists "isPersonal" boolean not null default true;
alter table "Wallet" add column if not exists "ownerName" text;

comment on column "Wallet"."isPersonal" is
  'false = محفظة أمانة (مال شخص آخر محفوظ لديّ) — لا يُحسب رصيدها ضمن صافي ثروتي';
comment on column "Wallet"."ownerName" is
  'صاحب المال في محافظ الأمانات (مثل: الوالد) — يُستخدم اسماً للدين عند السلفة';

-- ------------------------------------------------------------------
-- 2) الحركات: تصنيف مُقنّن + ربط طرفَي التحويل الواحد
-- ------------------------------------------------------------------
alter table "Transaction" add column if not exists "categoryKey" text not null default 'general';
alter table "Transaction" add column if not exists "transferId" uuid;

do $$ begin
  alter table "Transaction" add constraint "Transaction_categoryKey_check"
    check ("categoryKey" in (
      'general','salary','petty_cash','allowance','trust_fund',
      'transfer','debt','subscription','savings'
    ));
exception when duplicate_object then null;
end $$;

create index if not exists "Transaction_transferId_idx" on "Transaction"("transferId");
create index if not exists "Transaction_categoryKey_idx" on "Transaction"("categoryKey");

comment on column "Transaction"."categoryKey" is
  'تصنيف مُقنّن للتحليل — categoryKey = ''transfer'' يُستثنى دائماً من إجمالي الدخل والمصروف';
comment on column "Transaction"."transferId" is
  'يربط طرفَي التحويل الداخلي (الخارج والداخل) في عملية واحدة تُحذف معاً';

-- ------------------------------------------------------------------
-- 3) الديون: ربط الدين بالتحويل الذي أنشأه
-- ------------------------------------------------------------------
alter table "Debt" add column if not exists "transferId" uuid;
create index if not exists "Debt_transferId_idx" on "Debt"("transferId");

-- ------------------------------------------------------------------
-- 4) ترحيل البيانات القائمة إلى التصنيفات الجديدة (تخمين آمن لمرة واحدة)
-- ------------------------------------------------------------------
update "Transaction" set "categoryKey" = 'subscription'
  where "categoryKey" = 'general' and category = 'اشتراكات';
update "Transaction" set "categoryKey" = 'debt'
  where "categoryKey" = 'general' and category in ('تحصيل دين','سداد دين');

-- ------------------------------------------------------------------
-- 5) دوال RPC — الذرّية الكاملة للعمليات التي تمس أكثر من جدول
-- ------------------------------------------------------------------
-- ----- تحويل داخلي بين محفظتين (ذرّي: طرفان + تحديث رصيدين + دين اختياري) -----
--  p_mode:
--    'transfer' → تحويل محايد بين محافظي (لا يُحسب دخلاً ولا مصروفاً)
--    'debt'     → سلفة: يُنشئ ديناً "عليّ" باسم صاحب المحفظة المصدر
--    'gift'     → منحة/هدية: الطرف الداخل يُسجَّل دخلاً بتصنيف 'allowance'
create or replace function transfer_between_wallets(
  p_from_wallet_id uuid,
  p_to_wallet_id uuid,
  p_amount numeric,
  p_note text default null,
  p_mode text default 'transfer',
  p_due_date timestamptz default null
) returns json language plpgsql as $$
declare
  v_from "Wallet";
  v_to "Wallet";
  v_transfer_id uuid := gen_random_uuid();
  v_out "Transaction";
  v_in "Transaction";
  v_debt "Debt";
  v_person text;
  v_label text;
begin
  if p_from_wallet_id is null or p_to_wallet_id is null then
    raise exception 'اختر المحفظة المصدر والمحفظة الوجهة';
  end if;
  if p_from_wallet_id = p_to_wallet_id then
    raise exception 'لا يمكن التحويل إلى نفس المحفظة';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'المبلغ يجب أن يكون أكبر من صفر';
  end if;
  if p_mode not in ('transfer', 'debt', 'gift') then
    raise exception 'نوع التحويل غير مسموح';
  end if;

  -- قفل المحفظتين بترتيب ثابت حسب المعرّف — يمنع الـ deadlock عند التزامن
  if p_from_wallet_id < p_to_wallet_id then
    select * into v_from from "Wallet" where id = p_from_wallet_id and "userId" = auth.uid() for update;
    select * into v_to   from "Wallet" where id = p_to_wallet_id   and "userId" = auth.uid() for update;
  else
    select * into v_to   from "Wallet" where id = p_to_wallet_id   and "userId" = auth.uid() for update;
    select * into v_from from "Wallet" where id = p_from_wallet_id and "userId" = auth.uid() for update;
  end if;

  if v_from.id is null then raise exception 'المحفظة المصدر غير موجودة'; end if;
  if v_to.id   is null then raise exception 'المحفظة الوجهة غير موجودة'; end if;
  if v_from.balance < p_amount then
    raise exception 'رصيد "%" غير كافٍ للتحويل (المتاح %)', v_from.name, v_from.balance;
  end if;

  v_person := coalesce(nullif(trim(coalesce(v_from."ownerName", '')), ''), v_from.name);
  v_label := coalesce(nullif(trim(coalesce(p_note, '')), ''),
    case p_mode
      when 'debt' then 'سلفة من ' || v_person
      when 'gift' then 'منحة من ' || v_person
      else 'تحويل داخلي'
    end);

  -- الطرف الخارج — دائماً محايد ('transfer') فلا يتضخم إجمالي مصروفاتي
  insert into "Transaction"(type, status, amount, category, "categoryKey", description, "walletId", "transferId")
  values ('expense', 'completed', p_amount, 'تحويل داخلي', 'transfer',
          v_label || ' (إلى ' || v_to.name || ')', v_from.id, v_transfer_id)
  returning * into v_out;

  -- الطرف الداخل — 'allowance' دخل حقيقي في حالة المنحة فقط، وإلا محايد
  insert into "Transaction"(type, status, amount, category, "categoryKey", description, "walletId", "transferId")
  values ('income', 'completed', p_amount,
          case when p_mode = 'gift' then 'مصروف من ' || v_person else 'تحويل داخلي' end,
          case when p_mode = 'gift' then 'allowance' else 'transfer' end,
          v_label || ' (من ' || v_from.name || ')', v_to.id, v_transfer_id)
  returning * into v_in;

  update "Wallet" set balance = balance - p_amount where id = v_from.id;
  update "Wallet" set balance = balance + p_amount where id = v_to.id;

  if p_mode = 'debt' then
    insert into "Debt"("personName", direction, amount, "dueDate", notes, "transferId")
    values (v_person, 'i_owe', p_amount, p_due_date,
            'سلفة من محفظة «' || v_from.name || '»' ||
            case when nullif(trim(coalesce(p_note, '')), '') is not null then ' — ' || p_note else '' end,
            v_transfer_id)
    returning * into v_debt;
  end if;

  return json_build_object(
    'transferId', v_transfer_id,
    'mode',       p_mode,
    'out',        row_to_json(v_out),
    'in',         row_to_json(v_in),
    'debt',       case when v_debt.id is null then null else row_to_json(v_debt) end
  );
end;
$$;

-- ----- تسديد/تحصيل دين -----
--  p_to_wallet_id (اختياري، للسداد فقط): محفظة تستقبل المبلغ المسدَّد —
--  تُستخدم لإرجاع سلفة إلى محفظة أمانة الوالد فيُغلق السيناريو كاملاً.
drop function if exists settle_debt(uuid, uuid);
create or replace function settle_debt(p_debt_id uuid, p_wallet_id uuid, p_to_wallet_id uuid default null)
returns "Debt" language plpgsql as $$
declare
  v_debt "Debt";
  v_wallet "Wallet";
  v_to "Wallet";
  v_remaining numeric(14,2);
  v_collecting boolean;
  v_transfer_id uuid;
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

  if p_to_wallet_id is not null then
    if v_collecting then raise exception 'محفظة الوجهة تُستخدم عند السداد فقط'; end if;
    if p_to_wallet_id = p_wallet_id then raise exception 'لا يمكن السداد إلى نفس المحفظة'; end if;
    select * into v_to from "Wallet" where id = p_to_wallet_id and "userId" = auth.uid() for update;
    if v_to.id is null then raise exception 'محفظة الوجهة غير موجودة'; end if;
    v_transfer_id := gen_random_uuid();
  end if;

  insert into "Transaction"(type, status, amount, category, "categoryKey", description, "walletId", "transferId")
  values (
    case when v_collecting then 'income' else 'expense' end,
    'completed',
    v_remaining,
    case when v_collecting then 'تحصيل دين' else 'سداد دين' end,
    case when v_transfer_id is null then 'debt' else 'transfer' end,
    (case when v_collecting then 'تحصيل دين من ' else 'سداد دين إلى ' end) || v_debt."personName",
    v_wallet.id,
    v_transfer_id
  );

  update "Wallet" set balance = balance + (case when v_collecting then v_remaining else -v_remaining end)
    where id = v_wallet.id;

  -- إرجاع المبلغ إلى محفظة الوجهة (أمانة الوالد مثلاً) — طرف مقابل محايد
  if v_transfer_id is not null then
    insert into "Transaction"(type, status, amount, category, "categoryKey", description, "walletId", "transferId")
    values ('income', 'completed', v_remaining, 'تحويل داخلي', 'transfer',
            'إرجاع سلفة ' || v_debt."personName" || ' (من ' || v_wallet.name || ')',
            v_to.id, v_transfer_id);
    update "Wallet" set balance = balance + v_remaining where id = v_to.id;
  end if;

  update "Debt" set "isSettled" = true, "paidAmount" = v_debt.amount
    where id = v_debt.id returning * into v_debt;

  return v_debt;
end;
$$;

-- ----- حذف حركة مالية مع عكس أثرها على رصيد المحفظة -----
--  إن كانت الحركة طرفاً في تحويل داخلي، يُحذف الطرفان معاً (وكذلك الدين
--  غير المسدَّد الناتج عنه) في معاملة واحدة — فلا يبقى نصف تحويل معلّق.
create or replace function delete_transaction(p_txn_id uuid)
returns void language plpgsql as $$
declare
  v_txn "Transaction";
  v_leg "Transaction";
  v_debt "Debt";
begin
  select * into v_txn from "Transaction" where id = p_txn_id and "userId" = auth.uid() for update;
  if not found then return; end if;

  if v_txn."transferId" is not null then
    select * into v_debt from "Debt"
      where "transferId" = v_txn."transferId" and "userId" = auth.uid() limit 1;
    if found and v_debt."isSettled" then
      raise exception 'هذا التحويل مرتبط بدين مسدَّد بالفعل — احذف الدين أولاً';
    end if;

    for v_leg in
      select * from "Transaction"
        where "transferId" = v_txn."transferId" and "userId" = auth.uid() for update
    loop
      if v_leg.status = 'completed' and v_leg."walletId" is not null then
        update "Wallet"
          set balance = balance - (case when v_leg.type = 'income' then v_leg.amount else -v_leg.amount end)
          where id = v_leg."walletId";
      end if;
    end loop;

    delete from "Debt" where "transferId" = v_txn."transferId" and "userId" = auth.uid();
    delete from "Transaction" where "transferId" = v_txn."transferId" and "userId" = auth.uid();
    return;
  end if;

  if v_txn.status = 'completed' and v_txn."walletId" is not null then
    update "Wallet" set balance = balance - (case when v_txn.type = 'income' then v_txn.amount else -v_txn.amount end)
      where id = v_txn."walletId";
  end if;

  delete from "Transaction" where id = v_txn.id;
end;
$$;

-- =====================================================================
--  الجزء الثاني: مرونة الحياة الواقعية
--   • تصنيفات دخل ومصروف تناسب المعيشة اليومية (أكل، مواصلات، فواتير،
--     شغل حر، بيع شيء، هدية، مساعدة من الأهل…)
--   • سقوف شهرية لكل تصنيف — جدول "Budget"
--   • الدخل المتأخر: تاريخ متوقّع + تسجيله في شهر استلامه الفعلي
-- =====================================================================

-- ------------------------------------------------------------------
-- 6) توسيع التصنيفات المُقنّنة
-- ------------------------------------------------------------------
alter table "Transaction" drop constraint if exists "Transaction_categoryKey_check";
alter table "Transaction" add constraint "Transaction_categoryKey_check"
  check ("categoryKey" in (
    'general',
    'salary','side_income','sale','gift','family_support','allowance',
    'petty_cash','food','transport','bills','health','family_care','savings',
    'trust_fund','transfer','debt','subscription'
  ));

-- ------------------------------------------------------------------
-- 7) الدخل المتوقّع والمتأخر
-- ------------------------------------------------------------------
alter table "Transaction" add column if not exists "expectedDate" timestamptz;
create index if not exists "Transaction_expectedDate_idx" on "Transaction"("expectedDate");

comment on column "Transaction"."expectedDate" is
  'متى كان يُفترض وصول المبلغ — الفرق بينه وبين date هو مقدار التأخير';

-- ------------------------------------------------------------------
-- 8) سقوف الإنفاق الشهرية
-- ------------------------------------------------------------------
create table if not exists "Budget" (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null default auth.uid() references auth.users(id) on delete cascade,
  "categoryKey" text not null check ("categoryKey" in (
    'general',
    'salary','side_income','sale','gift','family_support','allowance',
    'petty_cash','food','transport','bills','health','family_care','savings',
    'trust_fund','transfer','debt','subscription'
  )),
  "monthlyLimit" numeric(14,2) not null check ("monthlyLimit" > 0),
  "createdAt" timestamptz not null default now(),
  unique ("userId", "categoryKey")
);

alter table "Budget" enable row level security;

do $$ begin
  create policy "owner_all" on "Budget" for all
    using (auth.uid() = "userId") with check (auth.uid() = "userId");
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------------------
-- 9) تحديث دوال الحركات لتدعم التاريخ المتوقّع والتكرار
-- ------------------------------------------------------------------
-- ----- إنشاء حركة مالية (دخل/مصروف/دخل متوقّع) + تحديث الرصيد -----
-- p_category_key : تصنيف مُقنّن للتحليل ('salary' مرتب، 'petty_cash' نثريات…)
-- p_expected_date: للدخل المعلّق فقط — متى يُفترض أن يصل (لحساب التأخير)
drop function if exists create_transaction(text, text, numeric, text, text, timestamptz, uuid);
drop function if exists create_transaction(text, text, numeric, text, text, timestamptz, uuid, text);
create or replace function create_transaction(
  p_type text, p_status text, p_amount numeric, p_category text,
  p_description text, p_date timestamptz, p_wallet_id uuid,
  p_category_key text default 'general',
  p_expected_date timestamptz default null
) returns "Transaction" language plpgsql as $$
declare
  v_wallet "Wallet";
  v_txn "Transaction";
begin
  if p_status = 'pending' and p_type <> 'income' then
    raise exception 'الدخل المتوقّع يكون دخلاً فقط';
  end if;
  if p_status = 'completed' and p_wallet_id is null then
    raise exception 'اختر المحفظة — كل دخل أو مصروف يرتبط بمحفظة';
  end if;
  -- 'transfer' محجوز لدالة التحويل الداخلي وحدها حتى تبقى الإحصاءات نظيفة
  if coalesce(p_category_key, 'general') = 'transfer' then
    raise exception 'تصنيف «تحويل داخلي» يُنشأ عبر التحويل بين المحافظ فقط';
  end if;

  if p_wallet_id is not null then
    select * into v_wallet from "Wallet" where id = p_wallet_id and "userId" = auth.uid() for update;
    if not found then raise exception 'المحفظة المحددة غير موجودة'; end if;
    if p_status = 'completed' and p_type = 'expense' and v_wallet.balance < p_amount then
      raise exception 'رصيد "%" غير كافٍ لهذا المصروف', v_wallet.name;
    end if;
  end if;

  insert into "Transaction"(type, status, amount, category, "categoryKey", description, date, "expectedDate", "walletId")
  values (p_type, p_status, p_amount, coalesce(nullif(p_category, ''), 'عام'),
          coalesce(nullif(p_category_key, ''), 'general'), p_description,
          coalesce(p_date, now()),
          case when p_status = 'pending' then coalesce(p_expected_date, p_date, now()) else p_expected_date end,
          p_wallet_id)
  returning * into v_txn;

  if p_status = 'completed' and p_wallet_id is not null then
    update "Wallet" set balance = balance + (case when p_type = 'income' then p_amount else -p_amount end)
      where id = p_wallet_id;
  end if;

  return v_txn;
end;
$$;

-- ----- تحصيل دخل متوقّع (pending -> completed + إدخال للمحفظة) -----
--  p_received_date: يوم الاستلام الفعلي — يصير تاريخ الحركة، فيُحتسب المبلغ
--    في شهر استلامه لا في شهر توقّعه (مهم مع المرتب المتأخر).
--  p_repeat_next  : ينشئ توقّعاً جديداً للشهر القادم بنفس القيمة والتصنيف.
drop function if exists confirm_pending_transaction(uuid, uuid);
create or replace function confirm_pending_transaction(
  p_txn_id uuid,
  p_wallet_id uuid,
  p_received_date timestamptz default null,
  p_repeat_next boolean default false
) returns "Transaction" language plpgsql as $$
declare
  v_txn "Transaction";
  v_wallet_id uuid;
  v_next timestamptz;
begin
  select * into v_txn from "Transaction" where id = p_txn_id and "userId" = auth.uid() for update;
  if not found then raise exception 'الحركة غير موجودة'; end if;
  if v_txn.status <> 'pending' then raise exception 'هذه الحركة محصّلة بالفعل'; end if;

  v_wallet_id := coalesce(p_wallet_id, v_txn."walletId");
  if v_wallet_id is null then raise exception 'اختر المحفظة التي سيدخل إليها المبلغ'; end if;
  if not exists (select 1 from "Wallet" where id = v_wallet_id and "userId" = auth.uid()) then
    raise exception 'المحفظة المحددة غير موجودة';
  end if;

  update "Transaction"
    set status = 'completed',
        "walletId" = v_wallet_id,
        date = coalesce(p_received_date, now()),
        "expectedDate" = coalesce(v_txn."expectedDate", v_txn.date)
    where id = v_txn.id returning * into v_txn;

  update "Wallet" set balance = balance + v_txn.amount where id = v_wallet_id;

  if p_repeat_next then
    v_next := coalesce(v_txn."expectedDate", v_txn.date) + interval '1 month';
    insert into "Transaction"(type, status, amount, category, "categoryKey", description, date, "expectedDate")
    values (v_txn.type, 'pending', v_txn.amount, v_txn.category, v_txn."categoryKey",
            v_txn.description, now(), v_next);
  end if;

  return v_txn;
end;
$$;
