import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface FeeHistoryEntry {
  amount: number;
  effectiveFrom: string;
}

// Get the monthly fee for a unit at a specific date
function getMonthlyFee(feeHistory: FeeHistoryEntry[], date: string): number {
  // Sort by effectiveFrom descending to find the most recent applicable fee
  const sorted = [...feeHistory].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  for (const entry of sorted) {
    if (entry.effectiveFrom <= date) {
      return entry.amount;
    }
  }
  return sorted[sorted.length - 1]?.amount || 37.5; // Default fallback
}

// Generate months for a year
function generateMonthsForYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

async function fixLumpsumPayments() {
  console.log('Starting lump-sum payment fix...\n');

  // Get all units with their fee history
  const units = await prisma.unit.findMany({
    include: {
      feeHistory: true,
      transactions: {
        where: {
          type: 'payment',
          amount: { gte: 400 },
        },
        orderBy: { date: 'asc' },
      },
    },
  });

  let totalSplit = 0;
  let totalCreated = 0;

  for (const unit of units) {
    const lumpsumPayments = unit.transactions.filter(t => t.amount >= 400);

    if (lumpsumPayments.length === 0) continue;

    console.log(`\n=== Unit ${unit.code} ===`);
    console.log(`Fee history:`, unit.feeHistory.map(f => `${f.effectiveFrom}: ${f.amount}€`).join(', '));

    for (const payment of lumpsumPayments) {
      const refMonth = payment.referenceMonth;
      if (!refMonth) {
        console.log(`  Skipping payment without referenceMonth: ${payment.description}`);
        continue;
      }

      const year = parseInt(refMonth.split('-')[0]);
      const monthlyFee = getMonthlyFee(unit.feeHistory as FeeHistoryEntry[], refMonth);
      const monthsCovered = Math.round(payment.amount / monthlyFee);

      console.log(`\n  Payment: ${payment.description}`);
      console.log(`    Amount: ${payment.amount}€, Monthly fee: ${monthlyFee}€`);
      console.log(`    Covers approximately ${monthsCovered} months`);

      if (monthsCovered < 6) {
        console.log(`    -> Skipping (less than 6 months, might be intentional)`);
        continue;
      }

      // Determine which months to create transactions for
      let monthsToCreate: string[] = [];

      if (monthsCovered === 12) {
        // Full year payment - distribute across all months of that year
        monthsToCreate = generateMonthsForYear(year);
      } else if (monthsCovered > 12) {
        // More than a year - start from January of the payment year
        const fullYears = Math.floor(monthsCovered / 12);
        const extraMonths = monthsCovered % 12;

        for (let y = 0; y < fullYears; y++) {
          monthsToCreate.push(...generateMonthsForYear(year + y));
        }
        // Add extra months at the start of the next year
        for (let m = 1; m <= extraMonths; m++) {
          monthsToCreate.push(`${year + fullYears}-${String(m).padStart(2, '0')}`);
        }
      } else {
        // Less than a year but >= 6 months - distribute starting from the reference month
        const startMonth = parseInt(refMonth.split('-')[1]);
        for (let i = 0; i < monthsCovered; i++) {
          const m = ((startMonth - 1 + i) % 12) + 1;
          const y = year + Math.floor((startMonth - 1 + i) / 12);
          monthsToCreate.push(`${y}-${String(m).padStart(2, '0')}`);
        }
      }

      console.log(`    -> Will create ${monthsToCreate.length} monthly transactions`);
      console.log(`    -> Months: ${monthsToCreate[0]} to ${monthsToCreate[monthsToCreate.length - 1]}`);

      // Check for existing monthly payments in this period
      const existingPayments = await prisma.transaction.findMany({
        where: {
          unitId: unit.id,
          type: 'payment',
          referenceMonth: { in: monthsToCreate },
          id: { not: payment.id },
        },
      });

      if (existingPayments.length > 0) {
        console.log(`    -> WARNING: ${existingPayments.length} existing payments in this period`);
        const existingMonths = existingPayments.map(p => p.referenceMonth);
        monthsToCreate = monthsToCreate.filter(m => !existingMonths.includes(m));
        console.log(`    -> Adjusted to ${monthsToCreate.length} months after excluding existing`);
      }

      if (monthsToCreate.length === 0) {
        console.log(`    -> No months to create, skipping`);
        continue;
      }

      // Calculate amount per month
      const amountPerMonth = payment.amount / (monthsCovered);

      // Delete the original lump-sum payment
      await prisma.transaction.delete({
        where: { id: payment.id },
      });
      totalSplit++;

      // Create individual monthly payments
      for (const month of monthsToCreate) {
        await prisma.transaction.create({
          data: {
            date: payment.date,
            valueDate: payment.valueDate,
            description: payment.description,
            amount: amountPerMonth,
            balance: null,
            type: 'payment',
            category: payment.category,
            referenceMonth: month,
            unitId: unit.id,
            creditorId: payment.creditorId,
          },
        });
        totalCreated++;
      }

      console.log(`    -> DONE: Split into ${monthsToCreate.length} payments of ${amountPerMonth.toFixed(2)}€ each`);
    }
  }

  console.log(`\n\n=== SUMMARY ===`);
  console.log(`Lump-sum payments split: ${totalSplit}`);
  console.log(`Individual payments created: ${totalCreated}`);
}

fixLumpsumPayments()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
