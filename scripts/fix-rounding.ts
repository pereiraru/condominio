import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fixing final allocation rounding errors...');

  // Errors from audit:
  // Transaction cml8a37u... (2E, 2024-08-16, 52.50 EUR): allocation sum = 45.00 EUR, diff = 7.50 EUR
  // Transaction cmlcjl3a... (2D, 2024-10-22, 52.50 EUR): allocation sum = 45.00 EUR, diff = 7.50 EUR

  const txs = await prisma.transaction.findMany({
    where: { amount: 52.50, description: { contains: 'CESAR' } },
    include: { monthAllocations: true }
  });

  for (const tx of txs) {
    const sum = tx.monthAllocations.reduce((s, a) => s + a.amount, 0);
    if (Math.abs(tx.amount - sum) > 0.01) {
      console.log(`\nFixing tx ${tx.id} (${tx.amount}€) for unit ${tx.unitId}`);
      // Find the existing allocation and add the missing 7.50
      const lastAlloc = tx.monthAllocations[tx.monthAllocations.length - 1];
      if (lastAlloc) {
        await prisma.transactionMonth.update({
          where: { id: lastAlloc.id },
          data: { amount: lastAlloc.amount + 7.50 }
        });
        console.log(`  Added 7.50€ to allocation for month ${lastAlloc.month}`);
      }
    }
  }

  console.log('\nRounding fixes complete!');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
