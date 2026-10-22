import * as React from 'react';
import { cn } from '@/lib/utils';

export type ProgressTone = 'normal' | 'approaching' | 'reached' | 'exceeded';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** True percentage value (can exceed 100, bar visually caps at 100) */
  value: number;
  tone?: ProgressTone;
  label?: string;
}

export function Progress({
  value,
  tone = 'normal',
  label = 'Progress',
  className,
  ...props
}: ProgressProps) {
  const clampedVisualWidth = Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 100);

  const toneBarStyles: Record<ProgressTone, string> = {
    normal: 'bg-income',
    approaching: 'bg-warning',
    reached: 'bg-warning',
    exceeded: 'bg-expense',
  };

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clampedVisualWidth)}
      className={cn(
        'relative h-2.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'h-full rounded-full transition-all duration-200',
          toneBarStyles[tone]
        )}
        style={{ width: `${clampedVisualWidth}%` }}
      />
    </div>
  );
}
