'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import ImageExt from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Table as TableIcon,
  Image as ImageIcon,
  Undo2,
  Redo2,
} from 'lucide-react';
import { cn } from '@/shared/utils';

interface Props {
  content: string;
  onChange: (html: string) => void;
}

/**
 * محرر نصوص غني (TipTap) للتقارير اليدوية: عناوين، قوائم، اقتباسات،
 * جداول، وإدراج صور. يُصدَّر HTML مباشرة عبر onChange لحفظه أو تحويله PDF.
 */
export default function RichTextEditor({ content, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      ImageExt,
      Placeholder.configure({ placeholder: 'ابدأ كتابة محتوى التقرير…' }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: 'tiptap-content min-h-[320px] focus:outline-none' },
    },
  });

  // مزامنة المحتوى عند تحميله من الخادم (بعد أن كان فارغاً وقت إنشاء المحرر)
  useEffect(() => {
    if (editor && !editor.isFocused && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, editor]);

  if (!editor) return null;

  const addImage = () => {
    const url = window.prompt('رابط الصورة (URL):');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const addTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const toolBtn = (active: boolean) =>
    cn(
      'rounded-lg p-2 transition',
      active ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:bg-white/10 hover:text-slate-200'
    );

  return (
    <div className="glass-inset overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 border-b border-white/[0.06] p-2">
        <button type="button" className={toolBtn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()} title="عريض">
          <Bold size={15} />
        </button>
        <button type="button" className={toolBtn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()} title="مائل">
          <Italic size={15} />
        </button>
        <div className="mx-1 h-5 w-px bg-white/10" />
        <button
          type="button"
          className={toolBtn(editor.isActive('heading', { level: 1 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="عنوان رئيسي"
        >
          <Heading1 size={15} />
        </button>
        <button
          type="button"
          className={toolBtn(editor.isActive('heading', { level: 2 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="عنوان فرعي"
        >
          <Heading2 size={15} />
        </button>
        <div className="mx-1 h-5 w-px bg-white/10" />
        <button type="button" className={toolBtn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()} title="قائمة نقطية">
          <List size={15} />
        </button>
        <button type="button" className={toolBtn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="قائمة مرقّمة">
          <ListOrdered size={15} />
        </button>
        <button type="button" className={toolBtn(editor.isActive('blockquote'))} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="اقتباس">
          <Quote size={15} />
        </button>
        <div className="mx-1 h-5 w-px bg-white/10" />
        <button type="button" className={toolBtn(false)} onClick={addTable} title="إدراج جدول">
          <TableIcon size={15} />
        </button>
        <button type="button" className={toolBtn(false)} onClick={addImage} title="إدراج صورة">
          <ImageIcon size={15} />
        </button>
        <div className="mx-1 h-5 w-px bg-white/10" />
        <button type="button" className={toolBtn(false)} onClick={() => editor.chain().focus().undo().run()} title="تراجع">
          <Undo2 size={15} />
        </button>
        <button type="button" className={toolBtn(false)} onClick={() => editor.chain().focus().redo().run()} title="إعادة">
          <Redo2 size={15} />
        </button>
      </div>
      <div className="max-h-[55vh] overflow-y-auto p-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
