import { parseISODate } from './dates';
import type { GoalContributionRecord, GoalRecord } from './types';

export type GoalState = 'reached' | 'past_due' | 'no_date' | 'active';

export interface EvaluatedGoal {
  id: string;
  name: string;
  description: string | null;
  targetMinor: number;
  savedMinor: number;
  remainingMinor: number;
  progressPct: number;
  targetDate: string | null;
  state: GoalState;
  stateLabel: string;
  requiredMonthlyMinor: number | null;
  monthsRemaining: number | null;
}

/**
 * Computes whole calendar months from todayStr to targetDateStr.
 */
export function computeWholeCalendarMonths(todayStr: string, targetDateStr: string): number {
  const start = parseISODate(todayStr);
  const end = parseISODate(targetDateStr);
  let months = (end.year - start.year) * 12 + (end.month - start.month);
  if (end.day < start.day) {
    months -= 1;
  }
  return Math.max(months, 0);
}

/**
 * Rule 6:
 * Saved = sum of contributions.
 * Remaining = max(target - saved, 0).
 * Progress = min(saved / target, 100%).
 * Required monthly contribution = remaining / whole calendar months from today to the target date,
 * rounded up, minimum 1.
 * Special states: "Goal reached", "Target date passed" (show remaining, no monthly figure) and "No target date".
 */
export function evaluateGoal(
  goal: GoalRecord,
  contributions: ReadonlyArray<Pick<GoalContributionRecord, 'goal_id' | 'amount_minor'>>,
  todayStr: string
): EvaluatedGoal {
  const savedRaw = contributions
    .filter((c) => c.goal_id === goal.id)
    .reduce((acc, c) => acc + c.amount_minor, 0);

  const savedMinor = Math.max(savedRaw, 0);
  const remainingMinor = Math.max(goal.target_minor - savedMinor, 0);
  const progressPct =
    goal.target_minor > 0
      ? Math.min(Math.max((savedMinor / goal.target_minor) * 100, 0), 100)
      : 0;

  const targetDate = goal.target_date ?? null;

  if (savedMinor >= goal.target_minor) {
    return {
      id: goal.id,
      name: goal.name,
      description: goal.description ?? null,
      targetMinor: goal.target_minor,
      savedMinor,
      remainingMinor: 0,
      progressPct: 100,
      targetDate,
      state: 'reached',
      stateLabel: 'Goal reached',
      requiredMonthlyMinor: null,
      monthsRemaining: null,
    };
  }

  if (!targetDate) {
    return {
      id: goal.id,
      name: goal.name,
      description: goal.description ?? null,
      targetMinor: goal.target_minor,
      savedMinor,
      remainingMinor,
      progressPct,
      targetDate: null,
      state: 'no_date',
      stateLabel: 'No target date',
      requiredMonthlyMinor: null,
      monthsRemaining: null,
    };
  }

  if (targetDate < todayStr) {
    return {
      id: goal.id,
      name: goal.name,
      description: goal.description ?? null,
      targetMinor: goal.target_minor,
      savedMinor,
      remainingMinor,
      progressPct,
      targetDate,
      state: 'past_due',
      stateLabel: 'Target date passed',
      requiredMonthlyMinor: null,
      monthsRemaining: 0,
    };
  }

  const wholeMonths = computeWholeCalendarMonths(todayStr, targetDate);
  const divisorMonths = Math.max(wholeMonths, 1);
  const requiredMonthlyMinor = Math.max(Math.ceil(remainingMinor / divisorMonths), 1);

  return {
    id: goal.id,
    name: goal.name,
    description: goal.description ?? null,
    targetMinor: goal.target_minor,
    savedMinor,
    remainingMinor,
    progressPct,
    targetDate,
    state: 'active',
    stateLabel: 'On track',
    requiredMonthlyMinor,
    monthsRemaining: divisorMonths,
  };
}

export type GoalContributionValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Validates a goal contribution or withdrawal against Rule 1 & Section 6:
 * - Positive amount (contribution) must not exceed Available to spend.
 * - Negative amount (withdrawal) must not exceed the goal's saved amount.
 */
export function validateGoalContribution(
  amountMinor: number,
  availableToSpendMinor: number,
  goalSavedMinor: number
): GoalContributionValidationResult {
  if (amountMinor === 0) {
    return { ok: false, error: 'Contribution amount cannot be zero' };
  }

  if (amountMinor > 0) {
    if (amountMinor > availableToSpendMinor) {
      return {
        ok: false,
        error: 'Contribution exceeds your Available to spend balance',
      };
    }
    return { ok: true };
  }

  const withdrawalMinor = Math.abs(amountMinor);
  if (withdrawalMinor > goalSavedMinor) {
    return {
      ok: false,
      error: 'Withdrawal cannot exceed the amount currently saved in this goal',
    };
  }

  return { ok: true };
}
