import { getCategoryLabel } from './categories';
import { minorToDecimalString } from './money';
import type { TransactionRecord } from './types';

export const UTF8_BOM = '\uFEFF';
export const CSV_HEADERS = [
  'Date',
  'Type',
  'Category',
  'Description',
  'Amount',
  'Notes',
] as const;

/**
 * Rule 11:
 * Prefix any cell starting with =, +, - or @ with an apostrophe to prevent formula injection,
 * and apply RFC-4180 quoting.
 */
export function escapeCsvCell(rawValue: string | number | null | undefined): string {
  if (rawValue === null || rawValue === undefined) {
    return '';
  }

  let value = String(rawValue);

  // Prefix formula-triggering characters with a single quote
  if (/^[=+\-@]/.test(value)) {
    value = `'${value}`;
  }

  // RFC-4180 quoting if cell contains comma, double quote, CR, or LF
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

/**
 * Generates a UTF-8 with BOM CSV string for a list of transactions.
 * Columns: Date (YYYY-MM-DD), Type, Category, Description, Amount (plain decimal), Notes.
 */
export function transactionsToCsv(
  transactions: ReadonlyArray<
    Pick<
      TransactionRecord,
      'txn_date' | 'type' | 'category' | 'description' | 'amount_minor' | 'notes'
    >
  >
): string {
  const rows: string[] = [CSV_HEADERS.join(',')];

  for (const txn of transactions) {
    const cells = [
      escapeCsvCell(txn.txn_date),
      escapeCsvCell(txn.type),
      escapeCsvCell(getCategoryLabel(txn.category)),
      escapeCsvCell(txn.description),
      escapeCsvCell(minorToDecimalString(txn.amount_minor, true)),
      escapeCsvCell(txn.notes ?? ''),
    ];
    rows.push(cells.join(','));
  }

  return `${UTF8_BOM}${rows.join('\r\n')}`;
}
