import { describe, expect, it } from 'vitest';
import {
  buildResponsesFilterFromQuery,
  endOfDayClinic,
  startOfDayClinic,
} from '../src/utils/responsesQuery';

describe('clinic-day bounds (Europe/Berlin)', () => {
  it('uses CET (UTC+1) in winter', () => {
    expect(startOfDayClinic('2026-01-15').toISOString()).toBe('2026-01-14T23:00:00.000Z');
    expect(endOfDayClinic('2026-01-15').toISOString()).toBe('2026-01-15T22:59:59.999Z');
  });

  it('uses CEST (UTC+2) in summer', () => {
    expect(startOfDayClinic('2026-07-15').toISOString()).toBe('2026-07-14T22:00:00.000Z');
    expect(endOfDayClinic('2026-07-15').toISOString()).toBe('2026-07-15T21:59:59.999Z');
  });

  it('handles the DST switch days (23h / 25h)', () => {
    // 2026-03-29: clocks go forward, day starts in CET and ends in CEST
    expect(startOfDayClinic('2026-03-29').toISOString()).toBe('2026-03-28T23:00:00.000Z');
    expect(endOfDayClinic('2026-03-29').toISOString()).toBe('2026-03-29T21:59:59.999Z');
    // 2026-10-25: clocks go back
    expect(startOfDayClinic('2026-10-25').toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(endOfDayClinic('2026-10-25').toISOString()).toBe('2026-10-25T22:59:59.999Z');
  });

  it('a report created at 00:30 Berlin time belongs to that Berlin day', () => {
    const created = new Date('2026-07-14T22:30:00.000Z'); // 00:30 on the 15th in Berlin
    expect(created >= startOfDayClinic('2026-07-15')).toBe(true);
    expect(created <= endOfDayClinic('2026-07-15')).toBe(true);
  });

  it('applies the day bounds to createdAtFrom/To', () => {
    const { filter } = buildResponsesFilterFromQuery({
      createdAtFrom: '2026-07-15',
      createdAtTo: '2026-07-15',
    });
    const range = filter.createdAt as { $gte: Date; $lte: Date };
    expect(range.$gte.toISOString()).toBe('2026-07-14T22:00:00.000Z');
    expect(range.$lte.toISOString()).toBe('2026-07-15T21:59:59.999Z');
  });
});

describe('search filter', () => {
  const ands = (q: Record<string, string>) =>
    (buildResponsesFilterFromQuery(q).filter.$and as Array<{ $or: Record<string, unknown>[] }>) ?? [];

  it('does not throw on regex metacharacters and escapes them', () => {
    expect(() => buildResponsesFilterFromQuery({ search: '(((' })).not.toThrow();
    const [first] = ands({ search: 'a.b' });
    const rx = (first.$or[0] as { intervieweeName: RegExp }).intervieweeName;
    expect(rx.test('a.b')).toBe(true);
    expect(rx.test('axb')).toBe(false);
  });

  it('requires every token to match (AND), each across several fields', () => {
    const conds = ands({ search: 'popović stefan' });
    expect(conds).toHaveLength(2);
    const fields = conds[0].$or.map((c) => Object.keys(c)[0]);
    expect(fields).toEqual(
      expect.arrayContaining(['intervieweeName', 'intervieweeEmail', 'pid', 'answers', 'birthDate'])
    );
  });

  it('matches first/last name answers (multi-part first names)', () => {
    const [first] = ands({ search: 'petar' });
    const answers = first.$or.find((c) => 'answers' in c) as {
      answers: { $elemMatch: { questionId: { $in: string[] }; value: RegExp } };
    };
    expect(answers.answers.$elemMatch.questionId.$in).toEqual(['firstName', 'lastName']);
    expect(answers.answers.$elemMatch.value.test('Stefan Petar')).toBe(true);
  });

  it('turns DD.MM.YYYY into the stored YYYY-MM-DD birth date', () => {
    const [first] = ands({ search: '5.3.1985' });
    expect(first.$or).toContainEqual({ birthDate: '1985-03-05' });
  });

  it('supports DD.MM. and a bare year for birth dates', () => {
    const [dm] = ands({ search: '15.03.' });
    const rx = (dm.$or.find((c) => 'birthDate' in c) as { birthDate: RegExp }).birthDate;
    expect(rx.test('1985-03-15')).toBe(true);
    expect(rx.test('1985-03-16')).toBe(false);
    const [year] = ands({ search: '1985' });
    const yrx = (year.$or.find((c) => 'birthDate' in c) as { birthDate: RegExp }).birthDate;
    expect(yrx.test('1985-03-15')).toBe(true);
  });

  it('keeps the workflow-bucket $or when a search is added', () => {
    const { filter } = buildResponsesFilterFromQuery({ workflowBucket: 'pending', search: 'meier' });
    expect(filter.$or).toBeDefined();
    expect(filter.$and).toHaveLength(1);
  });

  it('ignores a blank search', () => {
    const { filter } = buildResponsesFilterFromQuery({ search: '   ' });
    expect(filter.$and).toBeUndefined();
  });

  it('caps the search at 6 tokens', () => {
    expect(ands({ search: 'a b c d e f g h' })).toHaveLength(6);
  });

  it('turns impossible dates into a harmless exact match instead of throwing', () => {
    const [first] = ands({ search: '31.02.2020' });
    expect(first.$or).toContainEqual({ birthDate: '2020-02-31' });
  });

  it('matches phone numbers and PIDs too', () => {
    const [first] = ands({ search: '0228' });
    const fields = first.$or.map((c) => Object.keys(c)[0]);
    expect(fields).toEqual(expect.arrayContaining(['intervieweePhone', 'pid']));
  });
});
