interface BudgetData {
  nextYear: number;
  notes: string | null;
  lines: {
    category: string;
    description: string;
    monthlyAmount: number;
    annualAmount: number;
    percentage: number;
  }[];
  totalMonthly: number;
  totalAnnual: number;
}

interface FeeScheduleItem {
  unitCode: string;
  description: string;
  currentFee: number;
  newFee: number;
  variation: number;
}

interface Section7Props {
  budget: BudgetData | null;
  feeSchedule: FeeScheduleItem[];
  year: number;
}

function fmt(value: number): string {
  return value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(value: number): string {
  return value.toFixed(1) + '%';
}

export default function Section7Budget({ budget, feeSchedule, year }: Section7Props) {
  const nextYear = budget?.nextYear || year + 1;

  return (
    <div className="report-section report-section-break mb-8">
      <h2 className="text-lg font-bold mb-4 text-center">Orçamento de Despesas para {nextYear}</h2>

      {budget ? (
        <div className="mb-8">
          <table className="w-full text-sm border-collapse border border-gray-400">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-400">
                <th className="text-left py-2 px-2 border-r border-gray-300">Rubricas</th>
                <th className="text-right py-2 px-2 border-r border-gray-300">Mensal</th>
                <th className="text-right py-2 px-2 border-r border-gray-300">Anual</th>
                <th className="text-right py-2 px-2">%</th>
              </tr>
            </thead>
            <tbody>
              {budget.lines.map((line, i) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="py-1 px-2 border-r border-gray-300">{line.description}</td>
                  <td className="text-right py-1 px-2 border-r border-gray-300">{fmt(line.monthlyAmount)}</td>
                  <td className="text-right py-1 px-2 border-r border-gray-300">{fmt(line.annualAmount)}</td>
                  <td className="text-right py-1 px-2">{pct(line.percentage)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-800 font-bold bg-gray-50">
                <td className="py-2 px-2 border-r border-gray-300">Total</td>
                <td className="text-right py-2 px-2 border-r border-gray-300">{fmt(budget.totalMonthly)}</td>
                <td className="text-right py-2 px-2 border-r border-gray-300">{fmt(budget.totalAnnual)}</td>
                <td className="text-right py-2 px-2">100.0%</td>
              </tr>
            </tfoot>
          </table>
          {budget.notes && (
            <p className="text-xs text-gray-500 mt-2 italic">{budget.notes}</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500 italic mb-8">
          Orçamento para {nextYear} ainda não definido. Crie um orçamento para preencher esta secção.
        </p>
      )}

      {/* Fee Schedule */}
      <h2 className="text-lg font-bold mb-4 text-center">Quotas para {nextYear}</h2>

      <table className="w-full text-sm border-collapse border border-gray-400">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-400">
            <th className="text-left py-2 px-2 border-r border-gray-300">Fração</th>
            <th className="text-right py-2 px-2 border-r border-gray-300">Quota Mensal {year}</th>
            <th className="text-right py-2 px-2 border-r border-gray-300">Quota Mensal {nextYear}</th>
            <th className="text-right py-2 px-2">Variação</th>
          </tr>
        </thead>
        <tbody>
          {feeSchedule.map((item, i) => (
            <tr key={i} className="border-b border-gray-200">
              <td className="py-1 px-2 border-r border-gray-300">
                {item.unitCode}{item.description ? ` - ${item.description}` : ''}
              </td>
              <td className="text-right py-1 px-2 border-r border-gray-300">{fmt(item.currentFee)} €</td>
              <td className="text-right py-1 px-2 border-r border-gray-300">{fmt(item.newFee)} €</td>
              <td className={`text-right py-1 px-2 ${item.variation > 0 ? 'text-red-600' : item.variation < 0 ? 'text-green-600' : ''}`}>
                {item.variation > 0 ? '+' : ''}{pct(item.variation)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
