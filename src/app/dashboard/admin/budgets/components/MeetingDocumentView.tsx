'use client';

import {
  ACTION_PRIORITY_LABELS,
  ACTION_STATUS_LABELS,
  AttendanceStatus,
  computeQuorumSummary,
  formatMeetingDateLong,
  formatMeetingDateShort,
  isPlaceholderAdminNames,
  MeetingActionItem,
  MeetingDiscussionPoint,
  QuorumMode,
} from '@/lib/meetings';
import {
  AnnualReportData,
  BudgetLineInput,
  FeeSimulationConfig,
  UnitReportItem,
} from '../types';
import { computeFeeSimulation, fmtEur, formatUnitLabel, round2 } from '../utils';
import AttendanceSheetView from './AttendanceSheetView';

interface MeetingDocumentViewProps {
  year: number;
  buildingName: string;
  units: UnitReportItem[];
  annualReport: AnnualReportData | null;
  budgetLines: BudgetLineInput[];
  feeSimConfig: FeeSimulationConfig;
  templateMode: 'filled' | 'blank';
  quorumMode: QuorumMode;
  actaNumber: string;
  assemblyType: 'Ordinária' | 'Extraordinária';
  meetingDate: string;
  startTime: string;
  endTime: string;
  convocationUsed: '1.ª' | '2.ª';
  location: string;
  presidedBy: string;
  secretaryBy: string;
  newAdminNames: string;
  generalNotes: string;
  attendance: Record<string, AttendanceStatus>;
  permilagens: Record<string, number>;
  representatives: Record<string, string>;
  discussionPoints: MeetingDiscussionPoint[];
  actionItems: MeetingActionItem[];
}

export default function MeetingDocumentView({
  year,
  buildingName,
  units,
  annualReport,
  budgetLines,
  feeSimConfig,
  templateMode,
  quorumMode,
  actaNumber,
  assemblyType,
  meetingDate,
  startTime,
  endTime,
  convocationUsed,
  location,
  presidedBy,
  secretaryBy,
  newAdminNames,
  generalNotes,
  attendance,
  permilagens,
  representatives,
  discussionPoints,
  actionItems,
}: MeetingDocumentViewProps) {
  const nextYear = year + 1;
  const sim = computeFeeSimulation(units, feeSimConfig);
  const debtors = units.filter((u) => u.debtByYear.totalDebt > 0.01);

  const presentUnitsList = units.filter((u) => (attendance[u.id] || 'ausente') !== 'ausente');
  const quorum = computeQuorumSummary({
    unitIds: units.map((u) => u.id),
    attendance: { statuses: attendance, permilagens, representatives },
    quorumMode,
  });

  const budgetTotalAnnual = round2(budgetLines.reduce((s, l) => s + (l.annualAmount || 0), 0));
  const budgetTotalMonthly = round2(budgetLines.reduce((s, l) => s + (l.monthlyAmount || 0), 0));

  const pointLabelMap = new Map<string, string>();
  discussionPoints.forEach((pt, idx) => {
    pointLabelMap.set(pt.id, `Ponto ${idx + 1}`);
  });

  const renderFinancialSection = (point: MeetingDiscussionPoint) => {
    if (point.linkedSection === 'contas') {
      if (templateMode === 'blank') {
        return (
          <p className="text-xs text-gray-700">
            Foram apresentados os valores de receitas, despesas e disponibilidades bancárias referentes ao período de 01/01/{year} a 31/12/{year}:
          </p>
        );
      }
      return (
        <div className="space-y-3 text-xs">
          <p className="leading-relaxed text-justify">
            A Administração apresentou o Balancete de Receitas e Despesas do exercício de {year}, cujos totais apurados até à data são os seguintes:
          </p>
          {annualReport ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300 font-bold">
                    <th className="py-1.5 px-2 text-left">Receitas e Saldos</th>
                    <th className="py-1.5 px-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="py-1 px-2">Saldo transitado de {year - 1}</td>
                    <td className="py-1 px-2 text-right">{fmtEur(annualReport.balancete.saldoTransitar)}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-1 px-2">Quotas do exercício ({year})</td>
                    <td className="py-1 px-2 text-right">{fmtEur(annualReport.balancete.receitas.receitasDesteExercicio)}</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="py-1 px-2">Recebimentos de dívidas anteriores</td>
                    <td className="py-1 px-2 text-right">{fmtEur(annualReport.balancete.receitas.receitasAnosAnteriores)}</td>
                  </tr>
                  <tr className="border-b border-gray-300 font-bold bg-green-50/40">
                    <td className="py-1 px-2">Total de Receitas {year}</td>
                    <td className="py-1 px-2 text-right">{fmtEur(annualReport.balancete.receitas.totalReceitas)}</td>
                  </tr>
                  <tr className="font-black bg-gray-100">
                    <td className="py-1.5 px-2">Saldo Final Disponível em Banco</td>
                    <td className="py-1.5 px-2 text-right">{fmtEur(annualReport.balancete.totalBankBalance)}</td>
                  </tr>
                </tbody>
              </table>

              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300 font-bold">
                    <th className="py-1.5 px-2 text-left">Despesas por Credor ({year})</th>
                    <th className="py-1.5 px-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {annualReport.balancete.despesas.categories.map(
                    (cat: { label: string; amount: number }, i: number) => (
                      <tr key={i} className="border-b border-gray-200">
                        <td className="py-1 px-2">{cat.label}</td>
                        <td className="py-1 px-2 text-right">{fmtEur(cat.amount)}</td>
                      </tr>
                    )
                  )}
                  {annualReport.balancete.despesas.totalReforcoPoupanca > 0 && (
                    <tr className="border-b border-gray-200 text-blue-800">
                      <td className="py-1 px-2">Transferência p/ Fundo de Reserva</td>
                      <td className="py-1 px-2 text-right">
                        {fmtEur(annualReport.balancete.despesas.totalReforcoPoupanca)}
                      </td>
                    </tr>
                  )}
                  <tr className="font-black bg-gray-100">
                    <td className="py-1.5 px-2">Total Saídas ({year})</td>
                    <td className="py-1.5 px-2 text-right">
                      {fmtEur(annualReport.balancete.despesas.totalDespesas)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="italic text-gray-500">Resumo de contas não carregado.</p>
          )}
        </div>
      );
    }

    if (point.linkedSection === 'dividas') {
      if (templateMode === 'blank') {
        return (
          <p className="text-xs text-gray-700">
            Análise da relação de frações com quotizações em dívida e respetivos planos/prazos de regularização:
          </p>
        );
      }
      return (
        <div className="space-y-3 text-xs">
          {debtors.length === 0 ? (
            <p>Todas as frações encontram-se com a sua situação contributiva regularizada.</p>
          ) : (
            <>
              <p className="leading-relaxed text-justify">
                Foram analisados e validados os valores em dívida registados à data por fração autónoma, discriminados por período:
              </p>
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300 font-bold">
                    <th className="py-1.5 px-2 text-left">Fração</th>
                    <th className="py-1.5 px-2 text-left">Proprietário</th>
                    <th className="py-1.5 px-2 text-right">Pré-2024</th>
                    <th className="py-1.5 px-2 text-right">2024–{year - 1}</th>
                    <th className="py-1.5 px-2 text-right">{year}</th>
                    <th className="py-1.5 px-2 text-right bg-red-50">Total Dívida</th>
                  </tr>
                </thead>
                <tbody>
                  {debtors.map((u) => (
                    <tr key={u.id} className="border-b border-gray-200">
                      <td className="py-1 px-2 font-bold">
                        {u.code} ({formatUnitLabel(u.code)})
                      </td>
                      <td className="py-1 px-2">{u.currentOwner?.name || 'N/D'}</td>
                      <td className="py-1 px-2 text-right">{fmtEur(u.pre2024.remaining)}</td>
                      <td className="py-1 px-2 text-right">{fmtEur(u.debtByYear.pastYearsDebt)}</td>
                      <td className="py-1 px-2 text-right">{fmtEur(u.debtByYear.currentYearDebt)}</td>
                      <td className="py-1 px-2 text-right font-black text-red-700 bg-red-50/40">
                        {fmtEur(u.debtByYear.totalDebt)}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-black bg-gray-100 border-t-2 border-gray-800">
                    <td className="py-1.5 px-2" colSpan={5}>
                      Total Global de Quotas em Dívida
                    </td>
                    <td className="py-1.5 px-2 text-right text-red-800">
                      {fmtEur(debtors.reduce((s, d) => s + d.debtByYear.totalDebt, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          )}
          <p className="text-[11px] italic text-gray-700 leading-relaxed">
            Ao abrigo do disposto no art.º 6.º, n.º 1, do Decreto-Lei n.º 268/94, de 25 de outubro (na redação da Lei n.º 8/2022), a presente ata, contendo o montante das contribuições devidas ao condomínio, respetivo prazo de pagamento e identificação das frações devedoras, constitui título executivo contra os proprietários incumpridores.
          </p>
        </div>
      );
    }

    if (point.linkedSection === 'orcamento') {
      if (templateMode === 'blank') {
        return (
          <p className="text-xs text-gray-700">
            Apresentação e votação do orçamento previsional para {nextYear} e atualização dos valores das quotas mensais:
          </p>
        );
      }
      return (
        <div className="space-y-3 text-xs">
          <p>
            Foi apresentado o orçamento previsional de despesas para <strong>{nextYear}</strong> no total de{' '}
            <strong>{fmtEur(budgetTotalAnnual)}</strong> ({fmtEur(budgetTotalMonthly)}/mês), bem como a proposta de atualização das quotas para as {units.length} frações (receita anual prevista de{' '}
            <strong>{fmtEur(sim.totalNewAnnual)}</strong>, impacto de{' '}
            <strong>
              {sim.annualImpact >= 0 ? '+' : ''}
              {fmtEur(sim.annualImpact)}/ano
            </strong>
            ):
          </p>
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300 font-bold">
                <th className="py-1 px-2 text-left">Fração</th>
                <th className="py-1 px-2 text-left">Proprietário</th>
                <th className="py-1 px-2 text-right">Quota Atual</th>
                <th className="py-1 px-2 text-right">Nova Quota</th>
                <th className="py-1 px-2 text-right">Novo Valor Anual</th>
              </tr>
            </thead>
            <tbody>
              {sim.rows.map((r) => (
                <tr key={r.unitId} className="border-b border-gray-200">
                  <td className="py-1 px-2 font-semibold">{r.code}</td>
                  <td className="py-1 px-2">{r.ownerName}</td>
                  <td className="py-1 px-2 text-right">{fmtEur(r.currentMonthly)}</td>
                  <td className="py-1 px-2 text-right font-bold">{fmtEur(r.newMonthly)}</td>
                  <td className="py-1 px-2 text-right font-semibold">{fmtEur(r.newAnnual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (point.linkedSection === 'eleicao' && templateMode === 'filled' && newAdminNames.trim()) {
      return (
        <p className="text-xs leading-relaxed">
          A assembleia deliberou designar para exercer funções de Administração do condomínio referente ao exercício de {nextYear}:{' '}
          <strong>{newAdminNames}</strong>.
        </p>
      );
    }

    return null;
  };

  const hasCustomAdmin = !isPlaceholderAdminNames(newAdminNames);

  return (
    <div className="report-container bg-white rounded-2xl shadow-sm p-10 print:p-2 border border-gray-200 print:border-none max-w-4xl mx-auto text-gray-900 space-y-6">
      {/* Title */}
      <div className="text-center border-b-2 border-gray-800 pb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-600">
          Condomínio do Edifício sito na {buildingName}
        </p>
        <h1 className="text-2xl font-black uppercase mt-2">
          ACTA N.º {templateMode === 'blank' ? '_____' : actaNumber || '___'}
        </h1>
        <p className="text-xs uppercase font-bold text-gray-500 mt-1">
          Assembleia Geral {assemblyType} de Condóminos
        </p>
      </div>

      {/* Opening */}
      <p className="text-sm leading-relaxed text-justify">
        {templateMode === 'blank' ? (
          <>
            Aos _____ dias do mês de ________________________ de ________, pelas ______ horas e ______ minutos, em _____ convocatória, reuniu no {location} a Assembleia Geral {assemblyType} de Condóminos do prédio constituído em regime de propriedade horizontal sito na {buildingName}. Estiveram presentes ou representados os condóminos assinantes da lista de presenças anexa, perfazendo{' '}
            {quorumMode === 'permilagem'
              ? 'uma permilagem total de ________‰'
              : `____ de ${units.length} frações`}
            . A reunião foi presidida por ______________________________ e secretariada por ______________________________, com a seguinte Ordem de Trabalhos:
          </>
        ) : (
          <>
            No dia <strong>{formatMeetingDateLong(meetingDate)}</strong>, pelas <strong>{startTime} horas</strong>, em{' '}
            <strong>{convocationUsed} convocatória</strong>, reuniu no <strong>{location}</strong> a Assembleia Geral {assemblyType} de Condóminos do edifício constituído em regime de propriedade horizontal sito na {buildingName}.{' '}
            {presentUnitsList.length > 0 ? (
              <>
                Estiveram presentes ou devidamente representados os condóminos das frações{' '}
                <strong>
                  {presentUnitsList.map((u) => `${u.code} (${formatUnitLabel(u.code)})`).join(', ')}
                </strong>
                , perfazendo{' '}
                {quorumMode === 'permilagem' ? (
                  <>
                    uma permilagem total de <strong>{quorum.totalPermilagem.toFixed(1)}‰</strong> (
                    {quorum.percentByPermilagem.toFixed(1)}%).{' '}
                  </>
                ) : (
                  <>
                    <strong>
                      {quorum.presentCount} de {quorum.totalUnits} frações
                    </strong>{' '}
                    ({quorum.percentByUnits.toFixed(1)}%).{' '}
                  </>
                )}
              </>
            ) : (
              <>Verificada a lista de presenças anexa à presente ata, </>
            )}
            Confirmada a regularidade da convocatória e a existência de quórum, deu-se início à sessão, presidida por{' '}
            <strong>{presidedBy}</strong> e secretariada por <strong>{secretaryBy}</strong>, com a seguinte Ordem de Trabalhos:
          </>
        )}
      </p>

      {/* Dynamic Agenda Summary */}
      <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg text-xs space-y-1.5">
        <p className="font-bold uppercase text-gray-800 mb-1.5">Ordem de Trabalhos</p>
        {discussionPoints.length === 0 ? (
          <p className="italic text-gray-500">Sem pontos adicionados à ordem de trabalhos.</p>
        ) : (
          discussionPoints.map((pt, idx) => (
            <p key={pt.id}>
              <strong>Ponto {idx + 1}:</strong> {pt.title.trim() || `Assunto ${idx + 1}`}
            </p>
          ))
        )}
      </div>

      {/* Detailed Discussion Points */}
      <div className="space-y-6">
        {discussionPoints.map((pt, idx) => {
          const titleText = pt.title.trim() || `Ponto ${idx + 1}`;
          const votingCombined = [pt.votingOutcome, pt.votingDetails]
            .filter((v) => v && v.trim())
            .join(' — ');
          const hasDecisionContent = Boolean(votingCombined || pt.decision.trim());

          return (
            <div
              key={pt.id}
              className={`space-y-3 ${pt.linkedSection === 'orcamento' ? 'report-section-break' : ''}`}
            >
              <h2 className="text-sm font-black uppercase border-b border-gray-400 pb-1">
                Ponto {idx + 1} — {titleText}
              </h2>

              {renderFinancialSection(pt)}

              {templateMode === 'blank' ? (
                <div className="space-y-2 text-xs text-gray-700">
                  <div className="h-24 border border-dashed border-gray-400 rounded p-2">
                    Notas da discussão / intervenções:
                  </div>
                  <div className="h-14 border border-dashed border-gray-400 rounded p-2">
                    Votação e Decisão Tomada:
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 text-xs">
                  {pt.discussion.trim() && (
                    <div className="whitespace-pre-line leading-relaxed text-justify text-gray-800">
                      {pt.discussion.trim()}
                    </div>
                  )}

                  {hasDecisionContent ? (
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg space-y-1">
                      {votingCombined && (
                        <p className="text-emerald-950">
                          <strong>Votação:</strong> {votingCombined}
                        </p>
                      )}
                      {pt.decision.trim() && (
                        <p className="text-emerald-950 whitespace-pre-line">
                          <strong>Deliberação / Decisão Tomada:</strong> {pt.decision.trim()}
                        </p>
                      )}
                    </div>
                  ) : (
                    !pt.discussion.trim() && (
                      <p className="italic text-gray-500">Sem notas ou deliberações registadas neste ponto.</p>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary of Decisions Taken */}
      <div className="space-y-3 pt-2">
        <h2 className="text-sm font-black uppercase border-b-2 border-gray-800 pb-1">
          Quadro Resumo das Decisões Tomadas
        </h2>
        <table className="w-full text-xs border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300 font-bold">
              <th className="py-1.5 px-2 text-left w-20">Ponto</th>
              <th className="py-1.5 px-2 text-left">Assunto</th>
              <th className="py-1.5 px-2 text-left w-44">Votação</th>
              <th className="py-1.5 px-2 text-left">Decisão Tomada</th>
            </tr>
          </thead>
          <tbody>
            {templateMode === 'blank' ? (
              (discussionPoints.length > 0 ? discussionPoints : [0, 1, 2, 3]).map((item, idx) => {
                const key = typeof item === 'number' ? `blank-dec-${item}` : item.id;
                const title = typeof item === 'number' ? '' : item.title;
                return (
                  <tr key={key} className="border-b border-gray-200">
                    <td className="py-3 px-2 font-semibold">Ponto {idx + 1}</td>
                    <td className="py-3 px-2">{title}</td>
                    <td className="py-3 px-2"></td>
                    <td className="py-3 px-2"></td>
                  </tr>
                );
              })
            ) : discussionPoints.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-3 px-2 text-center italic text-gray-500">
                  Sem pontos registados na reunião.
                </td>
              </tr>
            ) : (
              discussionPoints.map((pt, idx) => {
                const voteSummary = [pt.votingOutcome, pt.votingDetails]
                  .filter((v) => v && v.trim())
                  .join(' — ');
                return (
                  <tr key={pt.id} className="border-b border-gray-200 align-top">
                    <td className="py-1.5 px-2 font-bold">Ponto {idx + 1}</td>
                    <td className="py-1.5 px-2 font-medium">{pt.title.trim() || `Assunto ${idx + 1}`}</td>
                    <td className="py-1.5 px-2 text-gray-700">{voteSummary || '—'}</td>
                    <td className="py-1.5 px-2 text-gray-900 whitespace-pre-line">
                      {pt.decision.trim() || '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Action Plan & Responsibilities */}
      <div className="space-y-3 pt-2">
        <h2 className="text-sm font-black uppercase border-b-2 border-gray-800 pb-1">
          Plano de Ações e Responsabilidades
        </h2>
        {templateMode === 'blank' ? (
          <table className="w-full text-xs border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300 font-bold">
                <th className="py-1.5 px-2 text-left w-10">#</th>
                <th className="py-1.5 px-2 text-left">Ação a Executar</th>
                <th className="py-1.5 px-2 text-left w-20">Ponto</th>
                <th className="py-1.5 px-2 text-left w-36">Responsável</th>
                <th className="py-1.5 px-2 text-left w-24">Prazo</th>
                <th className="py-1.5 px-2 text-left w-24">Estado</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((n) => (
                <tr key={n} className="border-b border-gray-200">
                  <td className="py-3.5 px-2 text-gray-500">{n}</td>
                  <td className="py-3.5 px-2"></td>
                  <td className="py-3.5 px-2"></td>
                  <td className="py-3.5 px-2"></td>
                  <td className="py-3.5 px-2"></td>
                  <td className="py-3.5 px-2"></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : actionItems.length === 0 ? (
          <p className="text-xs italic text-gray-600">
            Não foram registadas ações operacionais pendentes nesta sessão.
          </p>
        ) : (
          <table className="w-full text-xs border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300 font-bold">
                <th className="py-1.5 px-2 text-left w-8">#</th>
                <th className="py-1.5 px-2 text-left">Ação a Executar</th>
                <th className="py-1.5 px-2 text-left w-20">Ponto</th>
                <th className="py-1.5 px-2 text-left w-32">Responsável</th>
                <th className="py-1.5 px-2 text-left w-24">Prazo</th>
                <th className="py-1.5 px-2 text-left w-20">Custo Est.</th>
                <th className="py-1.5 px-2 text-left w-20">Estado</th>
              </tr>
            </thead>
            <tbody>
              {actionItems.map((act, idx) => {
                const pointRef = act.pointId ? pointLabelMap.get(act.pointId) || 'Geral' : 'Geral';
                return (
                  <tr key={act.id} className="border-b border-gray-200 align-top">
                    <td className="py-1.5 px-2 font-bold">{idx + 1}</td>
                    <td className="py-1.5 px-2">
                      <div className="font-semibold text-gray-900">
                        {act.priority === 'urgent' && (
                          <span className="inline-block mr-1.5 px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-red-100 text-red-800">
                            {ACTION_PRIORITY_LABELS.urgent}
                          </span>
                        )}
                        {act.title.trim() || '—'}
                      </div>
                      {act.notes?.trim() && (
                        <p className="text-[11px] text-gray-600 mt-0.5 whitespace-pre-line">
                          {act.notes.trim()}
                        </p>
                      )}
                    </td>
                    <td className="py-1.5 px-2">{pointRef}</td>
                    <td className="py-1.5 px-2">{act.responsible.trim() || 'Administração'}</td>
                    <td className="py-1.5 px-2 whitespace-nowrap">
                      {act.dueDate ? formatMeetingDateShort(act.dueDate) : 'A definir'}
                    </td>
                    <td className="py-1.5 px-2 whitespace-nowrap">
                      {act.estimatedCost?.trim() || '—'}
                    </td>
                    <td className="py-1.5 px-2 whitespace-nowrap">
                      {ACTION_STATUS_LABELS[act.status] || act.status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* General Notes & Closing */}
      <div className="space-y-3 text-xs pt-2">
        {templateMode === 'filled' && generalNotes.trim() && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-1">
            <p className="font-bold uppercase text-gray-700">Observações Finais</p>
            <p className="whitespace-pre-line text-gray-800 leading-relaxed">{generalNotes.trim()}</p>
          </div>
        )}

        <h2 className="text-sm font-black uppercase border-b border-gray-400 pb-1">
          Encerramento da Sessão
        </h2>
        <p className="leading-relaxed text-justify">
          {templateMode === 'blank' ? (
            <>
              Nada mais havendo a tratar, foi encerrada a reunião pelas ______ horas e ______ minutos, da qual se lavrou a presente ata que, depois de lida e aprovada, vai ser assinada pelos membros da mesa e condóminos presentes.
            </>
          ) : (
            <>
              {hasCustomAdmin && (
                <>
                  Confirma-se a designação da equipa de Administração para o exercício de {nextYear}:{' '}
                  <strong>{newAdminNames}</strong>.{' '}
                </>
              )}
              Nada mais havendo a tratar e não tendo ninguém pedido novamente a palavra, foi encerrada a sessão{' '}
              {endTime.trim() ? (
                <>
                  pelas <strong>{endTime.trim()} horas</strong>
                </>
              ) : (
                <>pelas ______ horas e ______ minutos</>
              )}
              , da qual se lavrou a presente ata que, depois de lida e aprovada, vai ser assinada pelos membros da mesa e condóminos presentes.
            </>
          )}
        </p>
      </div>

      {/* Attendance & Signatures Sheet */}
      <div className="report-section-break">
        <AttendanceSheetView
          buildingName={buildingName}
          actaNumber={actaNumber}
          assemblyType={assemblyType}
          meetingDate={meetingDate}
          startTime={startTime}
          location={location}
          units={units}
          quorumMode={quorumMode}
          attendance={attendance}
          permilagens={permilagens}
          representatives={representatives}
          mode={templateMode}
        />
      </div>
    </div>
  );
}
