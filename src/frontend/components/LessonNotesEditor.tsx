import { useEffect, useRef, useState } from 'react';
import { api } from '@/frontend/api';
import { cn } from '@/shared/utils';

interface Props {
  lessonId: string;
  initialNotes: string | null;
  className?: string;
}

export default function LessonNotesEditor({ lessonId, initialNotes, className }: Props) {
  const [value, setValue] = useState(initialNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setValue(initialNotes ?? '');
    setSaved(true);
  }, [lessonId, initialNotes]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setValue(next);
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setSaving(true);
      api(`/api/learning/lessons/${lessonId}`, {
        method: 'PATCH',
        body: { notes: next || null },
      }).then(() => {
        setSaving(false);
        setSaved(true);
      });
    }, 1000);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
          📝 ملاحظاتي
        </label>
        <span className={cn(
          'text-[10px] transition-opacity',
          saving ? 'text-amber-400' : saved ? 'text-emerald-400' : 'text-slate-600'
        )}>
          {saving ? 'جارٍ الحفظ…' : saved ? '✓ حُفظ' : 'غير محفوظ'}
        </span>
      </div>
      <textarea
        value={value}
        onChange={handleChange}
        rows={5}
        dir="auto"
        placeholder="دوّن خلاصة الدرس، اقتباسات، أو أسئلة تخطر ببالك…"
        className="input resize-y min-h-[6rem] text-sm leading-relaxed"
      />
    </div>
  );
}
