import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import * as XLSX from 'xlsx';

interface BankRow {
  dateMov: any;
  description: string;
  importance: any;
  balanceStr: any;
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
      const decoder = new TextDecoder('windows-1252');
      const content = decoder.decode(buffer);
      const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) return NextResponse.json({ error: 'Empty file' }, { status: 400 });
      
      const dataLines = lines.slice(1);
      rows = dataLines.map(line => {
        const parts = line.split('\t');
        return {
          dateMov: parts[0],
          description: parts[2] || '',
          importance: parts[3],
          balanceStr: parts[5]
        };
      });
    } else {
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const excelData = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet);
      
      rows = excelData.map(r => ({
        dateMov: r['DATA MOVIMENTO'] || r['Data Movimento'] || r['Data'],
        description: (r['DESCRIÇÃO'] || r['Descrição'] || r['Descricao'] || '').toString(),
        importance: r['IMPORTÂNCIA'] || r['Importância'] || r['Valor'],
        balanceStr: r['SALDO CONTABILÍSTICO'] || r['Saldo Contabilístico'] || r['Saldo']
      }));
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

    for (const row of rows) {
      const description = row.description?.trim() || '';
      try {
        if (!row.dateMov || row.importance === undefined) continue;

        let date: Date;
        if (row.dateMov instanceof Date) {
          date = row.dateMov;
          date.setHours(12, 0, 0, 0);
        } else {
          const dateParts = row.dateMov.toString().split(/[\/\-]/);
          if (dateParts.length < 3) continue;
          const m = parseInt(dateParts[0]);
          const d = parseInt(dateParts[1]);
          let y = parseInt(dateParts[2]);
          if (y < 100) y += 2000;
          date = new Date(y, m - 1, d, 12, 0, 0);
        }
        
        const parseAmount = (val: any): number => {
          if (typeof val === 'number') return val;
          if (!val) return 0;
          const cleaned = val.toString().replace(/"/g, '').replace(/\./g, '').replace(',', '.');
          return parseFloat(cleaned);
        };

        const amount = parseAmount(row.importance);
        const currentBalance = parseAmount(row.balanceStr);

        if (!latestDate || date >= latestDate) {
          latestDate = date;
          latestBalance = currentBalance;
        }

        let existing = await prisma.transaction.findFirst({
          where: { date, amount, description, balance: currentBalance }
        });

        if (!existing) {
          existing = await prisma.transaction.findFirst({
            where: { date, amount, description }
          });

          if (existing && !existing.balance && !isNaN(currentBalance)) {
            await prisma.transaction.update({
              where: { id: existing.id },
              data: { balance: currentBalance }
            });
            updatedCount++;
            duplicateCount++;
            continue;
          }
        }

        if (existing) {
          duplicateCount++;
          continue;
        }

        let unitId: string | null = null;
        let creditorId: string | null = null;
        let category: string | null = null;
        const type: string = amount > 0 ? 'payment' : 'expense';

        if (description.includes('POUPANÇA') || description.includes('027-15.010650-1')) {
          category = 'savings';
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
      message: `Sucesso: ${importedCount} novas transações, ${duplicateCount} duplicadas ignoradas.`,
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