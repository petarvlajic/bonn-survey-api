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

  /**
   * Regression test: a base64 data URI stored in imageUri/fileUri used to be
   * returned verbatim as the "answer text", which meant the full (often
   * multi-megabyte) base64 blob got printed literally in the PDF appendix —
   * ballooning an 8-page consent PDF into 80+ pages. It must always collapse
   * to a placeholder instead.
   */
  it('replaces base64 imageUri with a placeholder, never prints it raw', () => {
    const dataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAASABIAAD//2Q==';
    expect(
      formatStoredAnswerValue({
        questionId: 'echoPhotos_1',
        type: 'IMAGE_UPLOAD',
        imageUri: dataUri,
      })
    ).toBe('(Foto / Anhang gespeichert)');
  });

  it('replaces base64 fileUri with a placeholder, never prints it raw', () => {
    const dataUri = 'data:application/pdf;base64,JVBERi0xLjQK';
    expect(
      formatStoredAnswerValue({
        questionId: 'someFile',
        type: 'FILE_UPLOAD',
        fileUri: dataUri,
      })
    ).toBe('(Foto / Anhang gespeichert)');
  });

  it('still shows a real (non-data-URI) imageUri/fileUri reference as-is', () => {
    expect(
      formatStoredAnswerValue({
        questionId: 'echoPhotos_1',
        type: 'IMAGE_UPLOAD',
        imageUri: 'https://cdn.example.com/photo123.jpg',
      })
    ).toBe('https://cdn.example.com/photo123.jpg');
  });
});
