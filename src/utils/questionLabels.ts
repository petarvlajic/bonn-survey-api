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
  accompanyingSymptoms: 'Begleitsymptome (Accompanying Symptoms)',
  breathlessnessOnExertion: 'Haben Sie Atemnot bei körperlicher Belastung?',
  breathlessnessSince: 'Seit wann? (Since when?)',
  breathlessnessLying: 'Haben Sie Atemnot im Liegen?',
  swollenLegs: 'Haben Sie geschwollene Füße oder Beine bemerkt?',
  pulsingChest: 'Spüren Sie ein Pochen oder Klopfen im Brustkorb?',
  earNoise: 'Hören Sie ein Rauschen oder Pochen im Ohr?',
  dizzinessSyncope: 'Haben Sie Schwindel oder Bewusstseinsverluste?',
  reducedCapacity: 'Haben Sie verminderte körperliche Belastbarkeit bemerkt?',
  nightCough: 'Leiden Sie unter nächtlichem Husten?',
  palpitations: 'Haben Sie Herzklopfen oder Herzstolpern?',
  valveDisease: 'Wurde bei Ihnen bereits eine Herzklappenerkrankung festgestellt?',
  valveTypes: 'Herzklappenerkrankung (Valve types)',
  heartDiseases: 'Bestehen bekannte Herzerkrankungen?',
  riskFactors: 'Haben Sie folgende Erkrankungen oder Risikofaktoren?',
  previousExams: 'Vorangegangene Untersuchungen / Eingriffe',
  echoFreeText: 'Echokardiographie Freitext',
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
