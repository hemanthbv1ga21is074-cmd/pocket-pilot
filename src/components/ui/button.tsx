'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary:
        'bg-[#14533D] text-white hover:bg-[#0E3B2C] dark:bg-[#1E6F50] dark:hover:bg-[#258560] shadow-sm',
      secondary:
        'bg-[#0E3B2C]/10 text-[#0E3B2C] hover:bg-[#0E3B2C]/15 dark:bg-white/10 dark:text-[#EDEBE4] dark:hover:bg-white/15',
      outline:
        'border border-border bg-card text-primary hover:bg-black/5 dark:hover:bg-white/5',
      ghost:
        'bg-transparent text-primary hover:bg-black/5 dark:hover:bg-white/5',
      danger:
        'bg-[#B8473D] text-white hover:bg-[#9E3A31] dark:bg-[#C95247] dark:hover:bg-[#B24339] shadow-sm',
    };

    const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
      sm: 'min-h-[44px] px-3.5 py-2 text-sm',
      md: 'min-h-[44px] px-4 py-2.5 text-sm',
      lg: 'min-h-[48px] px-6 py-3 text-base',
      icon: 'min-h-[44px] min-w-[44px] p-2.5',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-control font-medium transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9E6B] focus-visible:ring-offset-2 focus-visible:ring-offset-page',
          'disabled:pointer-events-none disabled:opacity-55',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : leftIcon}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
