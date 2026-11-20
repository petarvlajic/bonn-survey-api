import { QUESTION_LABELS } from './questionLabels';

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
  intervieweeAddress?: string;
  intervieweePostalCode?: string;
  pathologicalFindingReport?: boolean;
  workflowStatus?: string;
  patientBoundedSubmit?: boolean;
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

/** Semicolon: German-locale Excel opens ";"-separated files in columns on double click. */
const CSV_DELIMITER = ';';
/** UTF-8 BOM so Excel does not show umlauts as "MÃ¼ller". */
const UTF8_BOM = '﻿';

const csvEscape = (value: unknown): string =>
  `"${String(value ?? '').replace(/"/g, '""')}"`;

const serializeValue = (value: unknown): string => {
  if (Array.isArray(value)) return value.join(' | ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
};

/** Answer ids already exported as dedicated columns (avoid duplicate columns). */
const DEDICATED_QUESTION_IDS = new Set([
  'name',
  'firstName',
  'lastName',
  'birthDate',
  'gender',
  'intervieweePhone',
  'intervieweeAddress',
  'intervieweePostalCode',
  'intervieweeEmail',
  'email',
]);

/** Short German column headers (no English, no "Q_" ids). */
const EXPORT_LABEL_OVERRIDES: Record<string, string> = {
  date: 'Datum',
  hasChestComplaints: 'Beschwerden im Brustbereich',
  painType: 'Art der Schmerzen',
  painTypeOther: 'Art der Schmerzen (Sonstige)',
  complaintsSince: 'Beschwerden seit',
  painIntensity: 'Schmerzstärke (0–10)',
  complaintsOccur: 'Beschwerden treten auf bei',
  complaintsDuration: 'Dauer der Beschwerden',
  painRadiation: 'Schmerzausstrahlung',
  whatHelps: 'Was bessert die Beschwerden',
  whatWorsens: 'Was verschlechtert die Beschwerden',
  accompanyingSymptoms: 'Begleitsymptome',
  valveDisease: 'Herzklappenerkrankung bekannt',
  valveTypes: 'Herzklappenerkrankung (Typ)',
  valveFreeText: 'Herzklappenerkrankung (Freitext)',
  heartDiseases: 'Herzerkrankungen',
  heartDiseasesFreeText: 'Herzerkrankungen (Freitext)',
  riskFactors: 'Risikofaktoren',
  previousExams: 'Vorangegangene Untersuchungen / Eingriffe',
  previousExamsFreeText: 'Untersuchungen / Eingriffe (Freitext)',
  medicationFreeText: 'Dauermedikation',
  echoFreeText: 'Echo (Freitext)',
  location: 'Standort',
  familyDoctor: 'Hausarzt',
  cardiologist: 'Kardiologe',
  preferredContactMethod: 'Bevorzugte Kontaktart',
  signature: 'Unterschrift',
};

const stripEnglishSuffix = (label: string): string =>
  label.replace(/\s*\([A-Za-z][^)]*\)\s*$/, '').trim();

export const getExportColumnLabel = (questionId: string): string => {
  if (EXPORT_LABEL_OVERRIDES[questionId]) return EXPORT_LABEL_OVERRIDES[questionId];
  const echoPhoto = /^echoPhotos?_?(\d+)$/i.exec(questionId);
  if (echoPhoto) return `Echo-Foto ${echoPhoto[1]}`;
  const label = QUESTION_LABELS[questionId];
  return label ? stripEnglishSuffix(label) : questionId;
};

const GENDER_DE: Record<string, string> = {
  male: 'männlich',
  female: 'weiblich',
  diverse: 'divers',
  other: 'andere',
  prefer_not_to_say: 'keine Angabe',
};

const WORKFLOW_FOLLOWUP_DE: Record<string, string> = {
  pending_shk_followup: 'Offen',
  shk_in_progress: 'In Bearbeitung',
};

const TIME_ZONE = 'Europe/Berlin';

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD → DD.MM.YYYY (pure string, no timezone shift). */
export const formatBirthDateDe = (value?: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : value || '';
};

export const formatDateTimeDe = (date?: Date): string => {
  if (!date || Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('de-DE', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${get('day')}.${get('month')}.${get('year')} ${pad(Number(get('hour')) % 24)}:${get('minute')}`;
};

/** Prefer explicit firstName/lastName answers; fall back to splitting intervieweeName (last token = Nachname). */
const resolveIntervieweeName = (
  response: ExportableResponse,
  answerMap: Map<string, string>
): { firstName: string; lastName: string } => {
  const firstName = (answerMap.get('firstName') || '').trim();
  const lastName = (answerMap.get('lastName') || '').trim();
  if (firstName || lastName) return { firstName, lastName };
  const parts = (response.intervieweeName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
};

const resolveFollowUp = (response: ExportableResponse): { required: string; status: string } => {
  const wf = response.workflowStatus;
  if (wf && WORKFLOW_FOLLOWUP_DE[wf]) return { required: 'Ja', status: WORKFLOW_FOLLOWUP_DE[wf] };
  const wasFollowUp = response.patientBoundedSubmit || response.pathologicalFindingReport;
  if (wf === 'closed' && wasFollowUp) return { required: 'Ja', status: 'Abgeschlossen' };
  return { required: 'Nein', status: '' };
};

const timeOf = (r: ExportableResponse): number => r.createdAt?.getTime?.() ?? 0;

export const buildResponseCsv = (responses: ExportableResponse[]): string => {
  // Oldest → newest, regardless of how the caller ordered them.
  const sorted = [...responses].sort((a, b) => timeOf(a) - timeOf(b));

  const questionIds = new Set<string>();
  for (const response of sorted) {
    for (const answer of response.answers || []) {
      if (!DEDICATED_QUESTION_IDS.has(answer.questionId)) questionIds.add(answer.questionId);
    }
  }

  const dynamicQuestionColumns = Array.from(questionIds).sort((a, b) =>
    getExportColumnLabel(a).localeCompare(getExportColumnLabel(b), 'de')
  );

  const headers = [
    'ID',
    'PID',
    'Erstellt am',
    'Abgeschlossen am',
    'Status',
    'Interviewer Vorname',
    'Interviewer Nachname',
    'Interviewer E-Mail',
    'Vorname',
    'Nachname',
    'Geburtsdatum',
    'Geschlecht',
    'E-Mail',
    'Telefon',
    'Adresse',
    'PLZ',
    'Kontrollbedürftig',
    'Nachverfolgung erforderlich',
    'Nachverfolgung Status',
    ...dynamicQuestionColumns.map(getExportColumnLabel),
  ];

  const rows = sorted.map((response) => {
    const answerMap = new Map<string, string>();
    for (const answer of response.answers || []) {
      answerMap.set(answer.questionId, serializeValue(answer.value));
    }

    const name = resolveIntervieweeName(response, answerMap);
    const followUp = resolveFollowUp(response);
    const profile = response.userId?.profile;

    return [
      typeof response._id === 'string' ? response._id : response._id.toString(),
      response.pid || '',
      formatDateTimeDe(response.createdAt),
      formatDateTimeDe(response.completedAt),
      response.draft ? 'Entwurf' : 'Abgeschlossen',
      profile?.firstName || '',
      profile?.lastName || '',
      response.userId?.email || '',
      name.firstName,
      name.lastName,
      formatBirthDateDe(response.birthDate),
      GENDER_DE[response.gender || ''] || response.gender || '',
      response.intervieweeEmail || '',
      response.intervieweePhone || '',
      response.intervieweeAddress || '',
      response.intervieweePostalCode || '',
      response.pathologicalFindingReport ? 'Ja' : 'Nein',
      followUp.required,
      followUp.status,
      ...dynamicQuestionColumns.map((id) => answerMap.get(id) || ''),
    ];
  });

  return (
    UTF8_BOM +
    [headers, ...rows].map((row) => row.map(csvEscape).join(CSV_DELIMITER)).join('\r\n')
  );
};
