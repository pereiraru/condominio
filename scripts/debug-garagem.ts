import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const unit = await prisma.unit.findUnique({
    where: { code: 'Garagem' },
    include: {
      transactions: {
        include: { monthAllocations: true },
        orderBy: { date: 'asc' }
      },
      feeHistory: { orderBy: { effectiveFrom: 'asc' } }
    }
  });
  console.log(JSON.stringify(unit, null, 2));
}
main().finally(() => prisma.$disconnect());
