import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking for orphaned allocations...');
  
  const allAllocations = await prisma.transactionMonth.findMany({
    select: { id: true, transactionId: true }
  });
  
  const transactions = await prisma.transaction.findMany({
    select: { id: true }
  });
  
  const txIds = new Set(transactions.map(t => t.id));
  const orphans = allAllocations.filter(a => !txIds.has(a.transactionId));
  
  if (orphans.length > 0) {
    console.log(`Found ${orphans.length} orphaned allocations. Deleting...`);
    for (const orphan of orphans) {
      await prisma.transactionMonth.delete({ where: { id: orphan.id } });
      console.log(`  Deleted orphan ${orphan.id} (referenced tx: ${orphan.transactionId})`);
    }
  } else {
    console.log('No orphans found.');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
