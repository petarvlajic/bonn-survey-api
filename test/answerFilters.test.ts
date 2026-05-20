import { describe, expect, it } from 'vitest';
import { applyAnswerFiltersToMongo, parseAnswerFilters } from '../src/utils/answerFilters';

describe('answerFilters', () => {
  it('parses JSON array of filters', () => {
    const parsed = parseAnswerFilters(
      JSON.stringify([
        { questionId: 'hasChestComplaints', op: 'eq', value: 'yes' },
        { questionId: 'painIntensity', op: 'lte', value: 5 },
      ])
    );
    expect(parsed).toHaveLength(2);
    expect(parsed![0].questionId).toBe('hasChestComplaints');
    expect(parsed![1].op).toBe('lte');
  });

  it('returns null for invalid JSON', () => {
    expect(parseAnswerFilters('not-json')).toBeNull();
  });

  it('adds $and elemMatch clauses to mongo filter', () => {
    const base = { draft: false };
    const merged = applyAnswerFiltersToMongo(base, [
      { questionId: 'painIntensity', op: 'lte', value: 5 },
    ]);
    expect(merged.draft).toBe(false);
    expect(Array.isArray(merged.$and)).toBe(true);
    expect((merged.$and as unknown[]).length).toBe(1);
  });
});
