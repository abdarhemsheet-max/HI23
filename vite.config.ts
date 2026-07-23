import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// اسم مستودع GitHub — غيّره ليطابق اسم الـ repo الفعلي عند النشر كموقع
// مشروع على GitHub Pages (يصبح الرابط: username.github.io/REPO_NAME).
// إن كان النشر سيتم على جذر النطاق (username.github.io مباشرة) اجعله '/'.
// يمكن أيضاً تجاوزه وقت البناء عبر متغير البيئة VITE_BASE_PATH (يُستخدم
// في .github/workflows/deploy.yml لضبطه تلقائياً من اسم الـ repo).
const REPO_NAME = 'HI23';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH ?? (command === 'build' ? `/${REPO_NAME}/` : '/'),
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 4400,
  },
  preview: {
    port: 4400,
  },
}));
