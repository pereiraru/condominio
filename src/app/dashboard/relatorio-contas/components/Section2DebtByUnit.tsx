interface UnitDebt {
  code: string;
  description: string;
  ownerName: string;
  saldoAnterior2024: number;
  saldoAnosAnteriores: number;
  saldoInicial: number;
  previsto: number;
  recebido: number;
  saldo: number;
}

interface Section2Props {
  data: {
    units: UnitDebt[];
    totals: {
      saldoAnterior2024: number;
      saldoAnosAnteriores: number;
      saldoInicial: number;
      previsto: number;
      recebido: number;
      saldo: number;
    };
  };
  year: number;
}

function fmt(value: number): string {
  return value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Section2DebtByUnit({ data, year }: Section2Props) {
  return (
    <div className="report-section report-section-break mb-8">
      <h2 className="text-lg font-bold mb-1">Valores em Débito por Fração</h2>
      <p className="text-sm text-gray-600 mb-4">Período: 01-01-{year} a 31-12-{year}</p>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-800 text-[10px] uppercase">
            <th className="text-left py-1 pr-2">Fração</th>
            <th className="text-left py-1 pr-2">Entidade</th>
            <th className="text-right py-1 pr-2">Dívida &lt; 2024</th>
            <th className="text-right py-1 pr-2">Dívida 24-25</th>
            <th className="text-right py-1 pr-2">Saldo Inicial</th>
            <th className="text-right py-1 pr-2">Previsto</th>
            <th className="text-right py-1 pr-2">Recebido</th>
            <th className="text-right py-1">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {data.units.map((unit, i) => (
            <tr key={i} className="border-b border-gray-200">
              <td className="py-1 pr-2 font-medium">{unit.code}</td>
              <td className="py-1 pr-2">{unit.ownerName}</td>
              <td className="text-right py-1 pr-2">{fmt(unit.saldoAnterior2024)}</td>
              <td className="text-right py-1 pr-2">{fmt(unit.saldoAnosAnteriores)}</td>
              <td className="text-right py-1 pr-2 bg-gray-50 font-semibold">{fmt(unit.saldoInicial)}</td>
              <td className="text-right py-1 pr-2">{fmt(unit.previsto)}</td>
              <td className="text-right py-1 pr-2">{fmt(unit.recebido)}</td>
              <td className={`text-right py-1 font-medium ${unit.saldo > 0 ? 'text-red-600' : ''}`}>
                {fmt(unit.saldo)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-800 font-bold bg-gray-50">
            <td className="py-2" colSpan={2}>Total</td>
            <td className="text-right py-2 pr-2">{fmt(data.totals.saldoAnterior2024)}</td>
            <td className="text-right py-2 pr-2">{fmt(data.totals.saldoAnosAnteriores)}</td>
            <td className="text-right py-2 pr-2">{fmt(data.totals.saldoInicial)}</td>
            <td className="text-right py-2 pr-2">{fmt(data.totals.previsto)}</td>
            <td className="text-right py-2 pr-2">{fmt(data.totals.recebido)}</td>
            <td className="text-right py-2">{fmt(data.totals.saldo)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
