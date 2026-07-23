export default function ProgressBar({
  value,
  color = '#34d399',
  className = '',
}: {
  value: number; // 0..100
  color?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-white/[0.07] ${className}`}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color, boxShadow: `0 0 12px ${color}66` }}
      />
    </div>
  );
}
