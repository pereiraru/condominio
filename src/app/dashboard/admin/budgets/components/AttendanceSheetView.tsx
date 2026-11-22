'use client';

import {
  AttendanceStatus,
  computeQuorumSummary,
  formatMeetingDateLong,
  QuorumMode,
} from '@/lib/meetings';
import { UnitReportItem } from '../types';
import { formatUnitLabel, round2 } from '../utils';

interface AttendanceSheetViewProps {
  buildingName: string;
  actaNumber: string;
  assemblyType: 'Ordinária' | 'Extraordinária';
  meetingDate: string;
  startTime: string;
  firstConvocationTime?: string;
  location: string;
  units: UnitReportItem[];
  quorumMode: QuorumMode;
  attendance: Record<string, AttendanceStatus>;
  permilagens: Record<string, number>;
  representatives: Record<string, string>;
  mode: 'signin' | 'filled' | 'blank';
}

export default function AttendanceSheetView({
  buildingName,
  actaNumber,
  assemblyType,
  meetingDate,
  startTime,
  firstConvocationTime,
  location,
  units,
  quorumMode,
  attendance,
  permilagens,
  representatives,
  mode,
}: AttendanceSheetViewProps) {
  const quorum = computeQuorumSummary({
    unitIds: units.map((u) => u.id),
    attendance: { statuses: attendance, permilagens, representatives },
    quorumMode,
  });

  const totalPermilagemBuilding = round2(
    units.reduce((sum, u) => sum + (permilagens[u.id] ?? u.permilagem ?? 62.5), 0)
  );

  const isSignIn = mode === 'signin';
  const isBlank = mode === 'blank';
  const showCheckboxes = isSignIn || isBlank;
  const rowPadClass = isSignIn ? 'py-2.5' : 'py-1.5';

  const summaryPercent =
    quorumMode === 'permilagem' ? quorum.percentByPermilagem : quorum.percentByUnits;

  const colSpanBeforeTotals = isSignIn ? 2 : 2;

  return (
    <div className="attendance-sheet-print space-y-4 print:space-y-2">
      {isSignIn ? (
        <div className="space-y-3 print:space-y-1.5">
          <div className="text-center border-b-2 border-gray-800 pb-3 print:pb-1.5">
            <p className="text-[11px] print:text-[9.5px] font-bold uppercase tracking-widest text-gray-600">
              Condomínio do Edifício sito na {buildingName}
            </p>
            <h1 className="text-xl print:text-[15px] print:leading-tight font-black uppercase mt-1 print:mt-0.5">
              FOLHA DE PRESENÇAS E ASSINATURAS — ACTA N.º {actaNumber || '___'}
            </h1>
            <p className="text-xs print:text-[10px] uppercase font-bold text-gray-500 mt-0.5 print:mt-0">
              Assembleia Geral {assemblyType} de Condóminos
            </p>
          </div>

          <div className="attendance-sheet-meta grid grid-cols-2 gap-x-6 gap-y-1 print:gap-x-4 print:gap-y-0.5 p-3 print:px-2.5 print:py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs print:text-[10px] print:leading-snug">
            <div>
              <strong>Data:</strong> {formatMeetingDateLong(meetingDate)}
            </div>
            <div>
              <strong>Hora:</strong>{' '}
              {firstConvocationTime
                ? `1.ª Conv.: ${firstConvocationTime} h / 2.ª Conv.: ${startTime} h`
                : `${startTime} h`}
            </div>
            <div className="col-span-2">
              <strong>Local:</strong> {location}
            </div>
            <div className="col-span-2 text-[11px] print:text-[9.5px] text-gray-700 pt-1 print:pt-0.5 border-t border-gray-200 mt-1 print:mt-0.5">
              <strong>Quórum legal ({quorumMode === 'units' ? 'por frações' : 'por permilagem'}):</strong>{' '}
              {quorumMode === 'units'
                ? `1.ª Convocatória ≥ ${quorum.minUnitsFirst} de ${quorum.totalUnits} frações • 2.ª Convocatória ≥ ${quorum.minUnitsSecond} de ${quorum.totalUnits} frações.`
                : '1.ª Convocatória > 500‰ • 2.ª Convocatória ≥ 250‰.'}
            </div>
          </div>
        </div>
      ) : (
        <h2 className="text-sm font-black uppercase border-b-2 border-gray-800 pb-1">
          Folha de Presenças{quorumMode === 'permilagem' ? ', Permilagens' : ''} e Assinaturas — Acta N.º{' '}
          {isBlank ? '_____' : actaNumber || '___'}
        </h2>
      )}

      <div className="overflow-x-auto print:overflow-visible">
      <table className="attendance-sheet-table w-full text-xs print:text-[10.5px] print:leading-tight border-collapse border border-gray-400">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-400 font-bold">
            <th className="py-1.5 px-2 print:py-1 print:px-1.5 text-left border-r border-gray-300 whitespace-nowrap">Fração</th>
            <th className="py-1.5 px-2 print:py-1 print:px-1.5 text-left border-r border-gray-300 whitespace-nowrap">Condómino</th>
            {quorumMode === 'permilagem' && (
              <th className="py-1.5 px-2 print:py-1 print:px-1.5 text-right border-r border-gray-300 w-20 whitespace-nowrap">Perm. (‰)</th>
            )}
            <th className="py-1.5 px-2 print:py-1 print:px-1.5 text-center border-r border-gray-300 w-28 whitespace-nowrap">Situação</th>
            {isSignIn && (
              <th className="py-1.5 px-2 print:py-1 print:px-1.5 text-left border-r border-gray-300 w-40 print:w-36 whitespace-nowrap">
                Representado por
              </th>
            )}
            <th className="py-1.5 px-2 print:py-1 print:px-1.5 text-left whitespace-nowrap">Assinatura</th>
          </tr>
        </thead>
        <tbody>
          {units.map((u) => {
            const st = attendance[u.id] || 'ausente';
            const rep = representatives[u.id];
            return (
              <tr key={u.id} className="border-b border-gray-300">
                <td className={`${rowPadClass} attendance-sheet-cell px-2 print:px-1.5 font-bold border-r border-gray-300 whitespace-nowrap`}>
                  {u.code} ({formatUnitLabel(u.code)})
                </td>
                <td className={`${rowPadClass} attendance-sheet-cell px-2 print:px-1.5 border-r border-gray-300 print:whitespace-nowrap print:max-w-[190px] print:truncate`}>
                  {u.currentOwner?.name || 'N/D'}
                  {mode === 'filled' && st === 'representado' && rep
                    ? ` (Repr.: ${rep})`
                    : ''}
                </td>
                {quorumMode === 'permilagem' && (
                  <td className={`${rowPadClass} attendance-sheet-cell px-2 print:px-1.5 text-right border-r border-gray-300 whitespace-nowrap`}>
                    {(permilagens[u.id] ?? u.permilagem ?? 62.5).toFixed(1)}‰
                  </td>
                )}
                <td className={`${rowPadClass} attendance-sheet-cell px-2 print:px-1.5 text-center border-r border-gray-300 whitespace-nowrap`}>
                  {showCheckboxes ? (
                    <span className="text-[10px] text-gray-700 whitespace-nowrap">
                      ☐ Pres. ☐ Repr.
                    </span>
                  ) : st === 'presente' ? (
                    <span className="font-bold text-green-800">Presente</span>
                  ) : st === 'representado' ? (
                    <span className="font-bold text-blue-800">Representado</span>
                  ) : (
                    <span className="text-gray-400">Ausente</span>
                  )}
                </td>
                {isSignIn && <td className={`${rowPadClass} attendance-sheet-cell px-2 print:px-1.5 border-r border-gray-300`}></td>}
                <td className={`${rowPadClass} attendance-sheet-cell px-2 print:px-1.5`}></td>
              </tr>
            );
          })}
          <tr className="bg-gray-100 font-bold border-t-2 border-gray-800">
            <td className="py-1.5 px-2 print:py-1 print:px-1.5 border-r border-gray-300" colSpan={colSpanBeforeTotals}>
              {showCheckboxes
                ? `Total Presente / Representado: _____ / ${units.length} frações`
                : `Total Presente / Representado (${quorum.presentCount}/${quorum.totalUnits} frações)`}
            </td>
            {quorumMode === 'permilagem' && (
              <td className="py-1.5 px-2 print:py-1 print:px-1.5 text-right border-r border-gray-300">
                {showCheckboxes
                  ? `____ / ${totalPermilagemBuilding.toFixed(1)}‰`
                  : `${quorum.totalPermilagem.toFixed(1)}‰`}
              </td>
            )}
            <td className="py-1.5 px-2 print:py-1 print:px-1.5 text-center border-r border-gray-300">
              {showCheckboxes ? '____ %' : `${summaryPercent.toFixed(1)}%`}
            </td>
            {isSignIn && <td className="py-1.5 px-2 print:py-1 print:px-1.5 border-r border-gray-300"></td>}
            <td className="py-1.5 px-2 print:py-1 print:px-1.5"></td>
          </tr>
        </tbody>
      </table>
      </div>

      <div className="attendance-sheet-sigs grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-8 sm:gap-16 print:gap-12 pt-8 print:pt-5 text-center text-xs print:text-[10px]">
        <div>
          <div className="border-t border-gray-800 pt-2 mx-auto w-60 print:w-52 font-bold uppercase">
            O Presidente da Mesa / Administração
          </div>
        </div>
        <div>
          <div className="border-t border-gray-800 pt-2 mx-auto w-60 print:w-52 font-bold uppercase">
            O Secretário
          </div>
        </div>
      </div>
    </div>
  );
}
