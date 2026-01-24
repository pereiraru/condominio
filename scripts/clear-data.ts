import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearData() {
  console.log('Clearing all data except users...\n');

  // Clear user references to units and owners first
  console.log('Clearing user references...');
  await prisma.user.updateMany({
    data: { unitId: null, ownerId: null },
  });

  // Delete in dependency order
  console.log('Deleting TransactionMonth...');
  const tmCount = await prisma.transactionMonth.deleteMany();
  console.log(`  Deleted ${tmCount.count} records`);

  console.log('Deleting Transaction...');
  const txCount = await prisma.transaction.deleteMany();
  console.log(`  Deleted ${txCount.count} records`);

  console.log('Deleting DescriptionMapping...');
  const dmCount = await prisma.descriptionMapping.deleteMany();
  console.log(`  Deleted ${dmCount.count} records`);

  console.log('Deleting FeeHistory...');
  const fhCount = await prisma.feeHistory.deleteMany();
  console.log(`  Deleted ${fhCount.count} records`);

  console.log('Deleting ExtraCharge...');
  const ecCount = await prisma.extraCharge.deleteMany();
  console.log(`  Deleted ${ecCount.count} records`);

  console.log('Deleting Owner...');
  const owCount = await prisma.owner.deleteMany();
  console.log(`  Deleted ${owCount.count} records`);

  console.log('Deleting Unit...');
  const unitCount = await prisma.unit.deleteMany();
  console.log(`  Deleted ${unitCount.count} records`);

  console.log('Deleting CreditorAttachment...');
  const caCount = await prisma.creditorAttachment.deleteMany();
  console.log(`  Deleted ${caCount.count} records`);

  console.log('Deleting Creditor...');
  const crCount = await prisma.creditor.deleteMany();
  console.log(`  Deleted ${crCount.count} records`);

  console.log('Deleting Document...');
  const docCount = await prisma.document.deleteMany();
  console.log(`  Deleted ${docCount.count} records`);

  // Verify users are preserved
  const userCount = await prisma.user.count();
  console.log(`\nDone! ${userCount} users preserved.`);
}

clearData()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
