import { describe, expect, it } from 'vitest';
import {
  formatStoredAnswerValue,
  normalizeAnswerTypeForStorage,
  normalizeAnswersForStorage,
} from '../src/utils/answerDisplay';

describe('answerDisplay', () => {
  it('stores complaintsSince as TEXT even when client sends DATE', () => {
    expect(normalizeAnswerTypeForStorage('complaintsSince', 'DATE')).toBe('TEXT');
    const out = normalizeAnswersForStorage([
      { questionId: 'complaintsSince', type: 'DATE', value: 'od rođenja' },
    ]);
    expect(out[0].type).toBe('TEXT');
    expect(out[0].value).toBe('od rođenja');
  });

  it('formats free-text DATE answers without Invalid Date', () => {
    expect(
      formatStoredAnswerValue({
        questionId: 'complaintsSince',
        type: 'DATE',
        value: 'od kad sam se rodio',
      })
    ).toBe('od kad sam se rodio');
    expect(
      formatStoredAnswerValue({
        questionId: 'complaintsSince',
        type: 'DATE',
        value: '2 Wochen',
      })
    ).toBe('2 Wochen');
  });

  it('still formats real ISO dates for birthDate', () => {
    const formatted = formatStoredAnswerValue({
      questionId: 'birthDate',
      type: 'DATE',
      value: '1990-05-15',
    });
    expect(formatted).not.toBe('Invalid Date');
    expect(formatted).toMatch(/1990|15\.05\.1990|5\/15\/1990/);
  });
});
