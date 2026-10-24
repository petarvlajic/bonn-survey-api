/** Standort (Bonn) — keep in sync with uk-bonn-survey `src/constants/locations.ts`. */
export const LOCATION_OPTIONS = [
  'Bad Godesberg',
  'Brüser Berg',
  'P26',
  'Duisdorf',
  'Endenich',
  'Beuel',
] as const;

export const LOCATION_QUESTION_ID = 'location';

export function isValidLocation(value: unknown): boolean {
  return typeof value === 'string' && (LOCATION_OPTIONS as readonly string[]).includes(value.trim());
}

/**
 * Validates the `location` answer. Returns an error payload, or null when fine.
 * `required` is set for completed patient submissions.
 */
export function validateLocationAnswer(
  answers: ReadonlyArray<object> | undefined,
  options: { required: boolean }
): Record<string, unknown> | null {
  const row = ((answers ?? []) as ReadonlyArray<Record<string, unknown>>).find(
    (a) => a.questionId === LOCATION_QUESTION_ID
  );
  const raw = row ? (row.value ?? row.answer) : undefined;
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) {
    return options.required
      ? {
          error: 'Location required',
          code: 'MISSING_LOCATION',
          message: 'Standort is required.',
          field: LOCATION_QUESTION_ID,
        }
      : null;
  }
  if (!isValidLocation(value)) {
    return {
      error: 'Invalid location',
      code: 'INVALID_LOCATION',
      message: `Standort must be one of: ${LOCATION_OPTIONS.join(', ')}`,
      field: LOCATION_QUESTION_ID,
    };
  }
  return null;
}
