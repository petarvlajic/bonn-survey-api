import { describe, expect, it } from 'vitest';
import {
  parseEchoScreeningFromBody,
  parseEchoScreeningStored,
  validEchoScreeningFixture,
} from '../src/utils/shkEchoScreening';

describe('shkEchoScreening', () => {
  it('validEchoScreeningFixture passes parseEchoScreeningFromBody', () => {
    const parsed = parseEchoScreeningFromBody({ echoScreening: validEchoScreeningFixture() });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.overall).toBe('unremarkable');
      expect(parsed.value.main.lv_function).toBe('unauffaellig');
      expect(parsed.value.optional.pericardial_effusion).toBe(false);
    }
  });

  it('rejects missing echoScreening', () => {
    const parsed = parseEchoScreeningFromBody({});
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.code).toBe('ECHO_SCREENING_REQUIRED');
  });

  it('rejects incomplete main rows', () => {
    const parsed = parseEchoScreeningFromBody({
      echoScreening: {
        main: { lv_function: 'unauffaellig' },
        overall: 'unremarkable',
      },
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.code).toBe('ECHO_MAIN_INCOMPLETE');
  });

  it('rejects invalid main value', () => {
    const f = validEchoScreeningFixture();
    f.main.lv_function = 'maybe' as 'unauffaellig';
    const parsed = parseEchoScreeningFromBody({ echoScreening: f });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.code).toBe('ECHO_MAIN_INCOMPLETE');
  });

  it('rejects missing or invalid overall', () => {
    const main = validEchoScreeningFixture().main;
    expect(parseEchoScreeningFromBody({ echoScreening: { main, optional: {} } }).ok).toBe(false);
    const badOverall = parseEchoScreeningFromBody({
      echoScreening: { main, optional: {}, overall: 'maybe' },
    });
    expect(badOverall.ok).toBe(false);
    if (!badOverall.ok) expect(badOverall.code).toBe('ECHO_OVERALL_REQUIRED');
  });

  it('defaults optional flags when optional omitted', () => {
    const main = validEchoScreeningFixture().main;
    const parsed = parseEchoScreeningFromBody({
      echoScreening: { main, overall: 'needs_followup' },
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.optional.rv_enlargement).toBe(false);
    }
  });

  it('parseEchoScreeningStored returns null for invalid stored blob', () => {
    expect(parseEchoScreeningStored(null)).toBeNull();
    expect(parseEchoScreeningStored({})).toBeNull();
  });

  it('parseEchoScreeningStored round-trips valid fixture', () => {
    const fixture = validEchoScreeningFixture();
    expect(parseEchoScreeningStored(fixture)).toEqual(fixture);
  });
});
