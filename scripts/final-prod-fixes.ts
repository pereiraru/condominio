import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Performing final data fixes...');

  // 1. Fix RCD overlapping fee history
  // Error: record 2023-06 to 2024-05 (17.5) overlaps with 2024-05 (20)
  const rcdUnit = await prisma.unit.findUnique({ where: { code: 'RCD' } });
  if (rcdUnit) {
    const overlappingFee = await prisma.feeHistory.findFirst({
      where: {
        unitId: rcdUnit.id,
        amount: 17.5,
        effectiveTo: '2024-05'
      }
    });

    if (overlappingFee) {
      await prisma.feeHistory.update({
        where: { id: overlappingFee.id },
        data: { effectiveTo: '2024-04' }
      });
      console.log('  Fixed Unit RCD overlapping fee history (ends 2024-04 now).');
    }
  }

  // 2. Remove confirmed duplicate transactions
  // 2025-10-21, amount=-200, desc="LEV.ATM 8887"
  // 2025-10-22, amount=-200, desc="LEV.ATM 8887"
  // 2025-10-23, amount=-200, desc="LEV.ATM 8887"
  // 2026-01-22, amount=-1, desc="COMISS. EXTRATO NET24"
  // 2026-01-22, amount=-0.04, desc="IMP.SELO S/OP.BANCARIAS"

  const dupes = [
    { date: new Date('2025-10-21'), amount: -200, desc: 'LEV.ATM 8887' },
    { date: new Date('2025-10-22'), amount: -200, desc: 'LEV.ATM 8887' },
    { date: new Date('2025-10-23'), amount: -200, desc: 'LEV.ATM 8887' },
    { date: new Date('2026-01-22'), amount: -1, desc: 'COMISS. EXTRATO NET24' },
    { date: new Date('2026-01-22'), amount: -0.04, desc: 'IMP.SELO S/OP.BANCARIAS' },
  ];

  for (const criteria of dupes) {
    const matches = await prisma.transaction.findMany({
      where: {
        date: criteria.date,
        amount: criteria.amount,
        description: criteria.desc
      },
      orderBy: { createdAt: 'desc' }
    });

    if (matches.length > 1) {
      // Keep the oldest one, delete the newest (duplicate)
      const toDelete = matches[0]; 
      await prisma.transaction.delete({ where: { id: toDelete.id } });
      console.log(`  Deleted duplicate transaction: ${criteria.desc} on ${criteria.date.toISOString().slice(0,10)}`);
    }
  }

  console.log('Final fixes complete!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
