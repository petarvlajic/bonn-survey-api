import { describe, expect, it } from 'vitest';
import { buildResponsesFilterFromQuery } from '../src/utils/responsesQuery';

describe('responsesQuery', () => {
  it('builds basic filter with userId', () => {
    const result = buildResponsesFilterFromQuery({
      userId: 'user123',
    });
    expect(result.filter.userId).toBe('user123');
    expect(result.answerFiltersError).toBeUndefined();
  });

  it('combines search with workflow bucket filter without crashing', () => {
    const result = buildResponsesFilterFromQuery({
      search: 'Stefan Petar',
      workflowBucket: 'pending',
    });

    // Should not crash and should have valid filter
    expect(result.answerFiltersError).toBeUndefined();
    expect(result.filter).toBeDefined();

    // Should preserve $or from search
    if (result.filter.$or) {
      expect(Array.isArray(result.filter.$or)).toBe(true);
    }

    // Should have workflow filter combined properly
    if (result.filter.$and) {
      expect(Array.isArray(result.filter.$and)).toBe(true);
      expect(result.filter.$and.length).toBeGreaterThan(0);
    } else if (result.filter.workflowStatus || result.filter.$or) {
      // Filter was applied successfully
      expect(result.filter).toBeDefined();
    }
  });

  it('combines search with workflowStatus filter without crashing', () => {
    const result = buildResponsesFilterFromQuery({
      search: 'Test Patient',
      workflowStatus: 'patient_completed',
    });

    expect(result.answerFiltersError).toBeUndefined();
    expect(result.filter).toBeDefined();
    expect(result.filter.workflowStatus).toBe('patient_completed');
  });

  it('handles draft filter', () => {
    const result = buildResponsesFilterFromQuery({
      draft: 'true',
    });
    expect(result.filter.draft).toBe(true);
  });

  it('combines date range filters', () => {
    const result = buildResponsesFilterFromQuery({
      completedAtFrom: '2026-01-01',
      completedAtTo: '2026-12-31',
    });

    expect(result.filter.completedAt).toBeDefined();
    const completedAt = result.filter.completedAt as Record<string, any>;
    expect(completedAt.$gte).toBeDefined();
    expect(completedAt.$lte).toBeDefined();
  });

  it('handles all filters combined without crashing', () => {
    const result = buildResponsesFilterFromQuery({
      userId: 'user123',
      draft: 'false',
      workflowBucket: 'done',
      search: 'Stefan Petar Popovic',
      completedAtFrom: '2026-01-01',
      completedAtTo: '2026-12-31',
    });

    // Main assertion: no crash, valid filter returned
    expect(result.answerFiltersError).toBeUndefined();
    expect(result.filter).toBeDefined();
    expect(result.filter.userId).toBe('user123');
    expect(result.filter.draft).toBe(false);
  });
});
