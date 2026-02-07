import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

// Unit codes that are actual apartments
const UNIT_CODES = ['1D', '1E', '2D', '2E', '3D', '3E', '4D', '4E', '5D', '5E', '6D', '6E', 'RCD', 'RCE', 'CV', 'Garagem'];

// Fee structure: { unitCode: { effectiveFrom: amount } }
const FEE_SCHEDULE: Record<string, { before: number; after: number; changeMonth: string }> = {
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
  'RCE': { before: 50, after: 50, changeMonth: '2024-06' }, // No change
};

// Creditor category mapping from Andar values
const CREDITOR_MAP: Record<string, { name: string; category: string; amountDue: number | null }> = {
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

function parseAmount(value: number | string | undefined): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  // Handle Portuguese format: "1.234,56" or "-155,18"
  const cleaned = value.toString().replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function parseExcelDate(value: Date | string | number | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    return new Date((value - 25569) * 86400 * 1000);
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function dateToMonth(date: Date): string {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
}

function getFeeForMonth(unitCode: string, month: string): number {
  const schedule = FEE_SCHEDULE[unitCode];
  if (!schedule) return 45;
  return month < schedule.changeMonth ? schedule.before : schedule.after;
}

function nextMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  if (m === 12) return `${year + 1}-01`;
  return `${year}-${(m + 1).toString().padStart(2, '0')}`;
}

async function importFull() {
  const excelPath = path.join(process.cwd(), 'data', 'contas predio.xlsm');
  console.log(`Reading Excel file: ${excelPath}`);
  const workbook = XLSX.readFile(excelPath);

  // Clear existing data
  console.log('Clearing existing data...');
  await prisma.transaction.deleteMany();
  await prisma.feeHistory.deleteMany();
  await prisma.owner.deleteMany();
  await prisma.creditorAttachment.deleteMany();
  await prisma.creditor.deleteMany();
  await prisma.unit.deleteMany();

  // 1. Create Units with fee history
  console.log('\n--- Creating Units ---');
  const unitMap: Record<string, string> = {}; // code -> id

  for (const code of UNIT_CODES) {
    const schedule = FEE_SCHEDULE[code];
    const floorMatch = code.match(/^(\d+)/);
    const floor = floorMatch ? parseInt(floorMatch[1]) : (code === 'RCD' || code === 'RCE' ? 0 : code === 'CV' || code === 'Garagem' ? -1 : null);

    const unit = await prisma.unit.create({
      data: {
        code,
        floor,
        monthlyFee: schedule.after, // Current fee
      },
    });
    unitMap[code] = unit.id;

    // Create fee history records
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

    console.log(`  Unit ${code}: ${schedule.before} → ${schedule.after} (from ${schedule.changeMonth})`);
  }

  // 2. Create Owners from Mapping tab
  console.log('\n--- Creating Owners ---');
  const mappingSheet = workbook.Sheets['Mapping'];
  const mappingData = XLSX.utils.sheet_to_json<{ Nome: string; Andar: string }>(mappingSheet);

  // Build name-to-unit mapping for transaction matching
  const nameToUnit: Record<string, string> = {};

  for (const row of mappingData) {
    const name = (row.Nome || '').trim();
    const andar = (row.Andar || '').trim();

    if (!name || !andar) continue;

    // Only create owners for actual unit codes
    if (UNIT_CODES.includes(andar)) {
      nameToUnit[name.toUpperCase()] = andar;

      // Extract person name from transfer description
      const personName = extractPersonName(name);
      if (personName && unitMap[andar]) {
        await prisma.owner.create({
          data: { name: personName, unitId: unitMap[andar] },
        });
        console.log(`  ${personName} → ${andar}`);
      }
    } else {
      // Map non-unit names for creditor assignment
      nameToUnit[name.toUpperCase()] = andar;
    }
  }

  // 3. Create Creditors
  console.log('\n--- Creating Creditors ---');
  const creditorMap: Record<string, string> = {}; // category name -> id

  for (const [key, info] of Object.entries(CREDITOR_MAP)) {
    const creditor = await prisma.creditor.create({
      data: {
        name: info.name,
        category: info.category,
        amountDue: info.amountDue,
      },
    });
    creditorMap[key] = creditor.id;

    // Create fee history for creditors with amountDue
    if (info.amountDue) {
      await prisma.feeHistory.create({
        data: {
          creditorId: creditor.id,
          amount: info.amountDue,
          effectiveFrom: '2024-01',
        },
      });
    }

    console.log(`  Creditor: ${info.name} (${info.category}) - ${info.amountDue ?? 'variable'} EUR/month`);
  }

  // 4. Import Transactions
  console.log('\n--- Importing Transactions ---');
  const txSheet = workbook.Sheets['Fy24-25'];
  const txData = XLSX.utils.sheet_to_json<Record<string, unknown>>(txSheet);

  // Separate unit payments from expenses
  interface RawTx {
    date: Date;
    valueDate: Date | null;
    description: string;
    amount: number;
    balance: number | null;
    andar: string;
  }

  const allTxs: RawTx[] = [];

  for (const row of txData) {
    const date = parseExcelDate(row['Data Mov.'] as string | number);
    if (!date) continue;

    const valueDate = parseExcelDate(row['Data Valor'] as string | number);
    const description = (row['Descrição'] as string || '').trim();
    const amount = parseAmount(row['Importância'] as string | number);
    const balanceRaw = row['Saldo Cont.'];
    const balance = balanceRaw ? parseAmount(balanceRaw as string | number) : null;
    const andar = (row['Andar'] as string || '').trim();

    if (!description) continue;

    allTxs.push({ date, valueDate, description, amount, balance, andar });
  }

  // Sort chronologically
  allTxs.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Track paid months per unit for splitting logic
  const unitPaidMonths: Record<string, Set<string>> = {};
  for (const code of UNIT_CODES) {
    unitPaidMonths[code] = new Set();
  }

  let imported = 0;

  for (const tx of allTxs) {
    if (UNIT_CODES.includes(tx.andar) && tx.amount > 0) {
      // Unit payment - split into months
      const unitCode = tx.andar;
      const unitId = unitMap[unitCode];
      if (!unitId) continue;

      const txMonth = dateToMonth(tx.date);
      const fee = getFeeForMonth(unitCode, txMonth);

      if (fee <= 0) {
        // No fee, just create single transaction
        await prisma.transaction.create({
          data: {
            date: tx.date,
            valueDate: tx.valueDate,
            description: tx.description,
            amount: tx.amount,
            balance: tx.balance,
            type: 'payment',
            category: 'monthly_fee',
            referenceMonth: txMonth,
            unitId,
          },
        });
        imported++;
        continue;
      }

      // Split payment into months
      let remaining = tx.amount;
      // Find the first unpaid month (starting from 2024-01)
      let targetMonth = '2024-01';
      while (unitPaidMonths[unitCode].has(targetMonth) && targetMonth <= txMonth) {
        targetMonth = nextMonth(targetMonth);
      }

      let isFirst = true;
      while (remaining >= fee * 0.9) { // Allow 10% tolerance for rounding
        const monthFee = getFeeForMonth(unitCode, targetMonth);
        if (remaining < monthFee * 0.9) break;

        const payAmount = Math.min(remaining, monthFee);

        await prisma.transaction.create({
          data: {
            date: tx.date,
            valueDate: tx.valueDate,
            description: tx.description + (isFirst ? '' : ` (ref. ${targetMonth})`),
            amount: payAmount,
            balance: isFirst ? tx.balance : null,
            type: 'payment',
            category: 'monthly_fee',
            referenceMonth: targetMonth,
            unitId,
          },
        });

        unitPaidMonths[unitCode].add(targetMonth);
        remaining -= monthFee;
        targetMonth = nextMonth(targetMonth);
        isFirst = false;
        imported++;
      }

      // If there's a small remainder, add it to the last month
      if (remaining > 0.01 && !isFirst) {
        // Already handled above with tolerance
      } else if (remaining > 0.01 && isFirst) {
        // Amount doesn't match any fee multiple - just record as-is
        await prisma.transaction.create({
          data: {
            date: tx.date,
            valueDate: tx.valueDate,
            description: tx.description,
            amount: tx.amount,
            balance: tx.balance,
            type: 'payment',
            category: 'monthly_fee',
            referenceMonth: txMonth,
            unitId,
          },
        });
        imported++;
      }
    } else {
      // Expense or non-unit transaction
      const txMonth = dateToMonth(tx.date);
      let unitId: string | null = null;
      let creditorId: string | null = null;
      let type = tx.amount >= 0 ? 'payment' : 'expense';
      let category: string | null = null;

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
        data: {
          date: tx.date,
          valueDate: tx.valueDate,
          description: tx.description,
          amount: tx.amount,
          balance: tx.balance,
          type,
          category,
          referenceMonth: txMonth,
          unitId,
          creditorId,
        },
      });
      imported++;
    }
  }

  console.log(`\nImported ${imported} transactions`);

  // Summary
  const unitCount = await prisma.unit.count();
  const creditorCount = await prisma.creditor.count();
  const txCount = await prisma.transaction.count();
  const feeHistoryCount = await prisma.feeHistory.count();
  console.log(`\n--- Summary ---`);
  console.log(`Units: ${unitCount}`);
  console.log(`Creditors: ${creditorCount}`);
  console.log(`Transactions: ${txCount}`);
  console.log(`Fee History records: ${feeHistoryCount}`);
}

function extractPersonName(transferDesc: string): string | null {
  // Remove transfer prefixes like "TR-", "TRF.DE ", "TRF.CRED ", etc.
  let name = transferDesc
    .replace(/^TR-IPS-/i, '')
    .replace(/^TR-/i, '')
    .replace(/^TRF\.DE\s+/i, '')
    .replace(/^TRF\.CRED\s+/i, '')
    .replace(/^TRF\.\s*/i, '')
    .replace(/^TRF\.IPS\s+P\/\s*/i, '')
    .replace(/^TRF\.P\/\s*/i, '')
    .trim();

  // Skip non-person entries
  if (!name || name.includes('ENDESA') || name.includes('OTIS') ||
      name.includes('EMISSÃO') || name.includes('SELO') ||
      name.includes('COMISS') || name.includes('SOLUÇÃO') ||
      name.includes('PAG.SERV') || name.includes('LEV.ATM') ||
      name.includes('DP NR')) {
    return null;
  }

  // Title case
  return name.split(' ').map(w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ');
}

importFull()
  .catch((e) => {
    console.error('Import error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
