/** questionId → label (must match mobile app). Used in PDF export and web filters. */
export const QUESTION_LABELS: Record<string, string> = {
  q1: 'Interviewee Name',
  q2: 'Contact Information',
  q3: 'Age Range',
  q4: 'Gender',
  q5: 'Topics of Interest',
  q6: 'Overall Satisfaction',
  q7: 'Additional Comments',
  q8: 'Date of Interview',
  q9: 'Location',
  q10: 'Photo (Optional)',
  name: 'Name',
  email: 'Email',
  birthDate: 'Geburtsdatum (Birth Date)',
  gender: 'Geschlecht (Gender)',
  date: 'Datum (Date)',
  hasChestComplaints: 'Haben Sie derzeit Beschwerden im Brustbereich?',
  painType: 'Art der Schmerzen (Type of pain)',
  painTypeOther: 'Specify other pain type',
  complaintsSince: 'Seit wann bestehen die Beschwerden? (Since when?)',
  painIntensity: 'Wie stark sind die Schmerzen (0–10)?',
  complaintsOccur: 'Treten die Beschwerden auf bei: (Complaints occur during)',
  complaintsDuration: 'Wie lange dauern die Beschwerden an? (Duration)',
  painRadiation: 'Strahlen die Schmerzen aus? (Pain radiation)',
  whatHelps: 'Was bessert die Beschwerden? (What helps?)',
  whatWorsens: 'Was verschlechtert die Beschwerden? (What worsens?)',
  accompanyingSymptoms:
    'Liegen Begleitsymptome oder Beschwerden vor, die auf Herzerkrankungen hinweisen können?',
  valveDisease: 'Sind Herzklappenerkrankungen bekannt?',
  valveTypes: 'Herzklappenerkrankung (Typ)',
  valveFreeText: 'Herzklappenerkrankungen — Freitext',
  heartDiseases: 'Bestehen bekannte Herzerkrankungen?',
  heartDiseasesFreeText: 'Herzerkrankungen — Freitext',
  riskFactors: 'Haben Sie folgende Erkrankungen oder Risikofaktoren?',
  previousExams: 'Vorangegangene Untersuchungen / Eingriffe',
  previousExamsFreeText: 'Untersuchungen / Eingriffe — Freitext',
  medicationFreeText: 'Dauermedikation',
  echoFreeText: 'Freitext',
  intervieweePhone: 'Handy / Telefon',
  intervieweeAddress: 'Adresse',
  signature: 'Signature',
};

export type FilterFieldKind = 'boolean' | 'number' | 'text';

const BOOLEAN_QUESTION_IDS = new Set([
  'hasChestComplaints',
  'breathlessnessOnExertion',
  'breathlessnessLying',
  'swollenLegs',
  'pulsingChest',
  'earNoise',
  'dizzinessSyncope',
  'reducedCapacity',
  'nightCough',
  'palpitations',
  'valveDisease',
]);

const NUMBER_QUESTION_IDS = new Set(['painIntensity', 'q6']);

export function getFilterFieldKind(questionId: string): FilterFieldKind {
  if (BOOLEAN_QUESTION_IDS.has(questionId)) return 'boolean';
  if (NUMBER_QUESTION_IDS.has(questionId)) return 'number';
  return 'text';
}

export function listFilterableFields(): Array<{
  questionId: string;
  label: string;
  kind: FilterFieldKind;
}> {
  return Object.keys(QUESTION_LABELS)
    .filter((id) => id !== 'signature' && !id.startsWith('echoPhotos'))
    .sort((a, b) => QUESTION_LABELS[a].localeCompare(QUESTION_LABELS[b], 'de'))
    .map((questionId) => ({
      questionId,
      label: QUESTION_LABELS[questionId],
      kind: getFilterFieldKind(questionId),
    }));
}
