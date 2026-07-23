import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import Toaster from '@/frontend/components/ui/Toaster';
import './globals.css';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  weight: ['400', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  title: 'نظام حياتي | عبدالرحيم أحمد شيتة',
  description: 'نظام شخصي متكامل لإدارة الحياة: المالية، العادات، المشاريع، التقارير، والقرآن الكريم',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
