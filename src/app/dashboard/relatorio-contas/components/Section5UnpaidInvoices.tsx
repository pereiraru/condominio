'use client';

interface UnpaidMonth {
  month: string;
  monthLabel: string;
  expected: number;
  paid: number;
  debt: number;
}

interface UnpaidExpenseGroup {
  creditorName: string;
  category: string;
  expectedMonthly: number;
  isAverage: boolean;
  unpaidMonths: UnpaidMonth[];
  totalUnpaid: number;
}

interface Section5Props {
  data: UnpaidExpenseGroup[];
  totalUnpaid: number;
  year: number;
}

function fmt(value: number): string {
  return value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Section5UnpaidInvoices({ data, totalUnpaid, year }: Section5Props) {
  if (!data || data.length === 0) {
    return (
      <div className="report-section mt-10">
        <h2 className="text-lg font-bold uppercase tracking-wider text-gray-800 border-b-2 border-gray-800 pb-1 mb-4">
          5. Despesas por Liquidar
        </h2>
        <p className="text-xs text-gray-400 mb-4">Situação a 31-12-{year}</p>
        <p className="text-sm text-gray-500 italic py-4">Sem despesas por liquidar a registar.</p>
      </div>
    );
  }

  return (
    <div className="report-section mt-10">
      <h2 className="text-lg font-bold uppercase tracking-wider text-gray-800 border-b-2 border-gray-800 pb-1 mb-4">
        5. Despesas por Liquidar
      </h2>
      <p className="text-xs text-gray-400 mb-6">Situação a 31-12-{year}</p>

      {data.map((group, idx) => (
        <div key={idx} className="mb-6">
          <div className="flex items-baseline gap-2 mb-2">
            <h3 className="text-sm font-bold text-gray-800">{group.creditorName}</h3>
            <span className="text-xs text-gray-400">
              {group.isAverage
                ? `(Valor esperado mensal: ${fmt(group.expectedMonthly)}€ — baseado na média)`
                : `(Valor contratual mensal: ${fmt(group.expectedMonthly)}€)`}
            </span>
          </div>

          <table className="w-full text-xs border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-3 py-1.5 text-left font-semibold text-gray-600">Mês</th>
                <th className="border border-gray-200 px-3 py-1.5 text-right font-semibold text-gray-600">Esperado</th>
                <th className="border border-gray-200 px-3 py-1.5 text-right font-semibold text-gray-600">Pago</th>
                <th className="border border-gray-200 px-3 py-1.5 text-right font-semibold text-gray-600">Em Dívida</th>
              </tr>
            </thead>
            <tbody>
              {group.unpaidMonths.map((m, mIdx) => (
                <tr key={mIdx} className="hover:bg-gray-50/50">
                  <td className="border border-gray-200 px-3 py-1.5 text-gray-700">{m.monthLabel}</td>
                  <td className="border border-gray-200 px-3 py-1.5 text-right text-gray-600">{fmt(m.expected)}€</td>
                  <td className="border border-gray-200 px-3 py-1.5 text-right text-gray-600">{fmt(m.paid)}€</td>
                  <td className="border border-gray-200 px-3 py-1.5 text-right font-bold text-red-700">{fmt(m.debt)}€</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-red-50 font-bold">
                <td className="border border-gray-200 px-3 py-1.5 text-gray-800" colSpan={3}>
                  Subtotal — {group.creditorName}
                </td>
                <td className="border border-gray-200 px-3 py-1.5 text-right text-red-700">
                  {fmt(group.totalUnpaid)}€
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}

      {/* Grand Total */}
      <div className="mt-4 border-t-2 border-red-800 pt-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-gray-800 uppercase">Total de Despesas por Liquidar</span>
          <span className="text-lg font-black text-red-700">{fmt(totalUnpaid)}€</span>
        </div>
      </div>
    </div>
  );
}
