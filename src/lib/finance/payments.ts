import {
  addDaysISO,
  addMonthsToYearMonth,
  diffDaysISO,
  formatISODate,
  getDaysInMonth,
  parseISODate,
} from './dates';
import type { PaymentFrequency, RecurringPaymentRecord } from './types';

export type PaymentDisplayStatus = 'upcoming' | 'due_soon' | 'overdue' | 'paid';

export interface EvaluatedPayment extends RecurringPaymentRecord {
  status: PaymentDisplayStatus;
  statusLabel: string;
  daysUntilDue: number; // negative when overdue
}

/**
 * Rule 7:
 * Overdue is derived: next_due_date before today and not paid.
 * Display statuses: Upcoming, Due soon (within 7 days), Overdue, Paid.
 */
export function evaluatePaymentStatus(
  payment: Pick<RecurringPaymentRecord, 'frequency' | 'is_paid' | 'next_due_date'>,
  todayStr: string
): {
  status: PaymentDisplayStatus;
  statusLabel: string;
  daysUntilDue: number;
} {
  const daysUntilDue = diffDaysISO(todayStr, payment.next_due_date);

  if (payment.frequency === 'once' && payment.is_paid) {
    return {
      status: 'paid',
      statusLabel: 'Paid',
      daysUntilDue,
    };
  }

  if (daysUntilDue < 0) {
    return {
      status: 'overdue',
      statusLabel: 'Overdue',
      daysUntilDue,
    };
  }

  if (daysUntilDue <= 7) {
    return {
      status: 'due_soon',
      statusLabel: 'Due soon',
      daysUntilDue,
    };
  }

  return {
    status: 'upcoming',
    statusLabel: 'Upcoming',
    daysUntilDue,
  };
}

/**
 * Rule 7:
 * Advances next_due_date from the anchor day so a monthly bill anchored on the 31st
 * goes Jan 31 -> Feb 28 (or 29 in leap year) -> Mar 31.
 * Handles weekly (+7 days), monthly (+1 month anchored), quarterly (+3 months anchored),
 * yearly (+1 year anchored, clamping Feb 29 -> Feb 28 on non-leap years), and once.
 */
export function computeNextDueDate(
  currentDueDate: string,
  frequency: PaymentFrequency,
  anchorDay: number
): string {
  const clampedAnchor = Math.min(Math.max(Math.round(anchorDay), 1), 31);

  if (frequency === 'once') {
    return currentDueDate;
  }

  if (frequency === 'weekly') {
    return addDaysISO(currentDueDate, 7);
  }

  const { year, month } = parseISODate(currentDueDate);

  if (frequency === 'monthly') {
    const next = addMonthsToYearMonth(year, month, 1);
    const maxDay = getDaysInMonth(next.year, next.month);
    return formatISODate(next.year, next.month, Math.min(clampedAnchor, maxDay));
  }

  if (frequency === 'quarterly') {
    const next = addMonthsToYearMonth(year, month, 3);
    const maxDay = getDaysInMonth(next.year, next.month);
    return formatISODate(next.year, next.month, Math.min(clampedAnchor, maxDay));
  }

  // yearly
  const nextYear = year + 1;
  const maxDay = getDaysInMonth(nextYear, month);
  return formatISODate(nextYear, month, Math.min(clampedAnchor, maxDay));
}

/**
 * Evaluates and categorizes recurring payments, and extracts in-app bell reminders
 * (overdue payments + payments due within 7 days).
 */
export function evaluateAllPayments(
  payments: ReadonlyArray<RecurringPaymentRecord>,
  todayStr: string
): {
  all: EvaluatedPayment[];
  upcoming: EvaluatedPayment[];
  overdue: EvaluatedPayment[];
  paidOnce: EvaluatedPayment[];
  reminders: EvaluatedPayment[];
} {
  const evaluated: EvaluatedPayment[] = payments
    .map((p) => ({
      ...p,
      ...evaluatePaymentStatus(p, todayStr),
    }))
    .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date));

  const overdue = evaluated.filter((p) => p.status === 'overdue');
  const upcoming = evaluated.filter(
    (p) => p.status === 'due_soon' || p.status === 'upcoming'
  );
  const paidOnce = evaluated.filter((p) => p.status === 'paid');
  const reminders = evaluated.filter(
    (p) => p.status === 'overdue' || p.status === 'due_soon'
  );

  return {
    all: evaluated,
    upcoming,
    overdue,
    paidOnce,
    reminders,
  };
}
