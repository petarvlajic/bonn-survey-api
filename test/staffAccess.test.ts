import { describe, it, expect } from 'vitest';
import { isStaffAccount } from '../src/utils/staffAccess';

describe('isStaffAccount', () => {
  it('treats accountType staff as staff regardless of email domain', () => {
    expect(isStaffAccount({ accountType: 'staff', email: 'anyone@gmail.com' })).toBe(true);
  });

  it('treats accountType patient as non-staff regardless of email domain', () => {
    expect(isStaffAccount({ accountType: 'patient', email: 'someone@ukbonn.de' })).toBe(false);
  });

  it('falls back to @ukbonn.de domain when accountType is missing (legacy accounts)', () => {
    expect(isStaffAccount({ email: 'legacy@ukbonn.de' })).toBe(true);
    expect(isStaffAccount({ email: 'legacy@gmail.com' })).toBe(false);
  });

  it('returns false for null/undefined user', () => {
    expect(isStaffAccount(null)).toBe(false);
    expect(isStaffAccount(undefined)).toBe(false);
  });
});
