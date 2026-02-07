import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const txs = await prisma.transaction.findMany({
    where: {
      OR: [
        { unit: { code: '2D' } },
        { unit: { code: '2E' } }
      ],
      description: { contains: 'CESAR' }
    },
    include: {
      unit: true,
      monthAllocations: true
    },
    orderBy: { date: 'asc' }
  });
  
  console.log(JSON.stringify(txs, null, 2));
}
main().finally(() => prisma.$disconnect());
