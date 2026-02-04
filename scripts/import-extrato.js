const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

const UNIT_CODES = ['1D', '1E', '2D', '2E', '3D', '3E', '4D', '4E', '5D', '5E', '6D', '6E', 'RCD', 'RCE', 'CV', 'Garagem'];

const CREDITOR_MAP = {
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

const CREDITOR_NAME_MAP = {
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

function parseExcelDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    return new Date((value - 25569) * 86400 * 1000);
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function parseAmount(value) {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  const cleaned = value.toString().replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

async function importExtrato() {
  // Check if transactions already exist — skip if so (preserves manual allocations)
  const existingCount = await prisma.transaction.count();
  if (existingCount > 0) {
    console.log(`[import-extrato] ${existingCount} transactions already exist. Skipping import.`);
    console.log('[import-extrato] To reimport, clear transactions first then restart.');
    return;
  }

  // Find the Excel file (check multiple locations)
  let excelPath;
  const candidates = [
    path.join(process.cwd(), 'extrato.xlsx'),
    path.join(process.cwd(), 'data', 'extrato.xlsx'),
  ];
  for (const p of candidates) {
    try {
      require('fs').accessSync(p);
      excelPath = p;
      break;
    } catch {}
  }
  if (!excelPath) {
    console.log('[import-extrato] No extrato.xlsx found. Skipping import.');
    return;
  }

  console.log(`[import-extrato] Reading: ${excelPath}`);
  const wb = XLSX.readFile(excelPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);
  console.log(`[import-extrato] Found ${rows.length} rows`);

  // Load existing units and creditors
  const units = await prisma.unit.findMany();
  const unitMap = {};
  for (const u of units) unitMap[u.code] = u.id;

  const creditors = await prisma.creditor.findMany();
  const creditorByName = {};
  for (const c of creditors) creditorByName[c.name] = c.id;

  const andarToCreditorId = {};
  for (const [andar, name] of Object.entries(CREDITOR_NAME_MAP)) {
    if (creditorByName[name]) andarToCreditorId[andar] = creditorByName[name];
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

    let unitId = null;
    let creditorId = null;
    let type;
    let category = null;

    if (UNIT_CODES.includes(andar)) {
      unitId = unitMap[andar] || null;
      type = 'payment';
      category = 'monthly_fee';
    } else if (CREDITOR_MAP[andar]) {
      creditorId = andarToCreditorId[andar] || null;
      type = CREDITOR_MAP[andar].type;
      category = CREDITOR_MAP[andar].category;
    } else {
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

  console.log(`[import-extrato] Imported ${imported} transactions`);
  console.log(`[import-extrato] Income: ${totalIncome.toFixed(2)} | Expense: ${totalExpense.toFixed(2)} | Net: ${(totalIncome + totalExpense).toFixed(2)}`);
}

importExtrato()
  .catch((e) => {
    console.error('[import-extrato] Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
