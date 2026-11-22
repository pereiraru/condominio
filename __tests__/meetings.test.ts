import type { CondoMeeting } from '@prisma/client';
import {
  computeMeetingQuorum,
  createDefaultDiscussionPoints,
  inferLinkedSectionFromTitle,
  normalizeActionItems,
  normalizeAttendance,
  normalizeDiscussionPoints,
  parseMeetingWriteData,
  serializeMeeting,
} from '@/lib/meetings';

describe('Condo meeting helpers', () => {
  it('createDefaultDiscussionPoints returns the 5 standard sections for the given year', () => {
    const points = createDefaultDiscussionPoints(2026);
    expect(points).toHaveLength(5);
    expect(points.map((p) => p.linkedSection)).toEqual([
      'contas',
      'dividas',
      'orcamento',
      'none',
      'eleicao',
    ]);
    expect(points[0].title).toContain('2026');
    expect(points[2].title).toContain('2027');
    expect(points[4].title).toContain('2027');
  });

  it('normalizeDiscussionPoints handles invalid inputs, missing fields, unknown sections, and duplicate IDs', () => {
    expect(normalizeDiscussionPoints(null)).toEqual([]);
    expect(normalizeDiscussionPoints('not-valid-json')).toEqual([]);
    expect(normalizeDiscussionPoints({ notAnArray: true })).toEqual([]);

    const normalized = normalizeDiscussionPoints([
      null,
      'invalid-entry',
      {
        id: 'p1',
        title: 'Substituição de lâmpadas',
        linkedSection: 'unknown_section',
        discussion: 'Garagem piso -3',
        votingOutcome: 'Aprovado por unanimidade',
        votingDetails: '12 a favor',
        decision: 'Trocar por LED',
      },
      {
        id: 'p1',
        linkedSection: 'orcamento',
      },
    ]);

    expect(normalized).toHaveLength(2);
    expect(normalized[0]).toEqual({
      id: 'p1',
      title: 'Substituição de lâmpadas',
      linkedSection: 'none',
      discussion: 'Garagem piso -3',
      votingOutcome: 'Aprovado por unanimidade',
      votingDetails: '12 a favor',
      decision: 'Trocar por LED',
    });
    expect(normalized[1].id).not.toBe('p1');
    expect(normalized[1].linkedSection).toBe('orcamento');
    expect(normalized[1].title).toBe('');
    expect(normalized[1].decision).toBe('');
  });

  it('normalizeActionItems validates priority and status fallbacks and strips invalid entries', () => {
    expect(normalizeActionItems('bad-json')).toEqual([]);
    expect(normalizeActionItems(123)).toEqual([]);

    const items = normalizeActionItems(
      JSON.stringify([
        42,
        null,
        {
          id: 'a1',
          pointId: 'p1',
          title: 'Pedir 3 orçamentos para o portão',
          responsible: 'Administração',
          dueDate: '2026-12-15',
          estimatedCost: '350 €',
          priority: 'invalid_prio',
          status: 'invalid_status',
          notes: 'Contactar fornecedor habitual',
        },
        {
          title: 'Atualizar contactos das frações',
          priority: 'urgent',
          status: 'in_progress',
        },
      ])
    );

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      id: 'a1',
      pointId: 'p1',
      title: 'Pedir 3 orçamentos para o portão',
      responsible: 'Administração',
      dueDate: '2026-12-15',
      estimatedCost: '350 €',
      priority: 'normal',
      status: 'pending',
      notes: 'Contactar fornecedor habitual',
    });
    expect(items[1].id).toBeTruthy();
    expect(items[1].pointId).toBeUndefined();
    expect(items[1].priority).toBe('urgent');
    expect(items[1].status).toBe('in_progress');
    expect(items[1].responsible).toBe('');
  });

  it('normalizeAttendance filters invalid values and retains valid unit attendance data', () => {
    const parsed = normalizeAttendance({
      statuses: { u1: 'presente', u2: 'representado', u3: 'bad_value' },
      permilagens: { u1: 62.5, u2: '75', u3: -5, u4: 'NaN' },
      representatives: { u2: 'João Silva', u3: 123 },
    });

    expect(parsed.statuses).toEqual({ u1: 'presente', u2: 'representado' });
    expect(parsed.permilagens).toEqual({ u1: 62.5, u2: 75 });
    expect(parsed.representatives).toEqual({ u2: 'João Silva' });
  });

  it('serializeMeeting safely parses valid and malformed JSON columns without throwing', () => {
    const now = new Date('2026-11-22T15:00:00.000Z');
    const validRecord: CondoMeeting = {
      id: 'mtg-1',
      year: 2026,
      actaNumber: '25',
      assemblyType: 'Extraordinária',
      meetingDate: '2026-11-30',
      startTime: '21:30',
      endTime: '23:10',
      convocationUsed: '1.ª',
      location: 'Átrio do Prédio',
      presidedBy: 'Fração 2D',
      secretaryBy: 'Fração 1E',
      newAdminNames: 'Fração 2D e Fração 3E',
      status: 'finalized',
      attendanceJson: JSON.stringify({
        statuses: { u1: 'presente', u2: 'ausente' },
        permilagens: { u1: 65, u2: 60 },
        representatives: {},
      }),
      discussionPointsJson: JSON.stringify([
        {
          id: 'p-extra',
          title: 'Impermeabilização da cobertura',
          linkedSection: 'none',
          discussion: 'Analisados 2 orçamentos',
          votingOutcome: 'Aprovado por maioria',
          votingDetails: '9 a favor',
          decision: 'Ajudicar à empresa A',
        },
      ]),
      actionItemsJson: JSON.stringify([
        {
          id: 'act-1',
          pointId: 'p-extra',
          title: 'Assinar contrato de obra',
          responsible: 'Administração',
          dueDate: '2026-12-05',
          estimatedCost: '4.200 €',
          priority: 'urgent',
          status: 'pending',
          notes: '',
        },
      ]),
      generalNotes: 'Próxima revisão na primavera.',
      generatedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const dto = serializeMeeting(validRecord);
    expect(dto.id).toBe('mtg-1');
    expect(dto.assemblyType).toBe('Extraordinária');
    expect(dto.status).toBe('finalized');
    expect(dto.discussionPoints).toHaveLength(1);
    expect(dto.actionItems).toHaveLength(1);
    expect(dto.generatedAt).toBe(now.toISOString());

    const malformedRecord: CondoMeeting = {
      ...validRecord,
      id: 'mtg-bad',
      assemblyType: 'Desconhecida',
      convocationUsed: '3.ª',
      status: 'unknown',
      endTime: null,
      newAdminNames: null,
      generalNotes: null,
      attendanceJson: '{corrupted json',
      discussionPointsJson: '[broken',
      actionItemsJson: 'null',
      generatedAt: null,
    };

    const safeDto = serializeMeeting(malformedRecord);
    expect(safeDto.assemblyType).toBe('Ordinária');
    expect(safeDto.convocationUsed).toBe('2.ª');
    expect(safeDto.status).toBe('draft');
    expect(safeDto.attendance).toEqual({ statuses: {}, permilagens: {}, representatives: {} });
    expect(safeDto.discussionPoints).toEqual([]);
    expect(safeDto.actionItems).toEqual([]);
    expect(safeDto.generatedAt).toBeNull();
  });

  it('infers linked section from agenda titles and computes quorum accurately', () => {
    expect(inferLinkedSectionFromTitle('Aprovação das contas de 2026')).toBe('contas');
    expect(inferLinkedSectionFromTitle('Dívidas dos condóminos')).toBe('dividas');
    expect(inferLinkedSectionFromTitle('Orçamento e atualização das quotas')).toBe('orcamento');
    expect(inferLinkedSectionFromTitle('Eleição da Administração')).toBe('eleicao');
    expect(inferLinkedSectionFromTitle('Limpeza da garagem')).toBe('none');

    const quorum = computeMeetingQuorum(['u1', 'u2', 'u3'], {
      statuses: { u1: 'presente', u2: 'representado', u3: 'ausente' },
      permilagens: { u1: 62.5, u2: 75, u3: 62.5 },
      representatives: { u2: 'Maria' },
    });
    expect(quorum).toEqual({ presentCount: 2, totalPermilagem: 137.5 });

    const writeData = parseMeetingWriteData({
      year: 2026,
      actaNumber: '26',
      status: 'finalized',
      discussionPoints: [{ title: 'Ponto extra', decision: 'Aprovado' }],
      actionItems: [{ title: 'Executar decisão', priority: 'urgent' }],
    });
    expect(writeData.status).toBe('finalized');
    expect(JSON.parse(writeData.discussionPointsJson)).toHaveLength(1);
    expect(JSON.parse(writeData.actionItemsJson)).toHaveLength(1);
  });
});
