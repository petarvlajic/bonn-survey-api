import { applyAnswerFiltersToMongo, parseAnswerFilters } from './answerFilters';

/** Clinic time zone: "a day" in the list filter means a Europe/Berlin calendar day. */
const CLINIC_TZ = 'Europe/Berlin';

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function tzOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** UTC instant of local wall-clock time y-m-d h:mi:s.ms in `timeZone` (DST-safe). */
function zonedTimeToUtc(
  y: number, m: number, d: number, h: number, mi: number, s: number, ms: number, timeZone: string
): Date {
  const guess = Date.UTC(y, m - 1, d, h, mi, s, ms);
  const first = guess - tzOffsetMs(guess, timeZone);
  return new Date(guess - tzOffsetMs(first, timeZone));
}

export function startOfDayClinic(isoDate: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (m) return zonedTimeToUtc(Number(m[1]), Number(m[2]), Number(m[3]), 0, 0, 0, 0, CLINIC_TZ);
  const d = new Date(isoDate);
  return Number.isNaN(d.getTime()) ? d : new Date(d.setUTCHours(0, 0, 0, 0));
}

export function endOfDayClinic(isoDate: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (m) return zonedTimeToUtc(Number(m[1]), Number(m[2]), Number(m[3]), 23, 59, 59, 999, CLINIC_TZ);
  const d = new Date(isoDate);
  return Number.isNaN(d.getTime()) ? d : new Date(d.setUTCHours(23, 59, 59, 999));
}

const escapeRegExp = (v: string): string => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const pad2 = (n: string): string => n.padStart(2, '0');

/** Conditions (OR) a single search token may match. */
function searchTokenConditions(token: string): Record<string, unknown>[] {
  const rx = new RegExp(escapeRegExp(token), 'i');
  const conditions: Record<string, unknown>[] = [
    { intervieweeName: rx },
    { intervieweeEmail: rx },
    { intervieweePhone: rx },
    { pid: rx },
    { answers: { $elemMatch: { questionId: { $in: ['firstName', 'lastName'] }, value: rx } } },
  ];

  // Birth dates are stored as YYYY-MM-DD but people type DD.MM.YYYY (or DD.MM., or a year).
  const full = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(token);
  const dayMonth = /^(\d{1,2})\.(\d{1,2})\.?$/.exec(token);
  if (full) {
    conditions.push({ birthDate: `${full[3]}-${pad2(full[2])}-${pad2(full[1])}` });
  } else if (dayMonth) {
    conditions.push({ birthDate: new RegExp(`-${pad2(dayMonth[2])}-${pad2(dayMonth[1])}$`) });
  } else {
    conditions.push({ birthDate: rx });
  }
  return conditions;
}

export type ResponsesQueryInput = Record<string, string | string[] | undefined>;

export function buildWorkflowBucketFilter(bucket: string): Record<string, unknown> | null {
  if (bucket === 'pending') {
    return {
      workflowStatus: { $ne: 'closed' },
      $or: [
        { workflowStatus: { $in: ['pending_shk_followup', 'shk_in_progress'] } },
        {
          workflowStatus: 'patient_completed',
          patientBoundedSubmit: true,
          $or: [
            { 'shkFollowUp.completedAt': { $exists: false } },
            { 'shkFollowUp.completedAt': null },
          ],
        },
      ],
    };
  }
  if (bucket === 'done') {
    return {
      $or: [
        { workflowStatus: 'closed' },
        {
          workflowStatus: 'patient_completed',
          $or: [
            { patientBoundedSubmit: { $ne: true } },
            { 'shkFollowUp.completedAt': { $exists: true, $ne: null } },
          ],
        },
      ],
    };
  }
  return null;
}

export function buildResponsesFilterFromQuery(
  query: ResponsesQueryInput
): { filter: Record<string, unknown>; answerFiltersError?: string } {
  const filter: Record<string, unknown> = {};

  filter.deletedAt = null;

  const userId = query.userId;
  if (userId && typeof userId === 'string') filter.userId = userId;

  const draft = query.draft;
  if (draft !== undefined) filter.draft = draft === 'true';

  const workflowStatus = query.workflowStatus;
  if (workflowStatus && typeof workflowStatus === 'string') {
    filter.workflowStatus = workflowStatus;
  }

  const workflowBucket = query.workflowBucket;
  if (workflowBucket && typeof workflowBucket === 'string') {
    const bucketFilter = buildWorkflowBucketFilter(workflowBucket);
    if (bucketFilter) {
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, bucketFilter];
        delete filter.$or;
      } else {
        Object.assign(filter, bucketFilter);
      }
    }
  }

  const pid = query.pid;
  if (pid && typeof pid === 'string') filter.pid = pid;

  // Every whitespace-separated token must match somewhere (name, e-mail, phone, PID,
  // first/last name answers, birth date), so "popović 15.03.1985" narrows down.
  // Tokens go into $and so they never overwrite the workflow-bucket $or.
  const search = query.search;
  if (search && typeof search === 'string') {
    const tokens = search.trim().split(/\s+/).filter(Boolean).slice(0, 6);
    if (tokens.length > 0) {
      filter.$and = [
        ...((filter.$and as unknown[]) ?? []),
        ...tokens.map((token) => ({ $or: searchTokenConditions(token) })),
      ];
    }
  }

  const completedAtFrom = query.completedAtFrom;
  const completedAtTo = query.completedAtTo;
  if (completedAtFrom || completedAtTo) {
    filter.completedAt = {};
    if (completedAtFrom && typeof completedAtFrom === 'string') {
      (filter.completedAt as Record<string, Date>).$gte = startOfDayClinic(completedAtFrom);
    }
    if (completedAtTo && typeof completedAtTo === 'string') {
      (filter.completedAt as Record<string, Date>).$lte = endOfDayClinic(completedAtTo);
    }
  }

  const createdAtFrom =
    query.createdAtFrom || query.startDate;
  const createdAtTo = query.createdAtTo || query.endDate;
  if (createdAtFrom || createdAtTo) {
    filter.createdAt = {};
    if (createdAtFrom && typeof createdAtFrom === 'string') {
      (filter.createdAt as Record<string, Date>).$gte = startOfDayClinic(createdAtFrom);
    }
    if (createdAtTo && typeof createdAtTo === 'string') {
      (filter.createdAt as Record<string, Date>).$lte = endOfDayClinic(createdAtTo);
    }
  }

  const parsed = parseAnswerFilters(query.answerFilters);
  if (parsed === null) {
    return { filter, answerFiltersError: 'Invalid answerFilters JSON' };
  }
  const withAnswers = applyAnswerFiltersToMongo(filter, parsed);
  return { filter: withAnswers };
}
