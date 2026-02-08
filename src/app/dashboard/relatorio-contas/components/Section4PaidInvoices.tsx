'use client';

interface PaidMonth {
  month: string;
  monthLabel: string;
  amount: number;
}

interface PaidExpenseGroup {
  category: string;
  categoryLabel: string;
  months: PaidMonth[];
  categoryTotal: number;
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
      <p className="text-sm text-gray-600 mb-6">Período: 01-01-{year} a 31-12-{year}</p>

      {data.map((group, idx) => (
        <div key={idx} className="mb-6">
          <h3 className="text-sm font-bold text-gray-800 mb-2">{group.categoryLabel}</h3>

          <table className="w-full text-xs border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-3 py-1.5 text-left font-semibold text-gray-600">Mês</th>
                <th className="border border-gray-200 px-3 py-1.5 text-right font-semibold text-gray-600">Valor Pago</th>
              </tr>
            </thead>
            <tbody>
              {group.months.map((m, mIdx) => (
                <tr key={mIdx} className="hover:bg-gray-50/50">
                  <td className="border border-gray-200 px-3 py-1.5 text-gray-700">{m.monthLabel}</td>
                  <td className="border border-gray-200 px-3 py-1.5 text-right text-gray-800">{fmt(m.amount)}€</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold">
                <td className="border border-gray-200 px-3 py-1.5 text-gray-800">
                  Subtotal — {group.categoryLabel}
                </td>
                <td className="border border-gray-200 px-3 py-1.5 text-right text-gray-900">
                  {fmt(group.categoryTotal)}€
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}

      {/* Grand Total */}
      <div className="mt-4 border-t-2 border-gray-800 pt-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-gray-800 uppercase">Total de Despesas Pagas</span>
          <span className="text-lg font-black text-gray-900">{fmt(totalPaid)}€</span>
        </div>
      </div>
    </div>
  );
}
