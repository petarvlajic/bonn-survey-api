import { describe, expect, it } from 'vitest';
import { buildResponseCsv } from '../src/utils/responseExport';

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

    expect(csv).toContain('"Q_q1"');
    expect(csv).toContain('"Q_q2"');
    expect(csv).toContain('"text value"');
    expect(csv).toContain('"a | b"');
    expect(csv).toContain('"HZB-20260311-ABCD"');
    expect(csv).toContain('"Completed"');
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

    expect(csv).toContain('"Q_consentDiscussionPoints"');
    expect(csv).toContain('"Q_echoFreeText"');
    expect(csv).toContain('"Q_echoPhotos_1"');
    expect(csv).toContain('"Alpha"');
    expect(csv).toContain('"Beta"');
    expect(csv).toContain('"Mild valve finding"');
    expect(csv).toContain('"Point A"');
    expect(csv).toContain('"Photo 1"');
    expect(csv).toContain('"Draft"');
    expect(csv).toContain('"Completed"');
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
});

