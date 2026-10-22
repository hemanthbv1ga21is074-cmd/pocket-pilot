export type AffordabilityOutcome =
  | 'comfortable'
  | 'dips_into_reserve'
  | 'exceeds_balance';

export interface AffordabilityInput {
  balanceMinor: number;
  purchaseMinor: number;
  reserveMinor: number;
}

export interface AffordabilityResult {
  outcome: AffordabilityOutcome;
  label: string;
  remainingMinor: number;
  shortfallMinor: number;
  explanation: string;
  disclaimer: string;
}

export const AFFORDABILITY_DISCLAIMER =
  'Note: This calculation is based only on the figures provided and does not account for unrecorded expenses or uncertain future income.';

/**
 * Rule 8:
 * Inputs are balance (prefilled with Available to spend, editable), purchase amount (above 0)
 * and minimum reserve (0 or more).
 * Remaining = balance - purchase.
 * Three outcomes:
 * - Comfortable (remaining >= reserve)
 * - Dips into reserve (0 <= remaining < reserve, show the shortfall)
 * - Exceeds balance (remaining < 0)
 */
export function evaluateAffordability(input: AffordabilityInput): AffordabilityResult {
  const balanceMinor = Math.round(input.balanceMinor);
  const purchaseMinor = Math.round(input.purchaseMinor);
  const reserveMinor = Math.max(Math.round(input.reserveMinor), 0);

  if (purchaseMinor <= 0) {
    throw new Error('Purchase amount must be greater than 0');
  }

  const remainingMinor = balanceMinor - purchaseMinor;

  if (remainingMinor >= reserveMinor) {
    return {
      outcome: 'comfortable',
      label: 'Comfortable',
      remainingMinor,
      shortfallMinor: 0,
      explanation:
        'After this purchase, your remaining balance stays at or above your minimum reserve.',
      disclaimer: AFFORDABILITY_DISCLAIMER,
    };
  }

  if (remainingMinor >= 0) {
    const shortfallMinor = reserveMinor - remainingMinor;
    return {
      outcome: 'dips_into_reserve',
      label: 'Dips into reserve',
      remainingMinor,
      shortfallMinor,
      explanation:
        'Your balance covers the purchase, but your remaining funds fall below your target reserve.',
      disclaimer: AFFORDABILITY_DISCLAIMER,
    };
  }

  const shortfallMinor = Math.abs(remainingMinor);
  return {
    outcome: 'exceeds_balance',
    label: 'Exceeds balance',
    remainingMinor,
    shortfallMinor,
    explanation:
      'This purchase is larger than the balance entered, resulting in a shortfall.',
    disclaimer: AFFORDABILITY_DISCLAIMER,
  };
}
