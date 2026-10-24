import { describe, expect, it } from 'vitest';
import { LOCATION_OPTIONS, validateLocationAnswer } from '../src/utils/locations';

const loc = (value: unknown) => [{ questionId: 'location', type: 'TEXT', value }];

describe('validateLocationAnswer', () => {
  it('knows the six Bonn locations', () => {
    expect([...LOCATION_OPTIONS]).toEqual([
      'Bad Godesberg',
      'Brüser Berg',
      'P26',
      'Duisdorf',
      'Endenich',
      'Beuel',
    ]);
  });

  it('requires a location when asked to', () => {
    expect(validateLocationAnswer([], { required: true })?.code).toBe('MISSING_LOCATION');
    expect(validateLocationAnswer(loc('  '), { required: true })?.code).toBe('MISSING_LOCATION');
    expect(validateLocationAnswer([], { required: false })).toBeNull();
  });

  it('rejects unknown locations and accepts known ones', () => {
    expect(validateLocationAnswer(loc('Köln'), { required: false })?.code).toBe('INVALID_LOCATION');
    expect(validateLocationAnswer(loc('Brüser Berg'), { required: true })).toBeNull();
  });
});
