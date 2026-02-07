interface InvoiceCategory {
  category: string;
  categoryLabel: string;
  invoices: {
    entryNumber: string;
    invoiceNumber: string;
    date: string;
    supplier: string;
    description: string;
    amountDue: number;
    amountPaid: number;
  }[];
  categoryTotal: number;
  categoryTotalPaid: number;
  documentCount: number;
}

interface Section5Props {
  data: InvoiceCategory[];
  totalUnpaid: number;
  year: number;
}

function fmt(value: number): string {
  return value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Section5UnpaidInvoices({ data, totalUnpaid, year }: Section5Props) {
  if (data.length === 0) {
    return (
      <div className="report-section report-section-break mb-8">
        <h2 className="text-lg font-bold mb-1">Documentos de Fornecedores por Liquidar</h2>
        <p className="text-sm text-gray-600 mb-4">Até 31-12-{year}</p>
        <p className="text-sm text-gray-500 italic">Sem dados para este período.</p>
      </div>
    );
  }

  return (
    <div className="report-section report-section-break mb-8">
      <h2 className="text-lg font-bold mb-1">Documentos de Fornecedores por Liquidar</h2>
      <p className="text-sm text-gray-600 mb-4">Até 31-12-{year}</p>

      {data.map((cat, catIdx) => (
        <div key={catIdx} className="mb-6">
          <h3 className="font-semibold text-sm border-b border-gray-400 pb-1 mb-2">{cat.categoryLabel}</h3>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-1 pr-1">Nº Lanç.</th>
                <th className="text-left py-1 pr-1">Nº Doc.</th>
                <th className="text-left py-1 pr-1">Emissão</th>
                <th className="text-left py-1 pr-1">Fornecedor</th>
                <th className="text-left py-1 pr-1">Descrição</th>
                <th className="text-right py-1 pr-1">Valor</th>
                <th className="text-right py-1 pr-1">Pago</th>
                <th className="text-right py-1">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {cat.invoices.map((inv, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1 pr-1">{inv.entryNumber}</td>
                  <td className="py-1 pr-1">{inv.invoiceNumber}</td>
                  <td className="py-1 pr-1">{inv.date}</td>
                  <td className="py-1 pr-1">{inv.supplier}</td>
                  <td className="py-1 pr-1">{inv.description}</td>
                  <td className="text-right py-1 pr-1">{fmt(inv.amountDue)}</td>
                  <td className="text-right py-1 pr-1">{fmt(inv.amountPaid)}</td>
                  <td className="text-right py-1">{fmt(inv.amountDue - inv.amountPaid)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-400 font-semibold text-xs">
                <td colSpan={5} className="py-1">
                  Total - {cat.categoryLabel} [ {cat.documentCount} documentos ]
                </td>
                <td className="text-right py-1 pr-1">{fmt(cat.categoryTotal)}</td>
                <td className="text-right py-1 pr-1">{fmt(cat.categoryTotalPaid)}</td>
                <td className="text-right py-1">{fmt(cat.categoryTotal - cat.categoryTotalPaid)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}

      <div className="border-t-2 border-gray-800 pt-2 mt-4">
        <table className="w-full text-sm">
          <tbody>
            <tr className="font-bold">
              <td>Total</td>
              <td className="text-right">{fmt(totalUnpaid)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
