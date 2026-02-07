import InvoiceCategoryTable, { CategoryGroup } from './InvoiceCategoryTable';

interface Section4Props {
  data: CategoryGroup[];
  totalPaid: number;
  year: number;
}

export default function Section4PaidInvoices({ data, totalPaid, year }: Section4Props) {
  return (
    <InvoiceCategoryTable 
      title="Despesas Pagas"
      subtitle={`Período: 01-01-${year} a 31-12-${year}`}
      categories={data}
      totalAmount={totalPaid}
      showPaidAmount={true}
    />
  );
}