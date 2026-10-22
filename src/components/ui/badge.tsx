import * as React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type BadgeVariant =
  | 'default'
  | 'income'
  | 'expense'
  | 'warning'
  | 'success'
  | 'muted';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  icon?: React.ReactNode;
  hideDefaultIcon?: boolean;
}

export function Badge({
  className,
  variant = 'default',
  icon,
  hideDefaultIcon = false,
  children,
  ...props
}: BadgeProps) {
  const variantStyles: Record<BadgeVariant, string> = {
    default:
      'bg-[#0E3B2C]/10 text-[#0E3B2C] border-[#0E3B2C]/20 dark:bg-white/10 dark:text-[#EDEBE4] dark:border-white/15',
    income:
      'bg-[#2E9E6B]/15 text-[#14533D] border-[#2E9E6B]/30 dark:bg-[#45B883]/15 dark:text-[#6EE7B7] dark:border-[#45B883]/30',
    success:
      'bg-[#2E9E6B]/15 text-[#14533D] border-[#2E9E6B]/30 dark:bg-[#45B883]/15 dark:text-[#6EE7B7] dark:border-[#45B883]/30',
    expense:
      'bg-[#D9695F]/15 text-[#9B332B] border-[#D9695F]/30 dark:bg-[#E58076]/15 dark:text-[#FCA5A5] dark:border-[#E58076]/30',
    warning:
      'bg-[#D9A441]/20 text-[#7A540B] border-[#D9A441]/35 dark:bg-[#E6B555]/15 dark:text-[#FDE68A] dark:border-[#E6B555]/30',
    muted:
      'bg-black/5 text-muted border-border dark:bg-white/5 dark:text-muted',
  };

  const defaultIcons: Record<BadgeVariant, React.ReactNode> = {
    default: <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
    income: <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
    success: <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
    expense: <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
    warning: <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
    muted: <TrendingDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {icon ?? (!hideDefaultIcon ? defaultIcons[variant] : null)}
      <span>{children}</span>
    </span>
  );
}
