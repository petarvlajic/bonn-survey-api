import { applyAnswerFiltersToMongo, parseAnswerFilters } from './answerFilters';

function startOfDayUtc(isoDate: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0));
  const d = new Date(isoDate);
  return Number.isNaN(d.getTime()) ? d : new Date(d.setUTCHours(0, 0, 0, 0));
}

function endOfDayUtc(isoDate: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999));
  const d = new Date(isoDate);
  return Number.isNaN(d.getTime()) ? d : new Date(d.setUTCHours(23, 59, 59, 999));
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

  const search = query.search;
  if (search && typeof search === 'string') {
    const regex = new RegExp(search, 'i');
    filter.$or = [
      { intervieweeName: regex },
      { intervieweeEmail: regex },
      { intervieweePhone: regex },
      { pid: regex },
      { 'answers.value': regex },
      { 'answers.questionId': regex },
    ];
  }

  const completedAtFrom = query.completedAtFrom;
  const completedAtTo = query.completedAtTo;
  if (completedAtFrom || completedAtTo) {
    filter.completedAt = {};
    if (completedAtFrom && typeof completedAtFrom === 'string') {
      (filter.completedAt as Record<string, Date>).$gte = startOfDayUtc(completedAtFrom);
    }
    if (completedAtTo && typeof completedAtTo === 'string') {
      (filter.completedAt as Record<string, Date>).$lte = endOfDayUtc(completedAtTo);
    }
  }

  const createdAtFrom =
    query.createdAtFrom || query.startDate;
  const createdAtTo = query.createdAtTo || query.endDate;
  if (createdAtFrom || createdAtTo) {
    filter.createdAt = {};
    if (createdAtFrom && typeof createdAtFrom === 'string') {
      (filter.createdAt as Record<string, Date>).$gte = startOfDayUtc(createdAtFrom);
    }
    if (createdAtTo && typeof createdAtTo === 'string') {
      (filter.createdAt as Record<string, Date>).$lte = endOfDayUtc(createdAtTo);
    }
  }

  const parsed = parseAnswerFilters(query.answerFilters);
  if (parsed === null) {
    return { filter, answerFiltersError: 'Invalid answerFilters JSON' };
  }
  const withAnswers = applyAnswerFiltersToMongo(filter, parsed);
  return { filter: withAnswers };
}
