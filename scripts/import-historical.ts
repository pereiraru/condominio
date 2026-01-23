import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

// Unit name to code mapping
const UNIT_NAME_TO_CODE: Record<string, string> = {
  '6ºAndar Direito': '6D',
  '6ºAndar Esquerdo': '6E',
  '5ºAndar Direito': '5D',
  '5 Andar Esquerdo': '5E',
  '4ºAndar Direito': '4D',
  '4ºAndar Esquerdo': '4E',
  '3ºAndar Direito': '3D',
  '3ºAndar Esquerdo': '3E',
  '2ºAndar Direito': '2D',
  '2ºAndar Esquerdo': '2E',
  '1ºAndar Direito': '1D',
  '1ºAndar Esquerdo': '1E',
  'Res-Chão Direito': 'RCD',
  'Res-Chão Esquerdo': 'RCE',
  'Cave -1 (Garagem)': 'Garagem',
  'Cave -2': 'CV',
};

// Expense category to creditor name mapping
const EXPENSE_TO_CREDITOR: Record<string, string> = {
  'Electricidade': 'Endesa Energia',
  'Elevadores': 'Otis Elevadores',
  'Reparação Extra Elevadores': 'Otis Elevadores',
  'Limpeza Escadas': 'Pagamentos Serviços',
  'Despesas Bancárias': 'Despesas Bancárias',
  'Depósitos Prazo  Poupança': 'Conta Poupança',
  'Depósitos Prazo Poupança': 'Conta Poupança',
  'Manutenção Central Bombagem': 'Jose Nicole, LDA',
  'Manutenção Bombas Água': 'Jose Nicole, LDA',
  'Manutenção Extintores': 'Pagamentos Serviços',
  'Inspecção Elevadores': 'Otis Elevadores',
  'Inspecção  Elevadores': 'Otis Elevadores',
  'Manutenção Geral Edificio': 'Pagamentos Serviços',
  'Curva Agua': 'Jose Nicole, LDA',
};

// Sheets to process (2011-2023, skip 2024 since we have bank data)
const YEAR_SHEETS: { name: string; year: number }[] = [
  { name: 'Receita Despesas 2011 ', year: 2011 },
  { name: 'Receitas Despesas 2012', year: 2012 },
  { name: 'Receitas Despesas 2013', year: 2013 },
  { name: 'Receitas Despesas 2014', year: 2014 },
  { name: 'Receitas Despesas 2015', year: 2015 },
  { name: 'Receitas Despesas 2016', year: 2016 },
  { name: 'Receita Despesas 2017', year: 2017 },
  { name: 'Receita Despesas 2018', year: 2018 },
  { name: 'Receita Despesas 2019', year: 2019 },
  { name: 'Receita Despesa 2020', year: 2020 },
  { name: 'Receita Despesas 2021', year: 2021 },
  { name: 'Receita Despesas 2022', year: 2022 },
  { name: 'Receitas Despesas 2023', year: 2023 },
];

async function importHistorical() {
  const excelPath = path.join(process.cwd(), 'Condominio Actual 2023.xlsx');
  console.log(`Reading: ${excelPath}`);
  const workbook = XLSX.readFile(excelPath);

  // Load existing units and creditors
  const units = await prisma.unit.findMany();
  const unitCodeToId: Record<string, string> = {};
  units.forEach((u) => { unitCodeToId[u.code] = u.id; });

  const creditors = await prisma.creditor.findMany();
  const creditorNameToId: Record<string, string> = {};
  creditors.forEach((c) => { creditorNameToId[c.name] = c.id; });

  // Delete existing historical transactions (before 2024)
  const deleted = await prisma.transaction.deleteMany({
    where: {
      referenceMonth: { lt: '2024-01' },
    },
  });
  console.log(`Deleted ${deleted.count} existing pre-2024 transactions`);

  // Update fee history to start from 2011
  await prisma.feeHistory.updateMany({
    where: { effectiveFrom: '2024-01' },
    data: { effectiveFrom: '2011-01' },
  });
  console.log('Updated fee history effectiveFrom to 2011-01');

  let totalImported = 0;

  for (const { name, year } of YEAR_SHEETS) {
    const sheet = workbook.Sheets[name];
    if (!sheet) {
      console.log(`  ${name}: NOT FOUND, skipping`);
      continue;
    }

    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

    // Find label column (column containing '6ºAndar Direito')
    let labelCol = -1;
    for (let r = 0; r <= 10; r++) {
      for (let c = 0; c <= 5; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        if (cell && cell.v && cell.v.toString().includes('6ºAndar')) {
          labelCol = c;
          break;
        }
      }
      if (labelCol >= 0) break;
    }

    if (labelCol < 0) {
      console.log(`  ${year}: Could not find label column, skipping`);
      continue;
    }

    // Month columns: every other column starting from labelCol + 1
    const monthCols: number[] = [];
    for (let m = 0; m < 12; m++) {
      monthCols.push(labelCol + 1 + m * 2);
    }

    let yearImported = 0;

    // Process unit rows (scan for known unit labels)
    for (let r = 0; r <= Math.min(range.e.r, 30); r++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c: labelCol })];
      if (!cell) continue;
      const label = cell.v.toString().trim();
      const unitCode = UNIT_NAME_TO_CODE[label];
      if (!unitCode) continue;

      const unitId = unitCodeToId[unitCode];
      if (!unitId) continue;

      // Read monthly values
      for (let m = 0; m < 12; m++) {
        const valCell = sheet[XLSX.utils.encode_cell({ r, c: monthCols[m] })];
        if (!valCell) continue;
        const amount = parseAmount(valCell.v);
        if (amount <= 0) continue;

        const monthStr = `${year}-${(m + 1).toString().padStart(2, '0')}`;
        const date = new Date(year, m, 15); // Mid-month as date

        await prisma.transaction.create({
          data: {
            date,
            description: `Pagamento ${unitCode} - ${monthStr}`,
            amount,
            type: 'payment',
            category: 'monthly_fee',
            referenceMonth: monthStr,
            unitId,
          },
        });
        yearImported++;
      }
    }

    // Process expense rows (scan for known expense labels after DESPESAS)
    let inExpenses = false;
    for (let r = 0; r <= Math.min(range.e.r, 55); r++) {
      // Check for DESPESAS marker
      for (let c = 0; c <= 2; c++) {
        const markerCell = sheet[XLSX.utils.encode_cell({ r, c })];
        if (markerCell && markerCell.v && markerCell.v.toString().trim().toUpperCase() === 'DESPESAS') {
          inExpenses = true;
        }
      }
      if (!inExpenses) continue;

      const cell = sheet[XLSX.utils.encode_cell({ r, c: labelCol })];
      if (!cell) continue;
      const label = cell.v.toString().trim();
      if (label === 'Despesas' || label.startsWith('Total')) continue;

      const creditorName = EXPENSE_TO_CREDITOR[label];
      const creditorId = creditorName ? creditorNameToId[creditorName] : null;

      // Read monthly values
      for (let m = 0; m < 12; m++) {
        const valCell = sheet[XLSX.utils.encode_cell({ r, c: monthCols[m] })];
        if (!valCell) continue;
        const amount = parseAmount(valCell.v);
        if (amount <= 0) continue;

        const monthStr = `${year}-${(m + 1).toString().padStart(2, '0')}`;
        const date = new Date(year, m, 15);

        await prisma.transaction.create({
          data: {
            date,
            description: label,
            amount: -amount, // Expenses are negative
            type: 'expense',
            category: getCategoryForExpense(label),
            referenceMonth: monthStr,
            creditorId,
          },
        });
        yearImported++;
      }
    }

    totalImported += yearImported;
    console.log(`  ${year}: ${yearImported} transactions imported`);
  }

  console.log(`\nTotal historical transactions imported: ${totalImported}`);

  // Summary
  const txCount = await prisma.transaction.count();
  console.log(`Total transactions in database: ${txCount}`);
}

function parseAmount(value: unknown): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  const cleaned = value.toString().replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function getCategoryForExpense(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('electric')) return 'electricity';
  if (l.includes('elevador')) return 'elevator';
  if (l.includes('limpeza')) return 'cleaning';
  if (l.includes('bancári') || l.includes('bancaria')) return 'bank_fee';
  if (l.includes('bombag') || l.includes('bombas') || l.includes('agua') || l.includes('curva')) return 'maintenance';
  if (l.includes('extinto')) return 'maintenance';
  if (l.includes('depósit') || l.includes('poupança')) return 'savings';
  if (l.includes('inspec')) return 'elevator';
  if (l.includes('manutenção geral')) return 'maintenance';
  return 'other';
}

importHistorical()
  .catch((e) => {
    console.error('Import error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
