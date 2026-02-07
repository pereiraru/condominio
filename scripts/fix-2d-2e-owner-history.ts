import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fixing ownership history for Units 2D and 2E...');

  const unit2D = await prisma.unit.findUnique({ where: { code: '2D' } });
  const unit2E = await prisma.unit.findUnique({ where: { code: '2E' } });

  if (!unit2D || !unit2E) {
    console.error('Units not found');
    return;
  }

  // Unit 2D
  // Current owner: Neide Patricia
  await prisma.owner.updateMany({
    where: { unitId: unit2D.id, name: { contains: 'Neide' } },
    data: { startMonth: '2024-09' }
  });
  
  await prisma.owner.create({
    data: {
      name: 'Cesar David Santos Sa',
      unitId: unit2D.id,
      startMonth: '2024-01',
      endMonth: '2024-08',
      previousDebt: 0
    }
  });
  console.log('  Fixed Unit 2D: Cesar Sa (Jan-Aug 2024), Neide (Sept 2024-Present)');

  // Unit 2E
  // Current owner: Nuno Filipe
  await prisma.owner.updateMany({
    where: { unitId: unit2E.id, name: { contains: 'Nuno' } },
    data: { startMonth: '2025-03' }
  });

  await prisma.owner.create({
    data: {
      name: 'Cesar David Santos Sa',
      unitId: unit2E.id,
      startMonth: '2024-01',
      endMonth: '2025-02',
      previousDebt: 0
    }
  });
  console.log('  Fixed Unit 2E: Cesar Sa (Jan 2024 - Feb 2025), Nuno (March 2025-Present)');

  console.log('\nOwnership update complete!');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
