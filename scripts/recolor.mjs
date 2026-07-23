import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const root = join(import.meta.dirname, '..');
const ALLOWED = ['.tsx', '.ts', '.css'];

/** استبدال آمن لكل الأنماط */
const REPLACEMENTS = [
  // ===== Gradients =====
  [/from-emerald-500\/25 to-teal-500\/10/g, 'from-orange-500/25 to-orange-500/10'],
  [/from-emerald-500\/20 to-transparent/g, 'from-orange-500/20 to-transparent'],
  [/from-emerald-400 to-teal-500/g, 'from-orange-400 to-orange-500'],
  [/from-emerald-500 to-teal-400/g, 'from-orange-500 to-orange-400'],
  [/from-emerald-500\/20 to-emerald-500\/5/g, 'from-orange-500/20 to-orange-500/5'],

  // ===== Text =====
  [/text-emerald-300/g, 'text-orange-300'],
  [/text-emerald-400/g, 'text-orange-400'],
  [/text-emerald-200\/90/g, 'text-orange-200/90'],
  [/text-emerald-200/g, 'text-orange-200'],
  [/text-emerald-500/g, 'text-orange-500'],

  // ===== Background =====
  [/bg-emerald-500\/\d+/g, (m) => m.replace('emerald', 'orange')],
  [/bg-emerald-500\/\[0\.[\d]+\]/g, (m) => m.replace('emerald', 'orange')],
  [/bg-emerald-400\/90/g, 'bg-orange-400/90'],
  [/bg-emerald-400/g, 'bg-orange-400'],
  [/bg-emerald-900\/70/g, 'bg-orange-900/70'],
  [/bg-emerald-700\/80/g, 'bg-orange-700/80'],
  [/bg-emerald-500\/85/g, 'bg-orange-500/85'],

  // ===== Borders =====
  [/border-emerald-500\/\d+/g, (m) => m.replace('emerald', 'orange')],

  // ===== Ring =====
  [/ring-emerald-500\/40/g, 'ring-orange-500/40'],
  [/ring-1 ring-emerald-400\/50/g, 'ring-1 ring-orange-400/50'],

  // ===== Shadow =====
  [/shadow-emerald-500\/10/g, 'shadow-orange-500/10'],
  [/shadow-\[0_0_20px_rgba\(52,211,153,0\.4\)\]/g, 'shadow-[0_0_20px_rgba(251,146,60,0.4)]'],
  [/shadow-\[0_0_30px_rgba\(52,211,153,0\.25\)\]/g, 'shadow-[0_0_30px_rgba(251,146,60,0.25)]'],

  // ===== Raw rgba in CSS =====
  [/rgba\(52,\s*211,\s*153,\s*0\.12\)/g, 'rgba(251, 146, 60, 0.12)'],

  // ===== Hex values (with word boundary) =====
  [/(?<![\w-])#34d399(?![\w-])/g, '#f97316'],
  [/(?<![\w-])#2dd4bf(?![\w-])/g, '#f97316'],

  // ===== emerald color type/tone identifiers (in TS types/props) =====
  [/'emerald' \| 'violet' \| 'sky' \| 'amber' \| 'rose'/g, "'orange' | 'violet' | 'sky' | 'amber' | 'rose'"],
  [/"emerald" \| "violet" \| "sky" \| "amber" \| "rose"/g, '"orange" | "violet" | "sky" | "amber" | "rose"'],
  [/: 'emerald'/g, ": 'orange'"],
  [/: "emerald"/g, ': "orange"'],
  [/tone="emerald"/g, 'tone="orange"'],
  [/color="emerald"/g, 'color="orange"'],
  [/color='emerald'/g, "color='orange'"],
  [/\bemerald:\s*\{/g, 'orange: {'],

  // ===== !important border + bg combo =====
  [/!border-emerald-500\/40 !bg-emerald-500\/\[0\.08\]/g, '!border-orange-500/40 !bg-orange-500/[0.08]'],

  // ===== remaining border-emerald bg-emerald text-emerald combos =====
  [/border-emerald-500\/20 bg-emerald-500\/10 text-emerald-300/g, 'border-orange-500/20 bg-orange-500/10 text-orange-300'],
];

function walk(dir) {
  const entries = readdirSync(dir);
  for (const e of entries) {
    const p = join(dir, e);
    if (p.includes('node_modules') || p.includes('dist')) continue;
    if (statSync(p).isDirectory()) { walk(p); continue; }
    const ext = extname(p);
    if (!ALLOWED.includes(ext)) continue;

    let content = readFileSync(p, 'utf8');
    const before = content;
    for (const [rx, repl] of REPLACEMENTS) {
      content = content.replace(rx, repl);
    }
    if (content !== before) {
      writeFileSync(p, content, 'utf8');
      console.log(`  ✔ ${p.replace(root, '').slice(1)}`);
    }
  }
}

console.log('🎨 Recoloring: emerald → orange ...');
walk(join(root, 'src'));
console.log('✅ Done!');
