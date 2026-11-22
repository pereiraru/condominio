'use client';

import { useState, useMemo } from 'react';
import { Budget } from '@/lib/types';
import { BudgetLineInput, FeeSimulationConfig, UnitReportItem } from '../types';
import { computeFeeSimulation, fmtEur, formatUnitLabel, round2 } from '../utils';

interface BudgetAndFeeSimulatorTabProps {
  budgets: Budget[];
  units: UnitReportItem[];
  suggestedBudgetLines: BudgetLineInput[];
  baseYear: number;
  feeSimConfig: FeeSimulationConfig;
  onFeeSimConfigChange: (config: FeeSimulationConfig) => void;
  onBudgetsUpdated: () => Promise<void>;
}

export default function BudgetAndFeeSimulatorTab({
  budgets,
  units,
  suggestedBudgetLines,
  baseYear,
  feeSimConfig,
  onFeeSimConfigChange,
  onBudgetsUpdated,
}: BudgetAndFeeSimulatorTabProps) {
  const nextYear = baseYear + 1;
  const existingNextBudget = useMemo(
    () => budgets.find((b) => b.year === nextYear) || null,
    [budgets, nextYear]
  );

  const [editYear, setEditYear] = useState<number>(nextYear);
  const [notes, setNotes] = useState<string>(
    existingNextBudget?.notes ||
      `Previsão orçamental para ${nextYear} elaborada com base nos custos reais de ${baseYear}.`
  );
  const [lines, setLines] = useState<BudgetLineInput[]>(() => {
    if (existingNextBudget?.lines && existingNextBudget.lines.length > 0) {
      return existingNextBudget.lines.map((l) => ({
        category: l.category,
        description: l.description,
        monthlyAmount: l.monthlyAmount,
        annualAmount: l.annualAmount,
      }));
    }
    if (suggestedBudgetLines.length > 0) {
      return suggestedBudgetLines;
    }
    return [
      { category: 'elevator', description: 'Otis Elevadores', monthlyAmount: 118.42, annualAmount: 1421.04 },
      { category: 'electricity', description: 'Endesa Energia', monthlyAmount: 145.0, annualAmount: 1740.0 },
      { category: 'cleaning', description: 'Luar Limpeza', monthlyAmount: 118.0, annualAmount: 1416.0 },
    ];
  });
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const sim = useMemo(() => computeFeeSimulation(units, feeSimConfig), [units, feeSimConfig]);

  const budgetTotalMonthly = useMemo(
    () => round2(lines.reduce((sum, l) => sum + (Number(l.monthlyAmount) || 0), 0)),
    [lines]
  );
  const budgetTotalAnnual = useMemo(
    () => round2(lines.reduce((sum, l) => sum + (Number(l.annualAmount) || 0), 0)),
    [lines]
  );

  const projectedBalance = round2(sim.totalNewAnnual - budgetTotalAnnual);

  function loadRealExpensesFromBaseYear() {
    if (suggestedBudgetLines.length === 0) return;
    setLines(suggestedBudgetLines.map((l) => ({ ...l })));
    setSaveFeedback(null);
  }

  function loadBudgetToEditor(budget: Budget) {
    setEditYear(budget.year);
    setNotes(budget.notes || '');
    setLines(
      (budget.lines || []).map((l) => ({
        category: l.category,
        description: l.description,
        monthlyAmount: l.monthlyAmount,
        annualAmount: l.annualAmount,
      }))
    );
    setSaveFeedback(null);
  }

  function addLine() {
    setLines([
      ...lines,
      { category: 'other', description: '', monthlyAmount: 0, annualAmount: 0 },
    ]);
  }

  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index));
  }

  function updateLine(index: number, field: keyof BudgetLineInput, value: string | number) {
    const next = [...lines];
    const item = { ...next[index], [field]: value };
    if (field === 'monthlyAmount') {
      const m = parseFloat(String(value)) || 0;
      item.monthlyAmount = m;
      item.annualAmount = round2(m * 12);
    } else if (field === 'annualAmount') {
      const a = parseFloat(String(value)) || 0;
      item.annualAmount = a;
      item.monthlyAmount = round2(a / 12);
    }
    next[index] = item;
    setLines(next);
  }

  async function handleSaveBudget(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveFeedback(null);
    try {
      const simSummary =
        feeSimConfig.value !== 0 || Object.keys(feeSimConfig.customOverrides).length > 0
          ? ` Simulação de quotas: receita anual prevista ${fmtEur(sim.totalNewAnnual)} (${
              sim.annualImpact >= 0 ? '+' : ''
            }${fmtEur(sim.annualImpact)}/ano).`
          : '';
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: editYear,
          notes: `${notes.trim()}${simSummary}`.trim(),
          lines: lines.filter((l) => l.description.trim() !== ''),
        }),
      });
      if (res.ok) {
        await onBudgetsUpdated();
        setSaveFeedback(`Orçamento de ${editYear} guardado com sucesso.`);
      } else {
        setSaveFeedback('Erro ao guardar orçamento.');
      }
    } finally {
      setSaving(false);
    }
  }

  function handleOverrideChange(unitId: string, rawVal: string) {
    const nextOverrides = { ...feeSimConfig.customOverrides };
    if (rawVal.trim() === '') {
      delete nextOverrides[unitId];
    } else {
      const parsed = parseFloat(rawVal);
      if (!isNaN(parsed) && parsed >= 0) {
        nextOverrides[unitId] = parsed;
      }
    }
    onFeeSimConfigChange({ ...feeSimConfig, customOverrides: nextOverrides });
  }

  return (
    <div className="space-y-8">
      {/* PART 1: Orçamento de Despesas */}
      <div className="card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              1. Orçamento Anual de Despesas ({editYear})
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Defina as despesas previstas para {editYear}. Este orçamento alimenta o Relatório de Contas (Secção 7) e a Ata.
            </p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadRealExpensesFromBaseYear}
              className="btn-secondary text-xs py-2 px-3"
              title={`Carregar despesas apuradas em ${baseYear}`}
            >
              Preencher c/ Despesas Reais de {baseYear}
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveBudget} className="space-y-4">
          <div className="no-print grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div>
              <label className="label text-xs">Ano do Orçamento</label>
              <input
                type="number"
                className="input h-9 text-sm font-bold"
                value={editYear}
                onChange={(e) => setEditYear(parseInt(e.target.value, 10) || nextYear)}
                required
              />
            </div>
            <div className="md:col-span-3">
              <label className="label text-xs">Notas / Observações</label>
              <input
                type="text"
                className="input h-9 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas para assembleia / relatório de contas..."
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200 uppercase text-[10px] font-bold">
                  <th className="py-2 pr-3">Rubrica / Despesa</th>
                  <th className="py-2 px-3 text-right w-36">Mensal (€)</th>
                  <th className="py-2 px-3 text-right w-36">Anual (€)</th>
                  <th className="py-2 px-3 text-right w-20">%</th>
                  <th className="no-print py-2 pl-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((line, idx) => {
                  const pct =
                    budgetTotalAnnual > 0
                      ? ((Number(line.annualAmount) || 0) / budgetTotalAnnual) * 100
                      : 0;
                  return (
                    <tr key={idx}>
                      <td className="py-2 pr-3">
                        <input
                          type="text"
                          className="input h-9 text-sm print:border-none print:bg-transparent print:p-0 print:h-auto"
                          value={line.description}
                          onChange={(e) => updateLine(idx, 'description', e.target.value)}
                          placeholder="Ex: Manutenção Elevador"
                          required
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step="0.01"
                          className="input h-9 text-sm text-right print:border-none print:bg-transparent print:p-0 print:h-auto"
                          value={line.monthlyAmount}
                          onChange={(e) => updateLine(idx, 'monthlyAmount', e.target.value)}
                          required
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step="0.01"
                          className="input h-9 text-sm text-right font-semibold print:border-none print:bg-transparent print:p-0 print:h-auto"
                          value={line.annualAmount}
                          onChange={(e) => updateLine(idx, 'annualAmount', e.target.value)}
                          required
                        />
                      </td>
                      <td className="py-2 px-3 text-right text-gray-500 text-xs">
                        {pct.toFixed(1)}%
                      </td>
                      <td className="no-print py-2 pl-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="text-gray-400 hover:text-red-600 p-1"
                          title="Remover rubrica"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-800 bg-gray-50 font-bold">
                  <td className="py-3 pr-3">Total Orçamento de Despesas {editYear}</td>
                  <td className="py-3 px-3 text-right">{fmtEur(budgetTotalMonthly)}</td>
                  <td className="py-3 px-3 text-right text-gray-900">{fmtEur(budgetTotalAnnual)}</td>
                  <td className="py-3 px-3 text-right text-xs">100.0%</td>
                  <td className="no-print"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="no-print flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={addLine}
              className="text-sm font-bold text-primary-600 hover:text-primary-800"
            >
              + Adicionar Rubrica
            </button>
            <div className="flex items-center gap-3">
              {saveFeedback && (
                <span className="text-xs font-semibold text-green-700">{saveFeedback}</span>
              )}
              <button type="submit" disabled={saving} className="btn-primary text-sm">
                {saving ? 'A guardar...' : `Guardar Orçamento ${editYear}`}
              </button>
            </div>
          </div>
        </form>

        {/* Saved Budgets selector */}
        {budgets.length > 0 && (
          <div className="no-print mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase mr-2">
              Orçamentos guardados:
            </span>
            {budgets.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => loadBudgetToEditor(b)}
                className="px-3 py-1 rounded-lg text-xs font-bold border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700"
              >
                {b.year} ({fmtEur(b.lines?.reduce((s, l) => s + l.annualAmount, 0) || 0)})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* PART 2: Simulador de Aumento de Mensalidade das Frações */}
      <div className="card report-section-break">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            2. Simulação de Atualização / Aumento das Mensalidades ({editYear})
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Simule o aumento por percentagem (%) ou valor fixo (€) e visualize imediatamente a nova prestação mensal, o valor anual por condómino e o impacto total nas receitas anuais do prédio.
          </p>
        </div>

        {/* Simulation Controls */}
        <div className="no-print grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-200 mb-6">
          <div>
            <label className="label text-xs">Tipo de Aumento</label>
            <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white">
              <button
                type="button"
                onClick={() =>
                  onFeeSimConfigChange({
                    ...feeSimConfig,
                    mode: 'percentage',
                    value: feeSimConfig.mode === 'percentage' ? feeSimConfig.value : 5,
                    customOverrides: {},
                  })
                }
                className={`flex-1 py-2 text-xs font-bold transition-colors ${
                  feeSimConfig.mode === 'percentage'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Percentagem (%)
              </button>
              <button
                type="button"
                onClick={() =>
                  onFeeSimConfigChange({
                    ...feeSimConfig,
                    mode: 'fixed',
                    value: feeSimConfig.mode === 'fixed' ? feeSimConfig.value : 5,
                    customOverrides: {},
                  })
                }
                className={`flex-1 py-2 text-xs font-bold transition-colors ${
                  feeSimConfig.mode === 'fixed'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Valor Fixo (€)
              </button>
            </div>
          </div>

          <div>
            <label className="label text-xs">
              {feeSimConfig.mode === 'percentage' ? 'Aumento (%)' : 'Aumento Mensal (€)'}
            </label>
            <input
              type="number"
              step="0.5"
              className="input h-10 text-sm font-bold"
              value={feeSimConfig.value}
              onChange={(e) =>
                onFeeSimConfigChange({
                  ...feeSimConfig,
                  value: parseFloat(e.target.value) || 0,
                  customOverrides: {},
                })
              }
            />
          </div>

          <div>
            <label className="label text-xs">Arredondamento</label>
            <select
              className="input h-10 text-sm"
              value={feeSimConfig.rounding}
              onChange={(e) =>
                onFeeSimConfigChange({
                  ...feeSimConfig,
                  rounding: e.target.value as FeeSimulationConfig['rounding'],
                  customOverrides: {},
                })
              }
            >
              <option value="exact">Exato (cêntimos)</option>
              <option value="half_euro">Múltiplos de 0,50 €</option>
              <option value="integer">Euros inteiros</option>
            </select>
          </div>

          <div className="flex flex-col justify-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700 font-medium">
              <input
                type="checkbox"
                checked={feeSimConfig.applyToCommercialRcd}
                onChange={(e) =>
                  onFeeSimConfigChange({
                    ...feeSimConfig,
                    applyToCommercialRcd: e.target.checked,
                    customOverrides: {},
                  })
                }
                className="w-4 h-4 rounded"
              />
              Aplicar também ao RCD (20,00 €)
            </label>
            {Object.keys(feeSimConfig.customOverrides).length > 0 && (
              <button
                type="button"
                onClick={() =>
                  onFeeSimConfigChange({ ...feeSimConfig, customOverrides: {} })
                }
                className="text-[11px] text-amber-700 font-bold text-left mt-1 hover:underline"
              >
                Limpar ajustes manuais
              </button>
            )}
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/70">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Receita Mensal (Atual → Nova)
            </p>
            <p className="text-lg font-black text-gray-900 mt-1">
              {fmtEur(sim.totalCurrentMonthly)} → {fmtEur(sim.totalNewMonthly)}
            </p>
            <p className="text-xs font-semibold text-blue-700 mt-0.5">
              {sim.monthlyImpact >= 0 ? '+' : ''}
              {fmtEur(sim.monthlyImpact)} / mês
            </p>
          </div>

          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/70">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Receita Anual Prevista
            </p>
            <p className="text-lg font-black text-gray-900 mt-1">
              {fmtEur(sim.totalNewAnnual)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Atual: {fmtEur(sim.totalCurrentAnnual)} / ano
            </p>
          </div>

          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/70">
            <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
              Impacto nas Receitas ao Ano
            </p>
            <p className="text-xl font-black text-blue-900 mt-1">
              {sim.annualImpact >= 0 ? '+' : ''}
              {fmtEur(sim.annualImpact)}
            </p>
            <p className="text-xs font-semibold text-blue-700 mt-0.5">
              Variação global: {sim.overallPercentImpact >= 0 ? '+' : ''}
              {sim.overallPercentImpact.toFixed(2)}%
            </p>
          </div>

          <div
            className={`p-4 rounded-xl border ${
              projectedBalance >= 0
                ? 'border-green-200 bg-green-50/70'
                : 'border-red-200 bg-red-50/70'
            }`}
          >
            <p
              className={`text-[10px] font-bold uppercase tracking-wider ${
                projectedBalance >= 0 ? 'text-green-700' : 'text-red-700'
              }`}
            >
              Saldo Previsto (Receita − Orçamento)
            </p>
            <p
              className={`text-xl font-black mt-1 ${
                projectedBalance >= 0 ? 'text-green-900' : 'text-red-900'
              }`}
            >
              {projectedBalance >= 0 ? '+' : ''}
              {fmtEur(projectedBalance)}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              Orçamento {editYear}: {fmtEur(budgetTotalAnnual)}
            </p>
          </div>
        </div>

        {/* Unit-by-unit breakdown */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-800 text-[10px] uppercase text-gray-500 font-bold bg-gray-50">
                <th className="py-2 px-3 text-left">Fração</th>
                <th className="py-2 px-3 text-left">Proprietário</th>
                <th className="py-2 px-3 text-right">Quota Atual</th>
                <th className="py-2 px-3 text-right">Nova Prestação</th>
                <th className="py-2 px-3 text-right">Aumento Mensal</th>
                <th className="py-2 px-3 text-right">Anual Atual</th>
                <th className="py-2 px-3 text-right bg-blue-50 text-blue-900">Novo Anual</th>
                <th className="py-2 px-3 text-right">Impacto / Ano</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sim.rows.map((row) => (
                <tr key={row.unitId} className="hover:bg-gray-50/50">
                  <td className="py-2 px-3 font-bold text-gray-900">
                    {row.code}{' '}
                    <span className="text-[11px] font-normal text-gray-400">
                      ({formatUnitLabel(row.code)})
                    </span>
                  </td>
                  <td className="py-2 px-3 text-gray-700">{row.ownerName}</td>
                  <td className="py-2 px-3 text-right text-gray-600">
                    {fmtEur(row.currentMonthly)}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      className="w-24 text-right font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-sm print:border-none print:bg-transparent print:p-0"
                      value={
                        feeSimConfig.customOverrides[row.unitId] ?? row.newMonthly
                      }
                      onChange={(e) => handleOverrideChange(row.unitId, e.target.value)}
                    />
                  </td>
                  <td className="py-2 px-3 text-right text-xs font-semibold text-blue-700">
                    {row.monthlyDiff >= 0 ? '+' : ''}
                    {fmtEur(row.monthlyDiff)} ({row.percentDiff >= 0 ? '+' : ''}
                    {row.percentDiff.toFixed(1)}%)
                  </td>
                  <td className="py-2 px-3 text-right text-gray-500">
                    {fmtEur(row.currentAnnual)}
                  </td>
                  <td className="py-2 px-3 text-right font-bold bg-blue-50/40 text-blue-900">
                    {fmtEur(row.newAnnual)}
                  </td>
                  <td className="py-2 px-3 text-right font-semibold text-gray-800">
                    {row.annualDiff >= 0 ? '+' : ''}
                    {fmtEur(row.annualDiff)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-800 font-black bg-gray-900 text-white">
                <td className="py-2.5 px-3" colSpan={2}>
                  TOTAL ({sim.rows.length} frações)
                </td>
                <td className="py-2.5 px-3 text-right">{fmtEur(sim.totalCurrentMonthly)}</td>
                <td className="py-2.5 px-3 text-right">{fmtEur(sim.totalNewMonthly)}</td>
                <td className="py-2.5 px-3 text-right">
                  {sim.monthlyImpact >= 0 ? '+' : ''}
                  {fmtEur(sim.monthlyImpact)}
                </td>
                <td className="py-2.5 px-3 text-right">{fmtEur(sim.totalCurrentAnnual)}</td>
                <td className="py-2.5 px-3 text-right bg-blue-900">{fmtEur(sim.totalNewAnnual)}</td>
                <td className="py-2.5 px-3 text-right">
                  {sim.annualImpact >= 0 ? '+' : ''}
                  {fmtEur(sim.annualImpact)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
