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
        Sem transações para mostrar
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-sm text-gray-400">
            <th className="pb-4 font-medium">Data</th>
            <th className="pb-4 font-medium">Descrição</th>
            <th className="pb-4 font-medium">Fração/Credor</th>
            <th className="pb-4 font-medium text-center">Estado</th>
            <th className="pb-4 font-medium text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx, i) => {
            const isUnassigned = !tx.unitId && !tx.creditorId && tx.category !== 'savings';
            const hasAllocations = tx.monthAllocations && tx.monthAllocations.length > 0;
            const isSavings = tx.category === 'savings';

            return (
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
                  {tx.unit?.code ?? tx.creditor?.name ?? (isSavings ? 'Poupança' : '-')}
                </td>
                <td className="py-4 text-center">
                  {isUnassigned ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      Sem atribuição
                    </span>
                  ) : !hasAllocations && !isSavings ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">
                      Sem alocação
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-600">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      OK
                    </span>
                  )}
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
