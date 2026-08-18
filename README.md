# نظام حياتي 🌟

نظام شخصي متكامل لإدارة الحياة (Life OS) — لعبدالرحيم أحمد شيتة.

**الإصدار الحالي:** React + Vite (SPA ثابت) · TypeScript · Tailwind CSS · **Supabase (Postgres + Auth)** · **Backblaze B2** — بتصميم Glassmorphism داكن كامل الدعم للعربية (RTL). ينشر كموقع ثابت على GitHub Pages.

> ⚠️ **تحول معماري:** كان هذا النظام مبنياً على Next.js + SQLite/Prisma بتصميم "محلي 100%". بعد هذه الهجرة أصبح رابطاً عاماً على الإنترنت ببيانات مخزَّنة سحابياً على Supabase وB2 — محمي بتسجيل دخول (Supabase Auth)، لكنه لم يعد "محلياً" بالمعنى الأصلي. نسخة SQLite القديمة (`prisma/dev.db`) وملفات `uploads/` باقية على القرص كنسخة احتياطية ومصدر للهجرة، غير مستخدَمة من التطبيق بعد الآن.

## الأقسام

| القسم | المزايا |
|---|---|
| 💰 المالية | مركزية المحافظ، تسديد الديون ودفع الاشتراكات (عمليات ذرّية عبر دوال Postgres RPC)، أرباح معلقة، أصول ومدخرات |
| 🔥 العادات والمهام | مهام متجددة، عادات بنظام Streaks، تركيز الأسبوع |
| 💼 الأعمال والمشاريع | مشاريع منتهية/مستمرة، سحب وإفلات لترتيب الأولويات، أرشفة تلقائية بعد 3 أيام |
| 📄 التقارير | تقارير مؤتمتة (اعتماد وأرشفة فورية) + تقارير يدوية بمحرر نصوص حر، تصدير PDF من المتصفح مباشرة |
| 📁 أرشيف المستندات | رفع مباشر إلى Backblaze B2 + عارض PDF/صور مدمج |
| 📖 القرآن الكريم | الحصون الخمسة، الطريقة الشنقيطية، نظام مخصص، مراجعة ذكية (SRS) |
| 🎓 التعلم والقراءة | تتبع كورسات يوتيوب، طابع الألعاب (مستويات وXP) |

## هيكلية الملفات 🗂️

```
src/
├── frontend/                ← كل شيء خاص بالواجهة
│   ├── main.tsx / App.tsx      نقطة الدخول + التوجيه (react-router-dom)
│   ├── api.ts                   نفس عقد الاستدعاء القديم، يوجَّه الآن لِـ backend/services
│   ├── pages/                   صفحات الأقسام التسعة
│   ├── components/               Sidebar, GlassCard, عناصر القرآن...
│   ├── hooks/                    useConfirm, usePrivacyMode
│   └── styles/globals.css        Tailwind + تصميم Glassmorphism
├── backend/                 ← منطق الاتصال بالبيانات (لا خادم — يعمل داخل المتصفح)
│   ├── config/                   supabaseClient.ts, b2Storage.ts, auth.ts
│   ├── services/                 دوال CRUD + العمليات الذرّية لكل قسم
│   ├── validate.ts               تحقق صارم من كل مدخل (كما كان)
│   └── srs.ts                    خوارزمية المراجعة الذكية
└── shared/                  ← أنواع ودوال مشتركة بين الطرفين (بلا تغيير)

supabase/schema.sql          ← مخطط قاعدة البيانات + سياسات RLS + دوال RPC
scripts/migrate-to-cloud.mjs ← هجرة بيانات dev.db القديمة إلى Supabase/B2 (لمرة واحدة)
.github/workflows/deploy.yml ← بناء ونشر تلقائي على GitHub Pages
```

## الإعداد السحابي (مرة واحدة)

### 1) Supabase
1. أنشئ مشروعاً جديداً على [supabase.com](https://supabase.com).
2. افتح **SQL Editor** والصق محتوى [`supabase/schema.sql`](supabase/schema.sql) بالكامل ثم Run — ينشئ كل الجداول وسياسات الحماية ودوال RPC دفعة واحدة.
3. من **Authentication → Users → Add user** أنشئ حسابك (بريد + كلمة مرور) — هو المستخدم الوحيد المصرَّح له بالدخول.
4. من **Project Settings → API** انسخ `Project URL` و `anon public key`.

### 2) Backblaze B2
1. أنشئ حاوية (Bucket) جديدة — **Private** موصى به (الروابط تُولَّد بتصريح مؤقت من التطبيق، لا حاجة لجعلها Public).
2. من **App Keys → Add a New Application Key** أنشئ مفتاحاً **مقيَّداً بهذه الحاوية فقط** (وليس مفتاحاً رئيسياً بصلاحية كاملة).
3. احتفظ بـ `keyID`، `applicationKey`، `bucketId`، `bucketName`.

> ⚠️ الرفع يتم مباشرة من المتصفح (بدون خادم وسيط)، لذا هذا المفتاح مرئي في كود الواجهة لأي زائر يفحص أدوات المطوّر. تقييده بحاوية واحدة (الخطوة 2) يحدّ من الضرر المحتمل.

### 3) متغيرات البيئة
انسخ [`​.env.example`](.env.example) إلى `.env` واملأ القيم أعلاه.

### 4) تسجيل الدخول محمي
النظام أصبح رابطاً عاماً — كل الأقسام خلف شاشة دخول (Supabase Auth) وكل الجداول محمية بسياسات RLS تقصر الوصول على صاحب الحساب فقط.

## نقل البيانات القديمة (SQLite → Supabase/B2)

إن كان لديك بيانات حقيقية في `prisma/dev.db` و`uploads/` من النسخة المحلية السابقة:

```bash
SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # من Project Settings → API (سرّي — لا يوضع في .env الخاص بـ Vite)
SUPABASE_USER_ID=xxxxxxxx-xxxx-...  # من Authentication → Users → انسخ UUID حسابك
VITE_B2_KEY_ID=... VITE_B2_APPLICATION_KEY=... VITE_B2_BUCKET_ID=... VITE_B2_BUCKET_NAME=... \
npm run migrate:data
```

يقرأ السكربت `dev.db` للقراءة فقط، يرفع كل ملف في `uploads/` فعلياً إلى B2، وينسخ كل الجداول إلى Supabase بنفس العلاقات. شغّله **مرة واحدة** على قاعدة Supabase فارغة.

## التشغيل محلياً

```bash
npm install
npm run dev       # http://localhost:4400
npm run build      # نسخة إنتاج في dist/
npm run preview    # معاينة نسخة الإنتاج محلياً
```

## النشر على GitHub Pages

1. أنشئ مستودع GitHub وارفع الكود إليه (`git push`).
2. **Settings → Pages → Source** اختر **GitHub Actions**.
3. **Settings → Secrets and variables → Actions** أضف نفس المتغيرات الستة من `.env` كـ Repository secrets.
4. أي `push` إلى `main` يُشغّل [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) تلقائياً: يبني المشروع (`VITE_BASE_PATH` يُضبط تلقائياً من اسم المستودع) وينشره.
5. الرابط النهائي: `https://<username>.github.io/<repo-name>/#/`

> التوجيه يستخدم `HashRouter` (روابط بصيغة `/#/finance`) عمداً — يضمن عمل كل المسارات الفرعية بلا أي إعداد خادم إضافي على GitHub Pages، حتى عند تحديث الصفحة أو فتح رابط قسم مباشرة.

## الحماية من الأخطاء (No Red Screens)

- **تحقق صارم** من كل المدخلات قبل لمس القاعدة ([src/backend/validate.ts](src/backend/validate.ts)) برسائل عربية واضحة.
- **عمليات ذرّية** للمالية والعمليات المركّبة عبر دوال RPC في Postgres (`supabase/schema.sql`) — تنجح كاملة أو تفشل كاملة، تماماً كما كانت `prisma.$transaction`.
- أي خطأ (تحقق/شبكة/قاعدة بيانات) يتحول إلى **تنبيه لطيف (Toast)** بدل انهيار الواجهة ([src/frontend/api.ts](src/frontend/api.ts)).
- **حماية على مستوى الصفوف (RLS)** في Postgres — حتى لو تسرّب مفتاح Supabase العام، لا يمكن لأحد غير صاحب الحساب قراءة أو تعديل البيانات.

## ملاحظات

- **النسخ الاحتياطي:** زر «نسخة احتياطية فورية» في الشريط الجانبي يُنزّل JSON بكل الجداول (ملفات B2 غير مضمَّنة — تُدار من لوحة Backblaze).
- **العملة:** غيّرها من `src/shared/utils.ts` (المتغير `CURRENCY`).
- **اسم المستودع في `vite.config.ts`:** ثابت `REPO_NAME` للتشغيل المحلي فقط — النشر الفعلي عبر GitHub Actions يضبطه تلقائياً من اسم المستودع الحقيقي عبر `VITE_BASE_PATH`.
