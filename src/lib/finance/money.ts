export const MAX_AMOUNT_MINOR = 10_000_000_000; // ₹10 crore (10,00,00,000.00 INR in paise)

export interface ParseMoneyOptions {
  allowZero?: boolean;
  allowNegative?: boolean;
  maxMinor?: number;
}

export type ParseMoneyResult =
  | { ok: true; minor: number }
  | { ok: false; error: string };

/**
 * Parses a human-typed amount string into integer minor units (paise)
 * using purely string/integer arithmetic (never floating-point multiplication).
 * Supports Indian/international commas (e.g. "1,25,000.50") and optional currency prefix.
 */
export function parseMoneyToMinor(
  rawInput: string | number,
  options: ParseMoneyOptions = {}
): ParseMoneyResult {
  const {
    allowZero = false,
    allowNegative = false,
    maxMinor = MAX_AMOUNT_MINOR,
  } = options;

  const str = String(rawInput).trim();
  if (!str) {
    return { ok: false, error: 'Amount is required' };
  }

  // Strip currency symbol if present and remove grouping commas/spaces
  const cleaned = str.replace(/^[₹$€£]\s*/, '').replace(/,/g, '').trim();

  if (!cleaned) {
    return { ok: false, error: 'Enter a valid amount' };
  }

  let isNegative = false;
  let unsigned = cleaned;
  if (unsigned.startsWith('-')) {
    if (!allowNegative) {
      return { ok: false, error: 'Amount must be greater than 0' };
    }
    isNegative = true;
    unsigned = unsigned.slice(1).trim();
  } else if (unsigned.startsWith('+')) {
    unsigned = unsigned.slice(1).trim();
  }

  // Check decimal parts
  const parts = unsigned.split('.');
  if (parts.length > 2) {
    return { ok: false, error: 'Enter a valid amount with at most one decimal point' };
  }

  const [wholePartRaw, fracPartRaw = ''] = parts;
  const wholePart = wholePartRaw === '' && fracPartRaw !== '' ? '0' : wholePartRaw;

  if (!/^\d+$/.test(wholePart)) {
    return { ok: false, error: 'Enter a valid numeric amount' };
  }

  if (fracPartRaw !== '' && !/^\d+$/.test(fracPartRaw)) {
    return { ok: false, error: 'Enter a valid numeric amount' };
  }

  if (fracPartRaw.length > 2) {
    return { ok: false, error: 'Amount can have at most 2 decimal places' };
  }

  const fracPadded = fracPartRaw.padEnd(2, '0');

  let minorBig: bigint;
  try {
    minorBig = BigInt(wholePart) * 100n + BigInt(fracPadded);
  } catch {
    return { ok: false, error: 'Amount is too large' };
  }

  if (minorBig === 0n) {
    if (!allowZero) {
      return { ok: false, error: 'Amount must be greater than 0' };
    }
    return { ok: true, minor: 0 };
  }

  if (minorBig > BigInt(maxMinor)) {
    return { ok: false, error: 'Amount cannot exceed ₹10,00,00,000 (₹10 crore)' };
  }

  const finalMinor = Number(minorBig) * (isNegative ? -1 : 1);
  // Normalize -0 to 0
  return { ok: true, minor: finalMinor === 0 ? 0 : finalMinor };
}

export interface FormatMoneyOptions {
  currency?: string;
  alwaysShowDecimals?: boolean;
  showPlusSign?: boolean;
}

const CURRENCY_LOCALE_MAP: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
};

/**
 * Formats integer minor units (paise) into a localized currency string.
 * Uses en-IN for INR (e.g. ₹1,25,000 or ₹1,25,000.50).
 * Negatives show a leading minus sign (e.g. -₹1,250). Never outputs "-0".
 */
export function formatMoney(
  minorInput: number,
  options: FormatMoneyOptions = {}
): string {
  const {
    currency = 'INR',
    alwaysShowDecimals = false,
    showPlusSign = false,
  } = options;

  const roundedMinor = Math.round(Number.isFinite(minorInput) ? minorInput : 0);
  // Prevent -0
  const normalizedMinor = Object.is(roundedMinor, -0) || roundedMinor === 0 ? 0 : roundedMinor;

  const isNegative = normalizedMinor < 0;
  const absMinor = Math.abs(normalizedMinor);
  const hasPaise = absMinor % 100 !== 0;

  // Convert to major units for Intl.NumberFormat
  const majorValue = absMinor / 100;
  const locale = CURRENCY_LOCALE_MAP[currency] ?? 'en-IN';

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: alwaysShowDecimals || hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  });

  const formattedAbs = formatter.format(majorValue);

  if (isNegative) {
    return `-${formattedAbs}`;
  }
  if (showPlusSign && normalizedMinor > 0) {
    return `+${formattedAbs}`;
  }
  return formattedAbs;
}

/**
 * Converts integer minor units to a plain decimal string without grouping commas
 * using exact integer division and remainder (for CSV exports and input defaults).
 * Examples:
 *  12500050 -> "125000.50"
 *  12500000 -> "125000.00" (when fixedDecimals = true) or "125000" (when fixedDecimals = false)
 */
export function minorToDecimalString(minorInput: number, fixedDecimals = true): string {
  const rounded = Math.round(Number.isFinite(minorInput) ? minorInput : 0);
  const normalized = Object.is(rounded, -0) || rounded === 0 ? 0 : rounded;
  const sign = normalized < 0 ? '-' : '';
  const abs = BigInt(Math.abs(normalized));
  const whole = abs / 100n;
  const frac = abs % 100n;

  if (!fixedDecimals && frac === 0n) {
    return `${sign}${whole.toString()}`;
  }

  return `${sign}${whole.toString()}.${frac.toString().padStart(2, '0')}`;
}
