import {
  buildTransport,
  escapeHtml,
  parseEmailList,
  resolveTransportConfig,
  type NotificationDispatchResult,
} from '@/lib/incidentNotifications';
import {
  ACTION_PRIORITY_LABELS,
  ACTION_STATUS_LABELS,
  addMinutesToTime,
  formatMeetingDateLong,
  formatMeetingDateShort,
  isPlaceholderAdminNames,
  type CondoMeetingDTO,
} from '@/lib/meetings';

async function dispatchHtmlEmail({
  toEmails,
  subject,
  html,
  text,
  attachments,
}: {
  toEmails: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}): Promise<NotificationDispatchResult> {
  const recipients = parseEmailList(toEmails);
  if (recipients.length === 0) {
    return {
      sent: false,
      recipients: [],
      reason: 'Nenhum endereço de email válido indicado.',
    };
  }

  try {
    const cfg = await resolveTransportConfig();
    if (!cfg.smtpHost || !cfg.fromEmail) {
      return {
        sent: false,
        recipients,
        reason: 'Servidor SMTP não configurado em Administração → Notificações & Email.',
      };
    }

    const transporter = buildTransport(cfg);
    await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to: recipients.length === 1 ? recipients[0] : cfg.fromEmail,
      bcc: recipients.length > 1 ? recipients.join(', ') : undefined,
      subject,
      text,
      html,
      attachments,
    });

    return { sent: true, recipients };
  } catch (error) {
    console.error('Error sending meeting email:', error);
    return {
      sent: false,
      recipients,
      reason: error instanceof Error ? error.message : 'Erro ao enviar email.',
    };
  }
}

export async function sendMeetingSummaryEmail({
  meeting,
  buildingName,
  presentCount,
  totalUnits,
  totalPermilagem,
  toEmails,
  customNote,
}: {
  meeting: CondoMeetingDTO;
  buildingName: string;
  presentCount: number;
  totalUnits: number;
  totalPermilagem: number;
  toEmails: string;
  customNote?: string;
}): Promise<NotificationDispatchResult> {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://condominio.pereiraru.com';
  const formattedDate = formatMeetingDateLong(meeting.meetingDate);
  const shortDate = formatMeetingDateShort(meeting.meetingDate);
  const timeRange = meeting.endTime
    ? `${meeting.startTime} às ${meeting.endTime}`
    : `${meeting.startTime}`;

  const unitPercent = totalUnits > 0 ? ((presentCount / totalUnits) * 100).toFixed(1) : '0.0';
  const quorumSummaryText =
    meeting.quorumMode === 'permilagem'
      ? `${presentCount}/${totalUnits} frações presentes/representadas · ${totalPermilagem.toFixed(1)}‰ (${(totalPermilagem / 10).toFixed(1)}%)`
      : `${presentCount}/${totalUnits} frações presentes/representadas (${unitPercent}%)`;

  const subject = `Resumo da Reunião de Condomínio — Acta N.º ${meeting.actaNumber} (${shortDate})`;

    const pointLabelById = new Map<string, string>();
    meeting.discussionPoints.forEach((pt, idx) => {
      pointLabelById.set(pt.id, `Ponto ${idx + 1}`);
    });

    const pointsHtml =
      meeting.discussionPoints.length > 0
        ? meeting.discussionPoints
            .map((pt, idx) => {
              const titleText = pt.title.trim() || `Ponto ${idx + 1}`;
              const discussionHtml = pt.discussion.trim()
                ? `<p style="margin:6px 0;font-size:13px;color:#374151;white-space:pre-line;">${escapeHtml(pt.discussion.trim())}</p>`
                : '';
              const votingLabel = [pt.votingOutcome, pt.votingDetails].filter((v) => v && v.trim()).join(' — ');
              const decisionHtml =
                votingLabel || pt.decision.trim()
                  ? `<div style="margin-top:8px;padding:8px 12px;background:#ecfdf5;border-left:3px solid #059669;border-radius:4px;font-size:12px;">
                      ${votingLabel ? `<div style="color:#065f46;"><strong>Votação:</strong> ${escapeHtml(votingLabel)}</div>` : ''}
                      ${pt.decision.trim() ? `<div style="color:#064e3b;margin-top:3px;"><strong>Decisão Tomada:</strong> ${escapeHtml(pt.decision.trim())}</div>` : ''}
                    </div>`
                  : '';

              return `<div style="margin-bottom:14px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#ffffff;">
                <div style="font-size:14px;font-weight:700;color:#111827;">Ponto ${idx + 1} — ${escapeHtml(titleText)}</div>
                ${discussionHtml}
                ${decisionHtml}
              </div>`;
            })
            .join('')
        : '<p style="font-size:13px;color:#6b7280;">Sem pontos registados.</p>';

    const actionsHtml =
      meeting.actionItems.length > 0
        ? `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;">
            <thead>
              <tr>
                <th style="padding:7px 8px;border:1px solid #d1d5db;background:#f3f4f6;text-align:left;width:32px;">#</th>
                <th style="padding:7px 8px;border:1px solid #d1d5db;background:#f3f4f6;text-align:left;">Ação a Executar</th>
                <th style="padding:7px 8px;border:1px solid #d1d5db;background:#f3f4f6;text-align:left;width:75px;">Ponto</th>
                <th style="padding:7px 8px;border:1px solid #d1d5db;background:#f3f4f6;text-align:left;">Responsável</th>
                <th style="padding:7px 8px;border:1px solid #d1d5db;background:#f3f4f6;text-align:left;width:90px;">Prazo</th>
                <th style="padding:7px 8px;border:1px solid #d1d5db;background:#f3f4f6;text-align:left;width:85px;">Custo Est.</th>
                <th style="padding:7px 8px;border:1px solid #d1d5db;background:#f3f4f6;text-align:left;width:80px;">Prioridade</th>
                <th style="padding:7px 8px;border:1px solid #d1d5db;background:#f3f4f6;text-align:left;width:85px;">Estado</th>
              </tr>
            </thead>
            <tbody>
              ${meeting.actionItems
                .map((act, idx) => {
                  const pointRef = act.pointId ? pointLabelById.get(act.pointId) || 'Geral' : 'Geral';
                  const due = act.dueDate ? formatMeetingDateShort(act.dueDate) : 'A definir';
                  const cost = act.estimatedCost?.trim() ? act.estimatedCost.trim() : '—';
                  const priority = ACTION_PRIORITY_LABELS[act.priority] || act.priority;
                  const status = ACTION_STATUS_LABELS[act.status] || act.status;
                  const notesLine = act.notes?.trim()
                    ? `<br/><span style="color:#6b7280;font-size:11px;">${escapeHtml(act.notes.trim())}</span>`
                    : '';
                  return `<tr>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;font-weight:600;">${idx + 1}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;"><strong>${escapeHtml(act.title || '—')}</strong>${notesLine}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;">${escapeHtml(pointRef)}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;">${escapeHtml(act.responsible || 'Administração')}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;white-space:nowrap;">${escapeHtml(due)}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;white-space:nowrap;">${escapeHtml(cost)}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;">${escapeHtml(priority)}</td>
                    <td style="padding:6px 8px;border:1px solid #e5e7eb;">${escapeHtml(status)}</td>
                  </tr>`;
                })
                .join('')}
            </tbody>
          </table>`
        : '<p style="font-size:13px;color:#6b7280;margin-bottom:16px;">Não foram registadas ações operacionais pendentes nesta sessão.</p>';

    const showNewAdmin = !isPlaceholderAdminNames(meeting.newAdminNames);

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:720px;margin:0 auto;color:#111827;">
        <div style="background:#111827;color:#ffffff;padding:18px 22px;border-radius:10px 10px 0 0;">
          <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">${escapeHtml(buildingName)}</p>
          <h1 style="margin:4px 0 0;font-size:20px;">Acta N.º ${escapeHtml(meeting.actaNumber)} — Assembleia Geral ${escapeHtml(meeting.assemblyType)}</h1>
        </div>

        <div style="border:1px solid #e5e7eb;border-top:none;padding:20px 22px;border-radius:0 0 10px 10px;background:#f9fafb;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;background:#ffffff;border:1px solid #e5e7eb;margin-bottom:16px;">
            <tr>
              <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;width:130px;color:#6b7280;">Data e Hora</td>
              <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-weight:600;">${escapeHtml(formattedDate)} (${escapeHtml(timeRange)}) · ${escapeHtml(meeting.convocationUsed)} Convocatória</td>
            </tr>
            <tr>
              <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Local</td>
              <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(meeting.location)}</td>
            </tr>
            <tr>
              <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Mesa</td>
              <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;">Presidente: ${escapeHtml(meeting.presidedBy)} · Secretário: ${escapeHtml(meeting.secretaryBy)}</td>
            </tr>
            <tr>
              <td style="padding:7px 10px;color:#6b7280;">Quórum</td>
              <td style="padding:7px 10px;font-weight:600;">${escapeHtml(quorumSummaryText)}</td>
            </tr>
          </table>

          ${
            customNote?.trim()
              ? `<div style="margin-bottom:16px;padding:12px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:13px;color:#1e3a8a;white-space:pre-line;">${escapeHtml(customNote.trim())}</div>`
              : ''
          }

          <h2 style="font-size:14px;text-transform:uppercase;color:#111827;margin:16px 0 10px;">Pontos Discutidos & Decisões Tomadas</h2>
          ${pointsHtml}

          <h2 style="font-size:14px;text-transform:uppercase;color:#111827;margin:18px 0 10px;">Plano de Ações e Responsabilidades</h2>
          ${actionsHtml}

          ${
            showNewAdmin
              ? `<div style="margin-bottom:14px;padding:10px 14px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;">
                  <strong>Administração Eleita (${meeting.year + 1}):</strong> ${escapeHtml(meeting.newAdminNames)}
                </div>`
              : ''
          }

          ${
            meeting.generalNotes.trim()
              ? `<div style="margin-bottom:14px;padding:10px 14px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;font-size:12px;color:#374151;white-space:pre-line;">
                  <strong>Observações Finais:</strong><br/>${escapeHtml(meeting.generalNotes.trim())}
                </div>`
              : ''
          }

          <p style="font-size:12px;color:#6b7280;margin:16px 0 0;">
            Portal do Condomínio: <a href="${escapeHtml(baseUrl)}" style="color:#111827;">${escapeHtml(baseUrl)}</a>
          </p>
        </div>
      </div>
    `;

    const textLines: string[] = [
      `${buildingName}`,
      `Acta N.º ${meeting.actaNumber} — Assembleia Geral ${meeting.assemblyType}`,
      `Data: ${formattedDate} (${timeRange}) · ${meeting.convocationUsed} Convocatória`,
      `Local: ${meeting.location}`,
      `Mesa: Presidente ${meeting.presidedBy} | Secretário ${meeting.secretaryBy}`,
      `Quórum: ${quorumSummaryText}`,
      '',
    ];

    if (customNote?.trim()) {
      textLines.push('Nota:', customNote.trim(), '');
    }

    textLines.push('PONTOS DISCUTIDOS & DECISÕES TOMADAS');
    meeting.discussionPoints.forEach((pt, idx) => {
      textLines.push(`${idx + 1}. ${pt.title || `Ponto ${idx + 1}`}`);
      if (pt.discussion.trim()) textLines.push(`   Discussão: ${pt.discussion.trim()}`);
      const vote = [pt.votingOutcome, pt.votingDetails].filter((v) => v && v.trim()).join(' — ');
      if (vote) textLines.push(`   Votação: ${vote}`);
      if (pt.decision.trim()) textLines.push(`   Decisão: ${pt.decision.trim()}`);
      textLines.push('');
    });

    textLines.push('PLANO DE AÇÕES E RESPONSABILIDADES');
    if (meeting.actionItems.length === 0) {
      textLines.push('- Sem ações pendentes registadas.');
    } else {
      meeting.actionItems.forEach((act, idx) => {
        const pointRef = act.pointId ? pointLabelById.get(act.pointId) || 'Geral' : 'Geral';
        const due = act.dueDate ? formatMeetingDateShort(act.dueDate) : 'A definir';
        const cost = act.estimatedCost?.trim() ? ` | Custo: ${act.estimatedCost.trim()}` : '';
        textLines.push(
          `${idx + 1}. ${act.title} [${pointRef}] — Resp.: ${act.responsible || 'Administração'} | Prazo: ${due}${cost} | Prioridade: ${ACTION_PRIORITY_LABELS[act.priority]} | Estado: ${ACTION_STATUS_LABELS[act.status]}`
        );
        if (act.notes?.trim()) textLines.push(`   Notas: ${act.notes.trim()}`);
      });
    }

    if (showNewAdmin) {
      textLines.push('', `Administração Eleita (${meeting.year + 1}): ${meeting.newAdminNames}`);
    }
    if (meeting.generalNotes.trim()) {
      textLines.push('', `Observações Finais: ${meeting.generalNotes.trim()}`);
    }
    textLines.push('', `Portal: ${baseUrl}`);

  return dispatchHtmlEmail({
    toEmails,
    subject,
    html,
    text: textLines.join('\n'),
  });
}

export async function sendMeetingConvocatoriaEmail({
  meeting,
  buildingName,
  toEmails,
  customNote,
  pdfAttachment,
}: {
  meeting: CondoMeetingDTO;
  buildingName: string;
  toEmails: string;
  customNote?: string;
  pdfAttachment?: { filename: string; content: Buffer };
}): Promise<NotificationDispatchResult> {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://condominio.pereiraru.com';
  const formattedDate = formatMeetingDateLong(meeting.meetingDate);
  const shortDate = formatMeetingDateShort(meeting.meetingDate);
  const issueFormatted = meeting.issueDate
    ? formatMeetingDateLong(meeting.issueDate)
    : formatMeetingDateLong(new Date().toISOString().slice(0, 10));
  const firstTime = meeting.firstConvocationTime || '21:30';
  const secondTime = addMinutesToTime(firstTime, 30);

  const agendaTitles = meeting.discussionPoints
    .map((p) => p.title.trim())
    .filter(Boolean);

  const subject = `Convocatória — Assembleia Geral ${meeting.assemblyType} de Condóminos (${shortDate})`;

  const agendaHtml =
    agendaTitles.length > 0
      ? `<ol style="margin:8px 0 0;padding-left:20px;font-size:13px;color:#111827;">
          ${agendaTitles
            .map((t) => `<li style="margin-bottom:6px;font-weight:500;">${escapeHtml(t)}</li>`)
            .join('')}
        </ol>`
      : '<p style="font-size:13px;color:#6b7280;">Sem pontos definidos.</p>';

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:720px;margin:0 auto;color:#111827;">
      <div style="background:#111827;color:#ffffff;padding:18px 22px;border-radius:10px 10px 0 0;">
        <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">${escapeHtml(buildingName)}</p>
        <h1 style="margin:4px 0 0;font-size:20px;">CONVOCATÓRIA — Assembleia Geral ${escapeHtml(meeting.assemblyType)}</h1>
      </div>

      <div style="border:1px solid #e5e7eb;border-top:none;padding:20px 22px;border-radius:0 0 10px 10px;background:#f9fafb;font-size:13px;line-height:1.6;">
        ${
          customNote?.trim()
            ? `<div style="margin-bottom:16px;padding:12px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;color:#1e3a8a;white-space:pre-line;">${escapeHtml(customNote.trim())}</div>`
            : ''
        }

        <p style="margin:0 0 12px;">Exmo.(a) Senhor(a) Condómino(a),</p>
        <p style="margin:0 0 16px;">
          Nos termos do n.º 2 do artigo 1431.º e do n.º 1 do artigo 1432.º do Código Civil, fica V.ª Ex.ª convocado(a) para a
          <strong>Assembleia Geral ${escapeHtml(meeting.assemblyType)} de Condóminos</strong>, a realizar no dia
          <strong>${escapeHtml(formattedDate)}</strong>, pelas <strong>${escapeHtml(firstTime)} horas</strong> (1.ª convocatória), no
          <strong>${escapeHtml(meeting.location)}</strong>, com a seguinte:
        </p>

        <div style="margin:16px 0;padding:14px 16px;background:#ffffff;border:1px solid #d1d5db;border-radius:8px;">
          <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;color:#111827;">
            Ordem de Trabalhos
          </div>
          ${agendaHtml}
        </div>

        <div style="margin:14px 0;padding:12px 14px;background:#ffffff;border-left:4px solid #374151;font-size:12px;color:#374151;">
          Caso não se verifique quórum na 1.ª convocatória às <strong>${escapeHtml(firstTime)} horas</strong>, fica desde já convocada nova reunião no
          <strong>mesmo dia e local, 30 minutos depois (${escapeHtml(secondTime)} horas)</strong>, com a mesma ordem de trabalhos, nos termos do n.º 4 do art.º 1432.º do Código Civil.
        </div>

        ${
          meeting.extraNote.trim()
            ? `<p style="font-size:12px;font-style:italic;color:#374151;margin:12px 0;">${escapeHtml(meeting.extraNote.trim())}</p>`
            : ''
        }

        <p style="margin:16px 0 4px;">Monte Abraão — Queluz, ${escapeHtml(issueFormatted)}</p>
        <p style="margin:0;font-weight:600;white-space:pre-line;">${escapeHtml(meeting.adminSigners)}</p>

        ${
          pdfAttachment
            ? `<p style="margin:14px 0 0;padding:10px 12px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;font-size:12px;color:#065f46;"><strong>Anexo:</strong> Em anexo segue o documento oficial da Convocatória em formato PDF (${escapeHtml(pdfAttachment.filename)}).</p>`
            : ''
        }

        <p style="font-size:12px;color:#6b7280;margin:18px 0 0;border-top:1px solid #e5e7eb;padding-top:12px;">
          Portal do Condomínio: <a href="${escapeHtml(baseUrl)}" style="color:#111827;">${escapeHtml(baseUrl)}</a>
        </p>
      </div>
    </div>
  `;

  const textLines: string[] = [
    `${buildingName}`,
    `CONVOCATÓRIA — Assembleia Geral ${meeting.assemblyType} de Condóminos`,
    '',
  ];
  if (customNote?.trim()) {
    textLines.push(customNote.trim(), '');
  }
  textLines.push(
    'Exmo.(a) Senhor(a) Condómino(a),',
    '',
    `Fica V.ª Ex.ª convocado(a) para a Assembleia Geral ${meeting.assemblyType} de Condóminos a realizar no dia ${formattedDate}, pelas ${firstTime} horas (1.ª convocatória), no ${meeting.location}.`,
    '',
    'ORDEM DE TRABALHOS:'
  );
  agendaTitles.forEach((t, idx) => textLines.push(`${idx + 1}. ${t}`));
  textLines.push(
    '',
    `Em 2.ª convocatória: no mesmo dia e local às ${secondTime} horas (30 minutos depois), com a mesma ordem de trabalhos (art.º 1432.º n.º 4 do Código Civil).`
  );
  if (meeting.extraNote.trim()) {
    textLines.push('', meeting.extraNote.trim());
  }
  textLines.push(
    '',
    `Monte Abraão — Queluz, ${issueFormatted}`,
    meeting.adminSigners
  );
  if (pdfAttachment) {
    textLines.push('', `Anexo: Em anexo segue o documento oficial da Convocatória em formato PDF (${pdfAttachment.filename}).`);
  }
  textLines.push('', `Portal: ${baseUrl}`);

  return dispatchHtmlEmail({
    toEmails,
    subject,
    html,
    text: textLines.join('\n'),
    attachments: pdfAttachment
      ? [
          {
            filename: pdfAttachment.filename,
            content: pdfAttachment.content,
            contentType: 'application/pdf',
          },
        ]
      : undefined,
  });
}
