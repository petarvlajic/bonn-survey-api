import { describe, expect, it } from 'vitest';
import { buildFieldChanges, verifyPostClosePin } from '../src/utils/audit';

describe('buildFieldChanges', () => {
  it('tracks only changed fields', () => {
    const changes = buildFieldChanges(
      { intervieweeName: 'Ana', draft: true, answers: [{ id: 1 }] },
      { intervieweeName: 'Ana M', draft: false, answers: [{ id: 1 }] },
      ['intervieweeName', 'draft', 'answers']
    );

    expect(changes).toHaveLength(2);
    expect(changes[0].field).toBe('intervieweeName');
    expect(changes[1].field).toBe('draft');
  });
});

describe('verifyPostClosePin', () => {
  it('allows edits when no pin configured', () => {
    delete process.env.POST_CLOSE_EDIT_PIN;
    expect(verifyPostClosePin(undefined)).toBe(true);
  });

  it('requires matching pin when configured', () => {
    process.env.POST_CLOSE_EDIT_PIN = '1234';
    expect(verifyPostClosePin('0000')).toBe(false);
    expect(verifyPostClosePin('1234')).toBe(true);
    delete process.env.POST_CLOSE_EDIT_PIN;
  });
});

