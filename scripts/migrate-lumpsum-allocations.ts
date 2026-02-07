import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Migrating lump-sum payments to multiple month allocations...');

  const units = await prisma.unit.findMany({
    include: {
      feeHistory: { orderBy: { effectiveFrom: 'asc' } },
      transactions: {
        where: {
          type: 'payment',
          amount: { gte: 100 }, // Focus on larger payments
        },
        include: {
          monthAllocations: true
        }
      }
    }
  });

  for (const unit of units) {
    for (const tx of unit.transactions) {
      // If it only has ONE allocation and it's for the full amount
      if (tx.monthAllocations.length === 1 && Math.abs(tx.monthAllocations[0].amount - tx.amount) < 0.01) {
        const currentAlloc = tx.monthAllocations[0];
        const fee = await getEffectiveFee(unit.id, currentAlloc.month);
        const monthsCovered = Math.round(tx.amount / fee);

        if (monthsCovered > 1) {
          console.log(`
Unit ${unit.code}: Payment of ${tx.amount}€ on ${tx.date.toISOString().slice(0,10)}`);
          console.log(`  Current allocation: ${currentAlloc.month} (${currentAlloc.amount}€)`);
          console.log(`  Estimated months covered: ${monthsCovered} (at ${fee}€/month)`);

          // Create new allocations
          const [startYear, startMonth] = currentAlloc.month.split('-').map(Number);
          
          // Delete existing single allocation
          await prisma.transactionMonth.delete({ where: { id: currentAlloc.id } });

          let remainingAmount = tx.amount;
          for (let i = 0; i < monthsCovered; i++) {
            const m = ((startMonth - 1 + i) % 12) + 1;
            const y = startYear + Math.floor((startMonth - 1 + i) / 12);
            const monthStr = `${y}-${m.toString().padStart(2, '0')}`;
            
            const monthFee = await getEffectiveFee(unit.id, monthStr);
            const allocAmount = (i === monthsCovered - 1) ? remainingAmount : Math.min(remainingAmount, monthFee);

            await prisma.transactionMonth.create({
              data: {
                transactionId: tx.id,
                month: monthStr,
                amount: parseFloat(allocAmount.toFixed(2))
              }
            });
            remainingAmount -= allocAmount;
            console.log(`    -> Allocated ${allocAmount.toFixed(2)}€ to ${monthStr}`);
            if (remainingAmount <= 0) break;
          }
        }
      }
    }
  }
}

async function getEffectiveFee(unitId: string, month: string): Promise<number> {
  const history = await prisma.feeHistory.findMany({
    where: { unitId },
    orderBy: { effectiveFrom: 'desc' }
  });

  for (const h of history) {
    if (month >= h.effectiveFrom && (!h.effectiveTo || month <= h.effectiveTo)) {
      return h.amount;
    }
  }
  return 45.0; // build fallback
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
