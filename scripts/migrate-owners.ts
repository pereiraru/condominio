/**
 * Migration script: Populate owner periods and link users to owners.
 *
 * For each Owner:
 *   - Set startMonth = earliest TransactionMonth for the unit
 *   - Set endMonth = null (current owner)
 *   - Copy Unit's email, telefone, nib to the owner
 *
 * For each User with unitId:
 *   - Set ownerId = current owner (endMonth=null) of that unit
 *
 * Run with: npx tsx scripts/migrate-owners.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting owner migration...');

  // Get all units with their owners
  const units = await prisma.unit.findMany({
    include: { owners: true },
  });

  for (const unit of units) {
    if (unit.owners.length === 0) continue;

    // Find earliest transaction month for this unit
    const earliestAlloc = await prisma.transactionMonth.findFirst({
      where: {
        transaction: { unitId: unit.id },
      },
      orderBy: { month: 'asc' },
      select: { month: true },
    });

    const startMonth = earliestAlloc?.month ?? null;

    // Update the first owner with period info and unit contact details
    const firstOwner = unit.owners[0];
    await prisma.owner.update({
      where: { id: firstOwner.id },
      data: {
        startMonth,
        endMonth: null,
        email: unit.email || null,
        telefone: unit.telefone || null,
        nib: unit.nib || null,
      },
    });

    console.log(
      `  Unit ${unit.code}: Owner "${firstOwner.name}" -> startMonth=${startMonth}, endMonth=null`
    );

    // If there are additional owners, set them with the same start/no end
    for (let i = 1; i < unit.owners.length; i++) {
      await prisma.owner.update({
        where: { id: unit.owners[i].id },
        data: {
          startMonth,
          endMonth: null,
        },
      });
      console.log(
        `  Unit ${unit.code}: Additional owner "${unit.owners[i].name}" -> startMonth=${startMonth}`
      );
    }
  }

  // Link users to their unit's current owner
  const users = await prisma.user.findMany({
    where: { unitId: { not: null } },
  });

  for (const user of users) {
    if (!user.unitId) continue;

    // Find the current owner (endMonth = null) for this unit
    const currentOwner = await prisma.owner.findFirst({
      where: {
        unitId: user.unitId,
        endMonth: null,
      },
    });

    if (currentOwner) {
      await prisma.user.update({
        where: { id: user.id },
        data: { ownerId: currentOwner.id },
      });
      console.log(
        `  User "${user.email}" -> ownerId=${currentOwner.id} (${currentOwner.name})`
      );
    }
  }

  console.log('Migration complete!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
