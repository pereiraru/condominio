interface UnitDetailedDebt {
  code: string;
  description: string;
  ownerName: string;
  items: { description: string; amount: number }[];
  unitTotal: number;
}

interface Section6Props {
  data: {
    units: UnitDetailedDebt[];
    grandTotal: number;
  };
  year: number;
}

function fmt(value: number): string {
  return value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Section6DetailedDebt({ data, year }: Section6Props) {
  if (data.units.length === 0) {
    return (
      <div className="report-section report-section-break mb-8">
        <h2 className="text-lg font-bold mb-1">Valores por Liquidar por Fração</h2>
        <p className="text-sm text-gray-600 mb-4">Até 31-12-{year}</p>
        <p className="text-sm text-gray-500 italic">Todas as frações estão em dia.</p>
      </div>
    );
  }

  return (
    <div className="report-section report-section-break mb-8">
      <h2 className="text-lg font-bold mb-1">Valores por Liquidar por Fração</h2>
      <p className="text-sm text-gray-600 mb-4">Até 31-12-{year}</p>

      {data.units.map((unit, i) => (
        <div key={i} className="mb-4">
          <div className="font-semibold text-sm border-b border-gray-400 pb-1 mb-1">
            {unit.code} | {unit.ownerName}
          </div>
          <table className="w-full text-sm ml-8">
            <tbody>
              <tr>
                <td className="font-medium py-0.5" colSpan={2}>Descrição</td>
                <td className="font-medium py-0.5 text-right">Débito</td>
              </tr>
              {unit.items.map((item, j) => (
                <tr key={j}>
                  <td className="py-0.5" colSpan={2}>{item.description}</td>
                  <td className="text-right py-0.5">{fmt(item.amount)}</td>
                </tr>
              ))}
              <tr className="font-semibold border-t border-gray-300">
                <td className="py-1" colSpan={2}>Total da fração {unit.code}</td>
                <td className="text-right py-1">{fmt(unit.unitTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      <div className="border-t-2 border-gray-800 pt-2 mt-4">
        <table className="w-full text-sm">
          <tbody>
            <tr className="font-bold">
              <td>Total</td>
              <td className="text-right">{fmt(data.grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
