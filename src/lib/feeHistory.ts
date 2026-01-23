export interface FeeHistoryRecord {
  amount: number;
  effectiveFrom: string; // "YYYY-MM"
}

/**
 * Given FeeHistory records and a month "YYYY-MM",
 * returns the applicable fee amount for that month.
 * Uses the most recent record with effectiveFrom <= month.
 * Falls back to defaultFee if no history record covers that month.
 */
export function getFeeForMonth(
  history: FeeHistoryRecord[],
  month: string,
  defaultFee: number
): number {
  // Sort ascending by effectiveFrom
  const sorted = [...history].sort((a, b) =>
    a.effectiveFrom.localeCompare(b.effectiveFrom)
  );

  let applicable = defaultFee;
  for (const record of sorted) {
    if (record.effectiveFrom <= month) {
      applicable = record.amount;
    } else {
      break;
    }
  }
  return applicable;
}
