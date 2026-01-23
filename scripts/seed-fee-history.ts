import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding FeeHistory records...');

  // For each unit with monthlyFee > 0, find the earliest transaction month
  // and create a FeeHistory record with that effectiveFrom
  const units = await prisma.unit.findMany({
    where: { monthlyFee: { gt: 0 } },
    include: {
      transactions: {
        where: { referenceMonth: { not: null } },
        orderBy: { referenceMonth: 'asc' },
        take: 1,
        select: { referenceMonth: true },
      },
      feeHistory: { select: { id: true }, take: 1 },
    },
  });

  let unitCount = 0;
  for (const unit of units) {
    // Skip if already has fee history
    if (unit.feeHistory.length > 0) continue;

    const effectiveFrom = unit.transactions[0]?.referenceMonth ?? '2024-01';
    await prisma.feeHistory.create({
      data: {
        unitId: unit.id,
        amount: unit.monthlyFee,
        effectiveFrom,
      },
    });
    unitCount++;
    console.log(`  Unit ${unit.code}: ${unit.monthlyFee} EUR from ${effectiveFrom}`);
  }

  // For each creditor with amountDue > 0, same logic
  const creditors = await prisma.creditor.findMany({
    where: { amountDue: { not: null, gt: 0 } },
    include: {
      transactions: {
        where: { referenceMonth: { not: null } },
        orderBy: { referenceMonth: 'asc' },
        take: 1,
        select: { referenceMonth: true },
      },
      feeHistory: { select: { id: true }, take: 1 },
    },
  });

  let creditorCount = 0;
  for (const creditor of creditors) {
    if (creditor.feeHistory.length > 0) continue;

    const effectiveFrom = creditor.transactions[0]?.referenceMonth ?? '2024-01';
    await prisma.feeHistory.create({
      data: {
        creditorId: creditor.id,
        amount: creditor.amountDue!,
        effectiveFrom,
      },
    });
    creditorCount++;
    console.log(`  Creditor ${creditor.name}: ${creditor.amountDue} EUR from ${effectiveFrom}`);
  }

  console.log(`Done. Created ${unitCount} unit and ${creditorCount} creditor fee history records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
