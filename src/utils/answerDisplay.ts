/**
 * Patient free-text fields (app uses text inputs; legacy payloads may still send type DATE).
 */
export const FREE_TEXT_ANSWER_QUESTION_IDS = new Set([
  'complaintsSince',
  'breathlessnessSince',
  'complaintsDuration',
  'complaintsOccur',
  'painTypeOther',
  'whatHelps',
  'whatWorsens',
  'accompanyingSymptoms',
  'painRadiation',
  'echoFreeText',
]);

export function normalizeAnswerTypeForStorage(
  questionId: string,
  type: string | undefined
): string {
  const t = String(type || 'TEXT').toUpperCase();
  if (FREE_TEXT_ANSWER_QUESTION_IDS.has(questionId) && t === 'DATE') return 'TEXT';
  return t;
}

export function rawAnswerValue(input: {
  value?: unknown;
  answer?: unknown;
}): unknown {
  if (input.value !== undefined && input.value !== null && input.value !== '') {
    return input.value;
  }
  if (input.answer !== undefined && input.answer !== null && input.answer !== '') {
    return input.answer;
  }
  return undefined;
}

/** Format one stored answer for PDF / export (never show "Invalid Date" for free text). */
export function formatStoredAnswerValue(input: {
  questionId?: string;
  type?: string;
  value?: unknown;
  answer?: unknown;
  imageUri?: string;
  fileUri?: string;
}): string {
  const raw = rawAnswerValue(input);
  const type = String(input.type || '').toUpperCase();
  const questionId = input.questionId || '';

  if (type === 'IMAGE_UPLOAD' || type === 'FILE_UPLOAD') {
    if (input.imageUri) {
      return input.imageUri.startsWith('data:')
        ? '(Foto / Anhang gespeichert)'
        : String(input.imageUri);
    }
    if (input.fileUri) {
      return input.fileUri.startsWith('data:')
        ? '(Foto / Anhang gespeichert)'
        : String(input.fileUri);
    }
    if (typeof raw === 'string' && raw.startsWith('data:')) return '(Foto / Anhang gespeichert)';
    if (raw != null && String(raw).trim()) return String(raw);
    return '(Foto / Anhang gespeichert)';
  }

  if (raw === undefined || raw === null || raw === '') return '—';

  if (FREE_TEXT_ANSWER_QUESTION_IDS.has(questionId) || type === 'TEXT') {
    if (Array.isArray(raw)) return raw.map(String).join(', ');
    return String(raw);
  }

  if (type === 'MULTIPLE_CHOICE' && Array.isArray(raw)) {
    return raw.map(String).join(', ');
  }

  if (type === 'DATE') {
    const s = String(raw).trim();
    if (/[a-zA-ZäöüÄÖÜß]/.test(s) && !/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
    const t = new Date(s).getTime();
    if (Number.isNaN(t)) return s;
    const formatted = new Date(s).toLocaleDateString('de-DE');
    if (formatted === 'Invalid Date') return s;
    return formatted;
  }

  if (typeof raw === 'boolean') return raw ? 'Ja' : 'Nein';
  return String(raw);
}

export function normalizeAnswersForStorage(
  answersArray: Record<string, unknown>[]
): Array<Record<string, unknown>> {
  return answersArray.map((ans) => {
    const questionId = String(ans.questionId || '');
    const transformed: Record<string, unknown> = {
      questionId,
      type: normalizeAnswerTypeForStorage(questionId, ans.type as string | undefined),
    };
    if (ans.answer !== undefined) transformed.value = ans.answer;
    else if (ans.value !== undefined) transformed.value = ans.value;
    if (ans.imageUri !== undefined) transformed.imageUri = ans.imageUri;
    if (ans.fileUri !== undefined) transformed.fileUri = ans.fileUri;
    if (ans.signatureBase64 !== undefined) transformed.signatureBase64 = ans.signatureBase64;
    return transformed;
  });
}
