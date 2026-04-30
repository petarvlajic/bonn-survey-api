const PID_PREFIX = 'HZB';

const randomAlphaNumeric = (length: number): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Generates a human-friendly PID for patient workflows.
 * Format: HZB-YYYYMMDD-XXXX
 */
export const generatePid = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const suffix = randomAlphaNumeric(4);
  return `${PID_PREFIX}-${y}${m}${d}-${suffix}`;
};

