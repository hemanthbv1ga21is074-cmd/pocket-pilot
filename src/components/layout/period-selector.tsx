'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Calendar } from 'lucide-react';
import type { PeriodKey } from '@/lib/finance/types';
import { getTodayInTimezone } from '@/lib/finance/dates';

export const PERIOD_OPTIONS: ReadonlyArray<{ value: PeriodKey; label: string }> = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'this_year', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
];

export function usePeriodParams() {
  const searchParams = useSearchParams();
  const rawPeriod = searchParams.get('period') as PeriodKey | null;
  const validPeriods = new Set<PeriodKey>([
    'this_month',
    'last_month',
    'last_3_months',
    'this_year',
    'custom',
  ]);
  const period: PeriodKey =
    rawPeriod && validPeriods.has(rawPeriod) ? rawPeriod : 'this_month';

  const today = getTodayInTimezone();
  const customFrom = searchParams.get('from') ?? `${today.slice(0, 8)}01`;
  const customTo = searchParams.get('to') ?? today;

  return { period, customFrom, customTo };
}

export function PeriodSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { period, customFrom, customTo } = usePeriodParams();

  const updateParams = React.useCallback(
    (nextPeriod: PeriodKey, nextFrom?: string, nextTo?: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('period', nextPeriod);
      if (nextPeriod === 'custom') {
        params.set('from', nextFrom ?? customFrom);
        params.set('to', nextTo ?? customTo);
      } else {
        params.delete('from');
        params.delete('to');
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams, customFrom, customTo]
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex items-center">
        <Calendar
          className="pointer-events-none absolute left-3 h-4 w-4 text-muted"
          aria-hidden="true"
        />
        <label htmlFor="global-period-select" className="sr-only">
          Select reporting period
        </label>
        <select
          id="global-period-select"
          aria-label="Reporting period"
          value={period}
          onChange={(e) => updateParams(e.target.value as PeriodKey)}
          className="min-h-[44px] appearance-none rounded-control border border-border bg-card pl-9 pr-8 py-2 text-sm font-medium text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9E6B]"
        >
          {PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {period === 'custom' && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            aria-label="Custom range start date"
            value={customFrom}
            max={customTo}
            onChange={(e) => updateParams('custom', e.target.value, customTo)}
            className="min-h-[44px] rounded-control border border-border bg-card px-2.5 py-1.5 text-xs text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9E6B]"
          />
          <span className="text-xs text-muted">to</span>
          <input
            type="date"
            aria-label="Custom range end date"
            value={customTo}
            min={customFrom}
            onChange={(e) => updateParams('custom', customFrom, e.target.value)}
            className="min-h-[44px] rounded-control border border-border bg-card px-2.5 py-1.5 text-xs text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9E6B]"
          />
        </div>
      )}
    </div>
  );
}
