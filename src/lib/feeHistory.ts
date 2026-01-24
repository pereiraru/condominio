export interface FeeHistoryRecord {
  amount: number;
  effectiveFrom: string; // "YYYY-MM"
  effectiveTo?: string | null; // "YYYY-MM", null means ongoing
}

export interface ExtraChargeRecord {
  id?: string;
  description: string;
  amount: number;
  effectiveFrom: string; // "YYYY-MM"
  effectiveTo?: string | null; // "YYYY-MM", null means ongoing
  unitId?: string | null; // null means global (applies to all units)
}

/**
 * Check if a month falls within a date range
 */
function isMonthInRange(
  month: string,
  effectiveFrom: string,
  effectiveTo?: string | null
): boolean {
  if (month < effectiveFrom) return false;
  if (effectiveTo && month > effectiveTo) return false;
  return true;
}

/**
 * Given FeeHistory records and a month "YYYY-MM",
 * returns the applicable fee amount for that month.
 * Uses records where effectiveFrom <= month <= effectiveTo (or ongoing).
 * Falls back to defaultFee if no history record covers that month.
 */
export function getFeeForMonth(
  history: FeeHistoryRecord[],
  month: string,
  defaultFee: number
): number {
  // Find records that cover this month
  const applicable = history.filter((record) =>
    isMonthInRange(month, record.effectiveFrom, record.effectiveTo)
  );

  if (applicable.length === 0) {
    return defaultFee;
  }

  // If multiple records, use the most recent one (by effectiveFrom)
  const sorted = applicable.sort((a, b) =>
    b.effectiveFrom.localeCompare(a.effectiveFrom)
  );

  return sorted[0].amount;
}

/**
 * Given ExtraCharge records, a month, and optionally a unitId,
 * returns all applicable extra charges for that month.
 * Includes global charges (unitId = null) and unit-specific charges.
 */
export function getExtraChargesForMonth(
  extraCharges: ExtraChargeRecord[],
  month: string,
  unitId?: string
): ExtraChargeRecord[] {
  return extraCharges.filter((charge) => {
    // Check if the month is in range
    if (!isMonthInRange(month, charge.effectiveFrom, charge.effectiveTo)) {
      return false;
    }
    // Include global charges (unitId = null) or unit-specific charges
    if (charge.unitId === null || charge.unitId === undefined) {
      return true; // Global charge
    }
    return charge.unitId === unitId; // Unit-specific charge
  });
}

/**
 * Calculate the total expected fee for a month (base fee + extra charges)
 */
export function getTotalFeeForMonth(
  feeHistory: FeeHistoryRecord[],
  extraCharges: ExtraChargeRecord[],
  month: string,
  defaultFee: number,
  unitId?: string
): { baseFee: number; extras: ExtraChargeRecord[]; total: number } {
  const baseFee = getFeeForMonth(feeHistory, month, defaultFee);
  const extras = getExtraChargesForMonth(extraCharges, month, unitId);
  const extrasTotal = extras.reduce((sum, e) => sum + e.amount, 0);

  return {
    baseFee,
    extras,
    total: baseFee + extrasTotal,
  };
}
