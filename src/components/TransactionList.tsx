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
          <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
            <th className="pb-3 font-semibold">Data</th>
            <th className="pb-3 font-semibold">Descrição</th>
            <th className="pb-3 font-semibold">Fração/Credor</th>
            <th className="pb-3 font-semibold text-center">Estado</th>
            <th className="pb-3 font-semibold text-right">Valor</th>
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
                className={`hover:bg-slate-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${selectedId === tx.id ? 'bg-slate-100' : ''} ${i !== transactions.length - 1 ? 'border-b border-slate-100' : ''}`}
                onClick={() => onRowClick?.(tx)}
              >
                <td className="py-4 text-sm text-slate-500 whitespace-nowrap pr-3">
                  {new Date(tx.date).toLocaleDateString('pt-PT')}
                </td>
                <td className="py-4 text-sm text-slate-900 font-medium pr-3">{tx.description}</td>
                <td className="py-4 text-sm text-slate-500 pr-3">
                  {tx.unit?.code ?? tx.creditor?.name ?? (isSavings ? 'Poupança' : '—')}
                </td>
                <td className="py-4 text-center">
                  {isUnassigned ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      Sem atribuição
                    </span>
                  ) : !hasAllocations && !isSavings ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                      Sem alocação
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      OK
                    </span>
                  )}
                </td>
                <td
                  className={`py-4 text-sm text-right font-semibold whitespace-nowrap ${
                    tx.amount >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {tx.amount >= 0 ? '+' : ''}
                  {tx.amount.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
