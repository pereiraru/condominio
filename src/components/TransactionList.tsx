import { Transaction } from '@/lib/types';

interface TransactionListProps {
  transactions: Transaction[];
}

export default function TransactionList({ transactions }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <p className="text-gray-500 text-center py-8">
        Sem transacoes para mostrar
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-sm text-gray-500 border-b">
            <th className="pb-3 font-medium">Data</th>
            <th className="pb-3 font-medium">Descricao</th>
            <th className="pb-3 font-medium">Fraccao/Credor</th>
            <th className="pb-3 font-medium text-right">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {transactions.map((tx) => (
            <tr key={tx.id} className="hover:bg-gray-50">
              <td className="py-3 text-sm text-gray-600">
                {new Date(tx.date).toLocaleDateString('pt-PT')}
              </td>
              <td className="py-3 text-sm text-gray-900">{tx.description}</td>
              <td className="py-3 text-sm text-gray-600">
                {tx.unit?.code ?? tx.creditor?.name ?? '-'}
              </td>
              <td
                className={`py-3 text-sm text-right font-medium ${
                  tx.amount >= 0 ? 'text-green-600' : 'text-red-600'
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
