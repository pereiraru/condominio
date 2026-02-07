import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

interface MappingRow {
  Nome: string;
  Andar: string;
}

interface TransactionRow {
  'Data Mov.': Date | string;
  'Data Valor': Date | string;
  'Descrição': string;
  'Importância': number;
  'Saldo Cont.': string | number;
  Andar: string;
}

async function importExcel() {
  const excelPath = path.join(process.cwd(), 'data', 'contas predio.xlsm');
  console.log(`Reading Excel file: ${excelPath}`);

  const workbook = XLSX.readFile(excelPath);

  // 1. Import mapping (resident names to unit codes)
  console.log('\n--- Importing Unit Mapping ---');
  const mappingSheet = workbook.Sheets['Mapping'];
  const mappingData = XLSX.utils.sheet_to_json<MappingRow>(mappingSheet);

  const unitCodes = new Set<string>();
  const nameToUnit: Record<string, string> = {};

  for (const row of mappingData) {
    if (row.Nome && row.Andar) {
      const unitCode = row.Andar.trim();
      unitCodes.add(unitCode);
      // Normalize the name for matching
      const normalizedName = row.Nome.trim().toUpperCase();
      nameToUnit[normalizedName] = unitCode;
    }
  }

  // 2. Create units
  console.log(`Found ${unitCodes.size} units`);
  const unitMap: Record<string, string> = {}; // code -> id

  for (const code of Array.from(unitCodes)) {
    // Extract floor number if code is like "1D", "2E", etc.
    const floorMatch = code.match(/^(\d+)/);
    const floor = floorMatch ? parseInt(floorMatch[1]) : null;

    const unit = await prisma.unit.upsert({
      where: { code },
      update: {},
      create: {
        code,
        floor,
        monthlyFee: code.endsWith('E') ? 75 : 45, // Larger units pay more
      },
    });

    unitMap[code] = unit.id;
    console.log(`  Created/updated unit: ${code}`);
  }

  // 3. Import transactions from Fy24-25 sheet
  console.log('\n--- Importing Transactions ---');
  const txSheet = workbook.Sheets['Fy24-25'];
  const txData = XLSX.utils.sheet_to_json<TransactionRow>(txSheet);

  let imported = 0;
  let skipped = 0;

  for (const row of txData) {
    const date = parseExcelDate(row['Data Mov.']);
    const valueDate = parseExcelDate(row['Data Valor']);
    const description = row['Descrição']?.toString().trim() ?? '';
    const amount = parseFloat(row['Importância']?.toString() ?? '0');
    const balanceStr = row['Saldo Cont.']?.toString().replace(/\./g, '').replace(',', '.') ?? '0';
    const balance = parseFloat(balanceStr);
    const unitCode = row['Andar']?.toString().trim();

    if (!date || !description) {
      skipped++;
      continue;
    }

    // Determine transaction type and category
    const { type, category } = categorizeTransaction(description, amount);

    // Find unit ID
    let unitId: string | null = null;
    if (unitCode && unitMap[unitCode]) {
      unitId = unitMap[unitCode];
    }

    await prisma.transaction.create({
      data: {
        date,
        valueDate,
        description,
        amount,
        balance: isNaN(balance) ? null : balance,
        type,
        category,
        unitId,
      },
    });

    imported++;
  }

  console.log(`Imported ${imported} transactions, skipped ${skipped}`);
  console.log('\nImport complete!');
}

function parseExcelDate(value: Date | string | number | undefined): Date | null {
  if (!value) return null;

  if (value instanceof Date) return value;

  // Excel serial date number
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000);
    return date;
  }

  // String date
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function categorizeTransaction(
  description: string,
  amount: number
): { type: string; category: string | null } {
  const desc = description.toUpperCase();

  // Expenses
  if (amount < 0) {
    if (desc.includes('ENDESA') || desc.includes('ENERGIA') || desc.includes('LUZ')) {
      return { type: 'expense', category: 'electricity' };
    }
    if (desc.includes('SELO') || desc.includes('COMISS') || desc.includes('EXTR')) {
      return { type: 'fee', category: 'bank_fee' };
    }
    if (desc.includes('TRF. P/') || desc.includes('POUPANÇA') || desc.includes('DP NR')) {
      return { type: 'transfer', category: 'savings' };
    }
    return { type: 'expense', category: 'other' };
  }

  // Income
  if (desc.includes('TRF') || desc.includes('TR-')) {
    return { type: 'payment', category: 'monthly_fee' };
  }

  return { type: 'payment', category: null };
}

importExcel()
  .catch((e) => {
    console.error('Import error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
