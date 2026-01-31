import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify2024() {
  console.log('=== Verifying 2024 data ===\n');

  // Get all units
  const units = await prisma.unit.findMany({
    orderBy: { code: 'asc' },
  });

  // Get all 2024 TransactionMonth records grouped by unit
  const allocations = await prisma.transactionMonth.findMany({
    where: {
      month: { startsWith: '2024-' },
      transaction: { type: 'payment' },
    },
    include: {
      transaction: {
        select: { unitId: true, description: true, amount: true },
      },
    },
  });

  // Build per-unit monthly totals from DB
  const dbTotals: Record<string, Record<string, number>> = {};
  for (const alloc of allocations) {
    const unitId = alloc.transaction.unitId;
    if (!unitId) continue;
    if (!dbTotals[unitId]) dbTotals[unitId] = {};
    if (!dbTotals[unitId][alloc.month]) dbTotals[unitId][alloc.month] = 0;
    dbTotals[unitId][alloc.month] += alloc.amount;
  }

  console.log('Unit totals for 2024 (from TransactionMonth allocations):\n');
  console.log('Unit\t\tJan\tFeb\tMar\tApr\tMay\tJun\tJul\tAug\tSep\tOct\tNov\tDec\tTotal');
  console.log('-'.repeat(140));

  for (const unit of units) {
    const months = dbTotals[unit.id] || {};
    let total = 0;
    const vals: string[] = [];
    for (let m = 1; m <= 12; m++) {
      const monthStr = `2024-${m.toString().padStart(2, '0')}`;
      const val = months[monthStr] || 0;
      total += val;
      vals.push(val > 0 ? val.toFixed(0) : '-');
    }
    const code = unit.code.padEnd(8);
    console.log(`${code}\t${vals.join('\t')}\t${total.toFixed(2)}`);
  }

  // Also show expense totals
  console.log('\n\nExpense totals for 2024:\n');

  const expenseAllocations = await prisma.transactionMonth.findMany({
    where: {
      month: { startsWith: '2024-' },
      transaction: { type: 'expense' },
    },
    include: {
      transaction: {
        select: { creditorId: true, description: true, amount: true },
      },
    },
  });

  const creditors = await prisma.creditor.findMany({ orderBy: { name: 'asc' } });
  const creditorMap: Record<string, string> = {};
  creditors.forEach((c) => { creditorMap[c.id] = c.name; });

  const expTotals: Record<string, Record<string, number>> = {};
  for (const alloc of expenseAllocations) {
    const creditorId = alloc.transaction.creditorId || 'unknown';
    if (!expTotals[creditorId]) expTotals[creditorId] = {};
    if (!expTotals[creditorId][alloc.month]) expTotals[creditorId][alloc.month] = 0;
    expTotals[creditorId][alloc.month] += alloc.amount;
  }

  for (const [creditorId, months] of Object.entries(expTotals)) {
    const name = creditorMap[creditorId] || creditorId;
    let total = 0;
    for (const val of Object.values(months)) total += val;
    console.log(`${name}: ${total.toFixed(2)} EUR`);
  }

  // Check for units with fee history but no 2024 allocations
  console.log('\n\nUnits with fee history but NO 2024 payment allocations:');
  for (const unit of units) {
    const has2024 = dbTotals[unit.id] && Object.keys(dbTotals[unit.id]).length > 0;
    if (!has2024) {
      const feeHistory = await prisma.feeHistory.findMany({
        where: { unitId: unit.id },
        orderBy: { effectiveFrom: 'asc' },
      });
      const fees = feeHistory.map((fh) => `${fh.amount}/mo from ${fh.effectiveFrom}`).join(', ');
      console.log(`  ${unit.code}: ${fees || 'no fee history'}`);
    }
  }

  // Count totals
  const totalPaymentAllocations = await prisma.transactionMonth.count({
    where: { month: { startsWith: '2024-' }, transaction: { type: 'payment' } },
  });
  const totalExpenseAllocations = await prisma.transactionMonth.count({
    where: { month: { startsWith: '2024-' }, transaction: { type: 'expense' } },
  });

  console.log(`\nTotal 2024 payment allocations: ${totalPaymentAllocations}`);
  console.log(`Total 2024 expense allocations: ${totalExpenseAllocations}`);

  // Check fee history records
  console.log('\n\nFee history summary:');
  const allFeeHistory = await prisma.feeHistory.findMany({
    include: { unit: { select: { code: true } } },
    orderBy: [{ unitId: 'asc' }, { effectiveFrom: 'asc' }],
  });

  for (const fh of allFeeHistory) {
    const unitCode = fh.unit?.code || 'N/A';
    console.log(`  ${unitCode}: ${fh.amount}/mo from ${fh.effectiveFrom}${fh.effectiveTo ? ` to ${fh.effectiveTo}` : ' (ongoing)'}`);
  }
}

verify2024()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
