interface Section1Props {
  data: {
    receitas: {
      orcamentoExercicio: number;
      quotasExtra: { description: string; amount: number }[];
      subTotalExercicio: number;
      receitasAnosAnteriores: number;
      totalRecibos: number;
      totalReceitas: number;
    };
    despesas: {
      categories: { label: string; category: string; amount: number }[];
      totalDespesas: number;
    };
    saldoExercicio: number;
    saldoTransitar: number;
    contasBancarias: { name: string; accountType: string; balance: number; description: string | null }[];
    totalBankBalance: number;
    despesasPorLiquidar: number;
    quotasPorLiquidar: { total: number };
  };
  year: number;
}

function fmt(value: number): string {
  return value.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export default function Section1Balancete({ data, year }: Section1Props) {
  return (
    <div className="report-section mb-8">
      <h2 className="text-lg font-bold text-center mb-1">BALANCETE DE RECEITAS E DESPESAS</h2>
      <h3 className="text-base font-semibold text-center mb-4 italic">RELATÓRIO DE CONTAS</h3>
      <p className="text-sm text-center text-gray-600 mb-6">
        PERÍODO: 01 DE JANEIRO A 31 DE DEZEMBRO DE {year}
      </p>

      <div className="grid grid-cols-2 gap-8">
        {/* Left: Receitas */}
        <div>
          <h4 className="font-bold text-sm border-b-2 border-gray-800 pb-1 mb-2">Receitas Apuradas</h4>
          <table className="w-full text-sm">
            <tbody>
              <tr className="font-semibold">
                <td colSpan={2}>1. Do Exercício</td>
              </tr>
              <tr>
                <td className="pl-4">1.1 Orçamento Exercício</td>
                <td className="text-right">{fmt(data.receitas.orcamentoExercicio)}</td>
              </tr>
              {data.receitas.quotasExtra.map((extra, i) => (
                <tr key={i}>
                  <td className="pl-4">1.{i + 2} {extra.description}</td>
                  <td className="text-right">{fmt(extra.amount)}</td>
                </tr>
              ))}
              <tr className="font-semibold border-t">
                <td>Sub Total</td>
                <td className="text-right">{fmt(data.receitas.subTotalExercicio)}</td>
              </tr>
              {data.receitas.receitasAnosAnteriores > 0 && (
                <>
                  <tr className="font-semibold mt-2">
                    <td colSpan={2}>2. Exercícios Anteriores</td>
                  </tr>
                  <tr>
                    <td className="pl-4">2.1 Orçamento</td>
                    <td className="text-right">{fmt(data.receitas.receitasAnosAnteriores)}</td>
                  </tr>
                </>
              )}
              <tr className="font-bold border-t-2 border-gray-800 mt-2">
                <td>Total dos Recibos Emitidos</td>
                <td className="text-right">{fmt(data.receitas.totalRecibos)}</td>
              </tr>
              <tr className="font-bold border-t-2 border-gray-800 mt-2">
                <td>Total das Receitas Apuradas</td>
                <td className="text-right">{fmt(data.receitas.totalReceitas)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Right: Despesas */}
        <div>
          <h4 className="font-bold text-sm border-b-2 border-gray-800 pb-1 mb-2">Despesas Pagas</h4>
          <table className="w-full text-sm">
            <tbody>
              <tr className="font-semibold">
                <td colSpan={2}>1. Neste Exercício</td>
              </tr>
              {data.despesas.categories.map((cat, i) => (
                <tr key={i}>
                  <td className="pl-4">1.{i + 1} {cat.label}</td>
                  <td className="text-right">{fmt(cat.amount)}</td>
                </tr>
              ))}
              <tr className="font-bold border-t-2 border-gray-800 mt-2">
                <td>Total das Despesas</td>
                <td className="text-right">{fmt(data.despesas.totalDespesas)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Saldo */}
      <div className="mt-6 border-t-2 border-gray-800 pt-4">
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="w-1/2">1. Saldo do Exercício (Receitas - Despesas)</td>
              <td className="text-right font-semibold">{fmt(data.saldoExercicio)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Bank Accounts */}
      {data.contasBancarias.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <table className="w-full text-sm">
            <tbody>
              {data.contasBancarias.map((conta, i) => (
                <tr key={i}>
                  <td>{i + 1}. {conta.name}{conta.description ? ` (${conta.description})` : ''}</td>
                  <td className="text-right">{fmt(conta.balance)}</td>
                </tr>
              ))}
              <tr className="font-bold border-t">
                <td>Total</td>
                <td className="text-right">{fmt(data.totalBankBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Despesas por Liquidar */}
      {data.despesasPorLiquidar > 0 && (
        <div className="mt-6 border-t pt-4">
          <table className="w-full text-sm">
            <tbody>
              <tr className="font-semibold">
                <td>Despesas por Liquidar a 31-12-{year}</td>
                <td className="text-right">{fmt(data.despesasPorLiquidar)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Quotas por Liquidar */}
      {data.quotasPorLiquidar.total > 0 && (
        <div className="mt-6 border-t pt-4">
          <table className="w-full text-sm">
            <tbody>
              <tr className="font-semibold">
                <td>Quotas por Liquidar a 31-12-{year}</td>
                <td className="text-right">{fmt(data.quotasPorLiquidar.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
