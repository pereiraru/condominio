import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const owners = await prisma.owner.findMany({
    where: { unit: { code: '4D' } },
    select: { id: true, name: true, startMonth: true, endMonth: true }
  });
  console.log(JSON.stringify(owners, null, 2));
}
main().finally(() => prisma.$disconnect());
