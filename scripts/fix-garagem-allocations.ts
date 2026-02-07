import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fixing Garagem unit allocations to cover full years...');

  const unit = await prisma.unit.findUnique({
    where: { code: 'Garagem' },
    include: { transactions: true }
  });

  if (!unit) {
    console.error('Garagem unit not found');
    return;
  }

  for (const tx of unit.transactions) {
    if (tx.amount === 450) {
      const year = tx.date.getFullYear();
      console.log(`\nProcessing ${tx.amount}€ payment from ${tx.date.toISOString().slice(0,10)} (Year: ${year})`);
      
      // Clear existing allocations for this transaction
      await prisma.transactionMonth.deleteMany({
        where: { transactionId: tx.id }
      });

      // Create 12 allocations of 37.50 for that year
      for (let month = 1; month <= 12; month++) {
        const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
        await prisma.transactionMonth.create({
          data: {
            transactionId: tx.id,
            month: monthStr,
            amount: 37.50
          }
        });
      }
      console.log(`  Created 12 allocations of 37.50€ for ${year}-01 through ${year}-12`);
    }
  }

  console.log('\nGaragem reallocation complete!');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());