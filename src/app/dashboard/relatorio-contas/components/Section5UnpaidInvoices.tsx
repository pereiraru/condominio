import InvoiceCategoryTable, { CategoryGroup } from './InvoiceCategoryTable';

interface Section5Props {
  data: CategoryGroup[];
  totalUnpaid: number;
  year: number;
}

export default function Section5UnpaidInvoices({ data, totalUnpaid, year }: Section5Props) {
  return (
    <InvoiceCategoryTable 
      title="Despesas por Liquidar"
      subtitle={`Situação a 31-12-${year}`}
      categories={data}
      totalAmount={totalUnpaid}
      showPaidAmount={false}
    />
  );
}