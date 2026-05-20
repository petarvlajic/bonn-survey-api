import { applyAnswerFiltersToMongo, parseAnswerFilters } from './answerFilters';

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
    if (bucketFilter) Object.assign(filter, bucketFilter);
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
      (filter.completedAt as Record<string, Date>).$gte = new Date(completedAtFrom);
    }
    if (completedAtTo && typeof completedAtTo === 'string') {
      (filter.completedAt as Record<string, Date>).$lte = new Date(completedAtTo);
    }
  }

  const parsed = parseAnswerFilters(query.answerFilters);
  if (parsed === null) {
    return { filter, answerFiltersError: 'Invalid answerFilters JSON' };
  }
  const withAnswers = applyAnswerFiltersToMongo(filter, parsed);
  return { filter: withAnswers };
}
