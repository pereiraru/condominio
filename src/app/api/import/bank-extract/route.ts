import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import iconv from 'iconv-lite';

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
    // Use ISO-8859-1 or Windows-1252 for Portuguese bank files
    const content = iconv.decode(buffer, 'win1252');
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');

    if (lines.length < 2) return NextResponse.json({ error: 'Empty file' }, { status: 400 });

    // Skip header
    const dataLines = lines.slice(1);
    
    // 1. Get mappings for auto-assignment
    const mappings = await prisma.descriptionMapping.findMany();
    const units = await prisma.unit.findMany();
    const creditors = await prisma.creditor.findMany();

    let importedCount = 0;
    let duplicateCount = 0;
    let latestBalance = 0;
    let latestDate: Date | null = null;

    for (const line of dataLines) {
      const parts = line.split('\t');
      if (parts.length < 6) continue;

      // DATA MOVIMENTO	DATA OPERAÇÃO	DESCRIÇÃO	IMPORTÂNCIA	MOEDA	SALDO CONTABILÍSTICO
      const [dateMov, , description, importance, , balanceStr] = parts;

      // Parse date (D/M/YY)
      const dateParts = dateMov.split('/');
      if (dateParts.length < 3) continue;
      
      const d = parseInt(dateParts[0]);
      const m = parseInt(dateParts[1]);
      const y = parseInt(dateParts[2]);
      const date = new Date(2000 + y, m - 1, d);
      
      // Parse amounts (format "1.234,56" or "123,45")
      const parseAmount = (s: string) => {
        const cleaned = s.replace(/"/g, '').replace(/\./g, '').replace(',', '.');
        return parseFloat(cleaned);
      };

      const amount = parseAmount(importance);
      const currentBalance = parseAmount(balanceStr);

      // Keep track of the latest balance
      if (!latestDate || date >= latestDate) {
        latestDate = date;
        latestBalance = currentBalance;
      }

      // 2. Deduplication check
      const existing = await prisma.transaction.findFirst({
        where: {
          date,
          amount,
          description: description.trim(),
          balance: currentBalance,
        }
      });

      if (existing) {
        duplicateCount++;
        continue;
      }

      // 3. Auto-assignment
      let unitId: string | null = null;
      let creditorId: string | null = null;
      let category: string | null = null;
      let type: string = amount > 0 ? 'payment' : 'expense';

      // Check for savings transfers (Montepio 60€)
      if (description.includes('POUPANÇA') || description.includes('027-15.010650-1')) {
        category = 'savings';
        type = 'transfer';
      } else {
        // Apply mappings
        const mapping = mappings.find(m => description.toUpperCase().includes(m.pattern.toUpperCase()));
        if (mapping) {
          unitId = mapping.unitId;
          creditorId = mapping.creditorId;
        }
      }

      // Create transaction
      await prisma.transaction.create({
        data: {
          date,
          description: description.trim(),
          amount,
          balance: isNaN(currentBalance) ? null : currentBalance,
          type,
          category,
          unitId,
          creditorId,
        }
      });

      importedCount++;
    }

    // 4. Update Bank Balance Snapshot
    if (latestDate && !isNaN(latestBalance)) {
      let bankAccount = await prisma.bankAccount.findFirst({
        where: { name: { contains: 'Montepio' }, accountType: 'current' }
      });

      if (!bankAccount) {
        bankAccount = await prisma.bankAccount.findFirst({ where: { accountType: 'current' } });
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

    return NextResponse.json({
      message: `Sucesso: ${importedCount} novas transações, ${duplicateCount} duplicadas ignoradas. Saldo atualizado para ${latestBalance.toFixed(2)}€`,
      importedCount,
      duplicateCount,
      latestBalance
    });

  } catch (error) {
    console.error('[BankImport]', error);
    return NextResponse.json({ error: 'Falha ao processar extrato' }, { status: 500 });
  }
}