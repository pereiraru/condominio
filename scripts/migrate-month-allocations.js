const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const transactions = await prisma.transaction.findMany({
    where: {
      referenceMonth: { not: null },
      monthAllocations: { none: {} },
    },
  });

  console.log(`Found ${transactions.length} transactions with referenceMonth to migrate`);

  let created = 0;
  for (const tx of transactions) {
    if (!tx.referenceMonth) continue;

    await prisma.transactionMonth.create({
      data: {
        transactionId: tx.id,
        month: tx.referenceMonth,
        amount: Math.abs(tx.amount),
      },
    });
    created++;
  }

  console.log(`Created ${created} TransactionMonth entries`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
