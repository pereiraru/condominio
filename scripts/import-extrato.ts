import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

const UNIT_CODES = ['1D', '1E', '2D', '2E', '3D', '3E', '4D', '4E', '5D', '5E', '6D', '6E', 'RCD', 'RCE', 'CV', 'Garagem'];

const CREDITOR_MAP: Record<string, { category: string; type: string }> = {
  'Luz': { category: 'electricity', type: 'expense' },
  'Elevadores': { category: 'elevator', type: 'expense' },
  'P. Serviços': { category: 'other', type: 'expense' },
  'Bomba Agua': { category: 'maintenance', type: 'expense' },
  'Electrecista': { category: 'maintenance', type: 'expense' },
  'Gestao Conta': { category: 'bank_fee', type: 'fee' },
  'Conta Poupança': { category: 'savings', type: 'transfer' },
  'pagamento': { category: 'other', type: 'expense' },
  'Outos pagamentos': { category: 'other', type: 'expense' },
  'Levantamento': { category: 'other', type: 'transfer' },
  'Exaustores': { category: 'maintenance', type: 'expense' },
};

function parseExcelDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    return new Date((value - 25569) * 86400 * 1000);
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function parseAmount(value: any): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  const cleaned = value.toString().replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

async function importExtrato() {
  const excelPath = path.join(process.cwd(), 'data', 'extrato.xlsx');
  console.log(`Reading: ${excelPath}`);

  const wb = XLSX.readFile(excelPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws) as any[];

  console.log(`Found ${rows.length} rows\n`);

  // Load existing units and creditors from DB
  const units = await prisma.unit.findMany();
  const unitMap: Record<string, string> = {};
  for (const u of units) {
    unitMap[u.code] = u.id;
  }

  const creditors = await prisma.creditor.findMany();
  const creditorByName: Record<string, string> = {};
  for (const c of creditors) {
    creditorByName[c.name] = c.id;
  }

  // Map Andar values to creditor IDs using existing creditors
  const andarToCreditorId: Record<string, string | null> = {};
  for (const [andar, info] of Object.entries(CREDITOR_MAP)) {
    // Find creditor by category match
    const creditor = creditors.find(c => c.category === info.category) || null;
    andarToCreditorId[andar] = creditor?.id || null;
  }

  // Also try exact name matches for creditors we created
  const creditorNameMap: Record<string, string> = {
    'Luz': 'Endesa Energia',
    'Elevadores': 'Otis Elevadores',
    'Gestao Conta': 'Despesas Bancárias',
    'Conta Poupança': 'Conta Poupança',
    'Levantamento': 'Levantamentos ATM',
    'P. Serviços': 'Pagamentos Serviços',
    'pagamento': 'JCSS Unipessoal',
    'Outos pagamentos': 'Outros Pagamentos',
    'Bomba Agua': 'Jose Nicole, LDA',
    'Electrecista': 'Fabio Henrique Peixoto',
    'Exaustores': 'Jose Carlos Sande',
  };

  for (const [andar, name] of Object.entries(creditorNameMap)) {
    if (creditorByName[name]) {
      andarToCreditorId[andar] = creditorByName[name];
    }
  }

  let imported = 0;
  let totalIncome = 0;
  let totalExpense = 0;

  for (const row of rows) {
    const date = parseExcelDate(row['Data Mov.']);
    if (!date) continue;

    const valueDate = parseExcelDate(row['Data Valor']);
    const description = (row['Descrição'] || '').trim();
    const amount = parseAmount(row['Importância']);
    const balanceRaw = row['Saldo Cont.'];
    const balance = balanceRaw ? parseAmount(balanceRaw) : null;
    const andar = (row['Andar'] || '').trim();

    if (!description) continue;

    // Determine unit, creditor, type, category
    let unitId: string | null = null;
    let creditorId: string | null = null;
    let type: string;
    let category: string | null = null;

    if (UNIT_CODES.includes(andar)) {
      // Unit payment
      unitId = unitMap[andar] || null;
      type = 'payment';
      category = 'monthly_fee';
    } else if (CREDITOR_MAP[andar]) {
      // Expense/creditor
      creditorId = andarToCreditorId[andar] || null;
      type = CREDITOR_MAP[andar].type;
      category = CREDITOR_MAP[andar].category;
    } else {
      // Unknown — categorize by amount sign
      type = amount >= 0 ? 'payment' : 'expense';
      category = 'other';
    }

    await prisma.transaction.create({
      data: {
        date,
        valueDate,
        description,
        amount,
        balance,
        type,
        category,
        unitId,
        creditorId,
      },
    });

    imported++;
    if (amount > 0) totalIncome += amount;
    else totalExpense += amount;
  }

  console.log(`Imported ${imported} transactions`);
  console.log(`Total income:  ${totalIncome.toFixed(2)}`);
  console.log(`Total expense: ${totalExpense.toFixed(2)}`);
  console.log(`Net:           ${(totalIncome + totalExpense).toFixed(2)}`);

  // Verify
  const count = await prisma.transaction.count();
  console.log(`\nDB transaction count: ${count}`);
}

importExtrato()
  .catch((e) => {
    console.error('Import error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
