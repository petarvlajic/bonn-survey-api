/** UKB staff accounts used for SHK / interviewer operations. */
export const isStaffEmail = (email: string | undefined | null): boolean =>
  typeof email === 'string' && email.trim().toLowerCase().endsWith('@ukbonn.de');
