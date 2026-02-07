import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const results = {
      units: { created: 0, updated: 0 },
      transactions: { imported: 0, skipped: 0 },
      errors: [] as string[],
    };

    // 1. Import mapping (resident names to unit codes)
    const mappingSheet = workbook.Sheets['Mapping'];
    if (!mappingSheet) {
      results.errors.push('Sheet "Mapping" not found');
    }

    const unitCodes = new Set<string>();
    const unitMap: Record<string, string> = {};

    if (mappingSheet) {
      const mappingData = XLSX.utils.sheet_to_json<MappingRow>(mappingSheet);

      for (const row of mappingData) {
        if (row.Nome && row.Andar) {
          const unitCode = row.Andar.trim();
          unitCodes.add(unitCode);
        }
      }

      // Create units
      for (const code of Array.from(unitCodes)) {
        const floorMatch = code.match(/^(\d+)/);
        const floor = floorMatch ? parseInt(floorMatch[1]) : null;

        const unit = await prisma.unit.upsert({
          where: { code },
          update: {},
          create: {
            code,
            floor,
            monthlyFee: code.endsWith('E') ? 75 : 45,
          },
        });

        unitMap[code] = unit.id;
        results.units.created++;
      }
    }

    // 2. Import transactions - try multiple sheet names
    const txSheetNames = ['Fy24-25', 'Fy23-24', 'Transactions', 'Movimentos'];
    let txSheet = null;

    for (const name of txSheetNames) {
      if (workbook.Sheets[name]) {
        txSheet = workbook.Sheets[name];
        break;
      }
    }

    if (!txSheet) {
      // Try first sheet if none of the expected names found
      const firstSheetName = workbook.SheetNames[0];
      if (firstSheetName && firstSheetName !== 'Mapping') {
        txSheet = workbook.Sheets[firstSheetName];
      }
    }

    if (txSheet) {
      const txData = XLSX.utils.sheet_to_json<TransactionRow>(txSheet);

      for (const row of txData) {
        try {
          const date = parseExcelDate(row['Data Mov.']);
          const valueDate = parseExcelDate(row['Data Valor']);
          const description = row['Descrição']?.toString().trim() ?? '';
          const amount = parseFloat(row['Importância']?.toString() ?? '0');
          const balanceStr = row['Saldo Cont.']?.toString().replace(/\./g, '').replace(',', '.') ?? '0';
          const balance = parseFloat(balanceStr);
          const unitCode = row['Andar']?.toString().trim();

          if (!date || !description) {
            results.transactions.skipped++;
            continue;
          }

          const { type, category } = categorizeTransaction(description, amount);

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

          results.transactions.imported++;
        } catch {
          results.transactions.skipped++;
        }
      }
    } else {
      results.errors.push('No transaction sheet found');
    }

    return NextResponse.json({
      success: true,
      message: `Imported ${results.units.created} units and ${results.transactions.imported} transactions`,
      results,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import file', details: String(error) },
      { status: 500 }
    );
  }
}
