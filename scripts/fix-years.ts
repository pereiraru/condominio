import { prisma } from '../src/lib/prisma';

async function run() {
  console.log('Searching for future transactions...');
  
  // Anything after 2026-12-31 is definitely wrong for now
  const futureDate = new Date('2026-12-31');
  
  const transactions = await prisma.transaction.findMany({
    where: {
      date: { gt: futureDate }
    }
  });

  console.log(`Found ${transactions.length} incorrect transactions.`);

  for (const tx of transactions) {
    const oldDate = new Date(tx.date);
    // Correcting 2028 -> 2025, 2027 -> 2024 etc (common offset error)
    // Or just subtract 3 years if they are all 2028
    const newDate = new Date(oldDate);
    if (oldDate.getFullYear() === 2028) {
      newDate.setFullYear(2025);
    } else if (oldDate.getFullYear() === 2027) {
      newDate.setFullYear(2024);
    }

    console.log(`Fixing: ${tx.description} | ${oldDate.toISOString()} -> ${newDate.toISOString()}`);
    
    await prisma.transaction.update({
      where: { id: tx.id },
      data: { date: newDate }
    });
  }

  console.log('Cleanup complete.');
}

run().catch(console.error);
