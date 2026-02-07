import * as XLSX from 'xlsx';

const wb = XLSX.readFile('data/extrato.xlsx');
const ws = wb.Sheets['Sheet1'];
const data = XLSX.utils.sheet_to_json(ws);

function excelDate(serial: any): string {
  if (typeof serial === 'string') return serial;
  const d = new Date((serial - 25569) * 86400 * 1000);
  return d.toISOString().split('T')[0];
}

// Date range
const dates = data.map((r: any) => r['Data Mov.']).filter((d: any) => typeof d === 'number').sort((a: number, b: number) => a - b);
console.log('Date range:', excelDate(dates[0]), 'to', excelDate(dates[dates.length - 1]));
console.log('Total rows:', data.length);

// Count by Andar
const byAndar: Record<string, number> = {};
data.forEach((r: any) => {
  const a = r['Andar'] || 'N/A';
  byAndar[a] = (byAndar[a] || 0) + 1;
});
console.log('\nTransactions by Andar:');
Object.entries(byAndar).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

// Sum amounts
let totalIncome = 0, totalExpense = 0;
data.forEach((r: any) => {
  const amt = typeof r['Importância'] === 'number' ? r['Importância'] : parseFloat(String(r['Importância']).replace(/\./g, '').replace(',', '.'));
  if (!isNaN(amt)) {
    if (amt > 0) totalIncome += amt;
    else totalExpense += amt;
  }
});
console.log('\nTotal income:', totalIncome.toFixed(2));
console.log('Total expense:', totalExpense.toFixed(2));
console.log('Net:', (totalIncome + totalExpense).toFixed(2));

// Unique Andar values
console.log('\nUnique Andar values:', Object.keys(byAndar).sort().join(', '));

// Sample transactions per Andar
console.log('\nSample transactions per Andar:');
const shown: Record<string, boolean> = {};
data.forEach((r: any) => {
  const a = r['Andar'] || 'N/A';
  if (!shown[a]) {
    shown[a] = true;
    console.log(`  [${a}] ${excelDate(r['Data Mov.'])} | ${r['Descrição']} | ${r['Importância']}`);
  }
});

// Show amounts by year-month
console.log('\n\nMonthly summary:');
const monthly: Record<string, { income: number; expense: number; count: number }> = {};
data.forEach((r: any) => {
  const date = excelDate(r['Data Mov.']);
  const ym = date.substring(0, 7);
  if (!monthly[ym]) monthly[ym] = { income: 0, expense: 0, count: 0 };
  const amt = typeof r['Importância'] === 'number' ? r['Importância'] : parseFloat(String(r['Importância']).replace(/\./g, '').replace(',', '.'));
  if (!isNaN(amt)) {
    monthly[ym].count++;
    if (amt > 0) monthly[ym].income += amt;
    else monthly[ym].expense += amt;
  }
});
Object.entries(monthly).sort().forEach(([ym, v]) => {
  console.log(`  ${ym}: ${v.count} txns | income: ${v.income.toFixed(2)} | expense: ${v.expense.toFixed(2)} | net: ${(v.income + v.expense).toFixed(2)}`);
});
