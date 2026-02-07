'use client';

export interface Invoice {
  entryNumber?: string;
  invoiceNumber?: string;
  date: string;
  supplier: string;
  description: string;
  amountDue: number;
  amountPaid: number;
}

export interface CategoryGroup {
  category: string;
  categoryLabel: string;
  invoices: Invoice[];
  categoryTotal: number;
  categoryTotalPaid: number;
  documentCount: number;
}

interface InvoiceCategoryTableProps {
  title: string;
  subtitle: string;
  categories: CategoryGroup[];
  totalAmount: number;
  showPaidAmount?: boolean;
}

function fmt(value: number): string {
  return value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InvoiceCategoryTable({ title, subtitle, categories, totalAmount, showPaidAmount = false }: InvoiceCategoryTableProps) {
  if (categories.length === 0) {
    return (
      <div className="report-section report-section-break mb-8">
        <h2 className="text-lg font-bold mb-1 uppercase">{title}</h2>
        <p className="text-sm text-gray-600 mb-4">{subtitle}</p>
        <p className="text-sm text-gray-500 italic py-4 border-t border-gray-100 mt-2">Sem movimentos a registar.</p>
      </div>
    );
  }

  return (
    <div className="report-section report-section-break mb-8">
      <h2 className="text-lg font-bold mb-1 uppercase">{title}</h2>
      <p className="text-sm text-gray-600 mb-4">{subtitle}</p>

      <div className="space-y-8">
        {categories.map((group, idx) => (
          <div key={idx} className="bg-white">
            <div className="flex justify-between items-center border-b border-gray-800 pb-1 mb-2">
              <h3 className="font-bold text-sm text-gray-900 uppercase">
                {group.categoryLabel} ({group.documentCount} docs)
              </h3>
              <span className="text-[10px] font-bold bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                {showPaidAmount ? `Total Categoria: ${fmt(group.categoryTotalPaid)}€` : `Total em Dívida: ${fmt(group.categoryTotal - group.categoryTotalPaid)}€`}
              </span>
            </div>

            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="text-left text-gray-500 font-bold uppercase border-b border-gray-100 bg-gray-50/30">
                  <th className="py-1 pl-2 w-16">Nº Lanç.</th>
                  <th className="py-1 w-24">Data</th>
                  <th className="py-1 w-32">Fornecedor</th>
                  <th className="py-1">Descrição</th>
                  <th className="py-1 text-right w-24">Valor Doc.</th>
                  {showPaidAmount && <th className="py-1 text-right w-24 pr-2">Valor Pago</th>}
                  {!showPaidAmount && <th className="py-1 text-right w-24 pr-2">Em Dívida</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {group.invoices.map((inv, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-1 pl-2 text-gray-400 font-mono">{inv.entryNumber || '-'}</td>
                    <td className="py-1 whitespace-nowrap">{new Date(inv.date).toLocaleDateString('pt-PT')}</td>
                    <td className="py-1 font-semibold">{inv.supplier}</td>
                    <td className="py-1 text-gray-600 italic line-clamp-1">{inv.description}</td>
                    <td className="py-1 text-right font-medium">{fmt(inv.amountDue)}€</td>
                    {showPaidAmount ? (
                      <td className="py-1 text-right font-bold text-gray-900 pr-2">{fmt(inv.amountPaid)}€</td>
                    ) : (
                      <td className="py-1 text-right font-bold text-red-600 pr-2">{fmt(inv.amountDue - inv.amountPaid)}€</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-2 border-t-2 border-gray-800 flex justify-between items-center bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
        <span className="font-bold text-xs uppercase text-gray-600">Total Acumulado de {title}</span>
        <span className="text-lg font-black text-gray-900">{fmt(totalAmount)}€</span>
      </div>
    </div>
  );
}