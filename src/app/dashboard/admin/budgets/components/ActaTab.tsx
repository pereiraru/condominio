'use client';

import { useState, useMemo } from 'react';
import { BudgetLineInput, FeeSimulationConfig, UnitReportItem, AnnualReportData } from '../types';
import { computeFeeSimulation, fmtEur, formatUnitLabel, round2 } from '../utils';

interface ActaTabProps {
  year: number;
  buildingName: string;
  units: UnitReportItem[];
  annualReport: AnnualReportData | null;
  budgetLines: BudgetLineInput[];
  feeSimConfig: FeeSimulationConfig;
}

type AttendanceStatus = 'presente' | 'representado' | 'ausente';

export default function ActaTab({
  year,
  buildingName,
  units,
  annualReport,
  budgetLines,
  feeSimConfig,
}: ActaTabProps) {
  const nextYear = year + 1;
  const [templateMode, setTemplateMode] = useState<'filled' | 'blank'>('filled');
  const [actaNumber, setActaNumber] = useState<string>('24');
  const [assemblyType, setAssemblyType] = useState<'Ordinária' | 'Extraordinária'>('Ordinária');
  const [meetingDate, setMeetingDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [startTime, setStartTime] = useState<string>('22:00');
  const [convocationUsed, setConvocationUsed] = useState<'1.ª' | '2.ª'>('2.ª');
  const [location, setLocation] = useState<string>('Parqueamento situado no Piso -4 do Edifício');
  const [presidedBy, setPresidedBy] = useState<string>('Administração Cessante');
  const [secretaryBy, setSecretaryBy] = useState<string>('A designar na reunião');
  const [newAdminNames, setNewAdminNames] = useState<string>(
    '_______________________________ e _______________________________'
  );
  const [votesPonto1, setVotesPonto1] = useState<string>('Aprovado por unanimidade dos presentes.');
  const [votesPonto3, setVotesPonto3] = useState<string>(
    'Aprovado por maioria dos presentes, entrando os novos valores em vigor no mês seguinte / janeiro.'
  );
  const [ponto4Notes, setPonto4Notes] = useState<string>(
    '- Análise de orçamentos e planeamento de manutenção/pintura do edifício.\n' +
      '- Ponto de situação sobre a limpeza do prédio e eventual regularização de limpeza de vidros.\n' +
      '- Verificação do funcionamento dos elevadores, bomba de água e portão da garagem.'
  );

  // Per-unit attendance and permilagem
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>(() => {
    const init: Record<string, AttendanceStatus> = {};
    units.forEach((u) => {
      init[u.id] = 'ausente';
    });
    return init;
  });
  const [permilagens, setPermilagens] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    units.forEach((u) => {
      init[u.id] = u.permilagem || 62.5;
    });
    return init;
  });
  const [representatives, setRepresentatives] = useState<Record<string, string>>({});

  const sim = useMemo(() => computeFeeSimulation(units, feeSimConfig), [units, feeSimConfig]);

  const debtors = useMemo(
    () => units.filter((u) => u.debtByYear.totalDebt > 0.01),
    [units]
  );

  const totalPermilagemPresent = useMemo(() => {
    return round2(
      units.reduce((sum, u) => {
        const st = attendance[u.id] || 'ausente';
        if (st === 'ausente') return sum;
        return sum + (permilagens[u.id] ?? u.permilagem ?? 62.5);
      }, 0)
    );
  }, [units, attendance, permilagens]);

  const presentUnitsList = useMemo(
    () => units.filter((u) => (attendance[u.id] || 'ausente') !== 'ausente'),
    [units, attendance]
  );

  const quorumStatus =
    totalPermilagemPresent > 500
      ? 'Quórum para 1.ª Convocatória (> 500‰)'
      : totalPermilagemPresent >= 250
      ? 'Quórum para 2.ª Convocatória (≥ 250‰)'
      : 'Sem quórum mínimo legal (< 250‰)';

  const budgetTotalAnnual = round2(budgetLines.reduce((s, l) => s + (l.annualAmount || 0), 0));
  const budgetTotalMonthly = round2(budgetLines.reduce((s, l) => s + (l.monthlyAmount || 0), 0));

  function formatPtDate(iso: string): string {
    if (!iso) return '____ de ____________ de ______';
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  return (
    <div className="space-y-6">
      {/* Editor Controls (hidden on print) */}
      <div className="no-print card space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Ata da Assembleia & Folha de Presenças</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Escolha entre a Ata pré-preenchida com os valores reais de {year}/{nextYear} ou o Template em branco para preencher à mão durante a reunião.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-gray-100 p-0.5">
              <button
                type="button"
                onClick={() => setTemplateMode('filled')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  templateMode === 'filled' ? 'bg-gray-900 text-white' : 'text-gray-600'
                }`}
              >
                Ata Preenchida ({year}/{nextYear})
              </button>
              <button
                type="button"
                onClick={() => setTemplateMode('blank')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  templateMode === 'blank' ? 'bg-gray-900 text-white' : 'text-gray-600'
                }`}
              >
                Template em Branco
              </button>
            </div>
            <button type="button" onClick={() => window.print()} className="btn-primary text-sm">
              Imprimir / PDF Ata
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="label text-xs">N.º da Ata</label>
            <input
              type="text"
              className="input h-9 text-sm font-bold"
              value={actaNumber}
              onChange={(e) => setActaNumber(e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs">Tipo</label>
            <select
              className="input h-9 text-sm"
              value={assemblyType}
              onChange={(e) => setAssemblyType(e.target.value as 'Ordinária' | 'Extraordinária')}
            >
              <option value="Ordinária">Ordinária</option>
              <option value="Extraordinária">Extraordinária</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">Data</label>
            <input
              type="date"
              className="input h-9 text-sm"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-xs">Hora</label>
              <input
                type="time"
                className="input h-9 text-sm"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">Convocatória</label>
              <select
                className="input h-9 text-sm"
                value={convocationUsed}
                onChange={(e) => setConvocationUsed(e.target.value as '1.ª' | '2.ª')}
              >
                <option value="1.ª">1.ª Conv.</option>
                <option value="2.ª">2.ª Conv.</option>
              </select>
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="label text-xs">Local</label>
            <input
              type="text"
              className="input h-9 text-sm"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs">Presidente da Mesa</label>
            <input
              type="text"
              className="input h-9 text-sm"
              value={presidedBy}
              onChange={(e) => setPresidedBy(e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs">Secretário / Redator</label>
            <input
              type="text"
              className="input h-9 text-sm"
              value={secretaryBy}
              onChange={(e) => setSecretaryBy(e.target.value)}
            />
          </div>
        </div>

        {/* Interactive Attendance Selector */}
        <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50/70">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-bold text-gray-900">
              Controlo de Presenças e Permilagens
            </h3>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                totalPermilagemPresent >= 250
                  ? 'bg-green-100 text-green-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {presentUnitsList.length}/{units.length} frações • {totalPermilagemPresent.toFixed(1)}‰ ({(totalPermilagemPresent / 10).toFixed(1)}%) — {quorumStatus}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {units.map((u) => {
              const st = attendance[u.id] || 'ausente';
              return (
                <div
                  key={u.id}
                  className={`p-2.5 rounded-xl border text-xs flex flex-col gap-1.5 ${
                    st !== 'ausente' ? 'bg-white border-green-300' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-gray-900">
                      {u.code} ({formatUnitLabel(u.code)})
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.5"
                        className="w-14 text-right border border-gray-200 rounded px-1 py-0.5 text-[11px]"
                        value={permilagens[u.id] ?? 62.5}
                        onChange={(e) =>
                          setPermilagens({
                            ...permilagens,
                            [u.id]: parseFloat(e.target.value) || 0,
                          })
                        }
                        title="Permilagem (‰)"
                      />
                      <span className="text-[10px] text-gray-400">‰</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 truncate">
                    {u.currentOwner?.name || 'N/D'}
                  </p>
                  <div className="flex gap-1">
                    {(['presente', 'representado', 'ausente'] as AttendanceStatus[]).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setAttendance({ ...attendance, [u.id]: opt })}
                        className={`flex-1 py-1 rounded text-[10px] font-bold uppercase ${
                          st === opt
                            ? opt === 'ausente'
                              ? 'bg-gray-700 text-white'
                              : 'bg-green-600 text-white'
                            : 'bg-gray-200/70 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {opt === 'presente' ? 'Pres.' : opt === 'representado' ? 'Repr.' : 'Aus.'}
                      </button>
                    ))}
                  </div>
                  {st === 'representado' && (
                    <input
                      type="text"
                      className="border border-gray-200 rounded px-2 py-1 text-[11px] bg-white"
                      placeholder="Representado por..."
                      value={representatives[u.id] || ''}
                      onChange={(e) =>
                        setRepresentatives({ ...representatives, [u.id]: e.target.value })
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {templateMode === 'filled' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label text-xs">Deliberação Ponto 1 (Contas {year})</label>
              <input
                type="text"
                className="input h-9 text-sm"
                value={votesPonto1}
                onChange={(e) => setVotesPonto1(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">Deliberação Ponto 3 (Orçamento e Quotas {nextYear})</label>
              <input
                type="text"
                className="input h-9 text-sm"
                value={votesPonto3}
                onChange={(e) => setVotesPonto3(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">Ponto 4 — Outros Assuntos (itens discutidos)</label>
              <textarea
                rows={3}
                className="input h-auto py-2 text-xs"
                value={ponto4Notes}
                onChange={(e) => setPonto4Notes(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">Ponto 5 — Administração Eleita para {nextYear}</label>
              <textarea
                rows={3}
                className="input h-auto py-2 text-xs"
                value={newAdminNames}
                onChange={(e) => setNewAdminNames(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Printable Official Minutes (ACTA) */}
      <div className="report-container bg-white rounded-2xl shadow-sm p-10 print:p-2 border border-gray-200 print:border-none max-w-4xl mx-auto text-gray-900 space-y-6">
        {/* Title */}
        <div className="text-center border-b-2 border-gray-800 pb-4">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-600">
            Condomínio do Edifício sito na {buildingName}
          </p>
          <h1 className="text-2xl font-black uppercase mt-2">
            ACTA N.º {templateMode === 'blank' ? '_____' : actaNumber}
          </h1>
          <p className="text-xs uppercase font-bold text-gray-500 mt-1">
            Assembleia Geral {assemblyType} de Condóminos
          </p>
        </div>

        {/* Opening */}
        <p className="text-sm leading-relaxed text-justify">
          {templateMode === 'blank' ? (
            <>
              Aos _____ dias do mês de ________________________ de ________, pelas ______ horas e ______ minutos, em _____ convocatória, reuniu no {location} a Assembleia Geral {assemblyType} de Condóminos do prédio constituído em regime de propriedade horizontal sito na {buildingName}. Estiveram presentes ou representados os condóminos assinantes da lista de presenças anexa, perfazendo uma permilagem total de ________‰. A reunião foi presidida por ______________________________ e secretariada por ______________________________.
            </>
          ) : (
            <>
              No dia <strong>{formatPtDate(meetingDate)}</strong>, pelas <strong>{startTime} horas</strong>, em <strong>{convocationUsed} convocatória</strong>, reuniu no <strong>{location}</strong> a Assembleia Geral {assemblyType} de Condóminos do edifício constituído em regime de propriedade horizontal sito na {buildingName}.{' '}
              {presentUnitsList.length > 0 ? (
                <>
                  Estiveram presentes ou devidamente representados os condóminos das frações{' '}
                  <strong>
                    {presentUnitsList.map((u) => `${u.code} (${formatUnitLabel(u.code)})`).join(', ')}
                  </strong>
                  , perfazendo uma permilagem total de <strong>{totalPermilagemPresent.toFixed(1)}‰</strong> ({(totalPermilagemPresent / 10).toFixed(1)}%).{' '}
                </>
              ) : (
                <>Verificada a lista de presenças anexa à presente ata,{' '}</>
              )}
              Confirmada a regularidade da convocatória e a existência de quórum, deu-se início à sessão, presidida por <strong>{presidedBy}</strong> e secretariada por <strong>{secretaryBy}</strong>, com a seguinte Ordem de Trabalhos:
            </>
          )}
        </p>

        {/* Agenda Summary */}
        <div className="p-4 bg-gray-50 border border-gray-300 rounded-lg text-xs space-y-1">
          <p className="font-bold uppercase text-gray-800 mb-1.5">Ordem de Trabalhos</p>
          <p><strong>Ponto Um:</strong> Apreciação e votação das contas do exercício de {year}.</p>
          <p><strong>Ponto Dois:</strong> Situação financeira do condomínio e relação de dívidas dos condóminos.</p>
          <p><strong>Ponto Três:</strong> Orçamento previsional para {nextYear} e definição das quotas mensais.</p>
          <p><strong>Ponto Quatro:</strong> Outros assuntos de interesse geral do prédio.</p>
          <p><strong>Ponto Cinco:</strong> Eleição da Administração para o exercício de {nextYear}.</p>
        </div>

        {/* PONTO 1 */}
        <div className="space-y-3">
          <h2 className="text-sm font-black uppercase border-b border-gray-400 pb-1">
            Ponto Um — Apresentação e Votação das Contas de {year}
          </h2>
          {templateMode === 'blank' ? (
            <div className="space-y-3 text-xs text-gray-700">
              <p>Foram apresentados os valores de receitas, despesas e disponibilidades bancárias referentes ao período de 01/01/{year} a 31/12/{year}:</p>
              <div className="h-24 border border-dashed border-gray-400 rounded p-2">Notas / Resumo de votação:</div>
            </div>
          ) : (
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
              <p className="font-semibold">Deliberação: {votesPonto1}</p>
            </div>
          )}
        </div>

        {/* PONTO 2 */}
        <div className="space-y-3">
          <h2 className="text-sm font-black uppercase border-b border-gray-400 pb-1">
            Ponto Dois — Situação Financeira e Dívidas em Aberto
          </h2>
          {templateMode === 'blank' ? (
            <div className="h-24 border border-dashed border-gray-400 rounded p-2 text-xs text-gray-700">
              Registo das frações com dívidas apuradas e prazos de regularização:
            </div>
          ) : (
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
          )}
        </div>

        {/* PONTO 3 */}
        <div className="space-y-3 report-section-break">
          <h2 className="text-sm font-black uppercase border-b border-gray-400 pb-1">
            Ponto Três — Orçamento para {nextYear} e Atualização das Quotas
          </h2>
          {templateMode === 'blank' ? (
            <div className="h-28 border border-dashed border-gray-400 rounded p-2 text-xs text-gray-700">
              Valor total do orçamento aprovado para {nextYear}, nova quota mensal aprovada e data de produção de efeitos:
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <p>
                Foi apresentado o orçamento previsional de despesas para <strong>{nextYear}</strong> no total de{' '}
                <strong>{fmtEur(budgetTotalAnnual)}</strong> ({fmtEur(budgetTotalMonthly)}/mês), bem como a proposta de atualização das quotas para as 16 frações (receita anual prevista de{' '}
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
              <p className="font-semibold">Deliberação: {votesPonto3}</p>
            </div>
          )}
        </div>

        {/* PONTO 4 & 5 */}
        <div className="space-y-4 text-xs">
          <div>
            <h2 className="text-sm font-black uppercase border-b border-gray-400 pb-1 mb-2">
              Ponto Quatro — Outros Assuntos de Interesse Geral
            </h2>
            {templateMode === 'blank' ? (
              <div className="h-24 border border-dashed border-gray-400 rounded p-2 text-gray-600">
                Assuntos discutidos e deliberações tomadas:
              </div>
            ) : (
              <div className="whitespace-pre-line leading-relaxed">{ponto4Notes}</div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-black uppercase border-b border-gray-400 pb-1 mb-2">
              Ponto Cinco — Eleição da Administração para {nextYear} e Encerramento
            </h2>
            <p className="leading-relaxed">
              {templateMode === 'blank' ? (
                <>
                  Foi deliberado eleger para a Administração do condomínio referente ao exercício de {nextYear} os condóminos: _______________________________________________________________. Nada mais havendo a tratar, foi encerrada a reunião pelas ______ horas e ______ minutos, da qual se lavrou a presente ata que vai ser assinada pelos membros da mesa e condóminos presentes.
                </>
              ) : (
                <>
                  A assembleia deliberou eleger para exercer funções de Administração durante o exercício de {nextYear}: <strong>{newAdminNames}</strong>. Nada mais havendo a tratar e não tendo ninguém pedido novamente a palavra, foi encerrada a sessão, da qual se lavrou a presente ata que, depois de lida e aprovada, vai ser assinada.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Attendance & Signatures Sheet */}
        <div className="report-section-break space-y-3">
          <h2 className="text-sm font-black uppercase border-b-2 border-gray-800 pb-1">
            Folha de Presenças, Permilagens e Assinaturas — Acta N.º {templateMode === 'blank' ? '_____' : actaNumber}
          </h2>
          <table className="w-full text-xs border-collapse border border-gray-400">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-400 font-bold">
                <th className="py-1.5 px-2 text-left border-r border-gray-300">Fração</th>
                <th className="py-1.5 px-2 text-left border-r border-gray-300">Condómino</th>
                <th className="py-1.5 px-2 text-right border-r border-gray-300 w-20">Perm. (‰)</th>
                <th className="py-1.5 px-2 text-center border-r border-gray-300 w-28">Situação</th>
                <th className="py-1.5 px-2 text-left">Assinatura</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => {
                const st = attendance[u.id] || 'ausente';
                const rep = representatives[u.id];
                return (
                  <tr key={u.id} className="border-b border-gray-300">
                    <td className="py-2 px-2 font-bold border-r border-gray-300">
                      {u.code} ({formatUnitLabel(u.code)})
                    </td>
                    <td className="py-2 px-2 border-r border-gray-300">
                      {u.currentOwner?.name || 'N/D'}
                      {templateMode === 'filled' && st === 'representado' && rep
                        ? ` (Repr.: ${rep})`
                        : ''}
                    </td>
                    <td className="py-2 px-2 text-right border-r border-gray-300">
                      {(permilagens[u.id] ?? 62.5).toFixed(1)}‰
                    </td>
                    <td className="py-2 px-2 text-center border-r border-gray-300">
                      {templateMode === 'blank' ? (
                        <span className="text-[10px] text-gray-500">☐ Pres. ☐ Repr.</span>
                      ) : st === 'presente' ? (
                        <span className="font-bold text-green-800">Presente</span>
                      ) : st === 'representado' ? (
                        <span className="font-bold text-blue-800">Representado</span>
                      ) : (
                        <span className="text-gray-400">Ausente</span>
                      )}
                    </td>
                    <td className="py-2 px-2"></td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-16 pt-10 text-center text-xs">
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
      </div>
    </div>
  );
}
