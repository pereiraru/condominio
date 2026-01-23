import { Transaction } from '@/lib/types';

interface TransactionListProps {
  transactions: Transaction[];
  onRowClick?: (tx: Transaction) => void;
  selectedId?: string;
}

export default function TransactionList({ transactions, onRowClick, selectedId }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <p className="text-gray-400 text-center py-8">
        Sem transacoes para mostrar
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-sm text-gray-400">
            <th className="pb-4 font-medium">Data</th>
            <th className="pb-4 font-medium">Descricao</th>
            <th className="pb-4 font-medium">Fraccao/Credor</th>
            <th className="pb-4 font-medium text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx, i) => (
            <tr
              key={tx.id}
              className={`hover:bg-gray-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${selectedId === tx.id ? 'bg-gray-100' : ''} ${i !== transactions.length - 1 ? 'border-b border-gray-100' : ''}`}
              onClick={() => onRowClick?.(tx)}
            >
              <td className="py-4 text-sm text-gray-500">
                {new Date(tx.date).toLocaleDateString('pt-PT')}
              </td>
              <td className="py-4 text-sm text-gray-900 font-medium">{tx.description}</td>
              <td className="py-4 text-sm text-gray-500">
                {tx.unit?.code ?? tx.creditor?.name ?? '-'}
              </td>
              <td
                className={`py-4 text-sm text-right font-semibold ${
                  tx.amount >= 0 ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {tx.amount >= 0 ? '+' : ''}
                {tx.amount.toFixed(2)} EUR
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
