import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Removing all data prior to 2024...');

  const cutoffDate = new Date('2024-01-01');
  const cutoffMonth = '2024-01';

  // 1. Transactions
  const deletedTxs = await prisma.transaction.deleteMany({
    where: { date: { lt: cutoffDate } }
  });
  console.log(`  Deleted ${deletedTxs.count} transactions prior to 2024.`);

  // 2. TransactionMonths (allocations)
  const deletedAllocs = await prisma.transactionMonth.deleteMany({
    where: { 
      AND: [
        { month: { lt: cutoffMonth } },
        { month: { not: 'PREV-DEBT' } }
      ]
    }
  });
  console.log(`  Deleted ${deletedAllocs.count} month allocations prior to 2024.`);

  // 3. FeeHistory
  const deletedFees = await prisma.feeHistory.deleteMany({
    where: { 
      AND: [
        { effectiveTo: { lt: cutoffMonth } },
        { effectiveTo: { not: null } }
      ]
    }
  });
  console.log(`  Deleted ${deletedFees.count} fee history records ending before 2024.`);

  const updatedFees = await prisma.feeHistory.updateMany({
    where: { effectiveFrom: { lt: cutoffMonth } },
    data: { effectiveFrom: cutoffMonth }
  });
  console.log(`  Adjusted ${updatedFees.count} fee history records to start at 2024-01.`);

  // 4. ExtraCharge
  const deletedExtras = await prisma.extraCharge.deleteMany({
    where: { 
      AND: [
        { effectiveTo: { lt: cutoffMonth } },
        { effectiveTo: { not: null } }
      ]
    }
  });
  console.log(`  Deleted ${deletedExtras.count} extra charges ending before 2024.`);

  const updatedExtras = await prisma.extraCharge.updateMany({
    where: { effectiveFrom: { lt: cutoffMonth } },
    data: { effectiveFrom: cutoffMonth }
  });
  console.log(`  Adjusted ${updatedExtras.count} extra charges to start at 2024-01.`);

  // 5. Owners
  // Delete owners who were only there before 2024
  const deletedOwners = await prisma.owner.deleteMany({
    where: { 
      AND: [
        { endMonth: { lt: cutoffMonth } },
        { endMonth: { not: null } }
      ]
    }
  });
  console.log(`  Deleted ${deletedOwners.count} owners who left before 2024.`);

  // Reset startMonth for remaining owners and clear previous debt
  const updatedOwners = await prisma.owner.updateMany({
    where: { 
      OR: [
        { startMonth: { lt: cutoffMonth } },
        { startMonth: null }
      ]
    },
    data: { startMonth: cutoffMonth, previousDebt: 0 }
  });
  console.log(`  Set startMonth to 2024-01 and reset previousDebt for ${updatedOwners.count} owners.`);

  // 6. Units previousBalance
  const updatedUnits = await prisma.unit.updateMany({
    data: { previousBalance: 0 }
  });
  console.log(`  Reset previousBalance for ${updatedUnits.count} units.`);

  console.log('\nData prior to 2024 has been removed.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
