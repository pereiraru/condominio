'use client';

interface PaidTransaction {
  date: string;
  description: string;
  amount: number;
}

interface PaidExpenseGroup {
  category: string;
  categoryLabel: string;
  transactions: PaidTransaction[];
  categoryTotal: number;
  transactionCount: number;
}

interface Section4Props {
  data: PaidExpenseGroup[];
  totalPaid: number;
  year: number;
}

function fmt(value: number): string {
  return value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Section4PaidInvoices({ data, totalPaid, year }: Section4Props) {
  if (!data || data.length === 0) {
    return (
      <div className="report-section report-section-break mb-8">
        <h2 className="text-lg font-bold mb-1 uppercase">Despesas Pagas</h2>
        <p className="text-sm text-gray-600 mb-4">Período: 01-01-{year} a 31-12-{year}</p>
        <p className="text-sm text-gray-500 italic py-4 border-t border-gray-100 mt-2">Sem movimentos a registar.</p>
      </div>
    );
  }

  return (
    <div className="report-section report-section-break mb-8">
      <h2 className="text-lg font-bold mb-1 uppercase">Despesas Pagas</h2>
      <p className="text-sm text-gray-600 mb-4">Período: 01-01-{year} a 31-12-{year}</p>

      <div className="space-y-6">
        {data.map((group, idx) => (
          <div key={idx} className="bg-white">
            <div className="flex justify-between items-center border-b border-gray-800 pb-1 mb-2">
              <h3 className="font-bold text-sm text-gray-900 uppercase">
                {group.categoryLabel} ({group.transactionCount} mov.)
              </h3>
              <span className="text-[10px] font-bold bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                Total: {fmt(group.categoryTotal)}€
              </span>
            </div>

            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="text-left text-gray-500 font-bold uppercase border-b border-gray-100 bg-gray-50/30">
                  <th className="py-1 pl-2 w-24">Data</th>
                  <th className="py-1">Descrição</th>
                  <th className="py-1 text-right w-24 pr-2">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {group.transactions.map((tx, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-1 pl-2 whitespace-nowrap">
                      {new Date(tx.date + 'T00:00:00').toLocaleDateString('pt-PT')}
                    </td>
                    <td className="py-1 text-gray-600 italic line-clamp-1">{tx.description}</td>
                    <td className="py-1 text-right font-medium pr-2">{fmt(tx.amount)}€</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-2 border-t-2 border-gray-800 flex justify-between items-center bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
        <span className="font-bold text-xs uppercase text-gray-600">Total de Despesas Pagas</span>
        <span className="text-lg font-black text-gray-900">{fmt(totalPaid)}€</span>
      </div>
    </div>
  );
}
