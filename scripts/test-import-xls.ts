/**
 * Test script: Simulates bank-extract import logic against XLS and TXT files
 * WITHOUT writing to the database. Validates parsing.
 *
 * Usage: npx tsx scripts/test-import-xls.ts [path-to-file]
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = process.argv[2] || '/tmp/bank-extract-test.XLS';
const buffer = fs.readFileSync(filePath);
const isTxt = filePath.toLowerCase().endsWith('.txt');

console.log(`\n=== Testing Import: ${filePath} (${isTxt ? 'TXT' : 'XLS'}) ===\n`);

interface BankRow { dateMov: string; description: string; importance: string; balanceStr: string; }
let rows: BankRow[] = [];

if (isTxt) {
  const decoder = new TextDecoder('windows-1252');
  const content = decoder.decode(buffer);
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  const dataLines = lines.slice(1);
  rows = dataLines.map(line => {
    const parts = line.split('\t');
    return { dateMov: parts[0]||'', description: parts[2]||'', importance: parts[3]||'', balanceStr: parts[5]||'' };
  });
} else {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const dataWithDates = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet);
  const dataFormatted = XLSX.utils.sheet_to_json<Record<string, string>>(firstSheet, { raw: false });

  rows = dataFormatted.map((r, i) => {
    const dateRow = dataWithDates[i];
    const dateVal = dateRow?.['DATA MOVIMENTO'] || dateRow?.['Data Movimento'] || dateRow?.['Data'];
    let dateStr = '';
    if (dateVal instanceof Date) {
      dateStr = `${dateVal.getUTCMonth() + 1}/${dateVal.getUTCDate()}/${dateVal.getUTCFullYear()}`;
    } else {
      dateStr = (r['DATA MOVIMENTO'] || r['Data Movimento'] || r['Data'] || '').toString();
    }
    return {
      dateMov: dateStr,
      description: (r['DESCRIÇÃO'] || r['Descrição'] || r['Descricao'] || '').toString(),
      importance: (r['IMPORTÂNCIA'] || r['Importância'] || r['Valor'] || '').toString(),
      balanceStr: (r['SALDO CONTABILÍSTICO'] || r['Saldo Contabilístico'] || r['Saldo'] || '').toString()
    };
  });
}

console.log(`Parsed ${rows.length} rows\n`);

const parseAmount = (val: string): number => {
  if (!val) return 0;
  const cleaned = val.replace(/"/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned);
};

const stripNonAscii = (s: string) => s.replace(/[^\x20-\x7E]/g, '').trim();

let dateMin = '', dateMax = '';
let amtMin = Infinity, amtMax = -Infinity;
const issues: string[] = [];

console.log('--- First 10 rows ---');
for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  if (!row.dateMov || !row.importance) continue;

  const dateParts = row.dateMov.split(/[\/\-]/);
  if (dateParts.length < 3) continue;
  const m = parseInt(dateParts[0]), d = parseInt(dateParts[1]);
  let y = parseInt(dateParts[2]); if (y < 100) y += 2000;
  const date = new Date(y, m - 1, d, 12, 0, 0);
  const dateStr = date.toISOString().split('T')[0];

  const amount = parseAmount(row.importance);
  const balance = parseAmount(row.balanceStr);

  if (!dateMin || dateStr < dateMin) dateMin = dateStr;
  if (!dateMax || dateStr > dateMax) dateMax = dateStr;
  if (amount < amtMin) amtMin = amount;
  if (amount > amtMax) amtMax = amount;

  if (date.getFullYear() < 2024 || date.getFullYear() > 2026) {
    issues.push(`Row ${i}: WRONG YEAR ${dateStr} | €${amount.toFixed(2)} | ${row.description.substring(0, 30)}`);
  }
  if (m > 12) {
    issues.push(`Row ${i}: MONTH OVERFLOW m=${m} from "${row.dateMov}"`);
  }

  if (i < 10) {
    console.log(`Row ${i}: ${dateStr} | €${amount.toFixed(2)} | bal:€${balance.toFixed(2)} | ${row.description.substring(0, 45)}`);
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`Total rows: ${rows.length}`);
console.log(`Date range: ${dateMin} to ${dateMax}`);
console.log(`Amount range: €${amtMin.toFixed(2)} to €${amtMax.toFixed(2)}`);

const first = rows[0];
const firstParts = first.dateMov.split(/[\/\-]/);
const fm = parseInt(firstParts[0]), fd = parseInt(firstParts[1]);
let fy = parseInt(firstParts[2]); if (fy < 100) fy += 2000;
const firstDateStr = new Date(fy, fm - 1, fd, 12, 0, 0).toISOString().split('T')[0];
const firstAmt = parseAmount(first.importance);
const firstBal = parseAmount(first.balanceStr);
const last = rows[rows.length - 1];
const lastBal = parseAmount(last.balanceStr);

console.log(`\n=== VALIDATION ===`);
console.log(`First date:    ${firstDateStr} (expected: 2024-02-05) ${firstDateStr === '2024-02-05' ? '✅' : '❌'}`);
console.log(`First amount:  €${firstAmt.toFixed(2)} (expected: €50.00) ${Math.abs(firstAmt - 50) < 0.01 ? '✅' : '❌'}`);
console.log(`First balance: €${firstBal.toFixed(2)} (expected: €917.56) ${Math.abs(firstBal - 917.56) < 0.01 ? '✅' : '❌'}`);
console.log(`Last balance:  €${lastBal.toFixed(2)} (expected: €1223.18) ${Math.abs(lastBal - 1223.18) < 0.01 ? '✅' : '❌'}`);

console.log(`\n=== ENCODING ===`);
const dbDesc = 'TRF.DE MARISIA CONCEIÇÃO QUINT';
const xlsDesc = first.description.trim();
console.log(`DB:   "${dbDesc}"`);
console.log(`File: "${xlsDesc}"`);
console.log(`ASCII match: ${stripNonAscii(dbDesc).substring(0,20) === stripNonAscii(xlsDesc).substring(0,20) ? '✅' : '❌'}`);

if (issues.length > 0) {
  console.log(`\n⚠ ISSUES:`);
  issues.forEach(s => console.log(`  ${s}`));
}

const allOk = firstDateStr === '2024-02-05'
  && Math.abs(firstAmt - 50) < 0.01
  && Math.abs(firstBal - 917.56) < 0.01
  && Math.abs(lastBal - 1223.18) < 0.01
  && issues.length === 0;

console.log(allOk ? '\n✅ IMPORT IS CORRECT - SAFE TO USE' : '\n❌ IMPORT HAS ISSUES - REVIEW ABOVE');
