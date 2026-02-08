import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import * as XLSX from 'xlsx';

interface BankRow {
  dateMov: string;
  description: string;
  importance: string;
  balanceStr: string;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    let rows: BankRow[] = [];

    if (file.name.toLowerCase().endsWith('.txt')) {
      // TXT: Windows-1252 encoded, tab-separated
      const decoder = new TextDecoder('windows-1252');
      const content = decoder.decode(buffer);
      const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) return NextResponse.json({ error: 'Empty file' }, { status: 400 });

      const dataLines = lines.slice(1);
      rows = dataLines.map(line => {
        const parts = line.split('\t');
        return {
          dateMov: parts[0] || '',
          description: parts[2] || '',
          importance: parts[3] || '',
          balanceStr: parts[5] || ''
        };
      });
    } else {
      // XLS/XLSX: Read twice - cellDates for correct dates, raw:false for formatted amounts
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

      // Get dates from cellDates (handles timezone correctly)
      const dataWithDates = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet);
      // Get formatted strings for amounts/balances (avoids cents vs euros issues)
      const dataFormatted = XLSX.utils.sheet_to_json<Record<string, string>>(firstSheet, { raw: false });

      rows = dataFormatted.map((r, i) => {
        const dateRow = dataWithDates[i];
        // Use the Date object from cellDates, format as M/D/YYYY for consistent parsing
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

    if (rows.length === 0) return NextResponse.json({ error: 'Nenhum dado encontrado no ficheiro' }, { status: 400 });

    const mappings = await prisma.descriptionMapping.findMany();

    let importedCount = 0;
    let duplicateCount = 0;
    let updatedCount = 0;
    let autoAssignedCount = 0;
    let latestBalance = 0;
    let latestDate: Date | null = null;
    const errors: string[] = [];

    // Parse Portuguese number format: "1.223,18" → 1223.18
    const parseAmount = (val: string): number => {
      if (!val) return 0;
      const cleaned = val.replace(/"/g, '').replace(/\./g, '').replace(',', '.');
      return parseFloat(cleaned);
    };

    // Strip non-ASCII for fuzzy description matching (encoding differences)
    const stripNonAscii = (s: string) => s.replace(/[^\x20-\x7E]/g, '').trim();

    for (const row of rows) {
      const description = row.description.trim();
      try {
        if (!row.dateMov || !row.importance) continue;

        // Parse date: M/D/YY format (American, from bank export)
        const dateParts = row.dateMov.split(/[\/\-]/);
        if (dateParts.length < 3) continue;
        const m = parseInt(dateParts[0]);
        const d = parseInt(dateParts[1]);
        let y = parseInt(dateParts[2]);
        if (y < 100) y += 2000;
        // Use noon to avoid timezone shift
        const date = new Date(y, m - 1, d, 12, 0, 0);

        if (isNaN(date.getTime()) || m < 1 || m > 12 || d < 1 || d > 31) {
          errors.push(`Data inválida: ${row.dateMov}`);
          continue;
        }

        const amount = parseAmount(row.importance);
        const currentBalance = parseAmount(row.balanceStr);

        if (isNaN(amount) || amount === 0) continue;

        if (!latestDate || date >= latestDate) {
          latestDate = date;
          latestBalance = currentBalance;
        }

        // Duplicate detection: try exact match first, then fuzzy (encoding-safe)
        let existing = await prisma.transaction.findFirst({
          where: { date, amount, description }
        });

        if (!existing) {
          // Fuzzy match: same date + amount, matching ASCII description prefix
          // Handles encoding differences (CONCEIÇÃO vs CONCEI¸¶O)
          const descAscii = stripNonAscii(description).substring(0, 20);
          const candidates = await prisma.transaction.findMany({
            where: { date, amount }
          });
          if (candidates.length > 0) {
            existing = candidates.find(c =>
              stripNonAscii(c.description).substring(0, 20) === descAscii
            ) || null;
          }
        }

        if (existing) {
          // Update balance if missing on existing record
          if (!existing.balance && !isNaN(currentBalance)) {
            await prisma.transaction.update({
              where: { id: existing.id },
              data: { balance: currentBalance }
            });
            updatedCount++;
          }
          duplicateCount++;
          continue;
        }

        // Auto-assign unit/creditor via description mappings
        let unitId: string | null = null;
        let creditorId: string | null = null;
        let category: string | null = null;
        let type: string = amount > 0 ? 'payment' : 'expense';

        if (description.includes('POUPANÇA') || description.includes('027-15.010650-1')) {
          category = 'savings';
          type = 'transfer';
          autoAssignedCount++;
        } else {
          const mapping = mappings.find(m => description.toUpperCase().includes(m.pattern.toUpperCase()));
          if (mapping) {
            unitId = mapping.unitId;
            creditorId = mapping.creditorId;
            autoAssignedCount++;
          }
        }

        await prisma.transaction.create({
          data: {
            date,
            description,
            amount,
            balance: isNaN(currentBalance) ? null : currentBalance,
            type,
            category,
            unitId,
            creditorId,
          }
        });

        importedCount++;
      } catch (err) {
        errors.push(`Erro: ${description.substring(0, 20)}... - ${String(err)}`);
      }
    }

    // Update bank account snapshot with latest balance
    if (latestDate && !isNaN(latestBalance)) {
      let bankAccount = await prisma.bankAccount.findFirst({
        where: { name: { contains: 'Montepio' }, accountType: 'current' }
      });
      if (!bankAccount) {
        bankAccount = await prisma.bankAccount.findFirst({ where: { accountType: 'current' } });
      }
      if (!bankAccount) {
        bankAccount = await prisma.bankAccount.create({
          data: { name: 'Montepio (DO)', accountType: 'current' }
        });
      }

      if (bankAccount) {
        const snapshot = await prisma.bankAccountSnapshot.findFirst({
          where: { bankAccountId: bankAccount.id, date: latestDate }
        });
        if (snapshot) {
          await prisma.bankAccountSnapshot.update({
            where: { id: snapshot.id },
            data: { balance: latestBalance, description: 'Importado do Extrato' }
          });
        } else {
          await prisma.bankAccountSnapshot.create({
            data: {
              bankAccountId: bankAccount.id,
              date: latestDate,
              balance: latestBalance,
              description: 'Importado do Extrato'
            }
          });
        }
      }
    }

    // Ensure savings bank account exists if savings transactions found
    if (importedCount > 0 || updatedCount > 0) {
      const hasSavings = await prisma.transaction.findFirst({ where: { category: 'savings' } });
      if (hasSavings) {
        const savExists = await prisma.bankAccount.findFirst({ where: { accountType: 'savings' } });
        if (!savExists) {
          await prisma.bankAccount.create({
            data: { name: 'Montepio Poupança', accountType: 'savings' }
          });
        }
      }
    }

    return NextResponse.json({
      message: `Sucesso: ${importedCount} novas transações, ${duplicateCount} duplicadas ignoradas${updatedCount > 0 ? `, ${updatedCount} saldos atualizados` : ''}.`,
      importedCount,
      duplicateCount,
      updatedCount,
      autoAssignedCount,
      latestBalance,
      errors,
      success: true
    });

  } catch (error) {
    console.error('[BankImport]', error);
    return NextResponse.json({ error: 'Falha ao processar extrato', success: false }, { status: 500 });
  }
}
