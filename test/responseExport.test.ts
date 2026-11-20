import { describe, expect, it } from 'vitest';
import { buildResponseCsv, formatBirthDateDe } from '../src/utils/responseExport';

describe('buildResponseCsv', () => {
  it('contains dynamic answer columns and complete data rows', () => {
    const csv = buildResponseCsv([
      {
        _id: '1',
        pid: 'HZB-20260311-ABCD',
        intervieweeName: 'Ana',
        intervieweeEmail: 'ana@example.com',
        intervieweePhone: '123',
        birthDate: '1990-01-01',
        gender: 'female',
        draft: false,
        createdAt: new Date('2026-03-11T12:00:00.000Z'),
        completedAt: new Date('2026-03-11T13:00:00.000Z'),
        userId: {
          email: 'shk@ukbonn.de',
          profile: { firstName: 'SHK', lastName: 'User' },
        },
        answers: [
          { questionId: 'q1', value: 'text value' },
          { questionId: 'q2', value: ['a', 'b'] },
        ],
      },
    ]);

    expect(csv).toContain('"Interviewee Name"');
    expect(csv).toContain('"Contact Information"');
    expect(csv).toContain('"text value"');
    expect(csv).toContain('"a | b"');
    expect(csv).toContain('"Geschlecht"');
    expect(csv).toContain('"weiblich"');
    expect(csv).toContain('"01.01.1990"');
    expect(csv).toContain('"HZB-20260311-ABCD"');
    expect(csv).toContain('"Abgeschlossen"');
  });

  it('builds a complete field matrix across filtered patients with blank-safe cells', () => {
    const csv = buildResponseCsv([
      {
        _id: '1',
        pid: 'HZB-20260311-AAAA',
        intervieweeName: 'Alpha',
        intervieweeEmail: 'alpha@example.com',
        intervieweePhone: '111',
        birthDate: '1980-01-01',
        draft: false,
        createdAt: new Date('2026-03-11T12:00:00.000Z'),
        completedAt: new Date('2026-03-11T13:00:00.000Z'),
        userId: {
          email: 'shk-a@ukbonn.de',
          profile: { firstName: 'A', lastName: 'User' },
        },
        answers: [
          { questionId: 'consentDiscussionPoints', value: 'Point A' },
          { questionId: 'echoFreeText', value: 'Mild valve finding' },
        ],
      },
      {
        _id: '2',
        pid: 'HZB-20260311-BBBB',
        intervieweeName: 'Beta',
        intervieweeEmail: 'beta@example.com',
        intervieweePhone: '222',
        birthDate: '1990-02-02',
        draft: true,
        createdAt: new Date('2026-03-11T12:30:00.000Z'),
        userId: {
          email: 'shk-b@ukbonn.de',
          profile: { firstName: 'B', lastName: 'User' },
        },
        answers: [{ questionId: 'echoPhotos_1', value: 'Photo 1' }],
      },
    ]);

    expect(csv).toContain('"consentDiscussionPoints"');
    expect(csv).toContain('"Echo (Freitext)"');
    expect(csv).toContain('"Echo-Foto 1"');
    expect(csv).toContain('"Alpha"');
    expect(csv).toContain('"Beta"');
    expect(csv).toContain('"Mild valve finding"');
    expect(csv).toContain('"Point A"');
    expect(csv).toContain('"Photo 1"');
    expect(csv).toContain('"Entwurf"');
    expect(csv).toContain('"Abgeschlossen"');
  });

  it('escapes free-text safely and excludes raw image payload from export', () => {
    const rawBase64 = 'data:image/jpeg;base64,AAAABBBBCCCCDDDD';
    const csv = buildResponseCsv([
      {
        _id: '3',
        pid: 'HZB-20260311-CCCC',
        intervieweeName: 'Gamma',
        intervieweeEmail: 'gamma@example.com',
        draft: false,
        createdAt: new Date('2026-03-11T12:00:00.000Z'),
        answers: [
          {
            questionId: 'echoFreeText',
            value: 'Line "one"\nLine two',
          },
          // Ensure accidental extra fields in answer objects are ignored by exporter.
          {
            questionId: 'echoPhotos_2',
            value: 'Photo 2',
            imageUri: rawBase64,
          } as any,
        ],
      },
    ]);

    expect(csv).toContain('"Line ""one""\nLine two"');
    expect(csv).toContain('"Photo 2"');
    expect(csv).not.toContain(rawBase64);
  });

  const base = {
    draft: false,
    createdAt: new Date('2026-05-01T10:00:00.000Z'),
  };
  const parse = (csv: string) =>
    csv
      .replace(/^\uFEFF/, '')
      .split('\r\n')
      .map((line) => line.split('";"').map((c) => c.replace(/^"|"$/g, '')));

  it('starts with a UTF-8 BOM, uses ";" and German headers without Q_ prefixes', () => {
    const csv = buildResponseCsv([{ ...base, _id: '1', answers: [{ questionId: 'painIntensity', value: 5 }] }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [headers] = parse(csv);
    expect(headers).toEqual(
      expect.arrayContaining([
        'PID',
        'Geburtsdatum',
        'PLZ',
        'Vorname',
        'Nachname',
        'Interviewer Vorname',
        'Interviewer Nachname',
        'Nachverfolgung erforderlich',
        'Schmerzstärke (0–10)',
      ])
    );
    expect(headers.some((h) => h.startsWith('Q_'))).toBe(false);
  });

  it('sorts rows oldest to newest regardless of input order', () => {
    const csv = buildResponseCsv([
      { ...base, _id: 'c', pid: 'C', createdAt: new Date('2026-11-20T10:00:00.000Z') },
      { ...base, _id: 'a', pid: 'A', createdAt: new Date('2026-05-01T10:00:00.000Z') },
      { ...base, _id: 'b', pid: 'B', createdAt: new Date('2026-08-10T10:00:00.000Z') },
    ]);
    const rows = parse(csv).slice(1);
    expect(rows.map((r) => r[1])).toEqual(['A', 'B', 'C']);
  });

  it('splits interviewer and interviewee names into Vorname / Nachname', () => {
    const csv = buildResponseCsv([
      {
        ...base,
        _id: '1',
        intervieweeName: 'Heike Rumpf-Dommermuth',
        userId: { email: 'j@ukbonn.de', profile: { firstName: 'Johanna', lastName: 'Vogelhuber' } },
      },
      {
        ...base,
        _id: '2',
        createdAt: new Date('2026-05-02T10:00:00.000Z'),
        intervieweeName: 'ignored',
        answers: [
          { questionId: 'firstName', value: 'Angela' },
          { questionId: 'lastName', value: 'von Oy' },
        ],
      },
    ]);
    const [headers, r1, r2] = parse(csv);
    const col = (n: string) => headers.indexOf(n);
    expect(r1[col('Vorname')]).toBe('Heike');
    expect(r1[col('Nachname')]).toBe('Rumpf-Dommermuth');
    expect(r1[col('Interviewer Vorname')]).toBe('Johanna');
    expect(r1[col('Interviewer Nachname')]).toBe('Vogelhuber');
    expect(r2[col('Vorname')]).toBe('Angela');
    expect(r2[col('Nachname')]).toBe('von Oy');
    // firstName/lastName answers are not duplicated as extra columns
    expect(headers.filter((h) => h === 'Vorname')).toHaveLength(1);
  });

  it('exports Nachverfolgung and Kontrollbedürftig flags', () => {
    const csv = buildResponseCsv([
      { ...base, _id: '1', pid: 'P1', workflowStatus: 'pending_shk_followup', patientBoundedSubmit: true },
      {
        ...base,
        _id: '2',
        pid: 'P2',
        createdAt: new Date('2026-05-02T10:00:00.000Z'),
        workflowStatus: 'closed',
        patientBoundedSubmit: true,
        pathologicalFindingReport: true,
      },
      { ...base, _id: '3', pid: 'P3', createdAt: new Date('2026-05-03T10:00:00.000Z'), workflowStatus: 'patient_completed' },
    ]);
    const [headers, r1, r2, r3] = parse(csv);
    const req = headers.indexOf('Nachverfolgung erforderlich');
    const st = headers.indexOf('Nachverfolgung Status');
    const kb = headers.indexOf('Kontrollbedürftig');
    expect([r1[req], r1[st], r1[kb]]).toEqual(['Ja', 'Offen', 'Nein']);
    expect([r2[req], r2[st], r2[kb]]).toEqual(['Ja', 'Abgeschlossen', 'Ja']);
    expect([r3[req], r3[st], r3[kb]]).toEqual(['Nein', '', 'Nein']);
  });

  it('formats dates in German format (Europe/Berlin)', () => {
    expect(formatBirthDateDe('1974-07-11')).toBe('11.07.1974');
    const csv = buildResponseCsv([
      { ...base, _id: '1', createdAt: new Date('2026-11-19T11:38:00.000Z'), completedAt: new Date('2026-11-19T11:40:00.000Z') },
    ]);
    expect(csv).toContain('"19.11.2026 12:38"');
    expect(csv).toContain('"19.11.2026 12:40"');
  });
});
