import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GARAGEM_CREDITOR_ID = 'cml1imze900tb89ezc77bjotd';

async function fixGaragem() {
  console.log('=== Fix Garagem: Convert creditor to unit ===\n');

  // Step 1: Create "Garagem" unit
  console.log('Step 1: Creating Garagem unit...');
  const garagemUnit = await prisma.unit.create({
    data: {
      code: 'Garagem',
      floor: -2,
      description: 'Cave -2',
      monthlyFee: 45,
    },
  });
  console.log(`  Created unit: ${garagemUnit.id} (code: ${garagemUnit.code})`);

  // Step 2: Find Garagem creditor
  console.log('\nStep 2: Finding Garagem creditor...');
  const creditor = await prisma.creditor.findUnique({
    where: { id: GARAGEM_CREDITOR_ID },
    include: {
      descriptionMappings: true,
      transactions: true,
    },
  });

  if (!creditor) {
    // Try finding by name
    const byName = await prisma.creditor.findFirst({
      where: { name: { contains: 'Garagem' } },
      include: {
        descriptionMappings: true,
        transactions: true,
      },
    });
    if (!byName) {
      console.log('  Garagem creditor not found! Skipping migration.');
      // Still update CV unit
      await updateCVUnit();
      return;
    }
    console.log(`  Found by name: ${byName.id} (${byName.name})`);
    await migrateCreditorToUnit(byName.id, garagemUnit.id);
  } else {
    console.log(`  Found: ${creditor.id} (${creditor.name})`);
    console.log(`  - ${creditor.descriptionMappings.length} description mappings`);
    console.log(`  - ${creditor.transactions.length} transactions`);
    await migrateCreditorToUnit(creditor.id, garagemUnit.id);
  }

  // Step 6: Update CV unit
  await updateCVUnit();

  console.log('\n=== Done! ===');
}

async function migrateCreditorToUnit(creditorId: string, unitId: string) {
  // Step 3: Move DescriptionMapping records
  console.log('\nStep 3: Moving DescriptionMapping records...');
  const mappingsUpdated = await prisma.descriptionMapping.updateMany({
    where: { creditorId },
    data: { creditorId: null, unitId },
  });
  console.log(`  Updated ${mappingsUpdated.count} description mappings`);

  // Step 4: Move Transaction records
  console.log('\nStep 4: Moving Transaction records...');
  const txUpdated = await prisma.transaction.updateMany({
    where: { creditorId },
    data: { creditorId: null, unitId, type: 'payment' },
  });
  console.log(`  Updated ${txUpdated.count} transactions (creditorId -> unitId, type -> payment)`);

  // Also make amounts positive (they were expenses = negative)
  const negativeTxs = await prisma.transaction.findMany({
    where: { unitId, amount: { lt: 0 } },
  });
  for (const tx of negativeTxs) {
    await prisma.transaction.update({
      where: { id: tx.id },
      data: { amount: Math.abs(tx.amount) },
    });
  }
  console.log(`  Fixed ${negativeTxs.length} negative amounts to positive`);

  // Step 5: Delete Garagem creditor
  console.log('\nStep 5: Deleting Garagem creditor...');
  await prisma.creditor.delete({ where: { id: creditorId } });
  console.log('  Deleted creditor');
}

async function updateCVUnit() {
  console.log('\nStep 6: Updating CV unit...');
  const cvUnit = await prisma.unit.findFirst({ where: { code: 'CV' } });
  if (cvUnit) {
    await prisma.unit.update({
      where: { id: cvUnit.id },
      data: { floor: -1, description: 'Cave -1 (Garagem)' },
    });
    console.log(`  Updated CV: floor=-1, description="Cave -1 (Garagem)"`);
  } else {
    console.log('  CV unit not found, skipping update');
  }
}

fixGaragem()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
