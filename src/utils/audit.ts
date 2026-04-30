export interface FieldChange {
  field: string;
  previousValue: string;
  nextValue: string;
}

const normalize = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export const buildFieldChanges = (
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
  trackedFields: string[]
): FieldChange[] => {
  const changes: FieldChange[] = [];
  for (const field of trackedFields) {
    const before = normalize(previous[field]);
    const after = normalize(next[field]);
    if (before !== after) {
      changes.push({
        field,
        previousValue: before,
        nextValue: after,
      });
    }
  }
  return changes;
};

export const verifyPostClosePin = (providedPin: string | undefined): boolean => {
  const requiredPin = process.env.POST_CLOSE_EDIT_PIN;
  if (!requiredPin) return true;
  return !!providedPin && providedPin === requiredPin;
};

