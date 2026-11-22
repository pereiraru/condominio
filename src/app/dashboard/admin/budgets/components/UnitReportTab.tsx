'use client';

import { useState } from 'react';
import { UnitReportItem } from '../types';
import { fmtEur, formatUnitLabel } from '../utils';

interface UnitReportTabProps {
  units: UnitReportItem[];
  year: number;
  buildingName: string;
}

export default function UnitReportTab({ units, year, buildingName }: UnitReportTabProps) {
  const [selectedCode, setSelectedCode] = useState<string>(units[0]?.code || 'ALL');
  const [onlyDebtors, setOnlyDebtors] = useState<boolean>(false);
  const [customNotes, setCustomNotes] = useState<Record<string, string>>({});

  const visibleUnits = (() => {
    const base = onlyDebtors ? units.filter((u) => u.debtByYear.totalDebt > 0.01) : units;
    if (selectedCode === 'ALL') return base;
    const match = units.find((u) => u.code === selectedCode);
    return match ? [match] : base;
  })();

  function getNotes(unit: UnitReportItem): string {
    return customNotes[unit.id] ?? unit.autoNotes;
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="no-print card flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="label text-xs">Selecionar Fração</label>
            <select
              className="input h-10 text-sm w-64"
              value={selectedCode}
              onChange={(e) => setSelectedCode(e.target.value)}
            >
              <option value="ALL">Todas as Frações (Impressão em Lote)</option>
              {units.map((u) => (
                <option key={u.id} value={u.code}>
                  {u.code} ({formatUnitLabel(u.code)}) — {u.currentOwner?.name || 'N/D'}
                  {u.debtByYear.totalDebt > 0.01 ? ` [Dívida: ${fmtEur(u.debtByYear.totalDebt)}]` : ' [Em dia]'}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700 pt-5">
            <input
              type="checkbox"
              checked={onlyDebtors}
              onChange={(e) => {
                setOnlyDebtors(e.target.checked);
                if (e.target.checked) setSelectedCode('ALL');
              }}
              className="w-4 h-4 rounded"
            />
            Mostrar apenas frações em dívida (quando em lote)
          </label>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="btn-primary text-sm flex items-center gap-2"
        >
          Imprimir / PDF ({visibleUnits.length}{' '}
          {visibleUnits.length === 1 ? 'fração' : 'frações'})
        </button>
      </div>

      {/* Rendered Reports */}
      {visibleUnits.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          Nenhuma fração corresponde ao filtro selecionado.
        </div>
      ) : (
        visibleUnits.map((unit, idx) => (
          <div
            key={unit.id}
            className={`report-container bg-white rounded-2xl shadow-sm p-8 print:p-0 border border-gray-100 print:border-none ${
              idx > 0 ? 'report-section-break mt-8 print:mt-0' : ''
            }`}
          >
            {/* Header */}
            <div className="border-b-2 border-gray-800 pb-4 mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                  Administração de Condomínio — {buildingName}
                </p>
                <h2 className="text-2xl font-black text-gray-900 mt-1">
                  Situação Financeira — Fração {unit.code} ({formatUnitLabel(unit.code)})
                </h2>
                <p className="text-sm text-gray-700 mt-1">
                  Condómino: <span className="font-bold">{unit.currentOwner?.name || 'N/D'}</span>
                  {unit.currentOwner?.email ? ` • ${unit.currentOwner.email}` : ''}
                  {unit.currentOwner?.telefone ? ` • Tel.: ${unit.currentOwner.telefone}` : ''}
                </p>
              </div>
              <div className="text-left sm:text-right text-xs text-gray-500">
                <p>Data de emissão: {new Date().toLocaleDateString('pt-PT')}</p>
                <p>Período analisado: 2024 – {year} (inclui saldo Pré-2024)</p>
              </div>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <div className="p-3 rounded-xl border border-gray-200 bg-gray-50">
                <p className="text-[10px] font-bold uppercase text-gray-400">Quota Atual</p>
                <p className="text-lg font-black text-gray-900">{fmtEur(unit.monthlyFee)}</p>
                <p className="text-[10px] text-gray-500">/ mês</p>
              </div>
              <div className="p-3 rounded-xl border border-orange-200 bg-orange-50/50">
                <p className="text-[10px] font-bold uppercase text-orange-700">Dívida Pré-2024</p>
                <p className="text-lg font-black text-orange-800">{fmtEur(unit.pre2024.remaining)}</p>
                <p className="text-[10px] text-orange-600">
                  Inicial: {fmtEur(unit.pre2024.initial)} | Pago: {fmtEur(unit.pre2024.paid)}
                </p>
              </div>
              <div className="p-3 rounded-xl border border-gray-200 bg-gray-50">
                <p className="text-[10px] font-bold uppercase text-gray-500">Dívida 2024–{year - 1}</p>
                <p
                  className={`text-lg font-black ${
                    unit.debtByYear.pastYearsDebt > 0.01 ? 'text-red-700' : 'text-green-700'
                  }`}
                >
                  {fmtEur(unit.debtByYear.pastYearsDebt)}
                </p>
              </div>
              <div className="p-3 rounded-xl border border-gray-200 bg-gray-50">
                <p className="text-[10px] font-bold uppercase text-gray-500">Dívida {year}</p>
                <p
                  className={`text-lg font-black ${
                    unit.debtByYear.currentYearDebt > 0.01 ? 'text-red-700' : 'text-green-700'
                  }`}
                >
                  {fmtEur(unit.debtByYear.currentYearDebt)}
                </p>
              </div>
              <div
                className={`p-3 rounded-xl border-2 ${
                  unit.debtByYear.totalDebt > 0.01
                    ? 'border-red-600 bg-red-50'
                    : 'border-green-600 bg-green-50'
                }`}
              >
                <p
                  className={`text-[10px] font-bold uppercase ${
                    unit.debtByYear.totalDebt > 0.01 ? 'text-red-700' : 'text-green-700'
                  }`}
                >
                  Total em Dívida
                </p>
                <p
                  className={`text-xl font-black ${
                    unit.debtByYear.totalDebt > 0.01 ? 'text-red-800' : 'text-green-800'
                  }`}
                >
                  {unit.debtByYear.totalDebt > 0.01
                    ? fmtEur(unit.debtByYear.totalDebt)
                    : 'Regularizado'}
                </p>
              </div>
            </div>

            {/* Clarifications / Esclarecimentos */}
            <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50/50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  Esclarecimentos e Justificação dos Valores
                </h3>
                <span className="no-print text-[10px] text-amber-700">
                  Editável antes de imprimir
                </span>
              </div>
              <textarea
                rows={Math.max(2, getNotes(unit).split('\n').length + 1)}
                className="no-print w-full text-xs text-gray-800 bg-white border border-amber-200 rounded-lg p-2.5 leading-relaxed"
                value={getNotes(unit)}
                onChange={(e) =>
                  setCustomNotes({ ...customNotes, [unit.id]: e.target.value })
                }
              />
              <div className="hidden print:block text-xs text-gray-900 whitespace-pre-line leading-relaxed">
                {getNotes(unit)}
              </div>
            </div>

            {/* Monthly Grid 2024..targetYear */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2">
                Mapa de Quotas Mensais (2024 – {year})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300 text-gray-700 font-bold">
                      <th className="py-1.5 px-2 text-left border-r border-gray-300">Ano</th>
                      {unit.yearsGrid[0]?.months.map((m) => (
                        <th key={m.month} className="py-1.5 px-1 text-center border-r border-gray-300">
                          {m.label}
                        </th>
                      ))}
                      <th className="py-1.5 px-2 text-right border-r border-gray-300 bg-green-50">
                        Pago
                      </th>
                      <th className="py-1.5 px-2 text-right bg-red-50">Em Falta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unit.yearsGrid.map((yg) => (
                      <tr key={yg.year} className="border-b border-gray-200">
                        <td className="py-1.5 px-2 font-bold border-r border-gray-300 bg-gray-50">
                          {yg.year}
                        </td>
                        {yg.months.map((cell) => {
                          const cls =
                            cell.status === 'paid'
                              ? 'bg-green-50 text-green-800 font-semibold'
                              : cell.status === 'partial'
                              ? 'bg-yellow-50 text-yellow-800 font-bold'
                              : cell.status === 'unpaid'
                              ? 'bg-red-50 text-red-700 font-bold'
                              : 'text-gray-300';
                          return (
                            <td
                              key={cell.month}
                              className={`py-1.5 px-1 text-center border-r border-gray-200 ${cls}`}
                              title={`${cell.fullLabel}: Pago ${cell.paid.toFixed(2)}€ / Previsto ${cell.expected.toFixed(2)}€`}
                            >
                              {cell.paid > 0
                                ? Number.isInteger(cell.paid)
                                  ? cell.paid
                                  : cell.paid.toFixed(1)
                                : cell.status === 'unpaid'
                                ? '0'
                                : '—'}
                            </td>
                          );
                        })}
                        <td className="py-1.5 px-2 text-right font-bold border-r border-gray-300 bg-green-50/40 text-green-800">
                          {fmtEur(yg.paid)}
                        </td>
                        <td
                          className={`py-1.5 px-2 text-right font-bold ${
                            yg.debt > 0.01 ? 'text-red-700 bg-red-50/40' : 'text-gray-400'
                          }`}
                        >
                          {yg.debt > 0.01 ? fmtEur(yg.debt) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payments History Table */}
            <div>
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-2">
                Pagamentos Registados ({unit.payments.length} movimentos — Total:{' '}
                {fmtEur(unit.totalPaidDigital)})
              </h3>
              {unit.payments.length === 0 ? (
                <p className="text-xs text-gray-500 italic">
                  Sem pagamentos registados entre 2024 e {year}.
                </p>
              ) : (
                <table className="w-full text-xs border-collapse border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-300 text-gray-600 font-bold">
                      <th className="py-1.5 px-2 text-left border-r border-gray-200 w-24">Data</th>
                      <th className="py-1.5 px-2 text-left border-r border-gray-200">Descrição</th>
                      <th className="py-1.5 px-2 text-left border-r border-gray-200">Alocação</th>
                      <th className="py-1.5 px-2 text-right w-24">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unit.payments.map((tx) => (
                      <tr key={tx.id} className="border-b border-gray-100">
                        <td className="py-1 px-2 border-r border-gray-200 font-mono text-[11px]">
                          {tx.date}
                        </td>
                        <td className="py-1 px-2 border-r border-gray-200">{tx.description}</td>
                        <td className="py-1 px-2 border-r border-gray-200 text-gray-600 text-[11px]">
                          {tx.allocations.length > 0
                            ? tx.allocations
                                .map((a) =>
                                  a.month === 'PREV-DEBT'
                                    ? `Abat. Pré-2024 (${a.amount.toFixed(2)}€)`
                                    : `${a.month} (${a.amount.toFixed(2)}€)`
                                )
                                .join(', ')
                            : 'Por alocar'}
                        </td>
                        <td className="py-1 px-2 text-right font-bold text-green-800">
                          {fmtEur(tx.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
