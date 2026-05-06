import { describe, expect, it } from 'vitest';
import { escapeHtml, formatConsentBannerDate } from '../src/utils/consentPatientDocument';

describe('consentPatientDocument', () => {
  it('formats ISO dates as German DD.MM.YYYY banner text', () => {
    expect(formatConsentBannerDate('2026-05-06')).toBe('06.05.2026');
  });

  it('passes through non-ISO date strings', () => {
    expect(formatConsentBannerDate('6.5.2026')).toBe('6.5.2026');
  });

  it('escapes HTML for query-driven banner fields', () => {
    expect(escapeHtml('a<b>')).toBe('a&lt;b&gt;');
    expect(escapeHtml('"x"')).toBe('&quot;x&quot;');
  });
});
