import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function excelDate(serial: any): string {
  if (typeof serial === 'string') return serial;
  const d = new Date((serial - 25569) * 86400 * 1000);
  return d.toISOString().split('T')[0];
}

async function main() {
  // Read Excel data
  const wb = XLSX.readFile('data/extrato.xlsx');
  const ws = wb.Sheets['Sheet1'];
  const excelData = XLSX.utils.sheet_to_json(ws) as any[];

  // Get all DB transactions in range with month allocations
  const dbTransactions = await prisma.transaction.findMany({
    where: {
      date: {
        gte: new Date('2024-01-01'),
        lte: new Date('2026-01-23'),
      },
    },
    include: {
      unit: true,
      creditor: true,
      monthAllocations: true,
    },
    orderBy: { date: 'asc' },
  });

  // Group DB transactions that were split from the same bank transaction
  // They share: same date, same unit, same base description
  const dbGrouped: Record<string, { date: string; desc: string; unit: string; totalAmount: number; txnCount: number; txnIds: string[] }> = {};

  for (const t of dbTransactions) {
    const date = t.date.toISOString().split('T')[0];
    const unit = t.unit?.code || t.creditor?.name || 'none';
    // Remove "(ref. YYYY-MM)" suffix to get base description
    const baseDesc = t.description.replace(/\s*\(ref\.\s*\d{4}-\d{2}\)$/, '');
    const key = `${date}|${unit}|${baseDesc}`;

    if (!dbGrouped[key]) {
      dbGrouped[key] = { date, desc: baseDesc, unit, totalAmount: 0, txnCount: 0, txnIds: [] };
    }
    dbGrouped[key].totalAmount += t.amount;
    dbGrouped[key].txnCount++;
    dbGrouped[key].txnIds.push(t.id);
  }

  console.log('=== GROUPED COMPARISON ===');
  console.log(`Excel rows: ${excelData.length}`);
  console.log(`DB transactions: ${dbTransactions.length}`);
  console.log(`DB grouped (unique bank transactions): ${Object.keys(dbGrouped).length}`);

  // Now match Excel rows to grouped DB transactions
  const excelUsed = new Set<number>();
  const dbUsed = new Set<string>();

  // Pass 1: Exact match on date + amount (grouped)
  for (const [key, group] of Object.entries(dbGrouped)) {
    for (let i = 0; i < excelData.length; i++) {
      if (excelUsed.has(i)) continue;
      const row = excelData[i];
      const date = excelDate(row['Data Mov.']);
      const amt = typeof row['Importância'] === 'number' ? row['Importância'] : 0;

      if (date === group.date && Math.abs(amt - group.totalAmount) < 0.02) {
        excelUsed.add(i);
        dbUsed.add(key);
        break;
      }
    }
  }

  console.log(`\nMatched: ${dbUsed.size} transactions`);

  // Unmatched Excel rows
  const unmatchedExcel: any[] = [];
  for (let i = 0; i < excelData.length; i++) {
    if (!excelUsed.has(i)) {
      const row = excelData[i];
      unmatchedExcel.push({
        idx: i,
        date: excelDate(row['Data Mov.']),
        desc: row['Descrição'],
        amt: typeof row['Importância'] === 'number' ? row['Importância'] : row['Importância'],
        andar: row['Andar'] || '',
      });
    }
  }

  // Unmatched DB groups
  const unmatchedDB: any[] = [];
  for (const [key, group] of Object.entries(dbGrouped)) {
    if (!dbUsed.has(key)) {
      unmatchedDB.push(group);
    }
  }

  console.log(`Unmatched Excel rows: ${unmatchedExcel.length}`);
  console.log(`Unmatched DB groups: ${unmatchedDB.length}`);

  // Try Pass 2: fuzzy match unmatched items (same date, same unit/description pattern, close amount)
  const stillUnmatchedExcel: any[] = [];
  const stillUnmatchedDB = new Set(unmatchedDB.map((_, i) => i));

  for (const exRow of unmatchedExcel) {
    let matched = false;
    for (let j = 0; j < unmatchedDB.length; j++) {
      if (!stillUnmatchedDB.has(j)) continue;
      const dbGroup = unmatchedDB[j];
      if (exRow.date === dbGroup.date && Math.abs(exRow.amt - dbGroup.totalAmount) < 1) {
        console.log(`  FUZZY MATCH: ${exRow.date} | Excel: ${exRow.amt} (${exRow.andar}) | DB: ${dbGroup.totalAmount.toFixed(2)} (${dbGroup.unit}) | ${exRow.desc}`);
        stillUnmatchedDB.delete(j);
        matched = true;
        break;
      }
    }
    if (!matched) {
      stillUnmatchedExcel.push(exRow);
    }
  }

  const finalUnmatchedDB = unmatchedDB.filter((_, i) => stillUnmatchedDB.has(i));

  console.log(`\nAfter fuzzy matching:`);
  console.log(`Still unmatched Excel rows: ${stillUnmatchedExcel.length}`);
  console.log(`Still unmatched DB groups: ${finalUnmatchedDB.length}`);

  // Print unmatched Excel
  if (stillUnmatchedExcel.length > 0) {
    console.log('\n=== EXCEL TRANSACTIONS NOT FOUND IN DATABASE ===');
    console.log('(These are in the bank extract but NOT registered in the site)\n');
    let totalMissing = 0;
    for (const row of stillUnmatchedExcel) {
      console.log(`  ${row.date} | ${String(row.amt).padStart(10)} | ${row.andar.padEnd(18)} | ${row.desc}`);
      if (typeof row.amt === 'number') totalMissing += row.amt;
    }
    console.log(`\n  Total missing amount: ${totalMissing.toFixed(2)}`);
  }

  // Print unmatched DB
  if (finalUnmatchedDB.length > 0) {
    console.log('\n=== DATABASE TRANSACTIONS NOT FOUND IN BANK EXTRACT ===');
    console.log('(These are registered in the site but NOT in the bank extract)\n');
    let totalExtra = 0;
    for (const group of finalUnmatchedDB) {
      console.log(`  ${group.date} | ${group.totalAmount.toFixed(2).padStart(10)} | ${group.unit.padEnd(18)} | ${group.desc} (${group.txnCount} txns)`);
      totalExtra += group.totalAmount;
    }
    console.log(`\n  Total extra amount: ${totalExtra.toFixed(2)}`);
  }

  // Summary by unit: compare total income in Excel vs DB
  console.log('\n=== INCOME COMPARISON BY UNIT ===');
  console.log('Unit       | Excel Total | DB Total   | Difference');
  console.log('-----------|-------------|------------|----------');

  const unitCodes = ['1D', '1E', '2D', '2E', '3D', '3E', '4D', '4E', '5D', '5E', '6D', '6E', 'RCD', 'RCE', 'CV', 'Garagem'];

  for (const code of unitCodes) {
    // Excel total for this unit
    const excelTotal = excelData
      .filter((r: any) => r['Andar'] === code)
      .reduce((sum: number, r: any) => {
        const amt = typeof r['Importância'] === 'number' ? r['Importância'] : 0;
        return sum + (amt > 0 ? amt : 0);
      }, 0);

    // DB total for this unit (only income)
    const dbTotal = dbTransactions
      .filter(t => t.unit?.code === code && t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const diff = excelTotal - dbTotal;
    const marker = Math.abs(diff) > 0.01 ? ' <<<' : '';
    console.log(`${code.padEnd(10)} | ${excelTotal.toFixed(2).padStart(11)} | ${dbTotal.toFixed(2).padStart(10)} | ${diff.toFixed(2).padStart(10)}${marker}`);
  }

  // Expense comparison by category
  console.log('\n=== EXPENSE COMPARISON BY CATEGORY ===');
  const expenseCategories: Record<string, string[]> = {
    'Luz': ['Luz'],
    'Elevadores': ['Elevadores'],
    'Gestao Conta': ['Gestao Conta'],
    'Conta Poupança': ['Conta Poupança'],
    'Levantamento': ['Levantamento'],
    'P. Serviços': ['P. Serviços'],
    'Other Expenses': ['pagamento', 'Bomba Agua', 'Electrecista', 'Outos pagamentos', 'Exaustores'],
  };

  console.log('Category         | Excel Total | Excel Count');
  console.log('-----------------|-------------|------------');
  for (const [cat, andares] of Object.entries(expenseCategories)) {
    const excelTotal = excelData
      .filter((r: any) => andares.includes(r['Andar']))
      .reduce((sum: number, r: any) => {
        const amt = typeof r['Importância'] === 'number' ? r['Importância'] : 0;
        return sum + amt;
      }, 0);
    const excelCount = excelData.filter((r: any) => andares.includes(r['Andar'])).length;
    console.log(`${cat.padEnd(17)}| ${excelTotal.toFixed(2).padStart(11)} | ${String(excelCount).padStart(11)}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
