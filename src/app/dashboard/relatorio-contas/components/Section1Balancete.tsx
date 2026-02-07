interface Section1Props {
  data: {
    receitas: {
      orcamentoExercicio: number;
      quotasExtra: { description: string; amount: number }[];
      subTotalExercicio: number;
      receitasAnosAnteriores: number;
      receitasDesteExercicio: number;
      totalRecibos: number;
      totalReceitas: number;
    };
    despesas: {
      categories: { label: string; category: string; amount: number }[];
      totalDespesas: number;
      totalFixedExpected?: number;
    };
    saldoExercicio: number;
    saldoTransitar: number;
    saldoFinalDisponivel: number;
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
    <div className="report-section mb-12">
      <div className="grid grid-cols-2 gap-12 border-b-2 border-gray-800 pb-8">
        {/* Left: Receitas */}
        <div>
          <h4 className="font-bold text-base bg-gray-100 p-2 mb-4 border-l-4 border-gray-800">RECEITAS APURADAS</h4>
          <table className="w-full text-sm">
            <tbody>
              <tr className="font-bold">
                <td className="py-1">1. DO EXERCÍCIO DE {year}</td>
                <td className="text-right"></td>
              </tr>
              <tr>
                <td className="pl-4 py-1">1.1 Quotas de Condomínio</td>
                <td className="text-right">{fmt(data.receitas.receitasDesteExercicio)}</td>
              </tr>
              {data.receitas.quotasExtra.map((extra, i) => (
                <tr key={i}>
                  <td className="pl-4 py-1">1.{i + 2} {extra.description}</td>
                  <td className="text-right">{fmt(extra.amount)}</td>
                </tr>
              ))}
              
              <tr className="font-bold mt-4 block">
                <td className="py-1">2. DE EXERCÍCIOS ANTERIORES</td>
                <td className="text-right"></td>
              </tr>
              <tr>
                <td className="pl-4 py-1">2.1 Recebimentos de Dívidas</td>
                <td className="text-right">{fmt(data.receitas.receitasAnosAnteriores)}</td>
              </tr>

              <tr className="border-t-2 border-gray-400 font-bold">
                <td className="py-2">TOTAL DAS RECEITAS</td>
                <td className="text-right text-base">{fmt(data.receitas.totalReceitas)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Right: Despesas */}
        <div>
          <h4 className="font-bold text-base bg-gray-100 p-2 mb-4 border-l-4 border-gray-800">DESPESAS PAGAS</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase text-gray-500 font-bold border-b border-gray-200">
                <th className="text-left py-1">Descrição</th>
                <th className="text-right py-1">Pago</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-bold">
                <td className="py-1">1. NESTE EXERCÍCIO</td>
                <td className="text-right"></td>
              </tr>
              {data.despesas.categories.map((cat, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="pl-4 py-1">1.{i + 1} {cat.label}</td>
                  <td className="text-right">{fmt(cat.amount)}</td>
                </tr>
              ))}
              
              <tr className="border-t-2 border-gray-400 font-bold">
                <td className="py-2">TOTAL DAS DESPESAS</td>
                <td className="text-right text-base">{fmt(data.despesas.totalDespesas)}</td>
              </tr>
            </tbody>
          </table>
          
          {data.despesas.totalFixedExpected && data.despesas.totalFixedExpected > 0 && (
            <div className="mt-4 p-2 bg-blue-50/50 rounded border border-blue-100 text-[10px]">
              <div className="flex justify-between items-center text-blue-800">
                <span className="font-bold uppercase">Projeção de Custos Fixos {year}</span>
                <span className="font-black">{fmt(data.despesas.totalFixedExpected)}</span>
              </div>
              <p className="text-blue-600/70 mt-1 italic">Este valor representa o total contratual esperado para fornecedores com avenças fixas.</p>
            </div>
          )}
        </div>
      </div>

      {/* Summary Table */}
      <div className="mt-8 grid grid-cols-2 gap-12">
        <div>
          <h4 className="font-bold text-sm mb-2 text-gray-700 underline uppercase tracking-wider">Resumo de Saldos</h4>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="py-1 italic">Saldo do Exercício (Rec. - Desp.)</td>
                <td className="text-right font-semibold">{fmt(data.saldoExercicio)}</td>
              </tr>
              <tr>
                <td className="py-1 italic text-gray-600">Saldo que transitou de {year - 1}</td>
                <td className="text-right">{fmt(data.saldoTransitar)}</td>
              </tr>
              <tr className="border-t-2 border-gray-800 font-bold bg-gray-50">
                <td className="py-2">SALDO FINAL DISPONÍVEL</td>
                <td className="text-right text-base">{fmt(data.saldoFinalDisponivel)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h4 className="font-bold text-sm mb-2 text-gray-700 underline uppercase tracking-wider">Disponibilidades Bancárias</h4>
          <table className="w-full text-sm">
            <tbody>
              {data.contasBancarias.map((conta, i) => (
                <tr key={i}>
                  <td className="py-1">{conta.name}</td>
                  <td className="text-right">{fmt(conta.balance)}</td>
                </tr>
              ))}
              <tr className="border-t font-bold">
                <td className="py-1">Total em Banco / Caixa</td>
                <td className="text-right">{fmt(data.totalBankBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-12 mt-8">
        {data.despesasPorLiquidar > 0 && (
          <div className="bg-red-50 p-3 rounded border border-red-100">
            <div className="flex justify-between items-center text-sm font-bold text-red-800">
              <span>DESPESAS POR LIQUIDAR A 31-12-{year}</span>
              <span>{fmt(data.despesasPorLiquidar)}</span>
            </div>
          </div>
        )}
        {data.quotasPorLiquidar.total > 0 && (
          <div className="bg-orange-50 p-3 rounded border border-orange-100">
            <div className="flex justify-between items-center text-sm font-bold text-orange-800">
              <span>QUOTAS POR LIQUIDAR A 31-12-{year}</span>
              <span>{fmt(data.quotasPorLiquidar.total)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
