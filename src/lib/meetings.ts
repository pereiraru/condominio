import type { CondoMeeting, Document } from '@prisma/client';

export type MeetingLinkedSection = 'none' | 'contas' | 'dividas' | 'orcamento' | 'eleicao';
export type MeetingActionStatus = 'pending' | 'in_progress' | 'done';
export type MeetingActionPriority = 'low' | 'normal' | 'urgent';
export type AttendanceStatus = 'presente' | 'representado' | 'ausente';
export type AssemblyType = 'Ordinária' | 'Extraordinária';
export type ConvocationUsed = '1.ª' | '2.ª';
export type MeetingStatus = 'draft' | 'finalized';
export type ConvocationStatus = 'draft' | 'finalized';
export type QuorumMode = 'units' | 'permilagem';

export interface MeetingLinkedDocument {
  id: string;
  name: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export const DEFAULT_CONVOCATION_EXTRA_NOTE =
  'Encontra-se disponível para consulta o Balancete de Receitas e Despesas e os extratos individuais por fração.';
export const DEFAULT_ADMIN_SIGNERS =
  'A Administração\nCondomínio Rua Vieira da Silva, n.º 6';

export interface MeetingDiscussionPoint {
  id: string;
  title: string;
  linkedSection: MeetingLinkedSection;
  discussion: string;
  votingOutcome: string;
  votingDetails: string;
  decision: string;
}

export interface MeetingActionItem {
  id: string;
  pointId?: string;
  title: string;
  responsible: string;
  dueDate: string;
  estimatedCost?: string;
  priority: MeetingActionPriority;
  status: MeetingActionStatus;
  notes?: string;
}

export interface MeetingAttendancePayload {
  statuses: Record<string, AttendanceStatus>;
  permilagens: Record<string, number>;
  representatives: Record<string, string>;
}

export interface CondoMeetingDTO {
  id: string;
  year: number;
  actaNumber: string;
  assemblyType: AssemblyType;
  meetingDate: string;
  startTime: string;
  endTime: string;
  convocationUsed: ConvocationUsed;
  location: string;
  presidedBy: string;
  secretaryBy: string;
  newAdminNames: string;
  status: MeetingStatus;
  quorumMode: QuorumMode;
  firstConvocationTime: string;
  issueDate: string;
  extraNote: string;
  adminSigners: string;
  convocationSentAt: string | null;
  convocationStatus: ConvocationStatus;
  convocationFinalizedAt: string | null;
  convocationDocumentId: string | null;
  convocationDocument: MeetingLinkedDocument | null;
  attendance: MeetingAttendancePayload;
  discussionPoints: MeetingDiscussionPoint[];
  actionItems: MeetingActionItem[];
  generalNotes: string;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingQuorumSummary {
  quorumMode: QuorumMode;
  totalUnits: number;
  presentCount: number;
  percentByUnits: number;
  minUnitsFirst: number;
  minUnitsSecond: number;
  totalPermilagem: number;
  percentByPermilagem: number;
  meetsFirst: boolean;
  meetsSecond: boolean;
  statusLabel: string;
  shortSummary: string;
}

export const VOTING_OUTCOME_OPTIONS: string[] = [
  'Aprovado por unanimidade',
  'Aprovado por maioria',
  'Rejeitado',
  'Adiado',
  'Tomado conhecimento (sem votação)',
  'Outro',
];

export const ACTION_STATUS_LABELS: Record<MeetingActionStatus, string> = {
  pending: 'Pendente',
  in_progress: 'Em Curso',
  done: 'Concluído',
};

export const ACTION_PRIORITY_LABELS: Record<MeetingActionPriority, string> = {
  low: 'Baixa',
  normal: 'Normal',
  urgent: 'Urgente',
};

export const LINKED_SECTION_LABELS: Record<MeetingLinkedSection, string> = {
  none: 'Ponto Livre',
  contas: 'Balancete / Contas',
  dividas: 'Tabela de Dívidas',
  orcamento: 'Orçamento & Quotas',
  eleicao: 'Eleição da Administração',
};

const VALID_LINKED_SECTIONS = new Set<MeetingLinkedSection>([
  'none',
  'contas',
  'dividas',
  'orcamento',
  'eleicao',
]);

const VALID_ACTION_STATUSES = new Set<MeetingActionStatus>(['pending', 'in_progress', 'done']);
const VALID_ACTION_PRIORITIES = new Set<MeetingActionPriority>(['low', 'normal', 'urgent']);
const VALID_ATTENDANCE_STATUSES = new Set<AttendanceStatus>([
  'presente',
  'representado',
  'ausente',
]);

export function createClientItemId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createDefaultDiscussionPoints(year: number): MeetingDiscussionPoint[] {
  const nextYear = year + 1;
  return [
    {
      id: 'point-contas',
      title: `Apresentação e Votação das Contas de ${year}`,
      linkedSection: 'contas',
      discussion: `Apresentação do balancete de receitas, despesas por credor e disponibilidades bancárias referentes ao exercício de ${year}.`,
      votingOutcome: 'Aprovado por unanimidade',
      votingDetails: '',
      decision: `Contas do exercício de ${year} aprovadas pela Assembleia.`,
    },
    {
      id: 'point-dividas',
      title: 'Situação Financeira e Dívidas em Aberto',
      linkedSection: 'dividas',
      discussion:
        'Análise da relação de dívidas dos condóminos (Pré-2024, anos anteriores e exercício corrente) e planos de regularização.',
      votingOutcome: 'Tomado conhecimento (sem votação)',
      votingDetails: '',
      decision:
        'Validada a relação de valores em dívida à data, mantendo-se o acompanhamento e interpelação das frações incumpridoras.',
    },
    {
      id: 'point-orcamento',
      title: `Orçamento para ${nextYear} e Atualização das Quotas`,
      linkedSection: 'orcamento',
      discussion: `Apresentação do orçamento previsional de despesas para ${nextYear} e respetiva simulação de atualização das quotas mensais.`,
      votingOutcome: 'Aprovado por maioria',
      votingDetails: '',
      decision: `Aprovado o orçamento para ${nextYear} e os novos valores de quotas mensais, entrando em vigor no mês acordado pela Assembleia.`,
    },
    {
      id: 'point-outros',
      title: 'Outros Assuntos de Interesse Geral',
      linkedSection: 'none',
      discussion:
        '- Conservação geral e manutenção das partes comuns do edifício.\n' +
        '- Ponto de situação sobre a limpeza do prédio e eventual regularização de limpeza de vidros.\n' +
        '- Verificação do funcionamento dos elevadores, bomba de água e portão da garagem.',
      votingOutcome: 'Tomado conhecimento (sem votação)',
      votingDetails: '',
      decision: '',
    },
    {
      id: 'point-eleicao',
      title: `Eleição da Administração para ${nextYear}`,
      linkedSection: 'eleicao',
      discussion: `Apresentação de candidaturas e designação da equipa de Administração para o exercício de ${nextYear}.`,
      votingOutcome: 'Aprovado por unanimidade',
      votingDetails: '',
      decision: `Eleita a Administração para o exercício de ${nextYear}.`,
    },
  ];
}

export function inferLinkedSectionFromTitle(title: string): MeetingLinkedSection {
  const lower = title.toLowerCase();
  if (lower.includes('eleiç') || lower.includes('eleic') || lower.includes('administra')) {
    return 'eleicao';
  }
  if (lower.includes('orçament') || lower.includes('orcament') || lower.includes('quota')) {
    return 'orcamento';
  }
  if (lower.includes('dívida') || lower.includes('divida') || lower.includes('incumpr')) {
    return 'dividas';
  }
  if (lower.includes('conta') || lower.includes('balancete')) {
    return 'contas';
  }
  return 'none';
}

function parseMaybeJson(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

export function normalizeDiscussionPoints(raw: unknown): MeetingDiscussionPoint[] {
  const parsed = parseMaybeJson(raw);
  if (!Array.isArray(parsed)) return [];

  const seenIds = new Set<string>();
  const result: MeetingDiscussionPoint[] = [];

  parsed.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const obj = item as Record<string, unknown>;

    const rawId = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : `pt-${index + 1}`;
    let id = rawId;
    while (seenIds.has(id)) {
      id = `${rawId}-${index + 1}-${seenIds.size}`;
    }
    seenIds.add(id);

    const rawSection = typeof obj.linkedSection === 'string' ? obj.linkedSection : 'none';
    const linkedSection: MeetingLinkedSection = VALID_LINKED_SECTIONS.has(
      rawSection as MeetingLinkedSection
    )
      ? (rawSection as MeetingLinkedSection)
      : 'none';

    result.push({
      id,
      title: typeof obj.title === 'string' ? obj.title : '',
      linkedSection,
      discussion: typeof obj.discussion === 'string' ? obj.discussion : '',
      votingOutcome: typeof obj.votingOutcome === 'string' ? obj.votingOutcome : '',
      votingDetails: typeof obj.votingDetails === 'string' ? obj.votingDetails : '',
      decision: typeof obj.decision === 'string' ? obj.decision : '',
    });
  });

  return result;
}

export function normalizeActionItems(raw: unknown): MeetingActionItem[] {
  const parsed = parseMaybeJson(raw);
  if (!Array.isArray(parsed)) return [];

  const seenIds = new Set<string>();
  const result: MeetingActionItem[] = [];

  parsed.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const obj = item as Record<string, unknown>;

    const rawId = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : `act-${index + 1}`;
    let id = rawId;
    while (seenIds.has(id)) {
      id = `${rawId}-${index + 1}-${seenIds.size}`;
    }
    seenIds.add(id);

    const rawPriority = typeof obj.priority === 'string' ? obj.priority : 'normal';
    const priority: MeetingActionPriority = VALID_ACTION_PRIORITIES.has(
      rawPriority as MeetingActionPriority
    )
      ? (rawPriority as MeetingActionPriority)
      : 'normal';

    const rawStatus = typeof obj.status === 'string' ? obj.status : 'pending';
    const status: MeetingActionStatus = VALID_ACTION_STATUSES.has(
      rawStatus as MeetingActionStatus
    )
      ? (rawStatus as MeetingActionStatus)
      : 'pending';

    result.push({
      id,
      pointId: typeof obj.pointId === 'string' && obj.pointId.trim() ? obj.pointId.trim() : undefined,
      title: typeof obj.title === 'string' ? obj.title : '',
      responsible: typeof obj.responsible === 'string' ? obj.responsible : '',
      dueDate: typeof obj.dueDate === 'string' ? obj.dueDate : '',
      estimatedCost: typeof obj.estimatedCost === 'string' ? obj.estimatedCost : '',
      priority,
      status,
      notes: typeof obj.notes === 'string' ? obj.notes : '',
    });
  });

  return result;
}

export function normalizeAttendance(raw: unknown): MeetingAttendancePayload {
  const parsed = parseMaybeJson(raw);
  const empty: MeetingAttendancePayload = {
    statuses: {},
    permilagens: {},
    representatives: {},
  };

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return empty;
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.statuses && typeof obj.statuses === 'object' && !Array.isArray(obj.statuses)) {
    for (const [k, v] of Object.entries(obj.statuses as Record<string, unknown>)) {
      if (typeof v === 'string' && VALID_ATTENDANCE_STATUSES.has(v as AttendanceStatus)) {
        empty.statuses[k] = v as AttendanceStatus;
      }
    }
  }

  if (obj.permilagens && typeof obj.permilagens === 'object' && !Array.isArray(obj.permilagens)) {
    for (const [k, v] of Object.entries(obj.permilagens as Record<string, unknown>)) {
      const num = typeof v === 'number' ? v : Number(v);
      if (Number.isFinite(num) && num >= 0) {
        empty.permilagens[k] = num;
      }
    }
  }

  if (
    obj.representatives &&
    typeof obj.representatives === 'object' &&
    !Array.isArray(obj.representatives)
  ) {
    for (const [k, v] of Object.entries(obj.representatives as Record<string, unknown>)) {
      if (typeof v === 'string') {
        empty.representatives[k] = v;
      }
    }
  }

  return empty;
}

export function serializeMeeting(
  record: CondoMeeting & { convocationDocument?: Document | null }
): CondoMeetingDTO {
  return {
    id: record.id,
    year: record.year,
    actaNumber: record.actaNumber,
    assemblyType: record.assemblyType === 'Extraordinária' ? 'Extraordinária' : 'Ordinária',
    meetingDate: record.meetingDate,
    startTime: record.startTime,
    endTime: record.endTime || '',
    convocationUsed: record.convocationUsed === '1.ª' ? '1.ª' : '2.ª',
    location: record.location,
    presidedBy: record.presidedBy,
    secretaryBy: record.secretaryBy,
    newAdminNames: record.newAdminNames || '',
    status: record.status === 'finalized' ? 'finalized' : 'draft',
    quorumMode: record.quorumMode === 'permilagem' ? 'permilagem' : 'units',
    firstConvocationTime: record.firstConvocationTime || '21:30',
    issueDate: record.issueDate ?? record.createdAt.toISOString().slice(0, 10),
    extraNote: record.extraNote ?? DEFAULT_CONVOCATION_EXTRA_NOTE,
    adminSigners: record.adminSigners ?? DEFAULT_ADMIN_SIGNERS,
    convocationSentAt: record.convocationSentAt ? record.convocationSentAt.toISOString() : null,
    convocationStatus: record.convocationStatus === 'finalized' ? 'finalized' : 'draft',
    convocationFinalizedAt: record.convocationFinalizedAt
      ? record.convocationFinalizedAt.toISOString()
      : null,
    convocationDocumentId: record.convocationDocumentId || null,
    convocationDocument: record.convocationDocument
      ? {
          id: record.convocationDocument.id,
          name: record.convocationDocument.name,
          filename: record.convocationDocument.filename,
          mimeType: record.convocationDocument.mimeType,
          size: record.convocationDocument.size,
          uploadedAt: record.convocationDocument.uploadedAt.toISOString(),
        }
      : null,
    attendance: normalizeAttendance(record.attendanceJson),
    discussionPoints: normalizeDiscussionPoints(record.discussionPointsJson),
    actionItems: normalizeActionItems(record.actionItemsJson),
    generalNotes: record.generalNotes || '',
    generatedAt: record.generatedAt ? record.generatedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function formatMeetingDateLong(iso: string): string {
  if (!iso) return '____ de ____________ de ______';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatMeetingDateShort(iso: string): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function isPlaceholderAdminNames(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^[_\s,e]+$/i.test(trimmed);
}

export const DEFAULT_BUILDING_NAME = 'Rua Vieira da Silva, n.º 6 — Monte Abraão, Queluz';

export function parseMeetingWriteData(
  body: Record<string, unknown>,
  fallbackYear?: number
) {
  const yearNum = Number(body.year);
  const year =
    Number.isInteger(yearNum) && yearNum >= 2000 && yearNum <= 2100
      ? yearNum
      : fallbackYear || new Date().getFullYear();

  const actaNumber =
    typeof body.actaNumber === 'string' && body.actaNumber.trim()
      ? body.actaNumber.trim()
      : '24';

  const assemblyType: AssemblyType =
    body.assemblyType === 'Extraordinária' ? 'Extraordinária' : 'Ordinária';

  const meetingDate =
    typeof body.meetingDate === 'string' && body.meetingDate.trim()
      ? body.meetingDate.trim()
      : new Date().toISOString().slice(0, 10);

  const startTime =
    typeof body.startTime === 'string' && body.startTime.trim()
      ? body.startTime.trim()
      : '22:00';

  const endTime =
    typeof body.endTime === 'string' && body.endTime.trim() ? body.endTime.trim() : null;

  const convocationUsed: ConvocationUsed = body.convocationUsed === '1.ª' ? '1.ª' : '2.ª';

  const location =
    typeof body.location === 'string' && body.location.trim()
      ? body.location.trim()
      : 'Parqueamento situado no Piso -4 do Edifício';

  const presidedBy =
    typeof body.presidedBy === 'string' && body.presidedBy.trim()
      ? body.presidedBy.trim()
      : 'Administração Cessante';

  const secretaryBy =
    typeof body.secretaryBy === 'string' && body.secretaryBy.trim()
      ? body.secretaryBy.trim()
      : 'A designar na reunião';

  const newAdminNames =
    typeof body.newAdminNames === 'string' ? body.newAdminNames.trim() || null : null;

  const status: MeetingStatus = body.status === 'finalized' ? 'finalized' : 'draft';
  const quorumMode: QuorumMode = body.quorumMode === 'permilagem' ? 'permilagem' : 'units';

  const firstConvocationTime =
    typeof body.firstConvocationTime === 'string' && body.firstConvocationTime.trim()
      ? body.firstConvocationTime.trim()
      : '21:30';

  const issueDate =
    typeof body.issueDate === 'string' ? body.issueDate.trim() || null : null;

  const extraNote =
    typeof body.extraNote === 'string' ? body.extraNote.trim() : null;

  const adminSigners =
    typeof body.adminSigners === 'string' ? body.adminSigners.trim() : null;

  const attendanceJson = JSON.stringify(
    normalizeAttendance(body.attendance ?? body.attendanceJson)
  );
  const discussionPointsJson = JSON.stringify(
    normalizeDiscussionPoints(body.discussionPoints ?? body.discussionPointsJson)
  );
  const actionItemsJson = JSON.stringify(
    normalizeActionItems(body.actionItems ?? body.actionItemsJson)
  );

  const generalNotes =
    typeof body.generalNotes === 'string' ? body.generalNotes.trim() || null : null;

  return {
    year,
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
    status,
    quorumMode,
    firstConvocationTime,
    issueDate,
    extraNote,
    adminSigners,
    attendanceJson,
    discussionPointsJson,
    actionItemsJson,
    generalNotes,
  };
}

export function addMinutesToTime(hhmm: string, minutesToAdd: number): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return hhmm;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return hhmm;
  }
  const total = ((h * 60 + m + minutesToAdd) % 1440 + 1440) % 1440;
  const nextH = Math.floor(total / 60);
  const nextM = total % 60;
  return `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`;
}

export function suggestNextActaNumber(saved: Pick<CondoMeetingDTO, 'actaNumber'>[]): string {
  let maxNum = 23;
  for (const m of saved) {
    const parsed = parseInt(m.actaNumber, 10);
    if (Number.isFinite(parsed) && parsed > maxNum) {
      maxNum = parsed;
    }
  }
  return String(maxNum + 1);
}

export function computeMeetingQuorum(
  unitIds: string[],
  attendance: MeetingAttendancePayload,
  defaultPermilagem = 62.5
): { presentCount: number; totalPermilagem: number } {
  let presentCount = 0;
  let totalPermilagem = 0;

  for (const id of unitIds) {
    const st = attendance.statuses[id] || 'ausente';
    if (st !== 'ausente') {
      presentCount += 1;
      const perm = attendance.permilagens[id] ?? defaultPermilagem;
      totalPermilagem += Number.isFinite(perm) ? perm : defaultPermilagem;
    }
  }

  return {
    presentCount,
    totalPermilagem: Math.round(totalPermilagem * 100) / 100,
  };
}

export function computeQuorumSummary({
  unitIds,
  attendance,
  quorumMode,
  defaultPermilagem = 62.5,
}: {
  unitIds: string[];
  attendance: MeetingAttendancePayload;
  quorumMode: QuorumMode;
  defaultPermilagem?: number;
}): MeetingQuorumSummary {
  const totalUnits = unitIds.length;
  const { presentCount, totalPermilagem } = computeMeetingQuorum(
    unitIds,
    attendance,
    defaultPermilagem
  );
  const percentByUnits =
    totalUnits > 0 ? Math.round((presentCount / totalUnits) * 1000) / 10 : 0;
  const minUnitsFirst = totalUnits > 0 ? Math.floor(totalUnits / 2) + 1 : 1;
  const minUnitsSecond = totalUnits > 0 ? Math.ceil(totalUnits / 4) : 1;
  const percentByPermilagem = Math.round((totalPermilagem / 10) * 10) / 10;

  if (quorumMode === 'permilagem') {
    const meetsFirst = totalPermilagem > 500;
    const meetsSecond = totalPermilagem >= 250;
    const statusLabel = meetsFirst
      ? 'Quórum para 1.ª Convocatória (> 500‰)'
      : meetsSecond
      ? 'Quórum para 2.ª Convocatória (≥ 250‰)'
      : 'Sem quórum mínimo legal (< 250‰)';
    const shortSummary = `${presentCount}/${totalUnits} frações • ${totalPermilagem.toFixed(1)}‰ (${percentByPermilagem.toFixed(1)}%)`;

    return {
      quorumMode,
      totalUnits,
      presentCount,
      percentByUnits,
      minUnitsFirst,
      minUnitsSecond,
      totalPermilagem,
      percentByPermilagem,
      meetsFirst,
      meetsSecond,
      statusLabel,
      shortSummary,
    };
  }

  const meetsFirst = totalUnits > 0 && presentCount >= minUnitsFirst;
  const meetsSecond = totalUnits > 0 && presentCount >= minUnitsSecond;
  const statusLabel = meetsFirst
    ? `Quórum para 1.ª Convocatória (≥ ${minUnitsFirst} frações)`
    : meetsSecond
    ? `Quórum para 2.ª Convocatória (≥ ${minUnitsSecond} frações)`
    : `Sem quórum mínimo (mín. ${minUnitsSecond} frações em 2.ª conv.)`;
  const shortSummary = `${presentCount}/${totalUnits} frações (${percentByUnits.toFixed(1)}%)`;

  return {
    quorumMode: 'units',
    totalUnits,
    presentCount,
    percentByUnits,
    minUnitsFirst,
    minUnitsSecond,
    totalPermilagem,
    percentByPermilagem,
    meetsFirst,
    meetsSecond,
    statusLabel,
    shortSummary,
  };
}
