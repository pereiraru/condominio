/**
 * Allocate all transactions to their respective months.
 *
 * For each transaction without a TransactionMonth allocation:
 * - Payment transactions: allocate to the month of the transaction date
 * - Expense transactions: allocate to the month of the transaction date
 * - Fee transactions: allocate to the month of the transaction date
 * - Transfer transactions: allocate to the month of the transaction date
 *
 * This enables the annual report and overview to show correct monthly data.
 *
 * Usage: npx tsx scripts/allocate-transactions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get all transactions that don't have any month allocations
  const transactions = await prisma.transaction.findMany({
    where: {
      monthAllocations: {
        none: {},
      },
    },
    orderBy: { date: 'asc' },
  });

  console.log(`Found ${transactions.length} transactions without month allocations`);

  let created = 0;
  let skipped = 0;

  for (const tx of transactions) {
    // Derive month from transaction date
    const date = new Date(tx.date);
    const month = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

    // Skip transactions with no unit and no creditor (shouldn't happen, but safety check)
    if (!tx.unitId && !tx.creditorId && tx.type !== 'fee' && tx.type !== 'transfer') {
      console.log(`  Skipping ${tx.id}: no unit or creditor assigned (${tx.description})`);
      skipped++;
      continue;
    }

    await prisma.transactionMonth.create({
      data: {
        transactionId: tx.id,
        month,
        amount: tx.amount,
      },
    });

    created++;
  }

  console.log(`\nDone!`);
  console.log(`  Created: ${created} month allocations`);
  console.log(`  Skipped: ${skipped}`);

  // Verify
  const totalAllocations = await prisma.transactionMonth.count();
  console.log(`  Total allocations in DB: ${totalAllocations}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
