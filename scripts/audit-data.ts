import { PrismaClient } from '@prisma/client';

// Re-implement fee history functions locally to avoid path alias issues with tsx
// (These mirror src/lib/feeHistory.ts exactly)

interface FeeHistoryRecord {
  amount: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

interface ExtraChargeRecord {
  id?: string;
  description: string;
  amount: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  unitId?: string | null;
}

function isMonthInRange(
  month: string,
  effectiveFrom: string,
  effectiveTo?: string | null
): boolean {
  if (month < effectiveFrom) return false;
  if (effectiveTo && month > effectiveTo) return false;
  return true;
}

function getFeeForMonth(
  history: FeeHistoryRecord[],
  month: string,
  defaultFee: number
): number {
  const applicable = history.filter((record) =>
    isMonthInRange(month, record.effectiveFrom, record.effectiveTo)
  );
  if (applicable.length === 0) return defaultFee;
  const sorted = applicable.sort((a, b) =>
    b.effectiveFrom.localeCompare(a.effectiveFrom)
  );
  return sorted[0].amount;
}

function getExtraChargesForMonth(
  extraCharges: ExtraChargeRecord[],
  month: string,
  unitId?: string
): ExtraChargeRecord[] {
  return extraCharges.filter((charge) => {
    if (!isMonthInRange(month, charge.effectiveFrom, charge.effectiveTo))
      return false;
    if (charge.unitId === null || charge.unitId === undefined) return true;
    return charge.unitId === unitId;
  });
}

function getTotalFeeForMonth(
  feeHistory: FeeHistoryRecord[],
  extraCharges: ExtraChargeRecord[],
  month: string,
  defaultFee: number,
  unitId?: string
): { baseFee: number; extras: ExtraChargeRecord[]; total: number } {
  const baseFee = getFeeForMonth(feeHistory, month, defaultFee);
  const extras = getExtraChargesForMonth(extraCharges, month, unitId);
  const extrasTotal = extras.reduce((sum, e) => sum + e.amount, 0);
  return { baseFee, extras, total: baseFee + extrasTotal };
}

function countMonthsInRange(
  effectiveFrom: string,
  effectiveTo: string | null | undefined
): number {
  const [fromYear, fromMonth] = effectiveFrom.split('-').map(Number);
  let toYear: number, toMonth: number;
  if (effectiveTo) {
    [toYear, toMonth] = effectiveTo.split('-').map(Number);
  } else {
    const now = new Date();
    toYear = now.getFullYear();
    toMonth = now.getMonth() + 1;
  }
  return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
}

function isMonthInOwnerPeriod(
  month: string,
  startMonth: string | null,
  endMonth: string | null
): boolean {
  if (startMonth && month < startMonth) return false;
  if (endMonth && month > endMonth) return false;
  return true;
}

// ─── Console color helpers ───────────────────────────────────────────────────

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function error(msg: string) {
  console.log(`  ${RED}[ERROR]${RESET} ${msg}`);
}
function warn(msg: string) {
  console.log(`  ${YELLOW}[WARN]${RESET}  ${msg}`);
}
function ok(msg: string) {
  console.log(`  ${GREEN}[OK]${RESET}    ${msg}`);
}
function info(msg: string) {
  console.log(`  ${DIM}[INFO]${RESET}  ${msg}`);
}
function header(msg: string) {
  console.log(`\n${BOLD}${CYAN}${'='.repeat(80)}${RESET}`);
  console.log(`${BOLD}${CYAN}  ${msg}${RESET}`);
  console.log(`${BOLD}${CYAN}${'='.repeat(80)}${RESET}`);
}
function subheader(msg: string) {
  console.log(`\n${BOLD}--- ${msg} ---${RESET}`);
}

// ─── Summary counters ────────────────────────────────────────────────────────

let totalErrors = 0;
let totalWarnings = 0;
let totalOk = 0;

function countError(msg: string) {
  totalErrors++;
  error(msg);
}
function countWarn(msg: string) {
  totalWarnings++;
  warn(msg);
}
function countOk(msg: string) {
  totalOk++;
  ok(msg);
}

// ─── Main audit ──────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

async function audit() {
  console.log(`${BOLD}${CYAN}`);
  console.log(`  =============================================`);
  console.log(`    CONDOMINIUM DATA INTEGRITY AUDIT`);
  console.log(`    ${new Date().toISOString()}`);
  console.log(`  =============================================`);
  console.log(`${RESET}`);

  // ── Load all data upfront ──────────────────────────────────────────────────

  const units = await prisma.unit.findMany({
    include: {
      owners: { orderBy: { startMonth: 'asc' } },
      feeHistory: { orderBy: { effectiveFrom: 'asc' } },
      transactions: { select: { id: true } },
      user: { select: { id: true } },
    },
    orderBy: { code: 'asc' },
  });

  const allTransactions = await prisma.transaction.findMany({
    include: {
      monthAllocations: true,
      unit: { select: { id: true, code: true } },
    },
  });

  const allExtraCharges = await prisma.extraCharge.findMany();

  const allFeeHistory = await prisma.feeHistory.findMany({
    include: {
      unit: { select: { code: true } },
      creditor: { select: { name: true } },
    },
    orderBy: [{ unitId: 'asc' }, { effectiveFrom: 'asc' }],
  });

  const allAllocations = await prisma.transactionMonth.findMany({
    include: {
      transaction: {
        select: { id: true, unitId: true, amount: true, type: true },
      },
    },
  });

  const allOwners = await prisma.owner.findMany({
    include: { unit: { select: { code: true } } },
    orderBy: [{ unitId: 'asc' }, { startMonth: 'asc' }],
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // 1. TRANSACTION ALLOCATION INTEGRITY
  // ═════════════════════════════════════════════════════════════════════════════

  header('1. TRANSACTION ALLOCATION INTEGRITY');
  info('Checking that sum of TransactionMonth.amount == Transaction.amount');

  let allocMismatchCount = 0;
  let allocMatchCount = 0;
  let txWithNoAllocCount = 0;

  // Only check payment transactions (type = "payment") since expenses may not have allocations
  const paymentTransactions = allTransactions.filter((t) => t.type === 'payment');

  for (const tx of paymentTransactions) {
    const allocSum = tx.monthAllocations.reduce((sum, a) => sum + a.amount, 0);
    const diff = Math.abs(tx.amount - allocSum);

    if (tx.monthAllocations.length === 0) {
      txWithNoAllocCount++;
      // Reported in orphan section
    } else if (diff > 0.01) {
      allocMismatchCount++;
      const unitCode = tx.unit?.code || 'N/A';
      countError(
        `Transaction ${tx.id.slice(0, 8)}... (${unitCode}, ${tx.date.toISOString().slice(0, 10)}, ` +
        `${tx.amount.toFixed(2)} EUR): allocation sum = ${allocSum.toFixed(2)} EUR, diff = ${diff.toFixed(2)} EUR`
      );
    } else {
      allocMatchCount++;
    }
  }

  if (allocMismatchCount === 0) {
    countOk(`All ${allocMatchCount} payment transactions with allocations have matching sums`);
  } else {
    info(`${allocMismatchCount} mismatches found out of ${paymentTransactions.length} payment transactions`);
  }

  // Also check expense transactions
  // Note: expenses have negative tx.amount but allocations may store the absolute value
  const expenseTransactions = allTransactions.filter(
    (t) => t.type === 'expense' && t.monthAllocations.length > 0
  );
  let expMismatchCount = 0;
  for (const tx of expenseTransactions) {
    const allocSum = tx.monthAllocations.reduce((sum, a) => sum + a.amount, 0);
    // Compare absolute values since expenses are negative but allocations can be positive
    const diff = Math.abs(Math.abs(tx.amount) - Math.abs(allocSum));
    if (diff > 0.01) {
      expMismatchCount++;
      countWarn(
        `Expense ${tx.id.slice(0, 8)}... (${tx.description.slice(0, 40)}, ${tx.amount.toFixed(2)} EUR): ` +
        `allocation sum = ${allocSum.toFixed(2)} EUR, diff = ${diff.toFixed(2)} EUR`
      );
    }
  }
  if (expMismatchCount === 0 && expenseTransactions.length > 0) {
    countOk(`All ${expenseTransactions.length} expense transactions with allocations have matching sums`);
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 2. EXPECTED VS PAID PER UNIT PER MONTH
  // ═════════════════════════════════════════════════════════════════════════════

  header('2. EXPECTED VS PAID PER UNIT PER MONTH');
  info('Comparing expected monthly fee with actual payments via TransactionMonth allocations');

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  for (const unit of units) {
    subheader(`Unit ${unit.code}`);

    const unitExtraCharges = allExtraCharges.filter(
      (e) => e.unitId === null || e.unitId === unit.id
    ) as ExtraChargeRecord[];

    // Get allocations for this unit (payments only, positive amounts)
    const unitAllocations = allAllocations.filter(
      (a) =>
        a.transaction.unitId === unit.id &&
        a.transaction.amount > 0 &&
        a.month !== 'PREV-DEBT'
    );

    // Get all months from allocations + fee history
    const months = new Set<string>();
    unitAllocations.forEach((a) => months.add(a.month));

    // Also add months covered by fee history
    for (const fh of unit.feeHistory) {
      const [fromYear, fromMonth] = fh.effectiveFrom.split('-').map(Number);
      const [toYear, toMonth] = fh.effectiveTo
        ? fh.effectiveTo.split('-').map(Number)
        : [currentYear, currentMonth];

      let y = fromYear;
      let m = fromMonth;
      while (y < toYear || (y === toYear && m <= toMonth)) {
        // Don't check future months
        if (y < currentYear || (y === currentYear && m <= currentMonth)) {
          months.add(`${y}-${m.toString().padStart(2, '0')}`);
        }
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }
    }

    const sortedMonths = Array.from(months).sort();
    let unitDiscrepancies = 0;

    for (const month of sortedMonths) {
      const feeData = getTotalFeeForMonth(
        unit.feeHistory as FeeHistoryRecord[],
        unitExtraCharges,
        month,
        unit.monthlyFee,
        unit.id
      );

      const paid = unitAllocations
        .filter((a) => a.month === month)
        .reduce((sum, a) => sum + a.amount, 0);

      const diff = paid - feeData.total;

      if (Math.abs(diff) > 0.01) {
        unitDiscrepancies++;
        if (diff < 0) {
          countWarn(
            `${month}: expected ${feeData.total.toFixed(2)} EUR, paid ${paid.toFixed(2)} EUR ` +
            `(underpaid by ${Math.abs(diff).toFixed(2)} EUR)`
          );
        } else {
          countWarn(
            `${month}: expected ${feeData.total.toFixed(2)} EUR, paid ${paid.toFixed(2)} EUR ` +
            `(overpaid by ${diff.toFixed(2)} EUR)`
          );
        }
      }
    }

    if (unitDiscrepancies === 0 && sortedMonths.length > 0) {
      countOk(`All ${sortedMonths.length} months match expected fees`);
    } else if (sortedMonths.length === 0) {
      countWarn(`No month allocations or fee history found`);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 3. FEE HISTORY CONSISTENCY
  // ═════════════════════════════════════════════════════════════════════════════

  header('3. FEE HISTORY CONSISTENCY');
  info('Checking for overlapping date ranges and gaps in fee history');

  // Group fee history by unitId+creditorId
  const feeHistoryGroups = new Map<string, typeof allFeeHistory>();
  for (const fh of allFeeHistory) {
    const key = `unit:${fh.unitId || 'null'}|creditor:${fh.creditorId || 'null'}`;
    if (!feeHistoryGroups.has(key)) feeHistoryGroups.set(key, []);
    feeHistoryGroups.get(key)!.push(fh);
  }

  for (const [key, records] of feeHistoryGroups) {
    const label =
      records[0].unit?.code
        ? `Unit ${records[0].unit.code}`
        : records[0].creditor?.name
          ? `Creditor ${records[0].creditor.name}`
          : key;

    // Sort by effectiveFrom
    const sorted = [...records].sort((a, b) =>
      a.effectiveFrom.localeCompare(b.effectiveFrom)
    );

    // Check for overlaps
    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];

      if (!curr.effectiveTo) {
        // Ongoing record overlaps with next
        countError(
          `${label}: fee record ${curr.effectiveFrom} (ongoing, ${curr.amount} EUR) ` +
          `overlaps with ${next.effectiveFrom} (${next.amount} EUR)`
        );
      } else if (curr.effectiveTo >= next.effectiveFrom) {
        countError(
          `${label}: fee record ${curr.effectiveFrom}-${curr.effectiveTo} (${curr.amount} EUR) ` +
          `overlaps with ${next.effectiveFrom} (${next.amount} EUR)`
        );
      }
    }

    // Check for gaps (month after effectiveTo should be next effectiveFrom)
    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];

      if (curr.effectiveTo) {
        const [y, m] = curr.effectiveTo.split('-').map(Number);
        let nextExpectedMonth: string;
        if (m === 12) {
          nextExpectedMonth = `${y + 1}-01`;
        } else {
          nextExpectedMonth = `${y}-${(m + 1).toString().padStart(2, '0')}`;
        }

        if (next.effectiveFrom > nextExpectedMonth) {
          countWarn(
            `${label}: gap in fee history between ${curr.effectiveTo} and ${next.effectiveFrom} ` +
            `(default fee will apply during gap)`
          );
        }
      }
    }

    if (sorted.length === 1) {
      info(`${label}: single record from ${sorted[0].effectiveFrom} (${sorted[0].amount} EUR)`);
    }
  }

  if (feeHistoryGroups.size === 0) {
    countWarn('No fee history records found at all');
  } else {
    let noIssuesInFeeHistory = true;
    // Check done inline above, just summarize
    for (const [, records] of feeHistoryGroups) {
      const sorted = [...records].sort((a, b) =>
        a.effectiveFrom.localeCompare(b.effectiveFrom)
      );
      let hasOverlap = false;
      for (let i = 0; i < sorted.length - 1; i++) {
        if (!sorted[i].effectiveTo || sorted[i].effectiveTo! >= sorted[i + 1].effectiveFrom) {
          hasOverlap = true;
        }
      }
      if (hasOverlap) noIssuesInFeeHistory = false;
    }
    if (noIssuesInFeeHistory) {
      countOk(`All ${allFeeHistory.length} fee history records have no overlaps`);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 4. EXTRA CHARGE CONSISTENCY
  // ═════════════════════════════════════════════════════════════════════════════

  header('4. EXTRA CHARGE CONSISTENCY');
  info('Checking date range validity and overlapping charges');

  for (const ec of allExtraCharges) {
    const unitLabel = ec.unitId
      ? `Unit ${units.find((u) => u.id === ec.unitId)?.code || ec.unitId}`
      : 'Global';

    // Check date range validity
    if (ec.effectiveTo && ec.effectiveFrom > ec.effectiveTo) {
      countError(
        `${unitLabel} - "${ec.description}": effectiveFrom (${ec.effectiveFrom}) > effectiveTo (${ec.effectiveTo})`
      );
    } else {
      // Valid range
    }

    // Check amount is positive
    if (ec.amount <= 0) {
      countWarn(`${unitLabel} - "${ec.description}": amount is ${ec.amount} EUR (non-positive)`);
    }
  }

  // Check for overlapping charges with same description
  const chargesByDesc = new Map<string, typeof allExtraCharges>();
  for (const ec of allExtraCharges) {
    const key = `${ec.description}|${ec.unitId || 'global'}`;
    if (!chargesByDesc.has(key)) chargesByDesc.set(key, []);
    chargesByDesc.get(key)!.push(ec);
  }

  for (const [key, charges] of chargesByDesc) {
    if (charges.length > 1) {
      // Check for overlaps
      const sorted = [...charges].sort((a, b) =>
        a.effectiveFrom.localeCompare(b.effectiveFrom)
      );
      for (let i = 0; i < sorted.length - 1; i++) {
        const curr = sorted[i];
        const next = sorted[i + 1];
        if (!curr.effectiveTo || curr.effectiveTo >= next.effectiveFrom) {
          countWarn(
            `Overlapping extra charges for "${curr.description}" ` +
            `(${curr.effectiveFrom}-${curr.effectiveTo || 'ongoing'} and ` +
            `${next.effectiveFrom}-${next.effectiveTo || 'ongoing'})`
          );
        }
      }
    }
  }

  if (allExtraCharges.length === 0) {
    info('No extra charges defined');
  } else {
    const invalidRanges = allExtraCharges.filter(
      (ec) => ec.effectiveTo && ec.effectiveFrom > ec.effectiveTo
    );
    if (invalidRanges.length === 0) {
      countOk(`All ${allExtraCharges.length} extra charges have valid date ranges`);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 5. ORPHANED DATA
  // ═════════════════════════════════════════════════════════════════════════════

  header('5. ORPHANED DATA');

  // 5a. Payment transactions with no month allocations
  subheader('5a. Payment transactions with no month allocations');
  const paymentsNoAlloc = paymentTransactions.filter(
    (t) => t.monthAllocations.length === 0
  );
  if (paymentsNoAlloc.length === 0) {
    countOk('All payment transactions have month allocations');
  } else {
    for (const tx of paymentsNoAlloc) {
      const unitCode = tx.unit?.code || 'N/A';
      countWarn(
        `Payment ${tx.id.slice(0, 8)}... (${unitCode}, ${tx.date.toISOString().slice(0, 10)}, ` +
        `${tx.amount.toFixed(2)} EUR, "${tx.description.slice(0, 50)}") has NO month allocations`
      );
    }
  }

  // 5b. Transactions with no unit assignment
  subheader('5b. Transactions with no unit assignment');
  const txNoUnit = allTransactions.filter(
    (t) => !t.unitId && t.type === 'payment'
  );
  if (txNoUnit.length === 0) {
    countOk('All payment transactions are assigned to a unit');
  } else {
    for (const tx of txNoUnit) {
      countWarn(
        `Payment ${tx.id.slice(0, 8)}... (${tx.date.toISOString().slice(0, 10)}, ` +
        `${tx.amount.toFixed(2)} EUR, "${tx.description.slice(0, 50)}") has NO unit`
      );
    }
  }

  // 5c. Units with no owners
  subheader('5c. Units with no owners');
  const unitsNoOwners = units.filter((u) => u.owners.length === 0);
  if (unitsNoOwners.length === 0) {
    countOk('All units have at least one owner');
  } else {
    for (const u of unitsNoOwners) {
      countWarn(`Unit ${u.code} has NO owners`);
    }
  }

  // 5d. Units with no current owner (all owners have endMonth set)
  subheader('5d. Units with no current owner');
  const unitsNoCurrentOwner = units.filter(
    (u) => u.owners.length > 0 && !u.owners.some((o) => o.endMonth === null)
  );
  if (unitsNoCurrentOwner.length === 0) {
    countOk('All units with owners have a current owner (endMonth=null)');
  } else {
    for (const u of unitsNoCurrentOwner) {
      countWarn(`Unit ${u.code} has owners but none with endMonth=null (no current owner)`);
    }
  }

  // 5e. Allocations pointing to non-existent transactions
  subheader('5e. Allocations referencing non-existent transactions');
  const txIds = new Set(allTransactions.map((t) => t.id));
  const orphanAllocs = allAllocations.filter(
    (a) => !txIds.has(a.transactionId)
  );
  if (orphanAllocs.length === 0) {
    countOk('All allocations reference existing transactions');
  } else {
    countError(`${orphanAllocs.length} allocations reference non-existent transactions`);
  }

  // 5f. Allocations referencing non-existent extra charges
  subheader('5f. Allocations referencing non-existent extra charges');
  const ecIds = new Set(allExtraCharges.map((ec) => ec.id));
  const orphanEcAllocs = allAllocations.filter(
    (a) => a.extraChargeId && !ecIds.has(a.extraChargeId)
  );
  if (orphanEcAllocs.length === 0) {
    countOk('All allocations with extraChargeId reference existing extra charges');
  } else {
    countError(
      `${orphanEcAllocs.length} allocations reference non-existent extra charges`
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 6. OWNER PERIOD CONSISTENCY
  // ═════════════════════════════════════════════════════════════════════════════

  header('6. OWNER PERIOD CONSISTENCY');
  info('Checking for overlapping owner periods and missing current owners');

  for (const unit of units) {
    if (unit.owners.length <= 1) continue;

    const sorted = [...unit.owners].sort((a, b) => {
      const aStart = a.startMonth || '0000-00';
      const bStart = b.startMonth || '0000-00';
      return aStart.localeCompare(bStart);
    });

    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];

      const currEnd = curr.endMonth;
      const nextStart = next.startMonth || '0000-00';

      if (!currEnd) {
        // Current owner with no end -- but there's a next owner
        countError(
          `Unit ${unit.code}: owner "${curr.name}" has no endMonth but ` +
          `owner "${next.name}" starts at ${next.startMonth || 'beginning'}`
        );
      } else if (currEnd >= nextStart) {
        countError(
          `Unit ${unit.code}: owner "${curr.name}" (ends ${currEnd}) ` +
          `overlaps with owner "${next.name}" (starts ${nextStart})`
        );
      }
    }

    // Check multiple current owners
    const currentOwners = unit.owners.filter((o) => o.endMonth === null);
    if (currentOwners.length > 1) {
      countError(
        `Unit ${unit.code}: ${currentOwners.length} current owners (endMonth=null): ` +
        currentOwners.map((o) => `"${o.name}"`).join(', ')
      );
    }
  }

  // Count units checked
  const unitsWithMultipleOwners = units.filter((u) => u.owners.length > 1);
  if (unitsWithMultipleOwners.length > 0) {
    info(`Checked ${unitsWithMultipleOwners.length} units with multiple owners`);
  }
  const unitsWithSingleOwner = units.filter((u) => u.owners.length === 1);
  if (unitsWithSingleOwner.length > 0) {
    const allSingleHaveNullEnd = unitsWithSingleOwner.every((u) =>
      u.owners[0].endMonth === null
    );
    if (allSingleHaveNullEnd) {
      countOk(
        `${unitsWithSingleOwner.length} units with single owner all have endMonth=null`
      );
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 7. DEBT CALCULATION CROSS-CHECK
  // ═════════════════════════════════════════════════════════════════════════════

  header('7. DEBT CALCULATION CROSS-CHECK');
  info('Manually computing debt for each unit and comparing with debt endpoint logic');

  // Replicate the logic from /api/units/[id]/debt/route.ts
  for (const unit of units) {
    subheader(`Unit ${unit.code}`);

    const unitExtraCharges = allExtraCharges.filter(
      (e) => e.unitId === null || e.unitId === unit.id
    ) as ExtraChargeRecord[];

    // Get allocations for this unit
    const unitAllocations = allAllocations.filter(
      (a) => a.transaction.unitId === unit.id && a.transaction.amount > 0
    );

    const regularAllocations = unitAllocations.filter(
      (a) => a.month !== 'PREV-DEBT'
    );
    const prevDebtAllocations = unitAllocations.filter(
      (a) => a.month === 'PREV-DEBT'
    );

    // Calculate previous debt
    const previousDebt = unit.owners.reduce((sum, o) => sum + o.previousDebt, 0);
    const previousDebtPaid = prevDebtAllocations.reduce(
      (sum, a) => sum + a.amount,
      0
    );
    const previousDebtRemaining = Math.max(0, previousDebt - previousDebtPaid);

    // Get all years covered
    const years = new Set<number>();
    regularAllocations.forEach((a) => {
      const year = parseInt(a.month.split('-')[0]);
      if (year < currentYear) years.add(year);
    });
    for (const fh of unit.feeHistory) {
      const fhStartYear = parseInt(fh.effectiveFrom.split('-')[0]);
      const fhEndYear = fh.effectiveTo
        ? parseInt(fh.effectiveTo.split('-')[0])
        : currentYear - 1;
      for (let y = fhStartYear; y <= Math.min(fhEndYear, currentYear - 1); y++) {
        years.add(y);
      }
    }

    let pastYearsDebt = 0;
    const sortedYears = Array.from(years).sort((a, b) => a - b);

    const yearlyBreakdown: {
      year: number;
      expected: number;
      paid: number;
      yearDebt: number;
      cumulativeDebt: number;
    }[] = [];

    for (const year of sortedYears) {
      let expectedForYear = 0;
      for (let m = 1; m <= 12; m++) {
        const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
        const feeData = getTotalFeeForMonth(
          unit.feeHistory as FeeHistoryRecord[],
          unitExtraCharges,
          monthStr,
          unit.monthlyFee,
          unit.id
        );
        expectedForYear += feeData.total;
      }

      const paidForYear = regularAllocations
        .filter((a) => a.month.startsWith(`${year}-`))
        .reduce((sum, a) => sum + a.amount, 0);

      pastYearsDebt = Math.max(0, pastYearsDebt + expectedForYear - paidForYear);

      yearlyBreakdown.push({
        year,
        expected: expectedForYear,
        paid: paidForYear,
        yearDebt: expectedForYear - paidForYear,
        cumulativeDebt: pastYearsDebt,
      });
    }

    // Report outstanding extras
    const outstandingExtras: {
      description: string;
      totalExpected: number;
      totalPaid: number;
      remaining: number;
    }[] = [];

    for (const charge of unitExtraCharges.filter((e) => e.id)) {
      const totalExpected =
        charge.amount *
        countMonthsInRange(charge.effectiveFrom, charge.effectiveTo);

      const totalPaid = allAllocations
        .filter(
          (a) =>
            a.extraChargeId === charge.id &&
            a.transaction.unitId === unit.id
        )
        .reduce((sum, a) => sum + a.amount, 0);

      const remaining = Math.max(0, totalExpected - totalPaid);

      if (remaining > 0.01 || totalPaid > 0.01) {
        outstandingExtras.push({
          description: charge.description,
          totalExpected,
          totalPaid,
          remaining,
        });
      }
    }

    // Output breakdown for this unit
    if (yearlyBreakdown.length > 0) {
      for (const yb of yearlyBreakdown) {
        const status =
          yb.yearDebt > 0.01
            ? `${RED}debt ${yb.yearDebt.toFixed(2)}${RESET}`
            : yb.yearDebt < -0.01
              ? `${GREEN}surplus ${Math.abs(yb.yearDebt).toFixed(2)}${RESET}`
              : `${GREEN}balanced${RESET}`;
        info(
          `${yb.year}: expected ${yb.expected.toFixed(2)}, paid ${yb.paid.toFixed(2)} => ${status} (cumulative: ${yb.cumulativeDebt.toFixed(2)})`
        );
      }
    }

    // Summary
    const totalDebt = pastYearsDebt + previousDebtRemaining;
    if (totalDebt > 0.01) {
      countWarn(
        `Unit ${unit.code} total debt: ${totalDebt.toFixed(2)} EUR ` +
        `(pastYears: ${pastYearsDebt.toFixed(2)}, previousDebt: ${previousDebtRemaining.toFixed(2)})`
      );
    } else {
      countOk(`Unit ${unit.code} has no outstanding debt`);
    }

    if (outstandingExtras.length > 0) {
      for (const oe of outstandingExtras) {
        if (oe.remaining > 0.01) {
          info(
            `  Extra "${oe.description}": expected ${oe.totalExpected.toFixed(2)}, ` +
            `paid ${oe.totalPaid.toFixed(2)}, remaining ${oe.remaining.toFixed(2)} EUR`
          );
        }
      }
    }

    // Cross-check: compare with debt-summary approach (per-year max(0, expected-paid))
    let debtSummaryTotal = 0;
    for (const year of sortedYears) {
      let expectedForYear = 0;
      for (let m = 1; m <= 12; m++) {
        const monthStr = `${year}-${m.toString().padStart(2, '0')}`;
        const feeData = getTotalFeeForMonth(
          unit.feeHistory as FeeHistoryRecord[],
          unitExtraCharges,
          monthStr,
          unit.monthlyFee,
          unit.id
        );
        expectedForYear += feeData.total;
      }
      const paidForYear = regularAllocations
        .filter((a) => a.month.startsWith(`${year}-`))
        .reduce((sum, a) => sum + a.amount, 0);
      debtSummaryTotal += Math.max(0, expectedForYear - paidForYear);
    }

    // debt endpoint uses cumulative carry-forward, report differences
    if (Math.abs(debtSummaryTotal - pastYearsDebt) > 0.01) {
      info(
        `Note: debt-summary method (per-year cap) = ${debtSummaryTotal.toFixed(2)} EUR vs ` +
        `debt endpoint (cumulative carry-forward) = ${pastYearsDebt.toFixed(2)} EUR ` +
        `(difference due to surplus carry-forward logic)`
      );
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 8. ADDITIONAL CHECKS
  // ═════════════════════════════════════════════════════════════════════════════

  header('8. ADDITIONAL CHECKS');

  // 8a. Check for duplicate transactions (same date, amount, description, unit)
  subheader('8a. Potential duplicate transactions');
  const txSignatures = new Map<string, typeof allTransactions>();
  for (const tx of allTransactions) {
    const sig = `${tx.date.toISOString().slice(0, 10)}|${tx.amount}|${tx.unitId}|${tx.description}`;
    if (!txSignatures.has(sig)) txSignatures.set(sig, []);
    txSignatures.get(sig)!.push(tx);
  }
  let dupeCount = 0;
  for (const [sig, txs] of txSignatures) {
    if (txs.length > 1) {
      dupeCount++;
      const parts = sig.split('|');
      countWarn(
        `${txs.length} transactions with same date=${parts[0]}, amount=${parts[1]}, ` +
        `unit=${units.find((u) => u.id === parts[2])?.code || parts[2]}, ` +
        `desc="${parts[3]?.slice(0, 40)}"`
      );
    }
  }
  if (dupeCount === 0) {
    countOk('No potential duplicate transactions found');
  }

  // 8b. Transactions with future dates
  subheader('8b. Transactions with future dates');
  const now = new Date();
  const futureTx = allTransactions.filter((t) => t.date > now);
  if (futureTx.length === 0) {
    countOk('No transactions with future dates');
  } else {
    for (const tx of futureTx) {
      countWarn(
        `Transaction ${tx.id.slice(0, 8)}... has future date ${tx.date.toISOString().slice(0, 10)}`
      );
    }
  }

  // 8c. TransactionMonth allocations with invalid month format
  subheader('8c. Invalid month formats in allocations');
  const validMonthRegex = /^\d{4}-\d{2}$/;
  const invalidMonthAllocs = allAllocations.filter(
    (a) => a.month !== 'PREV-DEBT' && !validMonthRegex.test(a.month)
  );
  if (invalidMonthAllocs.length === 0) {
    countOk('All allocation months have valid YYYY-MM format (or PREV-DEBT)');
  } else {
    for (const a of invalidMonthAllocs) {
      countError(`Allocation ${a.id.slice(0, 8)}... has invalid month format: "${a.month}"`);
    }
  }

  // 8d. Negative amount allocations for payment transactions
  subheader('8d. Negative allocations on positive transactions');
  const negAllocsOnPos = allAllocations.filter(
    (a) => a.amount < 0 && a.transaction.amount > 0
  );
  if (negAllocsOnPos.length === 0) {
    countOk('No negative allocations on positive (payment) transactions');
  } else {
    for (const a of negAllocsOnPos) {
      countWarn(
        `Allocation ${a.id.slice(0, 8)}... has negative amount ${a.amount.toFixed(2)} ` +
        `on positive transaction ${a.transactionId.slice(0, 8)}...`
      );
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═════════════════════════════════════════════════════════════════════════════

  console.log(`\n${BOLD}${CYAN}${'='.repeat(80)}${RESET}`);
  console.log(`${BOLD}${CYAN}  AUDIT SUMMARY${RESET}`);
  console.log(`${BOLD}${CYAN}${'='.repeat(80)}${RESET}\n`);

  console.log(`  Total units:        ${units.length}`);
  console.log(`  Total transactions: ${allTransactions.length}`);
  console.log(`  Total allocations:  ${allAllocations.length}`);
  console.log(`  Total owners:       ${allOwners.length}`);
  console.log(`  Total fee history:  ${allFeeHistory.length}`);
  console.log(`  Total extra charges:${allExtraCharges.length}`);
  console.log();
  console.log(`  ${GREEN}Checks passed:  ${totalOk}${RESET}`);
  console.log(`  ${YELLOW}Warnings:       ${totalWarnings}${RESET}`);
  console.log(`  ${RED}Errors:         ${totalErrors}${RESET}`);
  console.log();

  if (totalErrors > 0) {
    console.log(
      `  ${RED}${BOLD}DATA INTEGRITY ISSUES FOUND - review errors above${RESET}`
    );
  } else if (totalWarnings > 0) {
    console.log(
      `  ${YELLOW}${BOLD}Minor issues found - review warnings above${RESET}`
    );
  } else {
    console.log(
      `  ${GREEN}${BOLD}All checks passed - data looks clean!${RESET}`
    );
  }
  console.log();
}

audit()
  .catch((e) => {
    console.error(`${RED}Audit failed:${RESET}`, e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
