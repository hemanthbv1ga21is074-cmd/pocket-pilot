import type { PeriodKey } from './types';

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns the YYYY-MM-DD calendar date in the specified IANA timezone (default Asia/Kolkata).
 */
export function getTodayInTimezone(
  now: Date = new Date(),
  timezone: string = DEFAULT_TIMEZONE
): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDaysInMonth(year: number, month: number): number {
  const daysPerMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return daysPerMonth[month - 1] ?? 30;
}

export function parseISODate(dateStr: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) {
    throw new Error(`Invalid ISO date string: ${dateStr}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return { year, month, day };
}

export function isValidISODate(dateStr: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const maxDay = getDaysInMonth(year, month);
  return day >= 1 && day <= maxDay;
}

export function formatISODate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Converts a YYYY-MM-DD string to a UTC midnight Date object for deterministic calendar arithmetic.
 */
function toUTCDate(dateStr: string): Date {
  const { year, month, day } = parseISODate(dateStr);
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUTCDate(date: Date): string {
  return formatISODate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate()
  );
}

export function addDaysISO(dateStr: string, days: number): string {
  const d = toUTCDate(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTCDate(d);
}

/**
 * Returns endDate - startDate in whole calendar days (positive when endDate > startDate).
 */
export function diffDaysISO(startDateStr: string, endDateStr: string): number {
  const startMs = toUTCDate(startDateStr).getTime();
  const endMs = toUTCDate(endDateStr).getTime();
  return Math.round((endMs - startMs) / 86_400_000);
}

/**
 * Returns the Monday..Sunday week boundaries containing the given YYYY-MM-DD date.
 */
export function getWeekBoundaries(dateStr: string): { start: string; end: string } {
  const d = toUTCDate(dateStr);
  const utcDay = d.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const offsetFromMonday = utcDay === 0 ? -6 : 1 - utcDay;
  const start = addDaysISO(dateStr, offsetFromMonday);
  const end = addDaysISO(start, 6);
  return { start, end };
}

/**
 * Returns the first and last day of the calendar month containing the given YYYY-MM-DD date.
 */
export function getMonthBoundaries(dateStr: string): { start: string; end: string; yearMonth: string } {
  const { year, month } = parseISODate(dateStr);
  const lastDay = getDaysInMonth(year, month);
  return {
    start: formatISODate(year, month, 1),
    end: formatISODate(year, month, lastDay),
    yearMonth: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`,
  };
}

/**
 * Shifts a (year, month) pair by deltaMonths and returns the new { year, month }.
 */
export function addMonthsToYearMonth(
  year: number,
  month: number,
  deltaMonths: number
): { year: number; month: number } {
  const zeroIndexed = year * 12 + (month - 1) + deltaMonths;
  const nextYear = Math.floor(zeroIndexed / 12);
  const nextMonth = (zeroIndexed % 12) + 1;
  return { year: nextYear, month: nextMonth };
}

/**
 * Returns true if dateStr is strictly after todayStr.
 * Rule 1: Future-dated transactions are rejected (date must be on or before today in profile timezone).
 */
export function isFutureDate(dateStr: string, todayStr: string): boolean {
  return dateStr > todayStr;
}

export interface ResolvedPeriodRange {
  period: PeriodKey;
  label: string;
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
  budgetYearMonth: string; // YYYY-MM of the period's end date (Rule 5)
}

/**
 * Resolves the date range and previous comparison window for a selected global period.
 * Rule 3:
 * - "The previous period is the equally long window immediately before."
 * - "For 'This month', compare month-to-date with the same number of days of the previous month."
 */
export function resolvePeriodRange(
  period: PeriodKey,
  todayStr: string,
  customFrom?: string,
  customTo?: string
): ResolvedPeriodRange {
  const { year, month, day } = parseISODate(todayStr);

  if (period === 'this_month') {
    const start = formatISODate(year, month, 1);
    const end = todayStr;
    const prevYM = addMonthsToYearMonth(year, month, -1);
    const prevMaxDay = getDaysInMonth(prevYM.year, prevYM.month);
    const prevStart = formatISODate(prevYM.year, prevYM.month, 1);
    const prevEnd = formatISODate(prevYM.year, prevYM.month, Math.min(day, prevMaxDay));
    return {
      period,
      label: 'This month',
      start,
      end,
      prevStart,
      prevEnd,
      budgetYearMonth: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`,
    };
  }

  if (period === 'last_month') {
    const lastYM = addMonthsToYearMonth(year, month, -1);
    const start = formatISODate(lastYM.year, lastYM.month, 1);
    const end = formatISODate(
      lastYM.year,
      lastYM.month,
      getDaysInMonth(lastYM.year, lastYM.month)
    );
    const twoAgoYM = addMonthsToYearMonth(year, month, -2);
    const prevStart = formatISODate(twoAgoYM.year, twoAgoYM.month, 1);
    const prevEnd = formatISODate(
      twoAgoYM.year,
      twoAgoYM.month,
      getDaysInMonth(twoAgoYM.year, twoAgoYM.month)
    );
    return {
      period,
      label: 'Last month',
      start,
      end,
      prevStart,
      prevEnd,
      budgetYearMonth: `${String(lastYM.year).padStart(4, '0')}-${String(lastYM.month).padStart(2, '0')}`,
    };
  }

  if (period === 'last_3_months') {
    const startYM = addMonthsToYearMonth(year, month, -2);
    const start = formatISODate(startYM.year, startYM.month, 1);
    const end = todayStr;
    const windowDays = diffDaysISO(start, end) + 1;
    const prevEnd = addDaysISO(start, -1);
    const prevStart = addDaysISO(prevEnd, -(windowDays - 1));
    return {
      period,
      label: 'Last 3 months',
      start,
      end,
      prevStart,
      prevEnd,
      budgetYearMonth: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`,
    };
  }

  if (period === 'this_year') {
    const start = formatISODate(year, 1, 1);
    const end = todayStr;
    const windowDays = diffDaysISO(start, end) + 1;
    const prevEnd = addDaysISO(start, -1);
    const prevStart = addDaysISO(prevEnd, -(windowDays - 1));
    return {
      period,
      label: 'This year',
      start,
      end,
      prevStart,
      prevEnd,
      budgetYearMonth: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`,
    };
  }

  // Custom range
  const safeFrom = customFrom && isValidISODate(customFrom) ? customFrom : formatISODate(year, month, 1);
  const safeTo = customTo && isValidISODate(customTo) ? customTo : todayStr;
  const [start, end] = safeFrom <= safeTo ? [safeFrom, safeTo] : [safeTo, safeFrom];
  const windowDays = diffDaysISO(start, end) + 1;
  const prevEnd = addDaysISO(start, -1);
  const prevStart = addDaysISO(prevEnd, -(windowDays - 1));
  const endParts = parseISODate(end);

  return {
    period: 'custom',
    label: 'Custom range',
    start,
    end,
    prevStart,
    prevEnd,
    budgetYearMonth: `${String(endParts.year).padStart(4, '0')}-${String(endParts.month).padStart(2, '0')}`,
  };
}

export function formatDisplayDate(dateStr: string): string {
  if (!isValidISODate(dateStr)) return dateStr;
  const { year, month, day } = parseISODate(dateStr);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
