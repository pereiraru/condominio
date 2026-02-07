import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixGaragem() {
  console.log('Fixing Garagem allocations...');
  const unit = await prisma.unit.findFirst({ where: { code: { contains: 'Garagem' } } });
  if (!unit) return console.log('Garagem not found');

  // Find the transactions for G1
  const txs = await prisma.transaction.findMany({
    where: { unitId: unit.id },
    include: { monthAllocations: true }
  });

  for (const tx of txs) {
    console.log(`Processing G1 Tx: ${tx.description} (${tx.amount}€)`);
    // Delete old allocations
    await prisma.transactionMonth.deleteMany({ where: { transactionId: tx.id } });

    // Re-allocate based on fee schedule:
    // 2024-01 to 2024-05: 37.50
    // 2024-06 onwards: 45.00
    
    let remaining = Math.abs(tx.amount);
    const date = new Date(tx.date);
    const txYear = date.getFullYear();
    
    // Simple logic: if it's the 450€ tx from 2024, spread across 2024
    if (txYear === 2024 && Math.abs(tx.amount) === 450) {
      for (let m = 1; m <= 12; m++) {
        const month = `2024-${m.toString().padStart(2, '0')}`;
        const amount = m <= 5 ? 37.50 : 45.00;
        const allocAmount = Math.min(remaining, amount);
        if (allocAmount > 0) {
          await prisma.transactionMonth.create({
            data: { transactionId: tx.id, month, amount: allocAmount }
          });
          remaining -= allocAmount;
        }
      }
    } 
    // If it's the 450€ tx from 2025, spread across 2025 at 45€/month
    else if (txYear === 2025 && Math.abs(tx.amount) === 450) {
      for (let m = 1; m <= 12; m++) {
        const month = `2025-${m.toString().padStart(2, '0')}`;
        const amount = 45.00;
        const allocAmount = Math.min(remaining, amount);
        if (allocAmount > 0) {
          await prisma.transactionMonth.create({
            data: { transactionId: tx.id, month, amount: allocAmount }
          });
          remaining -= allocAmount;
        }
      }
    }
  }
}

async function fixCesar() {
  console.log('Fixing Cesar (2D/2E) allocations...');
  const codes = ['2D', '2E'];
  for (const code of codes) {
    const unit = await prisma.unit.findUnique({ where: { code } });
    if (!unit) continue;

    const txs = await prisma.transaction.findMany({
      where: { unitId: unit.id },
      include: { monthAllocations: true }
    });

    for (const tx of txs) {
      const regularAllocs = tx.monthAllocations.filter(a => a.month !== 'PREV-DEBT');
      if (regularAllocs.length === 0) continue;

      console.log(`Normalizing ${code} Tx: ${tx.description}`);
      await prisma.transactionMonth.deleteMany({
        where: { id: { in: regularAllocs.map(a => a.id) } }
      });

      const perMonth = 45.00; // All Cesar digital records are in 45€ period
      let remaining = regularAllocs.reduce((sum, a) => sum + a.amount, 0);
      
      for (const oldAlloc of regularAllocs) {
        const allocAmount = Math.min(remaining, perMonth);
        if (allocAmount > 0) {
          await prisma.transactionMonth.create({
            data: { transactionId: tx.id, month: oldAlloc.month, amount: allocAmount }
          });
          remaining -= allocAmount;
        }
      }
    }
  }
}

async function main() {
  await fixGaragem();
  await fixCesar();
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
