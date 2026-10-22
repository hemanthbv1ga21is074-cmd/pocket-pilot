import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  prefixAddon?: React.ReactNode;
  suffixAddon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, prefixAddon, suffixAddon, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-primary">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefixAddon && (
            <span className="pointer-events-none absolute left-3.5 text-sm font-medium text-muted">
              {prefixAddon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={cn(
              'flex min-h-[44px] w-full rounded-control border border-border bg-card px-3.5 py-2 text-sm text-primary transition-colors duration-150',
              'placeholder:text-muted/75',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9E6B] focus-visible:border-[#2E9E6B]',
              'disabled:cursor-not-allowed disabled:opacity-55',
              prefixAddon ? 'pl-9' : '',
              suffixAddon ? 'pr-9' : '',
              error ? 'border-expense focus-visible:ring-expense' : '',
              className
            )}
            {...props}
          />
          {suffixAddon && (
            <span className="pointer-events-none absolute right-3.5 text-sm font-medium text-muted">
              {suffixAddon}
            </span>
          )}
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-xs font-medium text-expense">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helperId} className="text-xs text-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
