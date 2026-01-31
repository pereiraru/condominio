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
  'Cave -1 (Garagem)': 'CV',
  'Cave -2': 'Garagem',
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

  // Delete existing fee history (will be rebuilt from Excel)
  const deletedFH = await prisma.feeHistory.deleteMany({});
  console.log(`Deleted ${deletedFH.count} existing fee history records`);

  let totalImported = 0;

  // Track expected fees per unit per year for fee history import
  const unitFeesByYear: Record<string, Record<number, number>> = {};

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

    // Find "Valor Esperado" column for fee history
    let valorEsperadoCol = -1;
    for (let c = labelCol + 1; c <= Math.min(range.e.c, labelCol + 30); c++) {
      for (let r = 0; r <= 10; r++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        if (cell && cell.v && cell.v.toString().toLowerCase().includes('valor esperado')) {
          valorEsperadoCol = c;
          break;
        }
      }
      if (valorEsperadoCol >= 0) break;
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

      // Read expected fee for this unit/year
      if (valorEsperadoCol >= 0) {
        const feeCell = sheet[XLSX.utils.encode_cell({ r, c: valorEsperadoCol })];
        if (feeCell) {
          const annualFee = parseAmount(feeCell.v);
          if (annualFee > 0) {
            if (!unitFeesByYear[unitCode]) unitFeesByYear[unitCode] = {};
            unitFeesByYear[unitCode][year] = annualFee / 12;
          }
        }
      }

      // Read monthly values
      for (let m = 0; m < 12; m++) {
        const valCell = sheet[XLSX.utils.encode_cell({ r, c: monthCols[m] })];
        if (!valCell) continue;
        const amount = parseAmount(valCell.v);
        if (amount <= 0) continue;

        const monthStr = `${year}-${(m + 1).toString().padStart(2, '0')}`;
        const date = new Date(year, m, 15); // Mid-month as date

        const tx = await prisma.transaction.create({
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

        // Create TransactionMonth allocation
        await prisma.transactionMonth.create({
          data: {
            transactionId: tx.id,
            month: monthStr,
            amount,
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

        const tx = await prisma.transaction.create({
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

        // Create TransactionMonth allocation
        await prisma.transactionMonth.create({
          data: {
            transactionId: tx.id,
            month: monthStr,
            amount,
          },
        });

        yearImported++;
      }
    }

    totalImported += yearImported;
    console.log(`  ${year}: ${yearImported} transactions imported`);
  }

  console.log(`\nTotal historical transactions imported: ${totalImported}`);

  // === Phase 3: Import fee history from Excel ===
  console.log('\n=== Importing fee history ===');

  for (const unitCode of Object.keys(unitFeesByYear)) {
    const unitId = unitCodeToId[unitCode];
    if (!unitId) continue;

    const yearFees = unitFeesByYear[unitCode];
    const sortedYears = Object.keys(yearFees).map(Number).sort();

    if (sortedYears.length === 0) continue;

    let previousFee: number | null = null;
    let currentFrom: string | null = null;

    for (const year of sortedYears) {
      const monthlyFee = Math.round(yearFees[year] * 100) / 100; // round to cents

      if (previousFee === null) {
        // First record
        currentFrom = `${year}-01`;
        previousFee = monthlyFee;
      } else if (Math.abs(monthlyFee - previousFee) > 0.01) {
        // Fee changed - save previous period and start new one
        await prisma.feeHistory.create({
          data: {
            unitId,
            amount: previousFee,
            effectiveFrom: currentFrom!,
            effectiveTo: `${year - 1}-12`,
          },
        });
        console.log(`  ${unitCode}: ${previousFee}/mo from ${currentFrom} to ${year - 1}-12`);

        currentFrom = `${year}-01`;
        previousFee = monthlyFee;
      }
    }

    // Save the last (ongoing) period
    if (previousFee !== null && currentFrom !== null) {
      await prisma.feeHistory.create({
        data: {
          unitId,
          amount: previousFee,
          effectiveFrom: currentFrom,
          effectiveTo: null, // ongoing
        },
      });
      console.log(`  ${unitCode}: ${previousFee}/mo from ${currentFrom} (ongoing)`);
    }
  }

  // For units not found in Excel fee data, create a default fee history from 2011
  for (const unit of units) {
    if (!unitFeesByYear[unit.code]) {
      await prisma.feeHistory.create({
        data: {
          unitId: unit.id,
          amount: unit.monthlyFee,
          effectiveFrom: '2011-01',
          effectiveTo: null,
        },
      });
      console.log(`  ${unit.code}: ${unit.monthlyFee}/mo from 2011-01 (default, ongoing)`);
    }
  }

  // Summary
  const txCount = await prisma.transaction.count();
  const tmCount = await prisma.transactionMonth.count();
  const fhCount = await prisma.feeHistory.count();
  console.log(`\nTotal transactions in database: ${txCount}`);
  console.log(`Total transaction month allocations: ${tmCount}`);
  console.log(`Total fee history records: ${fhCount}`);
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
