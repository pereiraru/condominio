const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

// ==================== PART 1: import-full ====================

const UNIT_CODES = ['1D', '1E', '2D', '2E', '3D', '3E', '4D', '4E', '5D', '5E', '6D', '6E', 'RCD', 'RCE', 'CV', 'Garagem'];

const FEE_SCHEDULE = {
  '1D': { before: 37.5, after: 45, changeMonth: '2024-06' },
  '1E': { before: 37.5, after: 45, changeMonth: '2024-06' },
  '2D': { before: 37.5, after: 45, changeMonth: '2024-06' },
  '2E': { before: 37.5, after: 45, changeMonth: '2024-06' },
  '3D': { before: 37.5, after: 45, changeMonth: '2024-06' },
  '3E': { before: 37.5, after: 45, changeMonth: '2024-06' },
  '4D': { before: 37.5, after: 45, changeMonth: '2024-06' },
  '4E': { before: 37.5, after: 45, changeMonth: '2024-06' },
  '5D': { before: 37.5, after: 45, changeMonth: '2024-06' },
  '5E': { before: 37.5, after: 45, changeMonth: '2024-06' },
  '6D': { before: 37.5, after: 45, changeMonth: '2024-06' },
  '6E': { before: 37.5, after: 45, changeMonth: '2024-06' },
  'CV': { before: 37.5, after: 45, changeMonth: '2024-06' },
  'Garagem': { before: 37.5, after: 45, changeMonth: '2024-06' },
  'RCD': { before: 17.5, after: 20, changeMonth: '2024-05' },
  'RCE': { before: 50, after: 50, changeMonth: '2024-06' },
};

const CREDITOR_MAP = {
  'Luz': { name: 'Endesa Energia', category: 'electricity', amountDue: 150 },
  'Elevadores': { name: 'Otis Elevadores', category: 'elevator', amountDue: 219 },
  'P. Serviços': { name: 'Pagamentos Serviços', category: 'other', amountDue: null },
  'Bomba Agua': { name: 'Jose Nicole, LDA', category: 'maintenance', amountDue: null },
  'Electrecista': { name: 'Fabio Henrique Peixoto', category: 'maintenance', amountDue: null },
  'Gestao Conta': { name: 'Despesas Bancárias', category: 'bank_fee', amountDue: 9 },
  'Conta Poupança': { name: 'Conta Poupança', category: 'other', amountDue: 60 },
  'pagamento': { name: 'JCSS Unipessoal', category: 'other', amountDue: null },
  'Outos pagamentos': { name: 'Outros Pagamentos', category: 'other', amountDue: null },
  'Levantamento': { name: 'Levantamentos ATM', category: 'other', amountDue: null },
};

// ==================== PART 2: import-historical ====================

const UNIT_NAME_TO_CODE = {
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

const EXPENSE_TO_CREDITOR = {
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

const YEAR_SHEETS = [
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

// ==================== Helpers ====================

function parseAmount(value) {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  const cleaned = value.toString().replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseExcelDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    return new Date((value - 25569) * 86400 * 1000);
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function dateToMonth(date) {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
}

function getFeeForMonthCode(unitCode, month) {
  const schedule = FEE_SCHEDULE[unitCode];
  if (!schedule) return 45;
  return month < schedule.changeMonth ? schedule.before : schedule.after;
}

function nextMonth(month) {
  const [year, m] = month.split('-').map(Number);
  if (m === 12) return `${year + 1}-01`;
  return `${year}-${(m + 1).toString().padStart(2, '0')}`;
}

function getCategoryForExpense(label) {
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

function extractPersonName(transferDesc) {
  let name = transferDesc
    .replace(/^TR-IPS-/i, '')
    .replace(/^TR-/i, '')
    .replace(/^TRF\.DE\s+/i, '')
    .replace(/^TRF\.CRED\s+/i, '')
    .replace(/^TRF\.\s*/i, '')
    .replace(/^TRF\.IPS\s+P\/\s*/i, '')
    .replace(/^TRF\.P\/\s*/i, '')
    .trim();

  if (!name || name.includes('ENDESA') || name.includes('OTIS') ||
      name.includes('EMISSÃO') || name.includes('SELO') ||
      name.includes('COMISS') || name.includes('SOLUÇÃO') ||
      name.includes('PAG.SERV') || name.includes('LEV.ATM') ||
      name.includes('DP NR')) {
    return null;
  }

  return name.split(' ').map(w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ');
}

// ==================== Main ====================

async function importData() {
  // Check if data already exists
  const existingUnits = await prisma.unit.count();
  const existingTx = await prisma.transaction.count();
  if (existingUnits > 0 && existingTx > 0) {
    console.log(`Database already has ${existingUnits} units and ${existingTx} transactions. Skipping import.`);
    return;
  }

  const xlsmPath = path.join(process.cwd(), 'contas predio.xlsm');
  const xlsxPath = path.join(process.cwd(), 'Condominio Actual 2023.xlsx');

  if (!fs.existsSync(xlsmPath)) {
    console.log(`Excel file not found: ${xlsmPath} - skipping import`);
    return;
  }

  console.log('=== STEP 1: Import Full (2024 data) ===\n');
  await runImportFull(xlsmPath);

  console.log('\n\n=== STEP 2: Fix CV/Garagem units ===\n');
  await fixCVGaragem();

  if (fs.existsSync(xlsxPath)) {
    console.log('\n\n=== STEP 3: Import Historical (2011-2023) ===\n');
    await runImportHistorical(xlsxPath);

    console.log('\n\n=== STEP 4: Fix fee history for 2024+ ===\n');
    await fixFeeHistory2024();
  } else {
    console.log(`\nHistorical Excel not found: ${xlsxPath} - skipping historical import`);
  }

  console.log('\n\n=== STEP 5: Create TransactionMonth for 2024 data ===\n');
  await createTransactionMonths2024();

  // Final summary
  const unitCount = await prisma.unit.count();
  const creditorCount = await prisma.creditor.count();
  const txCount = await prisma.transaction.count();
  const tmCount = await prisma.transactionMonth.count();
  const fhCount = await prisma.feeHistory.count();
  console.log('\n=== Final Summary ===');
  console.log(`Units: ${unitCount}`);
  console.log(`Creditors: ${creditorCount}`);
  console.log(`Transactions: ${txCount}`);
  console.log(`TransactionMonth: ${tmCount}`);
  console.log(`FeeHistory: ${fhCount}`);
}

async function runImportFull(excelPath) {
  console.log(`Reading: ${excelPath}`);
  const workbook = XLSX.readFile(excelPath);

  // Clear existing data
  console.log('Clearing existing data...');
  await prisma.transactionMonth.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.feeHistory.deleteMany();
  await prisma.owner.deleteMany();
  await prisma.creditorAttachment.deleteMany();
  await prisma.creditor.deleteMany();
  await prisma.unit.deleteMany();

  // 1. Create Units
  console.log('\n--- Creating Units ---');
  const unitMap = {};

  for (const code of UNIT_CODES) {
    const schedule = FEE_SCHEDULE[code];
    const floorMatch = code.match(/^(\d+)/);
    const floor = floorMatch ? parseInt(floorMatch[1]) : (code === 'RCD' || code === 'RCE' ? 0 : code === 'CV' || code === 'Garagem' ? -1 : null);

    const unit = await prisma.unit.create({
      data: {
        code,
        floor,
        monthlyFee: schedule.after,
      },
    });
    unitMap[code] = unit.id;

    await prisma.feeHistory.create({
      data: {
        unitId: unit.id,
        amount: schedule.before,
        effectiveFrom: '2024-01',
      },
    });

    if (schedule.before !== schedule.after) {
      await prisma.feeHistory.create({
        data: {
          unitId: unit.id,
          amount: schedule.after,
          effectiveFrom: schedule.changeMonth,
        },
      });
    }

    console.log(`  Unit ${code}: ${schedule.before} -> ${schedule.after} (from ${schedule.changeMonth})`);
  }

  // 2. Create Owners
  console.log('\n--- Creating Owners ---');
  const mappingSheet = workbook.Sheets['Mapping'];
  const mappingData = XLSX.utils.sheet_to_json(mappingSheet);
  const nameToUnit = {};

  for (const row of mappingData) {
    const name = (row.Nome || '').trim();
    const andar = (row.Andar || '').trim();
    if (!name || !andar) continue;

    if (UNIT_CODES.includes(andar)) {
      nameToUnit[name.toUpperCase()] = andar;
      const personName = extractPersonName(name);
      if (personName && unitMap[andar]) {
        await prisma.owner.create({
          data: { name: personName, unitId: unitMap[andar] },
        });
        console.log(`  ${personName} -> ${andar}`);
      }
    } else {
      nameToUnit[name.toUpperCase()] = andar;
    }
  }

  // 3. Create Creditors
  console.log('\n--- Creating Creditors ---');
  const creditorMap = {};

  for (const [key, info] of Object.entries(CREDITOR_MAP)) {
    const creditor = await prisma.creditor.create({
      data: {
        name: info.name,
        category: info.category,
        amountDue: info.amountDue,
      },
    });
    creditorMap[key] = creditor.id;

    if (info.amountDue) {
      await prisma.feeHistory.create({
        data: {
          creditorId: creditor.id,
          amount: info.amountDue,
          effectiveFrom: '2024-01',
        },
      });
    }
    console.log(`  ${info.name} (${info.category}) - ${info.amountDue ?? 'variable'} EUR/month`);
  }

  // 4. Import Transactions
  console.log('\n--- Importing Transactions ---');
  const txSheet = workbook.Sheets['Fy24-25'];
  const txData = XLSX.utils.sheet_to_json(txSheet);
  const allTxs = [];

  for (const row of txData) {
    const date = parseExcelDate(row['Data Mov.']);
    if (!date) continue;
    const valueDate = parseExcelDate(row['Data Valor']);
    const description = (row['Descrição'] || '').trim();
    const amount = parseAmount(row['Importância']);
    const balanceRaw = row['Saldo Cont.'];
    const balance = balanceRaw ? parseAmount(balanceRaw) : null;
    const andar = (row['Andar'] || '').trim();
    if (!description) continue;
    allTxs.push({ date, valueDate, description, amount, balance, andar });
  }

  allTxs.sort((a, b) => a.date.getTime() - b.date.getTime());

  const unitPaidMonths = {};
  for (const code of UNIT_CODES) {
    unitPaidMonths[code] = new Set();
  }

  let imported = 0;

  for (const tx of allTxs) {
    if (UNIT_CODES.includes(tx.andar) && tx.amount > 0) {
      const unitCode = tx.andar;
      const unitId = unitMap[unitCode];
      if (!unitId) continue;

      const txMonth = dateToMonth(tx.date);
      const fee = getFeeForMonthCode(unitCode, txMonth);

      if (fee <= 0) {
        await prisma.transaction.create({
          data: { date: tx.date, valueDate: tx.valueDate, description: tx.description, amount: tx.amount, balance: tx.balance, type: 'payment', category: 'monthly_fee', referenceMonth: txMonth, unitId },
        });
        imported++;
        continue;
      }

      let remaining = tx.amount;
      let targetMonth = '2024-01';
      while (unitPaidMonths[unitCode].has(targetMonth) && targetMonth <= txMonth) {
        targetMonth = nextMonth(targetMonth);
      }

      let isFirst = true;
      while (remaining >= fee * 0.9) {
        const monthFee = getFeeForMonthCode(unitCode, targetMonth);
        if (remaining < monthFee * 0.9) break;
        const payAmount = Math.min(remaining, monthFee);

        await prisma.transaction.create({
          data: {
            date: tx.date, valueDate: tx.valueDate,
            description: tx.description + (isFirst ? '' : ` (ref. ${targetMonth})`),
            amount: payAmount, balance: isFirst ? tx.balance : null,
            type: 'payment', category: 'monthly_fee', referenceMonth: targetMonth, unitId,
          },
        });

        unitPaidMonths[unitCode].add(targetMonth);
        remaining -= monthFee;
        targetMonth = nextMonth(targetMonth);
        isFirst = false;
        imported++;
      }

      if (remaining > 0.01 && isFirst) {
        await prisma.transaction.create({
          data: { date: tx.date, valueDate: tx.valueDate, description: tx.description, amount: tx.amount, balance: tx.balance, type: 'payment', category: 'monthly_fee', referenceMonth: txMonth, unitId },
        });
        imported++;
      }
    } else {
      const txMonth = dateToMonth(tx.date);
      let unitId = null;
      let creditorId = null;
      let type = tx.amount >= 0 ? 'payment' : 'expense';
      let category = null;

      if (UNIT_CODES.includes(tx.andar)) {
        unitId = unitMap[tx.andar] || null;
        type = 'payment';
        category = 'monthly_fee';
      } else if (creditorMap[tx.andar]) {
        creditorId = creditorMap[tx.andar];
        const creditorInfo = CREDITOR_MAP[tx.andar];
        category = creditorInfo?.category || 'other';
        if (tx.andar === 'Gestao Conta') type = 'fee';
        else if (tx.andar === 'Conta Poupança') type = 'transfer';
        else if (tx.andar === 'Levantamento') type = 'transfer';
      }

      await prisma.transaction.create({
        data: { date: tx.date, valueDate: tx.valueDate, description: tx.description, amount: tx.amount, balance: tx.balance, type, category, referenceMonth: txMonth, unitId, creditorId },
      });
      imported++;
    }
  }

  console.log(`Imported ${imported} transactions`);
}

async function fixCVGaragem() {
  const cv = await prisma.unit.findFirst({ where: { code: 'CV' } });
  if (cv) {
    await prisma.unit.update({ where: { id: cv.id }, data: { floor: -1, description: 'Cave -1 (Garagem)' } });
    console.log('Updated CV: floor=-1, description=Cave -1 (Garagem)');
  }
  const garagem = await prisma.unit.findFirst({ where: { code: 'Garagem' } });
  if (garagem) {
    await prisma.unit.update({ where: { id: garagem.id }, data: { floor: -2, description: 'Cave -2' } });
    console.log('Updated Garagem: floor=-2, description=Cave -2');
  }
}

async function runImportHistorical(excelPath) {
  console.log(`Reading: ${excelPath}`);
  const workbook = XLSX.readFile(excelPath);

  const units = await prisma.unit.findMany();
  const unitCodeToId = {};
  units.forEach((u) => { unitCodeToId[u.code] = u.id; });

  const creditors = await prisma.creditor.findMany();
  const creditorNameToId = {};
  creditors.forEach((c) => { creditorNameToId[c.name] = c.id; });

  // Delete existing pre-2024 transactions
  const deleted = await prisma.transaction.deleteMany({
    where: { referenceMonth: { lt: '2024-01' } },
  });
  console.log(`Deleted ${deleted.count} existing pre-2024 transactions`);

  // Delete existing fee history (will be rebuilt)
  const deletedFH = await prisma.feeHistory.deleteMany({});
  console.log(`Deleted ${deletedFH.count} existing fee history records`);

  let totalImported = 0;
  const unitFeesByYear = {};

  for (const { name, year } of YEAR_SHEETS) {
    const sheet = workbook.Sheets[name];
    if (!sheet) {
      console.log(`  ${name}: NOT FOUND, skipping`);
      continue;
    }

    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

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

    const monthCols = [];
    for (let m = 0; m < 12; m++) {
      monthCols.push(labelCol + 1 + m * 2);
    }

    // Find "Valor Esperado" column
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

    // Process unit rows
    for (let r = 0; r <= Math.min(range.e.r, 30); r++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c: labelCol })];
      if (!cell) continue;
      const label = cell.v.toString().trim();
      const unitCode = UNIT_NAME_TO_CODE[label];
      if (!unitCode) continue;
      const unitId = unitCodeToId[unitCode];
      if (!unitId) continue;

      // Read expected fee
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

      for (let m = 0; m < 12; m++) {
        const valCell = sheet[XLSX.utils.encode_cell({ r, c: monthCols[m] })];
        if (!valCell) continue;
        const amount = parseAmount(valCell.v);
        if (amount <= 0) continue;

        const monthStr = `${year}-${(m + 1).toString().padStart(2, '0')}`;
        const date = new Date(year, m, 15);

        const tx = await prisma.transaction.create({
          data: { date, description: `Pagamento ${unitCode} - ${monthStr}`, amount, type: 'payment', category: 'monthly_fee', referenceMonth: monthStr, unitId },
        });
        await prisma.transactionMonth.create({
          data: { transactionId: tx.id, month: monthStr, amount },
        });
        yearImported++;
      }
    }

    // Process expense rows
    let inExpenses = false;
    for (let r = 0; r <= Math.min(range.e.r, 55); r++) {
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

      for (let m = 0; m < 12; m++) {
        const valCell = sheet[XLSX.utils.encode_cell({ r, c: monthCols[m] })];
        if (!valCell) continue;
        const amount = parseAmount(valCell.v);
        if (amount <= 0) continue;

        const monthStr = `${year}-${(m + 1).toString().padStart(2, '0')}`;
        const date = new Date(year, m, 15);

        const tx = await prisma.transaction.create({
          data: { date, description: label, amount: -amount, type: 'expense', category: getCategoryForExpense(label), referenceMonth: monthStr, creditorId },
        });
        await prisma.transactionMonth.create({
          data: { transactionId: tx.id, month: monthStr, amount },
        });
        yearImported++;
      }
    }

    totalImported += yearImported;
    console.log(`  ${year}: ${yearImported} transactions imported`);
  }

  console.log(`\nTotal historical: ${totalImported}`);

  // Import fee history from collected data
  console.log('\n--- Fee History ---');
  for (const unitCode of Object.keys(unitFeesByYear)) {
    const unitId = unitCodeToId[unitCode];
    if (!unitId) continue;
    const yearFees = unitFeesByYear[unitCode];
    const sortedYears = Object.keys(yearFees).map(Number).sort();
    if (sortedYears.length === 0) continue;

    let previousFee = null;
    let currentFrom = null;

    for (const year of sortedYears) {
      const monthlyFee = Math.round(yearFees[year] * 100) / 100;
      if (previousFee === null) {
        currentFrom = `${year}-01`;
        previousFee = monthlyFee;
      } else if (Math.abs(monthlyFee - previousFee) > 0.01) {
        await prisma.feeHistory.create({
          data: { unitId, amount: previousFee, effectiveFrom: currentFrom, effectiveTo: `${year - 1}-12` },
        });
        console.log(`  ${unitCode}: ${previousFee}/mo from ${currentFrom} to ${year - 1}-12`);
        currentFrom = `${year}-01`;
        previousFee = monthlyFee;
      }
    }

    if (previousFee !== null && currentFrom !== null) {
      await prisma.feeHistory.create({
        data: { unitId, amount: previousFee, effectiveFrom: currentFrom, effectiveTo: null },
      });
      console.log(`  ${unitCode}: ${previousFee}/mo from ${currentFrom} (ongoing)`);
    }
  }

  // Default fee history for units not in Excel
  for (const unit of units) {
    if (!unitFeesByYear[unit.code]) {
      await prisma.feeHistory.create({
        data: { unitId: unit.id, amount: unit.monthlyFee, effectiveFrom: '2011-01', effectiveTo: null },
      });
      console.log(`  ${unit.code}: ${unit.monthlyFee}/mo from 2011-01 (default)`);
    }
  }
}

async function fixFeeHistory2024() {
  // End historical ongoing records at 2023-12
  const ongoingFees = await prisma.feeHistory.findMany({ where: { effectiveTo: null } });
  for (const fh of ongoingFees) {
    await prisma.feeHistory.update({
      where: { id: fh.id },
      data: { effectiveTo: '2023-12' },
    });
  }
  console.log(`Ended ${ongoingFees.length} ongoing historical fee records at 2023-12`);

  // Add 2024+ fee history
  const units = await prisma.unit.findMany();
  for (const unit of units) {
    const schedule = FEE_SCHEDULE[unit.code];
    if (!schedule) continue;

    await prisma.feeHistory.create({
      data: { unitId: unit.id, amount: schedule.before, effectiveFrom: '2024-01',
        effectiveTo: schedule.before !== schedule.after ? (() => {
          const [y, mo] = schedule.changeMonth.split('-');
          const prevMo = parseInt(mo) - 1;
          return prevMo > 0 ? `${y}-${prevMo.toString().padStart(2, '0')}` : `${parseInt(y) - 1}-12`;
        })() : null,
      },
    });

    if (schedule.before !== schedule.after) {
      await prisma.feeHistory.create({
        data: { unitId: unit.id, amount: schedule.after, effectiveFrom: schedule.changeMonth, effectiveTo: null },
      });
    }
    console.log(`  ${unit.code}: ${schedule.before} -> ${schedule.after}`);
  }
}

async function createTransactionMonths2024() {
  // Payment transactions
  const payTxs = await prisma.transaction.findMany({
    where: { referenceMonth: { gte: '2024-01' }, type: 'payment', unitId: { not: null } },
    include: { monthAllocations: true },
  });
  let created = 0;
  for (const tx of payTxs) {
    if (tx.monthAllocations.length === 0 && tx.referenceMonth) {
      await prisma.transactionMonth.create({
        data: { transactionId: tx.id, month: tx.referenceMonth, amount: Math.abs(tx.amount) },
      });
      created++;
    }
  }
  console.log(`Created ${created} TransactionMonth for 2024 payments`);

  // Expense transactions
  const expTxs = await prisma.transaction.findMany({
    where: { referenceMonth: { gte: '2024-01' }, type: 'expense' },
    include: { monthAllocations: true },
  });
  let createdExp = 0;
  for (const tx of expTxs) {
    if (tx.monthAllocations.length === 0 && tx.referenceMonth) {
      await prisma.transactionMonth.create({
        data: { transactionId: tx.id, month: tx.referenceMonth, amount: Math.abs(tx.amount) },
      });
      createdExp++;
    }
  }
  console.log(`Created ${createdExp} TransactionMonth for 2024 expenses`);
}

importData()
  .catch((e) => {
    console.error('Import error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
