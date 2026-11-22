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
  const rowPadClass = isSignIn ? 'py-3' : 'py-2';

  const summaryPercent =
    quorumMode === 'permilagem' ? quorum.percentByPermilagem : quorum.percentByUnits;

  const colSpanBeforeTotals = isSignIn ? 2 : 2;

  return (
    <div className="space-y-4">
      {isSignIn ? (
        <div className="space-y-3">
          <div className="text-center border-b-2 border-gray-800 pb-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-600">
              Condomínio do Edifício sito na {buildingName}
            </p>
            <h1 className="text-xl font-black uppercase mt-1">
              FOLHA DE PRESENÇAS E ASSINATURAS — ACTA N.º {actaNumber || '___'}
            </h1>
            <p className="text-xs uppercase font-bold text-gray-500 mt-0.5">
              Assembleia Geral {assemblyType} de Condóminos
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-1 p-3 bg-gray-50 border border-gray-300 rounded-lg text-xs">
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
            <div className="col-span-2 text-[11px] text-gray-700 pt-1 border-t border-gray-200 mt-1">
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

      <table className="w-full text-xs border-collapse border border-gray-400">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-400 font-bold">
            <th className="py-1.5 px-2 text-left border-r border-gray-300">Fração</th>
            <th className="py-1.5 px-2 text-left border-r border-gray-300">Condómino</th>
            {quorumMode === 'permilagem' && (
              <th className="py-1.5 px-2 text-right border-r border-gray-300 w-20">Perm. (‰)</th>
            )}
            <th className="py-1.5 px-2 text-center border-r border-gray-300 w-28">Situação</th>
            {isSignIn && (
              <th className="py-1.5 px-2 text-left border-r border-gray-300 w-44">
                Representado por (se aplicável)
              </th>
            )}
            <th className="py-1.5 px-2 text-left">Assinatura</th>
          </tr>
        </thead>
        <tbody>
          {units.map((u) => {
            const st = attendance[u.id] || 'ausente';
            const rep = representatives[u.id];
            return (
              <tr key={u.id} className="border-b border-gray-300">
                <td className={`${rowPadClass} px-2 font-bold border-r border-gray-300`}>
                  {u.code} ({formatUnitLabel(u.code)})
                </td>
                <td className={`${rowPadClass} px-2 border-r border-gray-300`}>
                  {u.currentOwner?.name || 'N/D'}
                  {mode === 'filled' && st === 'representado' && rep
                    ? ` (Repr.: ${rep})`
                    : ''}
                </td>
                {quorumMode === 'permilagem' && (
                  <td className={`${rowPadClass} px-2 text-right border-r border-gray-300`}>
                    {(permilagens[u.id] ?? u.permilagem ?? 62.5).toFixed(1)}‰
                  </td>
                )}
                <td className={`${rowPadClass} px-2 text-center border-r border-gray-300`}>
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
                {isSignIn && <td className={`${rowPadClass} px-2 border-r border-gray-300`}></td>}
                <td className={`${rowPadClass} px-2`}></td>
              </tr>
            );
          })}
          <tr className="bg-gray-100 font-bold border-t-2 border-gray-800">
            <td className="py-1.5 px-2 border-r border-gray-300" colSpan={colSpanBeforeTotals}>
              {showCheckboxes
                ? `Total Presente / Representado: _____ / ${units.length} frações`
                : `Total Presente / Representado (${quorum.presentCount}/${quorum.totalUnits} frações)`}
            </td>
            {quorumMode === 'permilagem' && (
              <td className="py-1.5 px-2 text-right border-r border-gray-300">
                {showCheckboxes
                  ? `____ / ${totalPermilagemBuilding.toFixed(1)}‰`
                  : `${quorum.totalPermilagem.toFixed(1)}‰`}
              </td>
            )}
            <td className="py-1.5 px-2 text-center border-r border-gray-300">
              {showCheckboxes ? '____ %' : `${summaryPercent.toFixed(1)}%`}
            </td>
            {isSignIn && <td className="py-1.5 px-2 border-r border-gray-300"></td>}
            <td className="py-1.5 px-2"></td>
          </tr>
        </tbody>
      </table>

      <div className="grid grid-cols-2 gap-16 pt-8 text-center text-xs">
        <div>
          <div className="border-t border-gray-800 pt-2 mx-auto w-60 font-bold uppercase">
            O Presidente da Mesa / Administração
          </div>
        </div>
        <div>
          <div className="border-t border-gray-800 pt-2 mx-auto w-60 font-bold uppercase">
            O Secretário
          </div>
        </div>
      </div>
    </div>
  );
}
