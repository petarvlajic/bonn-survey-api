export const GENDER_VALUES = [
  'male',
  'female',
  'diverse',
  'other',
  'prefer_not_to_say',
] as const;

export type GenderValue = (typeof GENDER_VALUES)[number];

const GENDER_LABELS: Record<GenderValue, { de: string; en: string }> = {
  male: { de: 'Männlich', en: 'Male' },
  female: { de: 'Weiblich', en: 'Female' },
  diverse: { de: 'Divers', en: 'Diverse' },
  other: { de: 'Andere', en: 'Other' },
  prefer_not_to_say: { de: 'Keine Angabe', en: 'Prefer not to say' },
};

export function isValidGender(value: unknown): value is GenderValue {
  return typeof value === 'string' && (GENDER_VALUES as readonly string[]).includes(value);
}

export function formatGenderLabel(
  value: string | undefined | null,
  locale: 'de' | 'en' = 'de'
): string {
  if (!value || !isValidGender(value)) {
    return value?.trim() || '';
  }
  return GENDER_LABELS[value][locale];
}

export function extractGenderFromAnswers(
  answers: Array<{ questionId?: string; value?: unknown; answer?: unknown }> | undefined
): GenderValue | undefined {
  if (!answers?.length) return undefined;
  for (const row of answers) {
    const qid = (row.questionId || '').toLowerCase();
    if (qid === 'gender' || qid === 'geschlecht' || qid === 'sex') {
      const raw = row.value ?? row.answer;
      const v = Array.isArray(raw) ? raw[0] : raw;
      if (isValidGender(v)) return v;
    }
  }
  return undefined;
}
