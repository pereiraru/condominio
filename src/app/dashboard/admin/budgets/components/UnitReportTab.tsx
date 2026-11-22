'use client';

import { useEffect, useState } from 'react';
import UnitFinancialReportCard from '@/components/UnitFinancialReportCard';
import { UnitReportItem } from '../types';
import { fmtEur, formatUnitLabel } from '../utils';

interface UnitReportTabProps {
  units: UnitReportItem[];
  year: number;
  buildingName: string;
}

interface BatchSendResultRow {
  unitId: string;
  code: string;
  sent: boolean;
  recipients: string[];
  reason?: string;
  savedDefaultEmail?: string;
}

export default function UnitReportTab({ units, year, buildingName }: UnitReportTabProps) {
  const [selectedCode, setSelectedCode] = useState<string>(units[0]?.code || 'ALL');
  const [onlyDebtors, setOnlyDebtors] = useState<boolean>(false);
  const [customNotes, setCustomNotes] = useState<Record<string, string>>({});

  // Global batch email modal state
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [emailsMap, setEmailsMap] = useState<Record<string, string>>({});
  const [saveDefaultsOnBatch, setSaveDefaultsOnBatch] = useState(true);
  const [sendingBatch, setSendingBatch] = useState(false);
  const [batchResults, setBatchResults] = useState<Record<string, BatchSendResultRow>>({});
  const [batchSummary, setBatchSummary] = useState<{
    sentCount: number;
    totalRequested: number;
  } | null>(null);

  useEffect(() => {
    const initEmails: Record<string, string> = {};
    const initSelected: Record<string, boolean> = {};
    for (const u of units) {
      const defEmail = u.defaultEmail || u.currentOwner?.email || u.email || '';
      initEmails[u.id] = defEmail;
      initSelected[u.id] = Boolean(defEmail);
    }
    setEmailsMap(initEmails);
    setSelectedIds(initSelected);
  }, [units]);

  const visibleUnits = (() => {
    const base = onlyDebtors ? units.filter((u) => u.debtByYear.totalDebt > 0.01) : units;
    if (selectedCode === 'ALL') return base;
    const match = units.find((u) => u.code === selectedCode);
    return match ? [match] : base;
  })();

  function openBatchModal() {
    setBatchResults({});
    setBatchSummary(null);
    setBatchModalOpen(true);
  }

  function selectAllUnits() {
    const next: Record<string, boolean> = {};
    for (const u of units) next[u.id] = true;
    setSelectedIds(next);
  }

  function selectDebtorsOnly() {
    const next: Record<string, boolean> = {};
    for (const u of units) {
      next[u.id] = u.debtByYear.totalDebt > 0.01;
    }
    setSelectedIds(next);
  }

  function clearSelection() {
    setSelectedIds({});
  }

  async function handleSendBatch() {
    const items = units
      .filter((u) => selectedIds[u.id])
      .map((u) => ({
        unitId: u.id,
        email: (emailsMap[u.id] || '').trim(),
        customNote: customNotes[u.id],
        saveAsDefaultEmail: saveDefaultsOnBatch,
      }));

    if (items.length === 0) return;

    setSendingBatch(true);
    setBatchSummary(null);
    setBatchResults({});
    try {
      const res = await fetch('/api/admin/unit-reports/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, items }),
      });
      const data = await res.json();
      if (Array.isArray(data.results)) {
        const mapped: Record<string, BatchSendResultRow> = {};
        for (const r of data.results) {
          mapped[r.unitId] = r;
        }
        setBatchResults(mapped);
        setBatchSummary({
          sentCount: data.sentCount ?? 0,
          totalRequested: data.totalRequested ?? items.length,
        });
      }
    } catch (error) {
      console.error('Error sending batch unit reports:', error);
    } finally {
      setSendingBatch(false);
    }
  }

  const checkedCount = units.filter((u) => selectedIds[u.id]).length;

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

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={openBatchModal}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>Enviar por Email (Global)</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="btn-primary text-sm flex items-center gap-2"
          >
            Imprimir / PDF ({visibleUnits.length}{' '}
            {visibleUnits.length === 1 ? 'fração' : 'frações'})
          </button>
        </div>
      </div>

      {/* Rendered Reports */}
      {visibleUnits.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          Nenhuma fração corresponde ao filtro selecionado.
        </div>
      ) : (
        visibleUnits.map((unit, idx) => (
          <UnitFinancialReportCard
            key={unit.id}
            unit={unit}
            year={year}
            buildingName={buildingName}
            isAdmin
            customNote={customNotes[unit.id]}
            onCustomNoteChange={(val) => setCustomNotes({ ...customNotes, [unit.id]: val })}
            hasPageBreakBefore={idx > 0}
          />
        ))
      )}

      {/* Global Batch Email Modal */}
      {batchModalOpen && (
        <div className="no-print fixed inset-0 bg-black/45 backdrop-blur-[1px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-4xl w-full overflow-hidden">
            <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  Envio Global de Situação Financeira ({year})
                </h3>
                <p className="text-xs text-gray-300 mt-0.5">
                  Cada fração selecionada receberá por email o respetivo relatório individual completo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBatchModalOpen(false)}
                className="text-gray-300 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectAllUnits}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 font-semibold text-gray-700"
                  >
                    Selecionar Todas ({units.length})
                  </button>
                  <button
                    type="button"
                    onClick={selectDebtorsOnly}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 font-semibold text-red-700"
                  >
                    Apenas em Dívida
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 font-semibold text-gray-600"
                  >
                    Limpar Seleção
                  </button>
                </div>

                <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveDefaultsOnBatch}
                    onChange={(e) => setSaveDefaultsOnBatch(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span>Guardar emails preenchidos como padrão da fração</span>
                </label>
              </div>

              {batchSummary && (
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold ${
                    batchSummary.sentCount === batchSummary.totalRequested
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  Envio concluído: {batchSummary.sentCount} de {batchSummary.totalRequested} relatórios enviados com sucesso.
                </div>
              )}

              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3 text-left w-10">Enviar</th>
                      <th className="py-2.5 px-3 text-left">Fração / Condómino</th>
                      <th className="py-2.5 px-3 text-right">Situação</th>
                      <th className="py-2.5 px-3 text-left">Email(s) de Destino</th>
                      <th className="py-2.5 px-3 text-right">Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {units.map((u) => {
                      const rowResult = batchResults[u.id];
                      return (
                        <tr key={u.id} className="hover:bg-gray-50/70">
                          <td className="py-2 px-3">
                            <input
                              type="checkbox"
                              checked={Boolean(selectedIds[u.id])}
                              onChange={(e) =>
                                setSelectedIds({ ...selectedIds, [u.id]: e.target.checked })
                              }
                              className="w-4 h-4 rounded"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <p className="font-bold text-gray-900">
                              {u.code} ({formatUnitLabel(u.code)})
                            </p>
                            <p className="text-[11px] text-gray-500">
                              {u.currentOwner?.name || 'N/D'}
                            </p>
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">
                            {u.debtByYear.totalDebt > 0.01 ? (
                              <span className="font-bold text-red-600">
                                {fmtEur(u.debtByYear.totalDebt)}
                              </span>
                            ) : (
                              <span className="font-semibold text-emerald-600">Regularizado</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              className="input h-8 text-xs px-2.5 bg-white"
                              placeholder="Sem email — introduza manualmente..."
                              value={emailsMap[u.id] || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEmailsMap({ ...emailsMap, [u.id]: val });
                                if (val.trim() && !selectedIds[u.id]) {
                                  setSelectedIds({ ...selectedIds, [u.id]: true });
                                }
                              }}
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            {rowResult ? (
                              rowResult.sent ? (
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                  Enviado
                                </span>
                              ) : (
                                <span
                                  className="text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full"
                                  title={rowResult.reason}
                                >
                                  {rowResult.reason || 'Falhou'}
                                </span>
                              )
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBatchModalOpen(false)}
                  className="btn-secondary text-sm"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  disabled={sendingBatch || checkedCount === 0}
                  onClick={handleSendBatch}
                  className="btn-primary text-sm"
                >
                  {sendingBatch
                    ? 'A enviar relatórios...'
                    : `Enviar Selecionados (${checkedCount})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
