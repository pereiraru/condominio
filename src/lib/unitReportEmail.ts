import {
  buildTransport,
  escapeHtml,
  parseEmailList,
  resolveTransportConfig,
  type NotificationDispatchResult,
} from '@/lib/incidentNotifications';
import type { UnitReportItem } from '@/app/dashboard/admin/budgets/types';
import { fmtEur, formatUnitLabel } from '@/app/dashboard/admin/budgets/utils';

export async function sendUnitFinancialReportEmail({
  unit,
  year,
  buildingName,
  toEmails,
  customNote,
}: {
  unit: UnitReportItem;
  year: number;
  buildingName: string;
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

    const unitLabel = formatUnitLabel(unit.code);
    const notesText = (customNote ?? unit.autoNotes).trim();
    const baseUrl = process.env.NEXTAUTH_URL || 'https://condominio.pereiraru.com';
    const unitUrl = `${baseUrl}/dashboard/units/${unit.id}`;

    const subject =
      unit.debtByYear.totalDebt > 0.01
        ? `Situação Financeira — Fração ${unit.code} (${fmtEur(unit.debtByYear.totalDebt)} em dívida)`
        : `Situação Financeira — Fração ${unit.code} (Regularizada)`;

    const kpis = [
      { label: 'Quota Atual', val: `${fmtEur(unit.monthlyFee)} / mês`, color: '#111827', bg: '#f9fafb' },
      { label: 'Dívida Pré-2024', val: fmtEur(unit.pre2024.remaining), color: '#9a3412', bg: '#fff7ed' },
      {
        label: `Dívida 2024–${year - 1}`,
        val: fmtEur(unit.debtByYear.pastYearsDebt),
        color: unit.debtByYear.pastYearsDebt > 0.01 ? '#b91c1c' : '#15803d',
        bg: '#f9fafb',
      },
      {
        label: `Dívida ${year}`,
        val: fmtEur(unit.debtByYear.currentYearDebt),
        color: unit.debtByYear.currentYearDebt > 0.01 ? '#b91c1c' : '#15803d',
        bg: '#f9fafb',
      },
      {
        label: 'Total em Dívida',
        val: unit.debtByYear.totalDebt > 0.01 ? fmtEur(unit.debtByYear.totalDebt) : 'Regularizado',
        color: unit.debtByYear.totalDebt > 0.01 ? '#991b1b' : '#166534',
        bg: unit.debtByYear.totalDebt > 0.01 ? '#fef2f2' : '#f0fdf4',
      },
    ];

    const kpiHtml = kpis
      .map(
        (k) =>
          `<td style="padding:8px 10px;border:1px solid #e5e7eb;background:${k.bg};width:20%;vertical-align:top;">
            <div style="font-size:10px;text-transform:uppercase;color:#6b7280;font-weight:700;">${escapeHtml(k.label)}</div>
            <div style="font-size:13px;font-weight:800;color:${k.color};margin-top:4px;">${escapeHtml(k.val)}</div>
          </td>`
      )
      .join('');

    const monthHeaders = (unit.yearsGrid[0]?.months || [])
      .map(
        (m) =>
          `<th style="padding:5px 3px;border:1px solid #d1d5db;background:#f3f4f6;font-size:10px;">${escapeHtml(m.label)}</th>`
      )
      .join('');

    const gridRows = unit.yearsGrid
      .map((yg) => {
        const monthCells = yg.months
          .map((cell) => {
            const bg =
              cell.status === 'paid'
                ? '#dcfce7'
                : cell.status === 'partial'
                  ? '#fef9c3'
                  : cell.status === 'unpaid'
                    ? '#fee2e2'
                    : '#ffffff';
            const fg =
              cell.status === 'paid'
                ? '#166534'
                : cell.status === 'partial'
                  ? '#854d0e'
                  : cell.status === 'unpaid'
                    ? '#b91c1c'
                    : '#9ca3af';
            const label =
              cell.paid > 0
                ? Number.isInteger(cell.paid)
                  ? String(cell.paid)
                  : cell.paid.toFixed(1)
                : cell.status === 'unpaid'
                  ? '0'
                  : '—';
            return `<td style="padding:5px 3px;border:1px solid #e5e7eb;text-align:center;font-size:10px;background:${bg};color:${fg};font-weight:700;">${escapeHtml(label)}</td>`;
          })
          .join('');

        return `<tr>
          <td style="padding:5px 6px;border:1px solid #d1d5db;font-weight:700;background:#f9fafb;font-size:11px;">${yg.year}</td>
          ${monthCells}
          <td style="padding:5px 6px;border:1px solid #d1d5db;text-align:right;font-weight:700;background:#f0fdf4;color:#166534;font-size:11px;">${escapeHtml(fmtEur(yg.paid))}</td>
          <td style="padding:5px 6px;border:1px solid #d1d5db;text-align:right;font-weight:700;color:${yg.debt > 0.01 ? '#b91c1c' : '#9ca3af'};font-size:11px;">${escapeHtml(yg.debt > 0.01 ? fmtEur(yg.debt) : '—')}</td>
        </tr>`;
      })
      .join('');

    const recentPayments = unit.payments.slice(0, 25);
    const paymentsRows =
      recentPayments.length > 0
        ? recentPayments
            .map((tx) => {
              const allocText =
                tx.allocations.length > 0
                  ? tx.allocations
                      .map((a) =>
                        a.month === 'PREV-DEBT'
                          ? `Abat. Pré-2024 (${a.amount.toFixed(2)}€)`
                          : `${a.month} (${a.amount.toFixed(2)}€)`
                      )
                      .join(', ')
                  : 'Por alocar';
              return `<tr>
                <td style="padding:5px 8px;border:1px solid #e5e7eb;font-size:11px;white-space:nowrap;">${escapeHtml(tx.date)}</td>
                <td style="padding:5px 8px;border:1px solid #e5e7eb;font-size:11px;">${escapeHtml(tx.description)}</td>
                <td style="padding:5px 8px;border:1px solid #e5e7eb;font-size:11px;color:#4b5563;">${escapeHtml(allocText)}</td>
                <td style="padding:5px 8px;border:1px solid #e5e7eb;font-size:11px;text-align:right;font-weight:700;color:#166534;white-space:nowrap;">${escapeHtml(fmtEur(tx.amount))}</td>
              </tr>`;
            })
            .join('')
        : `<tr><td colspan="4" style="padding:10px;border:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:12px;">Sem pagamentos registados entre 2024 e ${year}.</td></tr>`;

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:780px;margin:0 auto;color:#111827;">
        <div style="background:#111827;color:#ffffff;padding:18px 24px;border-radius:12px 12px 0 0;">
          <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Administração de Condomínio — ${escapeHtml(buildingName)}</p>
          <h2 style="margin:6px 0 0;font-size:19px;">Situação Financeira — Fração ${escapeHtml(unit.code)} (${escapeHtml(unitLabel)})</h2>
          <p style="margin:4px 0 0;font-size:12px;color:#d1d5db;">Condómino: ${escapeHtml(unit.currentOwner?.name || 'N/D')} · Emitido em ${new Date().toLocaleDateString('pt-PT')}</p>
        </div>

        <div style="border:1px solid #e5e7eb;border-top:none;padding:20px 24px;border-radius:0 0 12px 12px;background:#ffffff;">
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
            <tr>${kpiHtml}</tr>
          </table>

          <div style="padding:12px 14px;border:1px solid #fde68a;background:#fffbeb;border-radius:8px;margin-bottom:18px;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#92400e;margin-bottom:4px;">Esclarecimentos e Justificação dos Valores</div>
            <div style="font-size:12px;color:#1f2937;line-height:1.5;">${escapeHtml(notesText).replace(/\n/g, '<br/>')}</div>
          </div>

          <h3 style="font-size:12px;text-transform:uppercase;color:#374151;margin:0 0 8px;">Mapa de Quotas Mensais (2024 – ${year})</h3>
          <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
            <thead>
              <tr>
                <th style="padding:5px 6px;border:1px solid #d1d5db;background:#f3f4f6;text-align:left;font-size:10px;">Ano</th>
                ${monthHeaders}
                <th style="padding:5px 6px;border:1px solid #d1d5db;background:#dcfce7;text-align:right;font-size:10px;">Pago</th>
                <th style="padding:5px 6px;border:1px solid #d1d5db;background:#fee2e2;text-align:right;font-size:10px;">Falta</th>
              </tr>
            </thead>
            <tbody>${gridRows}</tbody>
          </table>

          <h3 style="font-size:12px;text-transform:uppercase;color:#374151;margin:0 0 8px;">Pagamentos Registados (${unit.payments.length} movimentos — Total: ${escapeHtml(fmtEur(unit.totalPaidDigital))})</h3>
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
            <thead>
              <tr>
                <th style="padding:6px 8px;border:1px solid #d1d5db;background:#f9fafb;text-align:left;font-size:11px;">Data</th>
                <th style="padding:6px 8px;border:1px solid #d1d5db;background:#f9fafb;text-align:left;font-size:11px;">Descrição</th>
                <th style="padding:6px 8px;border:1px solid #d1d5db;background:#f9fafb;text-align:left;font-size:11px;">Alocação</th>
                <th style="padding:6px 8px;border:1px solid #d1d5db;background:#f9fafb;text-align:right;font-size:11px;">Valor</th>
              </tr>
            </thead>
            <tbody>${paymentsRows}</tbody>
          </table>
          ${unit.payments.length > 25 ? `<p style="font-size:11px;color:#6b7280;margin:0 0 14px;">A mostrar os 25 pagamentos mais recentes de ${unit.payments.length}. Consulte o histórico completo no portal.</p>` : ''}

          <div style="margin-top:16px;">
            <a href="${escapeHtml(unitUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;">
              Ver Fração ${escapeHtml(unit.code)} no Portal
            </a>
          </div>
        </div>
      </div>
    `;

    const text = [
      `Situação Financeira — Fração ${unit.code} (${unitLabel})`,
      `Condómino: ${unit.currentOwner?.name || 'N/D'}`,
      `Quota Atual: ${fmtEur(unit.monthlyFee)}/mês`,
      `Dívida Pré-2024: ${fmtEur(unit.pre2024.remaining)}`,
      `Dívida 2024–${year - 1}: ${fmtEur(unit.debtByYear.pastYearsDebt)}`,
      `Dívida ${year}: ${fmtEur(unit.debtByYear.currentYearDebt)}`,
      `Total em Dívida: ${unit.debtByYear.totalDebt > 0.01 ? fmtEur(unit.debtByYear.totalDebt) : 'Regularizado'}`,
      '',
      'Esclarecimentos:',
      notesText,
      '',
      `Portal: ${unitUrl}`,
    ].join('\n');

    const transporter = buildTransport(cfg);
    await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to: recipients.join(', '),
      subject,
      text,
      html,
    });

    return { sent: true, recipients };
  } catch (error) {
    console.error(`Error sending unit financial report email for ${unit.code}:`, error);
    return {
      sent: false,
      recipients,
      reason: error instanceof Error ? error.message : 'Erro ao enviar email.',
    };
  }
}
