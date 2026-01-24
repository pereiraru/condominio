export interface OwnerPeriod {
  id: string;
  name: string;
  startMonth: string | null;
  endMonth: string | null;
}

/**
 * Check if a month falls within an owner's period.
 * startMonth null = from the beginning, endMonth null = current/ongoing.
 */
export function isMonthInOwnerPeriod(
  month: string,
  startMonth: string | null,
  endMonth: string | null
): boolean {
  if (startMonth && month < startMonth) return false;
  if (endMonth && month > endMonth) return false;
  return true;
}

/**
 * Find the owner for a given month from a list of owners.
 * Returns the owner whose period contains the month, or null.
 */
export function getOwnerForMonth(
  owners: OwnerPeriod[],
  month: string
): OwnerPeriod | null {
  return (
    owners.find((o) =>
      isMonthInOwnerPeriod(month, o.startMonth, o.endMonth)
    ) ?? null
  );
}

/**
 * Get the current owner (endMonth = null) from a list of owners.
 */
export function getCurrentOwner(owners: OwnerPeriod[]): OwnerPeriod | null {
  return owners.find((o) => o.endMonth === null) ?? null;
}
