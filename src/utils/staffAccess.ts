/** Legacy accounts predating the accountType field: @ukbonn.de was the only staff signal. */
const isUkbonnDomainEmail = (email: string | undefined | null): boolean =>
  typeof email === 'string' && email.trim().toLowerCase().endsWith('@ukbonn.de');

/**
 * UKB staff accounts used for SHK / interviewer operations.
 * Staff/patient is decided by the persisted `accountType` (set at registration,
 * any email domain allowed). Accounts created before that field existed have no
 * `accountType` — fall back to the @ukbonn.de domain check for those only.
 */
export const isStaffAccount = (
  user: { accountType?: 'staff' | 'patient'; email?: string | null } | undefined | null
): boolean => {
  if (!user) return false;
  if (user.accountType) return user.accountType === 'staff';
  return isUkbonnDomainEmail(user.email);
};
