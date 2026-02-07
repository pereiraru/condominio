interface CreditNote {
  date: string;
  unitCode: string;
  entity: string;
  description: string;
  amount: number;
  settled: number;
  balance: number;
}

interface Section3Props {
  data: CreditNote[];
  year: number;
}

function fmt(value: number): string {
  return value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Section3CreditNotes({ data, year }: Section3Props) {
  if (data.length === 0) {
    return (
      <div className="report-section report-section-break mb-8">
        <h2 className="text-lg font-bold mb-1">Avisos e Créditos</h2>
        <p className="text-sm text-gray-600 mb-4">De: 01-01-{year} a 31-12-{year}</p>
        <p className="text-sm text-gray-500 italic">Sem dados para este período.</p>
      </div>
    );
  }

  const totalAmount = data.reduce((sum, n) => sum + n.amount, 0);
  const totalSettled = data.reduce((sum, n) => sum + n.settled, 0);
  const totalBalance = data.reduce((sum, n) => sum + n.balance, 0);

  return (
    <div className="report-section report-section-break mb-8">
      <h2 className="text-lg font-bold mb-1">Avisos e Créditos</h2>
      <p className="text-sm text-gray-600 mb-4">De: 01-01-{year} a 31-12-{year}</p>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-800">
            <th className="text-left py-1 pr-2">Data</th>
            <th className="text-left py-1 pr-2">Fração</th>
            <th className="text-left py-1 pr-2">Entidade</th>
            <th className="text-left py-1 pr-2">Descrição</th>
            <th className="text-right py-1 pr-2">Valor</th>
            <th className="text-right py-1 pr-2">Liquidado</th>
            <th className="text-right py-1">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {data.map((note, i) => (
            <tr key={i} className="border-b border-gray-200">
              <td className="py-1 pr-2">{note.date}</td>
              <td className="py-1 pr-2">{note.unitCode}</td>
              <td className="py-1 pr-2">{note.entity}</td>
              <td className="py-1 pr-2">{note.description}</td>
              <td className="text-right py-1 pr-2">{fmt(note.amount)}</td>
              <td className="text-right py-1 pr-2">{fmt(note.settled)}</td>
              <td className="text-right py-1">{fmt(note.balance)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-800 font-bold">
            <td className="py-2" colSpan={4}>Total</td>
            <td className="text-right py-2 pr-2">{fmt(totalAmount)}</td>
            <td className="text-right py-2 pr-2">{fmt(totalSettled)}</td>
            <td className="text-right py-2">{fmt(totalBalance)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
