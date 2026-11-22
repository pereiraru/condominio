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
  formatMeetingDateLong,
  formatMeetingDateShort,
  isPlaceholderAdminNames,
  type CondoMeetingDTO,
} from '@/lib/meetings';

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

    const baseUrl = process.env.NEXTAUTH_URL || 'https://condominio.pereiraru.com';
    const formattedDate = formatMeetingDateLong(meeting.meetingDate);
    const shortDate = formatMeetingDateShort(meeting.meetingDate);
    const timeRange = meeting.endTime
      ? `${meeting.startTime} às ${meeting.endTime}`
      : `${meeting.startTime}`;

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
              <td style="padding:7px 10px;font-weight:600;">${presentCount}/${totalUnits} frações presentes/representadas · ${totalPermilagem.toFixed(1)}‰ (${(totalPermilagem / 10).toFixed(1)}%)</td>
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
      `Quórum: ${presentCount}/${totalUnits} frações (${totalPermilagem.toFixed(1)}‰)`,
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

    const transporter = buildTransport(cfg);
    await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to: recipients.length === 1 ? recipients[0] : cfg.fromEmail,
      bcc: recipients.length > 1 ? recipients.join(', ') : undefined,
      subject,
      text: textLines.join('\n'),
      html,
    });

    return { sent: true, recipients };
  } catch (error) {
    console.error('Error sending meeting summary email:', error);
    return {
      sent: false,
      recipients,
      reason: error instanceof Error ? error.message : 'Erro ao enviar email.',
    };
  }
}
