import { describe, expect, it, vi } from 'vitest';
import { generatePid } from '../src/utils/pid';

describe('generatePid', () => {
  it('uses expected prefix and date format', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const pid = generatePid(new Date('2026-03-11T12:00:00.000Z'));
    expect(pid).toMatch(/^HZB-20260311-[A-Z0-9]{4}$/);
    vi.restoreAllMocks();
  });

  it('generates different values across calls', () => {
    const first = generatePid(new Date('2026-03-11T12:00:00.000Z'));
    const second = generatePid(new Date('2026-03-11T12:00:00.000Z'));
    expect(first).not.toEqual(second);
  });
});

