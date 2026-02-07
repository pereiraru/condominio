import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Reallocating Cesar Sa payments between 2D and 2E...');

  const unit2D = await prisma.unit.findUnique({ where: { code: '2D' } });
  const unit2E = await prisma.unit.findUnique({ where: { code: '2E' } });

  if (!unit2D || !unit2E) {
    console.error('Units not found');
    return;
  }

  async function splitTransaction(txId: string, unitDId: string, unitEId: string, amountD: number, amountE: number, monthsD: string[], monthsE: string[]) {
    const original = await prisma.transaction.findUnique({ where: { id: txId } });
    if (!original) return;

    console.log(`\nSplitting ${original.amount}€ transaction "${original.description}"...`);

    // Update original (2E)
    await prisma.transaction.update({
        where: { id: txId },
        data: { amount: amountE }
    });
    await prisma.transactionMonth.deleteMany({ where: { transactionId: txId } });
    let remainingE = amountE;
    for (const m of monthsE) {
        const fee = (m < '2024-06') ? 37.50 : 45.00;
        const alloc = Math.min(remainingE, fee);
        if (alloc <= 0) break;
        await prisma.transactionMonth.create({ data: { transactionId: txId, month: m, amount: alloc } });
        remainingE -= alloc;
    }

    // Create new for 2D
    const newTx = await prisma.transaction.create({
        data: {
            date: original.date,
            description: original.description + " (Alloc to 2D)",
            amount: amountD,
            type: original.type,
            category: original.category,
            unitId: unitDId
        }
    });
    let remainingD = amountD;
    for (const m of monthsD) {
        const fee = (m < '2024-06') ? 37.50 : 45.00;
        const alloc = Math.min(remainingD, fee);
        if (alloc <= 0) break;
        await prisma.transactionMonth.create({ data: { transactionId: newTx.id, month: m, amount: alloc } });
        remainingD -= alloc;
    }
    console.log(`  Split into ${amountE.toFixed(2)}€ (2E) and ${amountD.toFixed(2)}€ (2D)`);
  }

  // 1. Split the 450€ payment (May 2024)
  await splitTransaction('cml8a37hl005911pfxb0xla0w', unit2D.id, unit2E.id, 225, 225, 
    ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06'],
    ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06']
  );

  // 2. Split the 97.50€ payment (Aug 2024)
  await splitTransaction('cml8a37uk00bl11pfayb5q1b3', unit2D.id, unit2E.id, 45, 52.50,
    ['2024-07'], ['2024-07']
  );

  // 3. Split the 277.50€ payment (Oct 2024)
  // Unit 2D needs 52.50 to clear Jan-Aug tenure debt.
  await splitTransaction('cml8a37qo009p11pf0p3lswq4', unit2D.id, unit2E.id, 52.50, 225,
    ['2024-08'], ['2024-08', '2024-09', '2024-10', '2024-11', '2024-12']
  );

  console.log('\nKeeping 90€ Jan 2025 payment for 2E.');
  console.log('\nReallocation complete!');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());