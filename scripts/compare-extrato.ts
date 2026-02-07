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

  console.log('=== BANK EXTRACT (Excel) ===');
  console.log(`Total rows: ${excelData.length}`);
  console.log(`Date range: ${excelDate(excelData[0]['Data Mov.'])} to ${excelDate(excelData[excelData.length - 1]['Data Mov.'])}`);

  // Get all transactions from DB
  const dbTransactions = await prisma.transaction.findMany({
    include: { unit: true, creditor: true },
    orderBy: { date: 'asc' },
  });

  console.log('\n=== DATABASE TRANSACTIONS ===');
  console.log(`Total transactions: ${dbTransactions.length}`);
  if (dbTransactions.length > 0) {
    const dates = dbTransactions.map(t => t.date);
    console.log(`Date range: ${dates[0].toISOString().split('T')[0]} to ${dates[dates.length - 1].toISOString().split('T')[0]}`);
  }

  // Get DB date range that overlaps with Excel
  const excelStart = new Date('2024-01-01');
  const excelEnd = new Date('2026-01-23');

  const dbInRange = dbTransactions.filter(t => t.date >= excelStart && t.date <= excelEnd);
  console.log(`\nDB transactions in Excel date range (2024-01-01 to 2026-01-22): ${dbInRange.length}`);

  // Compare by month
  console.log('\n=== MONTHLY COMPARISON ===');
  console.log('Month       | Excel Count | DB Count | Excel Income | DB Income | Excel Expense | DB Expense');
  console.log('------------|-------------|----------|--------------|-----------|---------------|----------');

  const excelMonthly: Record<string, { count: number; income: number; expense: number }> = {};
  excelData.forEach((r: any) => {
    const date = excelDate(r['Data Mov.']);
    const ym = date.substring(0, 7);
    if (!excelMonthly[ym]) excelMonthly[ym] = { count: 0, income: 0, expense: 0 };
    const amt = typeof r['Importância'] === 'number' ? r['Importância'] : 0;
    excelMonthly[ym].count++;
    if (amt > 0) excelMonthly[ym].income += amt;
    else excelMonthly[ym].expense += amt;
  });

  const dbMonthly: Record<string, { count: number; income: number; expense: number }> = {};
  dbInRange.forEach(t => {
    const ym = t.date.toISOString().substring(0, 7);
    if (!dbMonthly[ym]) dbMonthly[ym] = { count: 0, income: 0, expense: 0 };
    dbMonthly[ym].count++;
    if (t.amount > 0) dbMonthly[ym].income += t.amount;
    else dbMonthly[ym].expense += t.amount;
  });

  const allMonths = [...new Set([...Object.keys(excelMonthly), ...Object.keys(dbMonthly)])].sort();
  allMonths.forEach(ym => {
    const e = excelMonthly[ym] || { count: 0, income: 0, expense: 0 };
    const d = dbMonthly[ym] || { count: 0, income: 0, expense: 0 };
    const countDiff = e.count !== d.count ? ' <<<' : '';
    console.log(
      `${ym}    | ${String(e.count).padStart(11)} | ${String(d.count).padStart(8)} | ${e.income.toFixed(2).padStart(12)} | ${d.income.toFixed(2).padStart(9)} | ${e.expense.toFixed(2).padStart(13)} | ${d.expense.toFixed(2).padStart(10)}${countDiff}`
    );
  });

  // Find transactions in Excel but not in DB (by matching date + amount + description patterns)
  console.log('\n=== TRANSACTIONS IN EXCEL BUT POSSIBLY MISSING FROM DB ===');

  let missingCount = 0;
  const missingByMonth: Record<string, any[]> = {};

  for (const row of excelData) {
    const date = excelDate(row['Data Mov.']);
    const amt = typeof row['Importância'] === 'number' ? row['Importância'] : 0;
    const desc = row['Descrição'] || '';
    const andar = row['Andar'] || '';

    // Find matching DB transaction: same date and same amount
    const dateObj = new Date(date);
    const dayStart = new Date(dateObj);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateObj);
    dayEnd.setHours(23, 59, 59, 999);

    const matches = dbInRange.filter(t => {
      const tDate = t.date.toISOString().split('T')[0];
      return tDate === date && Math.abs(t.amount - amt) < 0.01;
    });

    if (matches.length === 0) {
      const ym = date.substring(0, 7);
      if (!missingByMonth[ym]) missingByMonth[ym] = [];
      missingByMonth[ym].push({ date, desc, amt, andar });
      missingCount++;
    }
  }

  console.log(`Total potentially missing: ${missingCount}`);
  Object.entries(missingByMonth).sort().forEach(([ym, items]) => {
    console.log(`\n  ${ym} (${items.length} missing):`);
    items.forEach(item => {
      console.log(`    ${item.date} | ${item.amt.toFixed(2).padStart(10)} | ${item.andar.padEnd(18)} | ${item.desc}`);
    });
  });

  // Find transactions in DB but not in Excel
  console.log('\n\n=== TRANSACTIONS IN DB BUT NOT IN EXCEL ===');
  let extraCount = 0;
  const extraByMonth: Record<string, any[]> = {};

  for (const t of dbInRange) {
    const date = t.date.toISOString().split('T')[0];
    const matches = excelData.filter((r: any) => {
      const rDate = excelDate(r['Data Mov.']);
      const rAmt = typeof r['Importância'] === 'number' ? r['Importância'] : 0;
      return rDate === date && Math.abs(rAmt - t.amount) < 0.01;
    });

    if (matches.length === 0) {
      const ym = date.substring(0, 7);
      if (!extraByMonth[ym]) extraByMonth[ym] = [];
      extraByMonth[ym].push({
        date,
        desc: t.description,
        amt: t.amount,
        unit: t.unit?.code || '',
        creditor: t.creditor?.name || '',
      });
      extraCount++;
    }
  }

  console.log(`Total in DB but not in Excel: ${extraCount}`);
  Object.entries(extraByMonth).sort().forEach(([ym, items]) => {
    console.log(`\n  ${ym} (${items.length} extra):`);
    items.forEach(item => {
      console.log(`    ${item.date} | ${item.amt.toFixed(2).padStart(10)} | ${(item.unit || item.creditor).padEnd(18)} | ${item.desc}`);
    });
  });

  await prisma.$disconnect();
}

main().catch(console.error);
