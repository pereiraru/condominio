const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || 'admin@condominio.pt';
  const password = process.argv[3] || 'admin123';

  // Check if admin already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: 'Administrador',
      role: 'admin',
    },
  });

  console.log(`Admin user created:`);
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  ID: ${admin.id}`);
  console.log('\n⚠️  Change the password after first login!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
