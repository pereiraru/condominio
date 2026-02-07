import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const units = await prisma.unit.findMany({
    where: { code: { in: ['2D', '2E'] } },
    include: { owners: { orderBy: { startMonth: 'asc' } } }
  });
  console.log(JSON.stringify(units, null, 2));
}
main().finally(() => prisma.$disconnect());
