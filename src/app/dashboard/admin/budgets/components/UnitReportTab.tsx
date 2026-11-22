'use client';

import { useState } from 'react';
import UnitFinancialReportCard from '@/components/UnitFinancialReportCard';
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
    </div>
  );
}
