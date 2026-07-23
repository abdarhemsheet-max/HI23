'use client';

import { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { cn } from '@/shared/utils';
import type { ProjectTask } from '@/shared/types';

interface Props {
  tasks: ProjectTask[];
  onReorder: (orderedIds: string[]) => void;
  onToggle: (task: ProjectTask) => void;
  onDelete: (task: ProjectTask) => void;
}

/** صف مهمة قابل للسحب */
function Row({
  task,
  onToggle,
  onDelete,
}: {
  task: ProjectTask;
  onToggle: (t: ProjectTask) => void;
  onDelete: (t: ProjectTask) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const color = task.project?.color ?? '#a78bfa';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'glass-inset group flex items-center gap-2 p-2.5',
        isDragging && 'ring-1 ring-emerald-500/40'
      )}
    >
      {/* مقبض السحب */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-slate-600 hover:text-slate-300 active:cursor-grabbing"
        aria-label="اسحب لإعادة الترتيب"
      >
        <GripVertical size={16} />
      </button>

      <button onClick={() => onToggle(task)} className="shrink-0" aria-label="تبديل الإنجاز">
        {task.isCompleted ? (
          <CheckCircle2 size={17} className="text-emerald-400" />
        ) : (
          <Circle size={17} className="text-slate-600" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-semibold', task.isCompleted && 'text-slate-500 line-through')}>
          {task.title}
        </p>
        {task.project && (
          <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
            {task.project.name}
          </span>
        )}
      </div>

      <button
        onClick={() => onDelete(task)}
        className="text-slate-700 opacity-0 transition group-hover:opacity-100 hover:!text-rose-400"
        aria-label="حذف"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

/**
 * قائمة مهام بالسحب والإفلات (تحديث متفائل): الترتيب يتغيّر فوراً في الواجهة
 * ثم يُحفظ في الخلفية. تُبقي نسخة محلية متزامنة مع الوارد من الأعلى.
 */
export default function SortableTasks({ tasks, onReorder, onToggle, onDelete }: Props) {
  const [items, setItems] = useState(tasks);

  // مزامنة مع أحدث بيانات من الخادم (بعد الإضافة/الحذف/التحديث)
  useEffect(() => {
    setItems(tasks);
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((t) => t.id === active.id);
    const newIndex = items.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next); // تحديث فوري
    onReorder(next.map((t) => t.id)); // حفظ في الخلفية
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1.5">
          {items.map((t) => (
            <Row key={t.id} task={t} onToggle={onToggle} onDelete={onDelete} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
