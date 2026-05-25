interface ExportableAnswer {
  questionId: string;
  value?: unknown;
}

interface ExportableResponse {
  _id: { toString(): string } | string;
  pid?: string;
  birthDate?: string;
  gender?: string;
  intervieweeName?: string;
  intervieweeEmail?: string;
  intervieweePhone?: string;
  draft: boolean;
  createdAt: Date;
  completedAt?: Date;
  answers?: ExportableAnswer[];
  userId?: {
    email?: string;
    profile?: {
      firstName?: string;
      lastName?: string;
    };
  };
}

const csvEscape = (value: unknown): string =>
  `"${String(value ?? '').replace(/"/g, '""')}"`;

const serializeValue = (value: unknown): string => {
  if (Array.isArray(value)) return value.join(' | ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
};

export const buildResponseCsv = (responses: ExportableResponse[]): string => {
  const questionIds = new Set<string>();
  for (const response of responses) {
    for (const answer of response.answers || []) {
      questionIds.add(answer.questionId);
    }
  }

  const dynamicQuestionColumns = Array.from(questionIds).sort();
  const headers = [
    'ID',
    'PID',
    'Interviewer Email',
    'Interviewer Name',
    'Interviewee Name',
    'Interviewee Email',
    'Interviewee Phone',
    'Birth Date',
    'Gender',
    'Status',
    'Created At',
    'Completed At',
    ...dynamicQuestionColumns.map((id) => `Q_${id}`),
  ];

  const rows = responses.map((response) => {
    const answerMap = new Map<string, string>();
    for (const answer of response.answers || []) {
      answerMap.set(answer.questionId, serializeValue(answer.value));
    }

    const interviewerName = response.userId?.profile
      ? `${response.userId.profile.firstName || ''} ${response.userId.profile.lastName || ''}`.trim()
      : '';

    return [
      typeof response._id === 'string' ? response._id : response._id.toString(),
      response.pid || '',
      response.userId?.email || '',
      interviewerName,
      response.intervieweeName || '',
      response.intervieweeEmail || '',
      response.intervieweePhone || '',
      response.birthDate || '',
      response.gender || '',
      response.draft ? 'Draft' : 'Completed',
      response.createdAt.toISOString(),
      response.completedAt ? response.completedAt.toISOString() : '',
      ...dynamicQuestionColumns.map((id) => answerMap.get(id) || ''),
    ];
  });

  return [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
};

