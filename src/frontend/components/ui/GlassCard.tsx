import { cn } from '@/shared/utils';

export default function GlassCard({
  children,
  className,
  hover = false,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div className={cn('glass p-5 animate-fade-up', hover && 'glass-hover', className)}>
      {children}
    </div>
  );
}
