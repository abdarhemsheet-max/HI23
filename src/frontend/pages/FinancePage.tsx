import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Wallet as WalletIcon,
  Landmark,
  Banknote,
  TrendingUp,
  TrendingDown,
  Hourglass,
  HandCoins,
  CalendarClock,
  Gem,
  PiggyBank,
  CheckCircle2,
  RefreshCw,
  Pencil,
  ArrowLeftRight,
  Zap,
  ShieldCheck,
  Scale,
  Target,
  AlertTriangle,
} from 'lucide-react';
import { api, getCached } from '@/frontend/api';
import { fmtMoney, fmtDateShort, todayStr, daysUntil, localMonth, dateStr, cn } from '@/shared/utils';
import type {
  Wallet,
  Transaction,
  Debt,
  Subscription,
  Asset,
  SavingsGoal,
  TxCategoryKey,
  TransferMode,
  Budget,
} from '@/shared/types';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, TX_CATEGORY_LABELS } from '@/shared/types';
import GlassCard from '@/frontend/components/ui/GlassCard';
import StatCard from '@/frontend/components/ui/StatCard';
import Modal from '@/frontend/components/ui/Modal';
import EmptyState from '@/frontend/components/ui/EmptyState';
import ProgressBar from '@/frontend/components/ui/ProgressBar';
import { financeSchemaReady } from '@/backend/services/capabilities';
import { useConfirm } from '@/frontend/hooks/useConfirm';
import { usePrivacyMode } from '@/frontend/hooks/usePrivacyMode';
import PrivacyToggleButton from '@/frontend/components/ui/PrivacyToggleButton';

type Tab = 'overview' | 'wallets' | 'debts' | 'subs' | 'assets' | 'savings';
type ModalKind =
  | null
  | 'txn'
  | 'wallet'
  | 'walletEdit'
  | 'debt'
  | 'sub'
  | 'asset'
  | 'saving'
  | 'addToSaving'
  | 'settleDebt'
  | 'paySub'
  | 'confirmTxn'
  | 'transfer'
  | 'budget';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'wallets', label: 'المحافظ' },
  { id: 'debts', label: 'الديون' },
  { id: 'subs', label: 'الاشتراكات' },
  { id: 'assets', label: 'الأصول' },
  { id: 'savings', label: 'الادخار والأهداف' },
];

/** أزرار النثريات السريعة — أكثر ما يتكرر يومياً */
const PETTY_PRESETS = ['قهوة ☕', 'مواصلات 🚕', 'أكل 🍽️', 'تسوق 🛒', 'رصيد هاتف 📱', 'نثريات ✏️'];

/** آخر محفظة استُخدمت للإدخال السريع — تُحفظ محلياً فلا تُختار كل مرة */
const QUICK_WALLET_KEY = 'hi23:quickWallet';

const TRANSFER_MODES: { id: TransferMode; label: string; hint: string }[] = [
  { id: 'transfer', label: 'تحويل عادي', hint: 'نقل بين محافظي — محايد تماماً، لا يُحسب دخلاً ولا مصروفاً' },
  { id: 'debt', label: 'سلفة (عليّ ردّها)', hint: 'يُنشأ دين «عليّ» باسم صاحب المحفظة المصدر تلقائياً' },
  { id: 'gift', label: 'منحة / هدية', hint: 'يُحتسب دخلاً حقيقياً بتصنيف «مصروف من الوالد»' },
];

/** تنفيذ دالة عند إرسال النموذج مع منع السلوك الافتراضي — متوافق مع React 18 */
const onForm =
  (fn: (f: FormData) => void) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fn(new FormData(e.currentTarget));
  };

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [modal, setModal] = useState<ModalKind>(null);
  const [editItem, setEditItem] = useState<Wallet | SavingsGoal | Debt | Subscription | Transaction | null>(null);
  const [txnKind, setTxnKind] = useState('income');
  const [txnCategory, setTxnCategory] = useState<TxCategoryKey>('general');
  const [transferMode, setTransferMode] = useState<TransferMode>('transfer');
  const [walletOwnership, setWalletOwnership] = useState<'personal' | 'trust'>('personal');
  // الإدخال السريع للنثريات
  const [quickAmount, setQuickAmount] = useState('');
  const [quickLabel, setQuickLabel] = useState(PETTY_PRESETS[0]);
  const [quickWalletId, setQuickWalletId] = useState('');
  const { confirm, ConfirmDialog } = useConfirm();
  const { showBalances, togglePrivacy, moneyBlur } = usePrivacyMode();

  // العرض الفوري من الكاش عند العودة للقسم، ثم تحديث صامت
  const [wallets, setWallets] = useState<Wallet[]>(() => getCached<Wallet[]>('/api/crud/wallets') ?? []);
  const [txns, setTxns] = useState<Transaction[]>(() => getCached<Transaction[]>('/api/transactions') ?? []);
  const [debts, setDebts] = useState<Debt[]>(() => getCached<Debt[]>('/api/crud/debts') ?? []);
  const [subs, setSubs] = useState<Subscription[]>(() => getCached<Subscription[]>('/api/crud/subscriptions') ?? []);
  const [assets, setAssets] = useState<Asset[]>(() => getCached<Asset[]>('/api/crud/assets') ?? []);
  const [savings, setSavings] = useState<SavingsGoal[]>(() => getCached<SavingsGoal[]>('/api/crud/savings') ?? []);
  const [budgets, setBudgets] = useState<Budget[]>(() => getCached<Budget[]>('/api/crud/budgets') ?? []);
  // هل شُغّل ترحيل المالية على القاعدة؟ الميزات الجديدة تعتمد عليه
  const [schemaReady, setSchemaReady] = useState(true);

  const load = useCallback(async () => {
    setSchemaReady(await financeSchemaReady());
    const [w, t, d, s, a, g, bu] = await Promise.all([
      api<Wallet[]>('/api/crud/wallets'),
      api<Transaction[]>('/api/transactions'),
      api<Debt[]>('/api/crud/debts'),
      api<Subscription[]>('/api/crud/subscriptions'),
      api<Asset[]>('/api/crud/assets'),
      api<SavingsGoal[]>('/api/crud/savings'),
      api<Budget[]>('/api/crud/budgets'),
    ]);
    if (w) setWallets(w);
    if (t) setTxns(t);
    if (d) setDebts(d);
    if (s) setSubs(s);
    if (a) setAssets(a);
    if (g) setSavings(g);
    if (bu) setBudgets(bu);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ===== إحصائيات =====
  // قاعدة الحساب: تُحتسب الحركة ضمن دخلي/مصروفي فقط إن كانت في محفظة شخصية
  // وليست تحويلاً داخلياً — فلا تتضخم الأرقام بأموال الأمانات ولا بنقل المال
  // بين محافظي.
  const personalWallets = wallets.filter((w) => w.isPersonal !== false);
  const trustWallets = wallets.filter((w) => w.isPersonal === false);
  const personalIds = new Set(personalWallets.map((w) => w.id));
  const isMine = (t: Transaction) =>
    t.categoryKey !== 'transfer' && (t.walletId === null || personalIds.has(t.walletId));

  const monthKey = todayStr().slice(0, 7);
  const monthTxns = txns.filter(
    (t) => t.status === 'completed' && localMonth(t.date) === monthKey && isMine(t)
  );
  const income = monthTxns.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  const expenses = monthTxns.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  const pettyTxns = monthTxns.filter((t) => t.categoryKey === 'petty_cash');
  const petty = pettyTxns.reduce((a, t) => a + t.amount, 0);
  const todayPetty = pettyTxns
    .filter((t) => dateStr(new Date(t.date)) === todayStr())
    .reduce((a, t) => a + t.amount, 0);
  const salary = monthTxns
    .filter((t) => t.type === 'income' && t.categoryKey === 'salary')
    .reduce((a, t) => a + t.amount, 0);
  // إنفاق الشهر موزّعاً على التصنيفات — أساس مقارنة السقوف
  const spentByCategory = new Map<string, number>();
  monthTxns
    .filter((t) => t.type === 'expense')
    .forEach((t) => spentByCategory.set(t.categoryKey, (spentByCategory.get(t.categoryKey) ?? 0) + t.amount));
  const pettyLimit = budgets.find((b) => b.categoryKey === 'petty_cash')?.monthlyLimit ?? 0;
  const pettyPct = pettyLimit > 0 ? Math.round((petty / pettyLimit) * 100) : 0;

  const pendingTxns = txns.filter((t) => t.status === 'pending');
  const pending = pendingTxns.reduce((a, t) => a + t.amount, 0);
  // الدخل المتأخر: مرّ تاريخه المتوقّع ولم يصل بعد
  const lateDays = (t: Transaction) => (t.expectedDate ? -daysUntil(t.expectedDate) : 0);
  const lateTxns = pendingTxns.filter((t) => lateDays(t) > 0);
  const lateTotal = lateTxns.reduce((a, t) => a + t.amount, 0);

  const cash = personalWallets.filter((w) => w.type === 'cash').reduce((a, w) => a + w.balance, 0);
  const bank = personalWallets.filter((w) => w.type === 'bank').reduce((a, w) => a + w.balance, 0);
  const personalTotal = cash + bank;
  const trustTotal = trustWallets.reduce((a, w) => a + w.balance, 0);
  const assetsTotal = assets.reduce((a, x) => a + x.estimatedValue, 0);

  const owedToMe = debts.filter((d) => d.direction === 'owed_to_me' && !d.isSettled).reduce((a, d) => a + d.amount - d.paidAmount, 0);
  const iOwe = debts.filter((d) => d.direction === 'i_owe' && !d.isSettled).reduce((a, d) => a + d.amount - d.paidAmount, 0);
  // صافي الثروة = أرصدتي الشخصية + ما لي عند الآخرين − ما عليّ (الأمانات خارجه)
  const netWorth = personalTotal + owedToMe - iOwe;

  const walletName = (id: string | null) => wallets.find((w) => w.id === id)?.name;

  // ضبط محفظة الإدخال السريع: آخر محفظة مستخدمة، وإلا أول محفظة كاش شخصية
  useEffect(() => {
    if (quickWalletId && personalIds.has(quickWalletId)) return;
    const saved = localStorage.getItem(QUICK_WALLET_KEY);
    const fallback = personalWallets.find((w) => w.type === 'cash') ?? personalWallets[0];
    const next = saved && personalIds.has(saved) ? saved : fallback?.id ?? '';
    if (next !== quickWalletId) setQuickWalletId(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets]);

  // ===== إجراءات =====
  const addTxn = async (f: FormData) => {
    const kind = String(f.get('kind'));
    const catKey = (String(f.get('categoryKey') || 'general') || 'general') as TxCategoryKey;
    // الوصف الحر اختياري — إن تُرك فارغاً يُستخدم اسم التصنيف المُقنّن
    const catText = String(f.get('category') || '').trim() || TX_CATEGORY_LABELS[catKey];
    const ok = await api('/api/transactions', {
      method: 'POST',
      ok: kind === 'pending' ? 'سُجّل الربح المعلق' : 'سُجّلت الحركة وتحدّث الرصيد',
      body: {
        type: kind === 'pending' ? 'income' : kind,
        status: kind === 'pending' ? 'pending' : 'completed',
        amount: Number(f.get('amount')),
        category: catText,
        categoryKey: catKey,
        description: String(f.get('description') || ''),
        date: String(f.get('date') || todayStr()),
        expectedDate: String(f.get('expectedDate') || '') || null,
        walletId: String(f.get('walletId') || '') || null,
      },
    });
    if (ok) {
      setModal(null);
      load();
    }
  };

  /** إدخال سريع للنثريات — مبلغ + وصف مختصر ثم Enter، بلا نوافذ ولا خطوات */
  const addQuick = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(quickAmount);
    if (!amount || amount <= 0 || !quickWalletId) return;
    const ok = await api('/api/transactions', {
      method: 'POST',
      ok: `سُجّلت نثرية ${fmtMoney(amount)}`,
      body: {
        type: 'expense',
        status: 'completed',
        amount,
        category: quickLabel,
        categoryKey: 'petty_cash',
        description: '',
        date: todayStr(),
        walletId: quickWalletId,
      },
    });
    if (ok) {
      localStorage.setItem(QUICK_WALLET_KEY, quickWalletId);
      setQuickAmount('');
      load();
    }
  };

  /** تحويل داخلي بين محفظتين — ذرّي، ومع خيار تسجيله ديناً أو منحة */
  const doTransfer = async (f: FormData) => {
    const mode = transferMode;
    const ok = await api('/api/wallets/transfer', {
      method: 'POST',
      ok:
        mode === 'debt'
          ? 'تم التحويل وسُجّل ديناً عليك'
          : mode === 'gift'
            ? 'تم التحويل وسُجّل دخلاً (منحة)'
            : 'تم التحويل بين المحفظتين',
      body: {
        fromWalletId: String(f.get('fromWalletId') || ''),
        toWalletId: String(f.get('toWalletId') || ''),
        amount: Number(f.get('amount')),
        note: String(f.get('note') || ''),
        mode,
        dueDate: String(f.get('dueDate') || '') || null,
      },
    });
    if (ok) {
      setModal(null);
      load();
    }
  };

  /** تحصيل ربح معلق — يفتح نافذة اختيار المحفظة التي سيدخل إليها المال */
  const confirmTxn = async (f: FormData) => {
    const t = editItem as Transaction | null;
    if (!t) return;
    const ok = await api(`/api/transactions/${t.id}`, {
      method: 'PATCH',
      ok: 'وصل المبلغ وأُضيف للمحفظة',
      body: {
        action: 'confirm',
        walletId: f.get('walletId'),
        receivedDate: String(f.get('receivedDate') || todayStr()),
        repeatNext: f.get('repeatNext') === 'on',
      },
    });
    if (ok) {
      setModal(null);
      setEditItem(null);
      load();
    }
  };

  /** تسديد دين — خصم أو إيداع في المحفظة المختارة + حركة موثقة */
  const settleDebt = async (f: FormData) => {
    const d = editItem as Debt | null;
    if (!d) return;
    const toWalletId = String(f.get('toWalletId') || '') || null;
    const ok = await api(`/api/debts/${d.id}/settle`, {
      method: 'POST',
      ok: d.direction === 'owed_to_me'
        ? 'حُصّل الدين وأُضيف للمحفظة'
        : toWalletId
          ? 'سُدّد الدين وعاد المبلغ إلى محفظة صاحبه'
          : 'سُدّد الدين وخُصم من المحفظة',
      body: { walletId: f.get('walletId'), toWalletId },
    });
    if (ok) {
      setModal(null);
      setEditItem(null);
      load();
    }
  };

  /** دفع اشتراك من محفظة — خصم + حركة مصروف + ترحيل التجديد للدورة القادمة */
  const paySub = async (f: FormData) => {
    const s = editItem as Subscription | null;
    if (!s) return;
    const ok = await api(`/api/subscriptions/${s.id}/pay`, {
      method: 'POST',
      ok: `دُفع «${s.name}» ورُحّل التجديد للدورة القادمة`,
      body: { walletId: f.get('walletId') },
    });
    if (ok) {
      setModal(null);
      setEditItem(null);
      load();
    }
  };

  const delTxn = async (id: string) => {
    const t = txns.find((x) => x.id === id);
    const isTransfer = t?.categoryKey === 'transfer';
    const ok1 = await confirm({
      title: isTransfer ? 'حذف تحويل داخلي' : 'حذف الحركة المالية',
      description: isTransfer
        ? 'سيُحذف طرفا التحويل معاً ويعود رصيد المحفظتين كما كان — ويُحذف معه الدين الناتج عنه إن لم يكن مسدداً.'
        : 'سيُعكس أثر هذه الحركة على رصيد المحفظة المرتبطة بها.',
      danger: true,
    });
    if (!ok1) return;
    const ok = await api(`/api/transactions/${id}`, { method: 'DELETE' });
    if (ok) load();
  };

  const addWallet = async (f: FormData) => {
    const ok = await api('/api/crud/wallets', {
      method: 'POST',
      ok: 'أُنشئت المحفظة',
      body: {
        name: f.get('name'),
        type: f.get('type'),
        balance: Number(f.get('balance') || 0),
        isPersonal: String(f.get('ownership') || 'personal') === 'personal',
        ownerName: String(f.get('ownerName') || ''),
      },
    });
    if (ok) {
      setModal(null);
      load();
    }
  };

  const editWalletBalance = async (f: FormData) => {
    if (!editItem) return;
    const ok = await api(`/api/crud/wallets/${editItem.id}`, {
      method: 'PATCH',
      ok: 'تحدّث الرصيد',
      body: { balance: Number(f.get('balance')) },
    });
    if (ok) {
      setModal(null);
      setEditItem(null);
      load();
    }
  };

  const addDebt = async (f: FormData) => {
    const ok = await api('/api/crud/debts', {
      method: 'POST',
      ok: 'سُجّل الدين',
      body: {
        personName: f.get('personName'),
        direction: f.get('direction'),
        amount: Number(f.get('amount')),
        dueDate: String(f.get('dueDate') || '') || null,
        notes: String(f.get('notes') || ''),
      },
    });
    if (ok) {
      setModal(null);
      load();
    }
  };

  const addSub = async (f: FormData) => {
    const ok = await api('/api/crud/subscriptions', {
      method: 'POST',
      ok: 'أُضيف الاشتراك',
      body: {
        name: f.get('name'),
        amount: Number(f.get('amount')),
        billingCycle: f.get('billingCycle'),
        nextRenewal: f.get('nextRenewal'),
        category: String(f.get('category') || ''),
      },
    });
    if (ok) {
      setModal(null);
      load();
    }
  };

  const addAsset = async (f: FormData) => {
    const ok = await api('/api/crud/assets', {
      method: 'POST',
      ok: 'أُضيف الأصل',
      body: {
        name: f.get('name'),
        category: String(f.get('category') || ''),
        estimatedValue: Number(f.get('estimatedValue') || 0),
        purchaseDate: String(f.get('purchaseDate') || '') || null,
        notes: String(f.get('notes') || ''),
      },
    });
    if (ok) {
      setModal(null);
      load();
    }
  };

  const addSaving = async (f: FormData) => {
    const ok = await api('/api/crud/savings', {
      method: 'POST',
      ok: 'أُنشئ الهدف المالي',
      body: {
        name: f.get('name'),
        targetAmount: Number(f.get('targetAmount')),
        currentAmount: Number(f.get('currentAmount') || 0),
        deadline: String(f.get('deadline') || '') || null,
      },
    });
    if (ok) {
      setModal(null);
      load();
    }
  };

  const addToSaving = async (f: FormData) => {
    const goal = editItem as SavingsGoal | null;
    if (!goal) return;
    const ok = await api(`/api/crud/savings/${goal.id}`, {
      method: 'PATCH',
      ok: 'أُضيف المبلغ للهدف',
      body: { currentAmount: goal.currentAmount + Number(f.get('amount') || 0) },
    });
    if (ok) {
      setModal(null);
      setEditItem(null);
      load();
    }
  };

  /** ضبط سقف شهري لتصنيف — إعادة ضبط نفس التصنيف تحدّث السقف بدل تكراره */
  const setBudget = async (f: FormData) => {
    const ok = await api('/api/crud/budgets', {
      method: 'POST',
      ok: 'ضُبط السقف الشهري',
      body: {
        categoryKey: String(f.get('categoryKey') || 'petty_cash'),
        monthlyLimit: Number(f.get('monthlyLimit')),
      },
    });
    if (ok) {
      setModal(null);
      load();
    }
  };

  const del = (resource: string, label: string) => async (id: string) => {
    const ok1 = await confirm({
      title: `حذف ${label}`,
      description: `هل أنت متأكد من حذف ${label}؟ لا يمكن التراجع عن هذا الإجراء.`,
      danger: true,
    });
    if (!ok1) return;
    const ok = await api(`/api/crud/${resource}/${id}`, { method: 'DELETE' });
    if (ok) load();
  };

  // تصنيفات النموذج تتبع نوع الحركة — لا تُعرض تصنيفات دخل على مصروف
  const activeCategories = txnKind === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-black">المالية والثروة</h1>
            <p className="text-sm text-slate-500">لوحة تحكم شاملة لأموالك — محلية وآمنة</p>
          </div>
          <PrivacyToggleButton visible={showBalances} onToggle={togglePrivacy} />
        </div>
        <button className="btn-primary" onClick={() => { setTxnKind('income'); setTxnCategory('general'); setModal('txn'); }}>
          <Plus size={16} /> حركة جديدة
        </button>
      </header>

      {/* التبويبات */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-xl px-4 py-2 text-xs font-bold transition',
              tab === t.id
                ? 'bg-gradient-to-l from-orange-500/25 to-orange-500/10 text-orange-300 border border-orange-500/25'
                : 'bg-white/[0.04] text-slate-400 border border-white/[0.07] hover:bg-white/[0.08]'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!schemaReady && (
        <GlassCard className="border-amber-500/30">
          <div className="flex flex-wrap items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-200">قاعدة البيانات لم تُحدَّث بعد</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                القسم يعمل بصيغته السابقة وكل بياناتك سليمة، لكن الميزات الجديدة معطّلة:
                محافظ الأمانات، التحويل الداخلي، السقوف الشهرية، والدخل المتأخر. لتفعيلها
                شغّل ملف
                <span className="mx-1 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-slate-300">
                  supabase/migrations/20260818090000_finance_real_life.sql
                </span>
                في Supabase ← SQL Editor، ثم أعد تحميل الصفحة.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* ======================= نظرة عامة ======================= */}
      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard
              title="الدخل (هذا الشهر)"
              value={fmtMoney(income)}
              icon={TrendingUp}
              tone="orange"
              sub={salary > 0 ? `منها مرتب ${fmtMoney(salary)}` : undefined}
              blurred={!showBalances}
            />
            <StatCard
              title="المصروفات (هذا الشهر)"
              value={fmtMoney(expenses)}
              icon={TrendingDown}
              tone="rose"
              sub={petty > 0 ? `منها نثريات ${fmtMoney(petty)}` : undefined}
              blurred={!showBalances}
            />
            <StatCard title="صافي الشهر" value={fmtMoney(income - expenses)} icon={WalletIcon} tone={income - expenses >= 0 ? 'sky' : 'rose'} blurred={!showBalances} />
            <StatCard title="النثريات (هذا الشهر)" value={fmtMoney(petty)} icon={Zap} tone="amber" sub={`${pettyTxns.length} حركة`} blurred={!showBalances} />
            <StatCard
              title="صافي الثروة"
              value={fmtMoney(netWorth)}
              icon={Scale}
              tone={netWorth >= 0 ? 'orange' : 'rose'}
              sub={assetsTotal > 0 ? `أرصدتي + الديون · وأصول بـ ${fmtMoney(assetsTotal)}` : 'أرصدتي الشخصية + لي − عليّ'}
              blurred={!showBalances}
            />
            <StatCard title="أرصدتي الشخصية" value={fmtMoney(personalTotal)} icon={Banknote} tone="sky" sub={`${personalWallets.length} محفظة شخصية`} blurred={!showBalances} />
            <StatCard
              title="أمانات لديّ"
              value={fmtMoney(trustTotal)}
              icon={ShieldCheck}
              tone="violet"
              sub={trustWallets.length > 0 ? `${trustWallets.length} محفظة أمانة — خارج ثروتي` : 'لا محافظ أمانات'}
              blurred={!showBalances}
            />
            <StatCard
              title="دخل بانتظار الوصول"
              value={fmtMoney(pending)}
              icon={Hourglass}
              tone={lateTxns.length > 0 ? 'rose' : 'amber'}
              sub={lateTxns.length > 0 ? `${lateTxns.length} متأخر عن موعده` : 'لم يصل بعد'}
              blurred={!showBalances}
            />
          </div>

          {/* ===== إدخال سريع للنثريات — مبلغ ثم Enter، بلا نوافذ ===== */}
          <GlassCard className="border-amber-500/20">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="section-title flex items-center gap-2">
                <Zap size={15} className="text-amber-300" /> إدخال سريع — نثريات
              </h3>
              <span className="text-[11px] text-slate-500">
                نثريات اليوم: <b className={cn('text-amber-300', moneyBlur)}>{fmtMoney(todayPetty)}</b>
              </span>
            </div>
            {!schemaReady ? null : pettyLimit > 0 ? (
              <div className="mb-3">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-500">
                    سقف الشهر: <b className={cn('text-slate-300', moneyBlur)}>{fmtMoney(pettyLimit)}</b>
                  </span>
                  <span className={cn('font-bold', pettyPct >= 100 ? 'text-rose-400' : pettyPct >= 80 ? 'text-amber-300' : 'text-slate-400')}>
                    {pettyPct}% · بقي <span className={moneyBlur}>{fmtMoney(Math.max(0, pettyLimit - petty))}</span>
                  </span>
                </div>
                <ProgressBar value={pettyPct} color={pettyPct >= 100 ? '#f43f5e' : pettyPct >= 80 ? '#f59e0b' : '#34d399'} />
                {pettyPct >= 80 && (
                  <p className={cn('mt-1.5 flex items-center gap-1 text-[11px]', pettyPct >= 100 ? 'text-rose-300' : 'text-amber-300')}>
                    <AlertTriangle size={12} />
                    {pettyPct >= 100 ? 'تجاوزت سقف النثريات هذا الشهر' : 'اقتربت من سقف النثريات'}
                  </p>
                )}
              </div>
            ) : (
              <button type="button" className="btn-ghost mb-3 !px-3 !py-1.5 text-[11px]" onClick={() => setModal('budget')}>
                <Target size={13} /> حدّد سقفاً شهرياً للنثريات
              </button>
            )}
            {personalWallets.length === 0 ? (
              <p className="py-3 text-center text-xs text-slate-500">
                أنشئ محفظة شخصية أولاً من تبويب «المحافظ»
              </p>
            ) : (
              <form onSubmit={addQuick} className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {PETTY_PRESETS.map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setQuickLabel(label)}
                      className={cn(
                        'rounded-lg border px-2.5 py-1 text-[11px] font-bold transition',
                        quickLabel === label
                          ? 'border-amber-500/40 bg-amber-500/15 text-amber-200'
                          : 'border-white/[0.07] bg-white/[0.03] text-slate-400 hover:bg-white/[0.08]'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={quickAmount}
                    onChange={(e) => setQuickAmount(e.target.value)}
                    type="number"
                    step="0.01"
                    min="0.01"
                    inputMode="decimal"
                    placeholder="المبلغ…"
                    className="input !w-auto min-w-[7rem] flex-1"
                  />
                  <select
                    value={quickWalletId}
                    onChange={(e) => setQuickWalletId(e.target.value)}
                    className="input !w-auto min-w-[10rem]"
                  >
                    {personalWallets.map((w) => (
                      <option key={w.id} value={w.id}>{w.name} ({fmtMoney(w.balance)})</option>
                    ))}
                  </select>
                  <button className="btn-primary shrink-0" disabled={!quickAmount || Number(quickAmount) <= 0}>
                    <Plus size={15} /> تسجيل «{quickLabel}»
                  </button>
                </div>
              </form>
            )}
          </GlassCard>

          {schemaReady && (
          <GlassCard>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="section-title flex items-center gap-2">
                <Target size={15} className="text-orange-300" /> السقوف الشهرية
              </h3>
              <button className="btn-ghost !px-3 !py-1.5 text-[11px]" onClick={() => setModal('budget')}>
                <Plus size={13} /> ضبط سقف
              </button>
            </div>
            {budgets.length === 0 ? (
              <p className="py-3 text-center text-xs text-slate-600">
                لا سقوف بعد — حدّد سقفاً للنثريات أو الأكل أو المواصلات لتعرف متى تتجاوز حدّك.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {budgets.map((b) => {
                  const spent = spentByCategory.get(b.categoryKey) ?? 0;
                  const pct = Math.round((spent / b.monthlyLimit) * 100);
                  return (
                    <div key={b.id} className="glass-inset p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-bold">{TX_CATEGORY_LABELS[b.categoryKey]}</p>
                        <button className="text-slate-600 transition hover:text-rose-400" onClick={() => del('budgets', 'السقف')(b.id)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <ProgressBar value={pct} color={pct >= 100 ? '#f43f5e' : pct >= 80 ? '#f59e0b' : '#34d399'} />
                      <p className="mt-1.5 text-[11px] text-slate-500">
                        <span className={moneyBlur}>{fmtMoney(spent)}</span> من{' '}
                        <span className={moneyBlur}>{fmtMoney(b.monthlyLimit)}</span> · {pct}%
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
          )}

          {pendingTxns.length > 0 && (
            <GlassCard className={lateTxns.length > 0 ? 'border-rose-500/25' : 'border-amber-500/20'}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="section-title">⏳ دخل بانتظار الوصول</h3>
                {lateTxns.length > 0 && (
                  <span className="flex items-center gap-1 rounded-lg bg-rose-500/15 px-2.5 py-1 text-[11px] font-bold text-rose-300">
                    <AlertTriangle size={12} /> {lateTxns.length} متأخر ·{' '}
                    <span className={moneyBlur}>{fmtMoney(lateTotal)}</span>
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {pendingTxns.map((t) => {
                  const late = lateDays(t);
                  return (
                  <div key={t.id} className={cn('glass-inset flex items-center justify-between gap-3 p-3', late > 0 && 'border border-rose-500/25')}>
                    <div>
                      <p className="text-sm font-bold">{t.description || t.category}</p>
                      <p className="text-[11px] text-slate-500">
                        {t.expectedDate ? `متوقّع ${fmtDateShort(t.expectedDate)}` : fmtDateShort(t.date)}
                        {walletName(t.walletId) ? ` · ${walletName(t.walletId)}` : ''}
                        {late > 0 && <span className="text-rose-400"> · متأخر منذ {late} يوماً</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-sm font-black', late > 0 ? 'text-rose-300' : 'text-amber-300', moneyBlur)}>
                        {fmtMoney(t.amount)}
                      </span>
                      <button
                        className="btn-primary !px-3 !py-1.5 text-[11px]"
                        onClick={() => { setEditItem(t); setModal('confirmTxn'); }}
                      >
                        <CheckCircle2 size={13} /> وصل
                      </button>
                      <button className="text-slate-700 transition hover:!text-rose-400" onClick={() => delTxn(t.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </GlassCard>
          )}

          <GlassCard>
            <h3 className="section-title mb-3">آخر الحركات</h3>
            {txns.length === 0 ? (
              <EmptyState icon={Banknote} title="لا توجد حركات بعد" hint="أضف أول حركة من زر «حركة جديدة»" />
            ) : (
              <div className="flex flex-col gap-1.5">
                {txns.slice(0, 12).map((t) => {
                  // التحويل الداخلي لا دخل ولا مصروف — يُعرض بلون محايد وسهم مزدوج
                  const isTransfer = t.categoryKey === 'transfer';
                  const keyLabel =
                    t.categoryKey && t.categoryKey !== 'general' ? TX_CATEGORY_LABELS[t.categoryKey] : null;
                  return (
                  <div key={t.id} className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.04]">
                    <div className="flex items-center gap-3">
                      <div className={cn('rounded-lg p-2',
                        isTransfer
                          ? 'bg-sky-500/10 text-sky-300'
                          : t.type === 'income' ? 'bg-orange-500/10 text-orange-300' : 'bg-rose-500/10 text-rose-300')}>
                        {isTransfer ? <ArrowLeftRight size={15} /> : t.type === 'income' ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-bold">{t.description || t.category}</p>
                          {keyLabel && (
                            <span className={cn('chip !px-2 !py-0.5 text-[10px]',
                              isTransfer ? 'bg-sky-500/15 text-sky-300' : 'bg-white/[0.06] text-slate-400')}>
                              {keyLabel}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {fmtDateShort(t.date)} · {t.category}
                          {walletName(t.walletId) ? ` · ${walletName(t.walletId)}` : ''}
                          {t.status === 'pending' && <span className="text-amber-400"> · معلّق</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-sm font-black',
                        isTransfer ? 'text-slate-400' : t.type === 'income' ? 'text-orange-300' : 'text-rose-300', moneyBlur)}>
                        {isTransfer ? '' : t.type === 'income' ? '+' : '−'}{fmtMoney(t.amount)}
                      </span>
                      <button className="text-slate-700 opacity-0 transition group-hover:opacity-100 hover:!text-rose-400" onClick={() => delTxn(t.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </>
      )}

      {/* ======================= المحافظ ======================= */}
      {tab === 'wallets' && (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
            <StatCard title="💵 كاش (نقدي)" value={fmtMoney(cash)} icon={Banknote} tone="orange" sub="شخصي فقط" blurred={!showBalances} />
            <StatCard title="🏦 في المصرف" value={fmtMoney(bank)} icon={Landmark} tone="sky" sub="شخصي فقط" blurred={!showBalances} />
            <StatCard title="🤝 أمانات لديّ" value={fmtMoney(trustTotal)} icon={ShieldCheck} tone="violet" sub="مال غيري — خارج ثروتي" blurred={!showBalances} />
          </div>

          <div className="flex justify-end">
            <button
              className="btn-ghost"
              disabled={wallets.length < 2 || !schemaReady}
              title={
                !schemaReady
                  ? 'يحتاج تشغيل ملف الترحيل على قاعدة البيانات'
                  : wallets.length < 2
                    ? 'تحتاج محفظتين على الأقل'
                    : 'نقل مبلغ بين محفظتين'
              }
              onClick={() => { setTransferMode('transfer'); setModal('transfer'); }}
            >
              <ArrowLeftRight size={16} /> تحويل داخلي
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {wallets.map((w) => {
              const isTrust = w.isPersonal === false;
              return (
              <GlassCard key={w.id} hover className={cn('group', isTrust && 'border-violet-500/25')}>
                <div className="flex items-start justify-between">
                  <div className={cn('rounded-xl border p-2.5',
                    isTrust
                      ? 'border-violet-500/20 bg-violet-500/10 text-violet-300'
                      : w.type === 'cash' ? 'border-orange-500/20 bg-orange-500/10 text-orange-300' : 'border-sky-500/20 bg-sky-500/10 text-sky-300')}>
                    {isTrust ? <ShieldCheck size={20} /> : w.type === 'cash' ? <Banknote size={20} /> : <Landmark size={20} />}
                  </div>
                  <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <button className="text-slate-500 hover:text-orange-300" onClick={() => { setEditItem(w); setModal('walletEdit'); }}>
                      <Pencil size={14} />
                    </button>
                    <button className="text-slate-500 hover:text-rose-400" onClick={() => del('wallets', 'المحفظة')(w.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-bold text-slate-400">{w.name}</p>
                  {isTrust && (
                    <span className="chip !px-2 !py-0.5 bg-violet-500/15 text-[10px] text-violet-300">
                      أمانة{w.ownerName ? ` · ${w.ownerName}` : ''}
                    </span>
                  )}
                </div>
                <p className={cn('mt-1 text-2xl font-black', moneyBlur)}>{fmtMoney(w.balance)}</p>
                <p className="mt-1 text-[11px] text-slate-600">
                  {w.type === 'cash' ? 'نقدي' : 'حساب مصرفي'}
                  {isTrust ? ' · لا يُحتسب ضمن ثروتي' : ''}
                </p>
              </GlassCard>
              );
            })}
            <button onClick={() => setModal('wallet')} className="glass glass-hover flex min-h-[10rem] flex-col items-center justify-center gap-2 text-slate-500 hover:text-orange-300">
              <Plus size={24} />
              <span className="text-sm font-bold">محفظة جديدة</span>
            </button>
          </div>
        </>
      )}

      {/* ======================= الديون ======================= */}
      {tab === 'debts' && (
        <>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => setModal('debt')}>
              <Plus size={16} /> دين جديد
            </button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {(
              [
                { dir: 'owed_to_me', title: '🟢 لي عند الآخرين', total: owedToMe, tone: 'text-orange-300' },
                { dir: 'i_owe', title: '🔴 عليّ للآخرين', total: iOwe, tone: 'text-rose-300' },
              ] as const
            ).map((col) => (
              <GlassCard key={col.dir}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="section-title">{col.title}</h3>
                  <span className={cn('text-sm font-black', col.tone, moneyBlur)}>{fmtMoney(col.total)}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {debts.filter((d) => d.direction === col.dir).length === 0 && (
                    <p className="py-6 text-center text-xs text-slate-600">لا ديون هنا 🎉</p>
                  )}
                  {debts
                    .filter((d) => d.direction === col.dir)
                    .map((d) => (
                      <div key={d.id} className={cn('glass-inset flex items-center justify-between gap-3 p-3', d.isSettled && 'opacity-45')}>
                        <div>
                          <p className="text-sm font-bold">{d.personName}</p>
                          <p className="text-[11px] text-slate-500">
                            {d.dueDate ? `يستحق ${fmtDateShort(d.dueDate)}` : 'بدون تاريخ استحقاق'}
                            {d.notes ? ` · ${d.notes}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn('text-sm font-black', moneyBlur)}>{fmtMoney(d.amount - d.paidAmount)}</span>
                          {d.isSettled ? (
                            <span className="chip bg-orange-500/15 text-orange-300">مسدد ✓</span>
                          ) : (
                            <button
                              className="btn-ghost !px-2.5 !py-1 text-[11px]"
                              onClick={() => { setEditItem(d); setModal('settleDebt'); }}
                            >
                              <HandCoins size={13} /> تسديد
                            </button>
                          )}
                          <button className="text-slate-600 hover:text-rose-400" onClick={() => del('debts', 'الدين')(d.id)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </GlassCard>
            ))}
          </div>
        </>
      )}

      {/* ======================= الاشتراكات ======================= */}
      {tab === 'subs' && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-400">
              التكلفة الشهرية التقديرية:{' '}
              <b className={cn('text-slate-100', moneyBlur)}>
                {fmtMoney(subs.filter((x) => x.isActive).reduce((a, x) => a + (x.billingCycle === 'monthly' ? x.amount : x.amount / 12), 0))}
              </b>
            </p>
            <button className="btn-primary" onClick={() => setModal('sub')}>
              <Plus size={16} /> اشتراك جديد
            </button>
          </div>
          <GlassCard>
            {subs.length === 0 ? (
              <EmptyState icon={CalendarClock} title="لا اشتراكات مسجلة" hint="Netflix، Adobe، إنترنت المنزل…" />
            ) : (
              <div className="flex flex-col gap-2">
                {subs.map((sub) => {
                  const days = daysUntil(sub.nextRenewal);
                  return (
                    <div key={sub.id} className={cn('glass-inset flex flex-wrap items-center justify-between gap-3 p-3.5', !sub.isActive && 'opacity-45')}>
                      <div>
                        <p className="text-sm font-black">{sub.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {sub.billingCycle === 'monthly' ? 'شهري' : 'سنوي'} · {sub.category} · التجديد {fmtDateShort(sub.nextRenewal)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {sub.isActive && (
                          <span className={cn('chip', days <= 3 ? 'bg-rose-500/15 text-rose-300' : days <= 7 ? 'bg-amber-500/15 text-amber-300' : 'bg-white/[0.06] text-slate-400')}>
                            {days < 0 ? 'متأخر!' : days === 0 ? 'اليوم' : `بعد ${days} يوم`}
                          </span>
                        )}
                        <span className={cn('text-sm font-black', moneyBlur)}>{fmtMoney(sub.amount)}</span>
                        <button
                          className="btn-primary !px-3 !py-1.5 text-[11px]"
                          onClick={() => { setEditItem(sub); setModal('paySub'); }}
                          title="دفع من محفظة وترحيل التجديد"
                        >
                          <RefreshCw size={13} /> دفع
                        </button>
                        <button className="text-slate-600 hover:text-rose-400" onClick={() => del('subscriptions', 'الاشتراك')(sub.id)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </>
      )}

      {/* ======================= الأصول ======================= */}
      {tab === 'assets' && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-400">
              قيمة الأصول الإجمالية: <b className={cn('text-slate-100', moneyBlur)}>{fmtMoney(assets.reduce((a, x) => a + x.estimatedValue, 0))}</b>
            </p>
            <button className="btn-primary" onClick={() => setModal('asset')}>
              <Plus size={16} /> أصل جديد
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {assets.length === 0 && (
              <GlassCard className="sm:col-span-2 xl:col-span-3">
                <EmptyState icon={Gem} title="لا أصول مسجلة" hint="سيارة، معدات تصميم، أجهزة…" />
              </GlassCard>
            )}
            {assets.map((a) => (
              <GlassCard key={a.id} hover className="group">
                <div className="flex items-start justify-between">
                  <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-2.5 text-violet-300">
                    <Gem size={18} />
                  </div>
                  <button className="text-slate-600 opacity-0 transition group-hover:opacity-100 hover:!text-rose-400" onClick={() => del('assets', 'الأصل')(a.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="mt-3 text-sm font-black">{a.name}</p>
                <p className="text-[11px] text-slate-500">{a.category}{a.purchaseDate ? ` · شراء ${fmtDateShort(a.purchaseDate)}` : ''}</p>
                <p className={cn('mt-2 text-lg font-black text-violet-200', moneyBlur)}>{fmtMoney(a.estimatedValue)}</p>
              </GlassCard>
            ))}
          </div>
        </>
      )}

      {/* ======================= الادخار والأهداف ======================= */}
      {tab === 'savings' && (
        <>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => setModal('saving')}>
              <Plus size={16} /> هدف جديد
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {savings.length === 0 && (
              <GlassCard className="sm:col-span-2">
                <EmptyState icon={PiggyBank} title="لا أهداف ادخار بعد" hint="جهاز جديد، سفر، طوارئ…" />
              </GlassCard>
            )}
            {savings.map((g) => {
              const pct = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0;
              return (
                <GlassCard key={g.id} hover className="group">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-black">🎯 {g.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{g.deadline ? `الموعد: ${fmtDateShort(g.deadline)}` : 'بدون موعد نهائي'}</p>
                    </div>
                    <button className="text-slate-600 opacity-0 transition group-hover:opacity-100 hover:!text-rose-400" onClick={() => del('savings', 'الهدف')(g.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <p className={cn('text-lg font-black text-orange-300', moneyBlur)}>{fmtMoney(g.currentAmount)}</p>
                    <p className={cn('text-xs text-slate-500', moneyBlur)}>من {fmtMoney(g.targetAmount)}</p>
                  </div>
                  <ProgressBar value={pct} className="mt-2" color={g.color} />
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400">{Math.round(pct)}%</span>
                    <button className="btn-ghost !px-3 !py-1.5 text-[11px]" onClick={() => { setEditItem(g); setModal('addToSaving'); }}>
                      <Plus size={13} /> إضافة مبلغ
                    </button>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/*                        النوافذ المنبثقة                        */}
      {/* ============================================================ */}

      <Modal open={modal === 'txn'} onClose={() => setModal(null)} title="حركة مالية جديدة">
        <form onSubmit={onForm(addTxn)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">النوع</label>
              <select
                name="kind"
                className="input"
                value={txnKind}
                onChange={(e) => { setTxnKind(e.target.value); setTxnCategory('general'); }}
              >
                <option value="income">دخل 🟢</option>
                <option value="expense">مصروف 🔴</option>
                <option value="pending">دخل متوقّع ⏳ (لم يصل بعد)</option>
              </select>
            </div>
            <div>
              <label className="label">المبلغ</label>
              <input name="amount" type="number" step="0.01" min="0.01" className="input" required placeholder="0.00" />
            </div>
          </div>
          {schemaReady && (
          <div>
            <label className="label">التصنيف</label>
            <div className="flex flex-wrap gap-1.5">
              {activeCategories.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setTxnCategory(c.key)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1 text-[11px] font-bold transition',
                    txnCategory === c.key
                      ? 'border-orange-500/40 bg-orange-500/15 text-orange-200'
                      : 'border-white/[0.07] bg-white/[0.03] text-slate-400 hover:bg-white/[0.08]'
                  )}
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
            <input type="hidden" name="categoryKey" value={txnCategory} />
          </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{schemaReady ? 'وصف التصنيف (اختياري)' : 'التصنيف'}</label>
              <input name="category" className="input" placeholder={schemaReady ? TX_CATEGORY_LABELS[txnCategory] : 'راتب، تصميم، طعام…'} />
            </div>
            <div>
              <label className="label">{txnKind === 'pending' && schemaReady ? 'متى تتوقّع وصوله؟' : 'التاريخ'}</label>
              {txnKind === 'pending' && schemaReady ? (
                <input name="expectedDate" type="date" className="input" required defaultValue={todayStr()} />
              ) : (
                <input name="date" type="date" className="input" defaultValue={todayStr()} />
              )}
            </div>
          </div>
          <div>
            <label className="label">الوصف (اختياري)</label>
            <input name="description" className="input" placeholder="تفاصيل الحركة…" />
          </div>
          <div>
            <label className="label">
              {txnKind === 'pending' ? 'المحفظة (اختياري — تُحدد عند التحصيل)' : 'المحفظة (إلزامي — يُحدَّث رصيدها تلقائياً)'}
            </label>
            <select name="walletId" className="input" defaultValue="" required={txnKind !== 'pending'}>
              <option value="">{txnKind === 'pending' ? '— تُحدد عند التحصيل —' : 'اختر المحفظة…'}</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>{w.name} ({fmtMoney(w.balance)})</option>
              ))}
            </select>
          </div>
          <button className="btn-primary">حفظ الحركة</button>
        </form>
      </Modal>

      <Modal open={modal === 'wallet'} onClose={() => setModal(null)} title="محفظة جديدة">
        <form onSubmit={onForm(addWallet)} className="flex flex-col gap-4">
          <div>
            <label className="label">اسم المحفظة</label>
            <input name="name" className="input" required autoFocus placeholder="جيبي، مصرف الجمهورية…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">النوع</label>
              <select name="type" className="input" defaultValue="cash">
                <option value="cash">كاش 💵</option>
                <option value="bank">مصرف 🏦</option>
              </select>
            </div>
            <div>
              <label className="label">الرصيد الحالي</label>
              <input name="balance" type="number" step="0.01" min="0" className="input" defaultValue={0} />
            </div>
          </div>
          {schemaReady && (
          <div>
            <label className="label">ملكية المال</label>
            <select
              name="ownership"
              className="input"
              value={walletOwnership}
              onChange={(e) => setWalletOwnership(e.target.value as 'personal' | 'trust')}
            >
              <option value="personal">مالي الشخصي 👤</option>
              <option value="trust">أمانة — مال شخص آخر لديّ 🤝</option>
            </select>
          </div>
          )}
          {schemaReady && walletOwnership === 'trust' && (
            <div>
              <label className="label">صاحب المال</label>
              <input name="ownerName" className="input" required placeholder="الوالد…" />
              <p className="mt-1.5 rounded-xl border border-violet-500/20 bg-violet-500/10 p-2.5 text-[11px] text-violet-200">
                🤝 رصيد هذه المحفظة لن يدخل في «صافي ثروتي»، وحركاتها لا تُحسب ضمن دخلي
                أو مصروفي. لأخذ مبلغ منها استخدم «تحويل داخلي» من تبويب المحافظ.
              </p>
            </div>
          )}
          <button className="btn-primary">إنشاء المحفظة</button>
        </form>
      </Modal>

      <Modal open={modal === 'walletEdit'} onClose={() => { setModal(null); setEditItem(null); }} title={`تعديل رصيد «${(editItem as Wallet | null)?.name ?? ''}»`}>
        <form onSubmit={onForm(editWalletBalance)} className="flex flex-col gap-4">
          <div>
            <label className="label">الرصيد الجديد</label>
            <input name="balance" type="number" step="0.01" min="0" className="input" required autoFocus defaultValue={(editItem as Wallet | null)?.balance} />
          </div>
          <button className="btn-primary">حفظ الرصيد</button>
        </form>
      </Modal>

      <Modal open={modal === 'debt'} onClose={() => setModal(null)} title="دين جديد">
        <form onSubmit={onForm(addDebt)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">اسم الشخص</label>
              <input name="personName" className="input" required autoFocus />
            </div>
            <div>
              <label className="label">الاتجاه</label>
              <select name="direction" className="input" defaultValue="owed_to_me">
                <option value="owed_to_me">لي عنده 🟢</option>
                <option value="i_owe">عليّ له 🔴</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">المبلغ</label>
              <input name="amount" type="number" step="0.01" min="0.01" className="input" required />
            </div>
            <div>
              <label className="label">تاريخ الاستحقاق (اختياري)</label>
              <input name="dueDate" type="date" className="input" />
            </div>
          </div>
          <div>
            <label className="label">ملاحظات</label>
            <input name="notes" className="input" placeholder="سبب الدين…" />
          </div>
          <button className="btn-primary">تسجيل الدين</button>
        </form>
      </Modal>

      <Modal open={modal === 'sub'} onClose={() => setModal(null)} title="اشتراك جديد">
        <form onSubmit={onForm(addSub)} className="flex flex-col gap-4">
          <div>
            <label className="label">اسم الاشتراك</label>
            <input name="name" className="input" required autoFocus placeholder="Adobe CC، إنترنت…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">القيمة</label>
              <input name="amount" type="number" step="0.01" min="0.01" className="input" required />
            </div>
            <div>
              <label className="label">الدورة</label>
              <select name="billingCycle" className="input" defaultValue="monthly">
                <option value="monthly">شهري</option>
                <option value="yearly">سنوي</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">التجديد القادم</label>
              <input name="nextRenewal" type="date" className="input" required defaultValue={todayStr()} />
            </div>
            <div>
              <label className="label">التصنيف</label>
              <input name="category" className="input" placeholder="أدوات، ترفيه…" />
            </div>
          </div>
          <button className="btn-primary">إضافة الاشتراك</button>
        </form>
      </Modal>

      <Modal open={modal === 'asset'} onClose={() => setModal(null)} title="أصل / ممتلكات جديدة">
        <form onSubmit={onForm(addAsset)} className="flex flex-col gap-4">
          <div>
            <label className="label">اسم الأصل</label>
            <input name="name" className="input" required autoFocus placeholder="لابتوب، سيارة…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">القيمة التقديرية</label>
              <input name="estimatedValue" type="number" step="0.01" min="0" className="input" defaultValue={0} />
            </div>
            <div>
              <label className="label">التصنيف</label>
              <input name="category" className="input" placeholder="أجهزة، عقار…" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">تاريخ الشراء (اختياري)</label>
              <input name="purchaseDate" type="date" className="input" />
            </div>
            <div>
              <label className="label">ملاحظات</label>
              <input name="notes" className="input" />
            </div>
          </div>
          <button className="btn-primary">إضافة الأصل</button>
        </form>
      </Modal>

      <Modal open={modal === 'saving'} onClose={() => setModal(null)} title="هدف ادخار جديد">
        <form onSubmit={onForm(addSaving)} className="flex flex-col gap-4">
          <div>
            <label className="label">اسم الهدف</label>
            <input name="name" className="input" required autoFocus placeholder="جهاز ماك، طوارئ…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">المبلغ المستهدف</label>
              <input name="targetAmount" type="number" step="0.01" min="0.01" className="input" required />
            </div>
            <div>
              <label className="label">المدخر حالياً</label>
              <input name="currentAmount" type="number" step="0.01" min="0" className="input" defaultValue={0} />
            </div>
          </div>
          <div>
            <label className="label">الموعد النهائي (اختياري)</label>
            <input name="deadline" type="date" className="input" />
          </div>
          <button className="btn-primary">إنشاء الهدف</button>
        </form>
      </Modal>

      <Modal open={modal === 'addToSaving'} onClose={() => { setModal(null); setEditItem(null); }} title={`إضافة مبلغ إلى «${(editItem as SavingsGoal | null)?.name ?? ''}»`}>
        <form onSubmit={onForm(addToSaving)} className="flex flex-col gap-4">
          <div>
            <label className="label">المبلغ المضاف</label>
            <input name="amount" type="number" step="0.01" min="0.01" className="input" required autoFocus />
          </div>
          <button className="btn-primary">إضافة</button>
        </form>
      </Modal>

      {/* ===== سقف شهري لتصنيف ===== */}
      <Modal open={modal === 'budget'} onClose={() => setModal(null)} title="سقف شهري لتصنيف">
        <form onSubmit={onForm(setBudget)} className="flex flex-col gap-4">
          <div>
            <label className="label">التصنيف</label>
            <select name="categoryKey" className="input" defaultValue="petty_cash">
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">السقف الشهري</label>
            <input
              name="monthlyLimit"
              type="number"
              step="0.01"
              min="0.01"
              className="input"
              required
              autoFocus
              placeholder="500"
            />
          </div>
          <p className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-2.5 text-[11px] text-orange-200">
            🎯 السقف تنبيه لا منع — الحركة تُسجَّل دائماً، لكن الشريط يصفرّ عند ٨٠٪ ويحمرّ عند التجاوز.
            وضبط سقف لتصنيف له سقف سابق يحدّثه بدل أن يكرره.
          </p>
          <button className="btn-primary">حفظ السقف</button>
        </form>
      </Modal>

      {/* ===== تحويل داخلي بين محفظتين ===== */}
      <Modal open={modal === 'transfer'} onClose={() => setModal(null)} title="تحويل داخلي بين محفظتين">
        <form onSubmit={onForm(doTransfer)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">من محفظة</label>
              <select name="fromWalletId" className="input" required defaultValue="">
                <option value="">اختر…</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}{w.isPersonal === false ? ' (أمانة)' : ''} ({fmtMoney(w.balance)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">إلى محفظة</label>
              <select name="toWalletId" className="input" required defaultValue="">
                <option value="">اختر…</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}{w.isPersonal === false ? ' (أمانة)' : ''} ({fmtMoney(w.balance)})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">المبلغ</label>
            <input name="amount" type="number" step="0.01" min="0.01" className="input" required placeholder="0.00" />
          </div>
          <div>
            <label className="label">طبيعة التحويل</label>
            <div className="flex flex-col gap-1.5">
              {TRANSFER_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setTransferMode(m.id)}
                  className={cn(
                    'rounded-xl border p-2.5 text-right transition',
                    transferMode === m.id
                      ? 'border-orange-500/40 bg-orange-500/10'
                      : 'border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.07]'
                  )}
                >
                  <p className={cn('text-xs font-bold', transferMode === m.id ? 'text-orange-200' : 'text-slate-300')}>
                    {m.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{m.hint}</p>
                </button>
              ))}
            </div>
          </div>
          {transferMode === 'debt' && (
            <div>
              <label className="label">تاريخ ردّ السلفة (اختياري)</label>
              <input name="dueDate" type="date" className="input" />
            </div>
          )}
          <div>
            <label className="label">ملاحظة (اختياري)</label>
            <input name="note" className="input" placeholder="سبب التحويل — تظهر في وصف الحركتين" />
          </div>
          <button className="btn-primary">
            <ArrowLeftRight size={15} /> تنفيذ التحويل
          </button>
        </form>
      </Modal>

      {/* ===== تسديد دين: اختيار المحفظة ===== */}
      <Modal
        open={modal === 'settleDebt'}
        onClose={() => { setModal(null); setEditItem(null); }}
        title={`تسديد دين «${(editItem as Debt | null)?.personName ?? ''}»`}
      >
        {(() => {
          const d = editItem as Debt | null;
          if (!d) return null;
          const remaining = d.amount - d.paidAmount;
          const collecting = d.direction === 'owed_to_me';
          return (
            <form onSubmit={onForm(settleDebt)} className="flex flex-col gap-4">
              <p className={cn('rounded-xl border p-3 text-xs', collecting ? 'border-orange-500/20 bg-orange-500/10 text-orange-200' : 'border-rose-500/20 bg-rose-500/10 text-rose-200')}>
                {collecting
                  ? <>💰 سيُضاف <b>{fmtMoney(remaining)}</b> إلى المحفظة المختارة (تحصيل دين)</>
                  : <>💸 سيُخصم <b>{fmtMoney(remaining)}</b> من المحفظة المختارة (سداد دين)</>}
                {' '}وتُسجَّل حركة مالية موثقة تلقائياً.
              </p>
              <div>
                <label className="label">{collecting ? 'المحفظة المستلمة' : 'محفظة الدفع'}</label>
                <select name="walletId" className="input" required defaultValue="">
                  <option value="">اختر المحفظة…</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}{w.isPersonal === false ? ' (أمانة)' : ''} ({fmtMoney(w.balance)})
                    </option>
                  ))}
                </select>
              </div>
              {!collecting && trustWallets.length > 0 && (
                <div>
                  <label className="label">إرجاع المبلغ إلى محفظة (اختياري)</label>
                  <select name="toWalletId" className="input" defaultValue="">
                    <option value="">— يخرج من النظام (خصم فقط) —</option>
                    {trustWallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}{w.ownerName ? ` — ${w.ownerName}` : ''} ({fmtMoney(w.balance)})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    إن كنت تُعيد المال فعلياً إلى أمانة صاحبه، اختر محفظته — عندها ينتقل
                    المبلغ بين المحفظتين بدل أن يختفي من النظام.
                  </p>
                </div>
              )}
              <button className="btn-primary">
                <HandCoins size={15} /> تأكيد التسديد
              </button>
            </form>
          );
        })()}
      </Modal>

      {/* ===== دفع اشتراك: اختيار المحفظة ===== */}
      <Modal
        open={modal === 'paySub'}
        onClose={() => { setModal(null); setEditItem(null); }}
        title={`دفع اشتراك «${(editItem as Subscription | null)?.name ?? ''}»`}
      >
        {(() => {
          const s = editItem as Subscription | null;
          if (!s) return null;
          return (
            <form onSubmit={onForm(paySub)} className="flex flex-col gap-4">
              <p className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-xs text-sky-200">
                💳 سيُخصم <b>{fmtMoney(s.amount)}</b> من المحفظة المختارة، وتُسجَّل حركة مصروف،
                ويُرحَّل التجديد تلقائياً إلى الدورة {s.billingCycle === 'monthly' ? 'الشهرية' : 'السنوية'} القادمة.
              </p>
              <div>
                <label className="label">محفظة الدفع</label>
                <select name="walletId" className="input" required defaultValue="">
                  <option value="">اختر المحفظة…</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({fmtMoney(w.balance)})</option>
                  ))}
                </select>
              </div>
              <button className="btn-primary">
                <RefreshCw size={15} /> دفع وترحيل التجديد
              </button>
            </form>
          );
        })()}
      </Modal>

      {/* ===== تحصيل ربح معلق: اختيار المحفظة ===== */}
      <Modal
        open={modal === 'confirmTxn'}
        onClose={() => { setModal(null); setEditItem(null); }}
        title="وصول دخل متوقّع"
      >
        {(() => {
          const t = editItem as Transaction | null;
          if (!t) return null;
          return (
            <form onSubmit={onForm(confirmTxn)} className="flex flex-col gap-4">
              <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                ⏳ سيدخل مبلغ <b>{fmtMoney(t.amount)}</b> ({t.description || t.category}) إلى المحفظة المختارة
                وتتحول الحركة إلى دخل مؤكد.
                {lateDays(t) > 0 && <> وهو <b>متأخر منذ {lateDays(t)} يوماً</b> عن موعده.</>}
              </p>
              <div>
                <label className="label">المحفظة المستلمة</label>
                <select name="walletId" className="input" required defaultValue={t.walletId ?? ''}>
                  <option value="">اختر المحفظة…</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}{w.isPersonal === false ? ' (أمانة)' : ''} ({fmtMoney(w.balance)})
                    </option>
                  ))}
                </select>
              </div>
              {schemaReady && (
              <div>
                <label className="label">تاريخ الاستلام الفعلي</label>
                <input name="receivedDate" type="date" className="input" defaultValue={todayStr()} />
                <p className="mt-1 text-[11px] text-slate-500">
                  يُحتسب المبلغ في شهر استلامه لا في شهر توقّعه — يهمّ إن تأخّر المرتب.
                </p>
              </div>
              )}
              {schemaReady && (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                <input
                  name="repeatNext"
                  type="checkbox"
                  className="h-4 w-4 accent-orange-500"
                  defaultChecked={t.categoryKey === 'salary'}
                />
                أنشئ توقّع الشهر القادم بنفس القيمة تلقائياً
              </label>
              )}
              <button className="btn-primary">
                <CheckCircle2 size={15} /> تأكيد الوصول
              </button>
            </form>
          );
        })()}
      </Modal>

      <ConfirmDialog />
    </div>
  );
}
