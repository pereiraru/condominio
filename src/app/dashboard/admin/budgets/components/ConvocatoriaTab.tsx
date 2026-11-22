'use client';

import { useState } from 'react';
import { fmtEur } from '../utils';

interface ConvocatoriaTabProps {
  year: number;
  buildingName: string;
  projectedAnnualImpact?: number;
}

export default function ConvocatoriaTab({
  year,
  buildingName,
  projectedAnnualImpact = 0,
}: ConvocatoriaTabProps) {
  const nextYear = year + 1;
  const [assemblyType, setAssemblyType] = useState<'Ordinária' | 'Extraordinária'>('Ordinária');
  const [meetingDate, setMeetingDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [meetingTime, setMeetingTime] = useState<string>('21:30');
  const [meetingLocation, setMeetingLocation] = useState<string>(
    'Parqueamento Piso -4 do Edifício (sala de reuniões do condomínio)'
  );
  const [issueDate, setIssueDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [adminSigners, setAdminSigners] = useState<string>('A Administração\nCondomínio Rua Vieira da Silva, n.º 6');
  const [agendaItems, setAgendaItems] = useState<string[]>([
    'Leitura e análise da última ata.',
    `Apresentação, discussão e aprovação das contas referentes ao exercício de ${year}.`,
    `Situação financeira do condomínio, dívidas por regularizar e esclarecimentos às frações.`,
    `Apresentação e aprovação do orçamento para ${nextYear} e revisão/atualização das quotas mensais${
      projectedAnnualImpact > 0 ? ` (impacto previsto +${fmtEur(projectedAnnualImpact)}/ano)` : ''
    }.`,
    'Outros assuntos de interesse geral (manutenção do edifício, elevadores, limpeza e eventuais obras/pintura).',
    `Eleição da Administração para o exercício de ${nextYear}.`,
  ]);
  const [extraNote, setExtraNote] = useState<string>(
    'Encontra-se disponível para consulta o Balancete de Receitas e Despesas e os extratos individuais por fração.'
  );

  function formatPtDate(iso: string): string {
    if (!iso) return '____ / ____ / ______';
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString('pt-PT', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  function updateAgendaItem(idx: number, val: string) {
    const next = [...agendaItems];
    next[idx] = val;
    setAgendaItems(next);
  }

  function addAgendaItem() {
    setAgendaItems([...agendaItems, '']);
  }

  function removeAgendaItem(idx: number) {
    setAgendaItems(agendaItems.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-6">
      {/* Editor Controls (hidden on print) */}
      <div className="no-print card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Configurar Convocatória</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Edite a data, hora, local e ordem de trabalhos antes de imprimir ou guardar em PDF.
            </p>
          </div>
          <button type="button" onClick={() => window.print()} className="btn-primary text-sm">
            Imprimir / PDF Convocatória
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="label text-xs">Tipo de Assembleia</label>
            <select
              className="input h-10 text-sm"
              value={assemblyType}
              onChange={(e) => setAssemblyType(e.target.value as 'Ordinária' | 'Extraordinária')}
            >
              <option value="Ordinária">Assembleia Geral Ordinária</option>
              <option value="Extraordinária">Assembleia Geral Extraordinária</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">Data da Reunião</label>
            <input
              type="date"
              className="input h-10 text-sm"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs">Hora (1.ª Convocatória)</label>
            <input
              type="time"
              className="input h-10 text-sm"
              value={meetingTime}
              onChange={(e) => setMeetingTime(e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs">Data de Emissão</label>
            <input
              type="date"
              className="input h-10 text-sm"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label text-xs">Local</label>
            <input
              type="text"
              className="input h-10 text-sm"
              value={meetingLocation}
              onChange={(e) => setMeetingLocation(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label text-xs">Nota Adicional</label>
            <input
              type="text"
              className="input h-10 text-sm"
              value={extraNote}
              onChange={(e) => setExtraNote(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="label text-xs mb-0">Pontos da Ordem de Trabalhos</label>
            <button
              type="button"
              onClick={addAgendaItem}
              className="text-xs font-bold text-primary-600 hover:underline"
            >
              + Adicionar Ponto
            </button>
          </div>
          {agendaItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 w-6 text-right">{idx + 1}.</span>
              <input
                type="text"
                className="input h-9 text-sm flex-1"
                value={item}
                onChange={(e) => updateAgendaItem(idx, e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeAgendaItem(idx)}
                className="text-gray-400 hover:text-red-600 px-2"
                title="Remover ponto"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div>
          <label className="label text-xs">Assinatura / Administração</label>
          <textarea
            rows={2}
            className="input h-auto py-2 text-sm"
            value={adminSigners}
            onChange={(e) => setAdminSigners(e.target.value)}
          />
        </div>
      </div>

      {/* Printable Official Document */}
      <div className="report-container bg-white rounded-2xl shadow-sm p-10 print:p-2 border border-gray-200 print:border-none max-w-4xl mx-auto text-gray-900">
        <div className="text-center border-b-2 border-gray-800 pb-4 mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-600">
            Condomínio do Prédio sito na
          </p>
          <p className="text-base font-bold text-gray-900 mt-0.5">{buildingName}</p>
          <h1 className="text-2xl font-black tracking-wide uppercase mt-5 underline underline-offset-4">
            CONVOCATÓRIA
          </h1>
        </div>

        <div className="space-y-5 text-sm leading-relaxed text-justify">
          <p className="font-semibold">Exmo.(a) Senhor(a) Condómino(a),</p>

          <p>
            Nos termos do n.º 2 do artigo 1431.º e do n.º 1 do artigo 1432.º do Código Civil, fica V.ª Ex.ª convocado(a) para a{' '}
            <strong>Assembleia Geral {assemblyType} de Condóminos</strong>, a realizar no dia{' '}
            <strong className="uppercase">{formatPtDate(meetingDate)}</strong>, pelas{' '}
            <strong>{meetingTime} horas</strong>, no <strong>{meetingLocation}</strong>, com a seguinte:
          </p>

          <div className="my-6 p-5 bg-gray-50 border border-gray-300 rounded-lg">
            <h2 className="text-sm font-black uppercase tracking-wider mb-3 text-gray-900">
              Ordem de Trabalhos
            </h2>
            <ol className="list-decimal pl-6 space-y-2">
              {agendaItems
                .filter((i) => i.trim() !== '')
                .map((item, idx) => (
                  <li key={idx} className="font-medium text-gray-900">
                    {item}
                  </li>
                ))}
            </ol>
          </div>

          <p className="text-xs leading-relaxed text-gray-700 bg-gray-50/60 p-4 border-l-4 border-gray-700">
            Na reunião da Assembleia de Condóminos acima referida, se não estiverem presentes ou representados condóminos titulares da maioria dos votos representativos do capital investido no prédio, ou não for possível formar a maioria prevista no n.º 3 do art.º 1432.º do Código Civil, fica também desde já convocada nova reunião da Assembleia de Condóminos a realizar no <strong>mesmo dia e no mesmo local, trinta minutos depois</strong>, com a mesma ordem de trabalhos, a qual poderá deliberar por maioria dos votos dos proprietários presentes, desde que representem pelo menos um quarto do valor total do prédio, nos termos do n.º 4 do citado art.º 1432.º do Código Civil.
          </p>

          {extraNote.trim() && (
            <p className="text-xs italic text-gray-700">{extraNote}</p>
          )}

          <p className="pt-2">
            A sua comparência e participação são muito importantes para a gestão do nosso edifício.
          </p>
          <p>Com os melhores cumprimentos,</p>

          <div className="pt-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
            <p className="text-sm text-gray-700">
              Monte Abraão — Queluz,{' '}
              <strong>
                {issueDate
                  ? new Date(`${issueDate}T12:00:00`).toLocaleDateString('pt-PT', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })
                  : '____ / ____ / ______'}
              </strong>
            </p>
            <div className="text-center min-w-[240px]">
              <div className="border-t border-gray-800 pt-2 whitespace-pre-line text-sm font-semibold">
                {adminSigners}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
