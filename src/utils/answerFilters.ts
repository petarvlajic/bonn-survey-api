export type AnswerFilterOp = 'eq' | 'ne' | 'contains' | 'gte' | 'lte' | 'gt' | 'lt';

export interface AnswerFilter {
  questionId: string;
  op: AnswerFilterOp;
  value: string | number | boolean;
}

const VALID_OPS: AnswerFilterOp[] = ['eq', 'ne', 'contains', 'gte', 'lte', 'gt', 'lt'];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseAnswerFilters(input: unknown): AnswerFilter[] | null {
  if (input === undefined || input === null || input === '') return [];
  let raw: unknown;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return null;
    }
  } else if (Array.isArray(input)) {
    raw = input;
  } else {
    return null;
  }
  if (!Array.isArray(raw)) return null;
  const out: AnswerFilter[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const questionId = String((item as AnswerFilter).questionId || '').trim();
    const op = (item as AnswerFilter).op;
    const value = (item as AnswerFilter).value;
    if (!questionId || !VALID_OPS.includes(op)) continue;
    if (value === undefined || value === null || value === '') continue;
    out.push({ questionId, op, value });
  }
  return out;
}

function yesNoElemMatch(questionId: string, wantYes: boolean): Record<string, unknown> {
  if (wantYes) {
    return {
      questionId,
      $or: [
        { value: true },
        { value: 'true' },
        { value: 'yes' },
        { value: 'Yes' },
        { value: 'ja' },
        { value: 'Ja' },
        { value: 'YES' },
      ],
    };
  }
  return {
    questionId,
    $or: [
      { value: false },
      { value: 'false' },
      { value: 'no' },
      { value: 'No' },
      { value: 'nein' },
      { value: 'Nein' },
      { value: 'NO' },
    ],
  };
}

function buildElemMatch(filter: AnswerFilter): Record<string, unknown> {
  const { questionId, op, value } = filter;
  const str = String(value).trim();
  const num = Number(str);
  const useNum = str !== '' && !Number.isNaN(num);

  if (op === 'eq' || op === 'ne') {
    const lower = str.toLowerCase();
    if (lower === 'yes' || lower === 'ja' || lower === 'true') {
      if (op === 'eq') return yesNoElemMatch(questionId, true);
      return {
        questionId,
        value: { $nin: [true, 'true', 'yes', 'Yes', 'ja', 'Ja', 'YES'] },
      };
    }
    if (lower === 'no' || lower === 'nein' || lower === 'false') {
      if (op === 'eq') return yesNoElemMatch(questionId, false);
      return {
        questionId,
        value: { $nin: [false, 'false', 'no', 'No', 'nein', 'Nein', 'NO'] },
      };
    }
    if (useNum) {
      const cond = op === 'eq' ? { value: num } : { value: { $ne: num } };
      return { questionId, ...cond };
    }
    const regex = new RegExp(`^${escapeRegex(str)}$`, 'i');
    const cond = op === 'eq' ? { value: regex } : { value: { $not: regex } };
    return { questionId, ...cond };
  }

  if (op === 'contains') {
    return { questionId, value: new RegExp(escapeRegex(str), 'i') };
  }

  if (op === 'gte' || op === 'gt' || op === 'lte' || op === 'lt') {
    const mongoOp =
      op === 'gte' ? '$gte' : op === 'gt' ? '$gt' : op === 'lte' ? '$lte' : '$lt';
    if (useNum) {
      return { questionId, value: { [mongoOp]: num } };
    }
    return { questionId, value: { [mongoOp]: str } };
  }

  return { questionId, value: str };
}

/** AND-combines answer filters into an existing Mongo filter object. */
export function applyAnswerFiltersToMongo(
  baseFilter: Record<string, unknown>,
  answerFilters: AnswerFilter[]
): Record<string, unknown> {
  if (!answerFilters.length) return baseFilter;
  const clauses = answerFilters.map((f) => ({
    answers: { $elemMatch: buildElemMatch(f) },
  }));
  const existing = baseFilter.$and;
  if (Array.isArray(existing)) {
    return { ...baseFilter, $and: [...existing, ...clauses] };
  }
  return { ...baseFilter, $and: clauses };
}
