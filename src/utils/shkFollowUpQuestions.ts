/**
 * @deprecated Legacy SHK checklist (5 booleans). The API now uses `echoScreening`
 * (`src/utils/shkEchoScreening.ts`). Kept only for reference / old data in DB.
 */
export type ShkFollowUpItem = { id: string; labelDe: string; hintDe: string };

export const SHK_FOLLOWUP_ITEMS: ShkFollowUpItem[] = [
  {
    id: 'discussion_results_with_patient',
    labelDe:
      'Gespräch mit Patient:in zu den Ergebnissen / weiteren Schritten dokumentiert oder durchgeführt',
    hintDe:
      'Kurz festhalten, ob Befunde besprochen wurden und ob Rückfragen der Patient:in beantwortet wurden.',
  },
  {
    id: 'open_questions_clarified',
    labelDe: 'Offene Rückfragen der Patient:in wurden geklärt',
    hintDe:
      'Alle offenen Punkte aus dem Screening sollten vor Abschluss geklärt oder für die weitere Betreuung dokumentiert sein.',
  },
  {
    id: 'next_steps_explained',
    labelDe: 'Nächste Schritte (Verlauf, Termine) wurden erläutert',
    hintDe:
      'z. B. Folgetermine, Überweisung, Hausarztinformation oder „kein weiterer Bedarf“ — je nach klinischer Entscheidung.',
  },
  {
    id: 'patient_informed_contact',
    labelDe: 'Patient:in wurde über Erreichbarkeit / Kontakt informiert',
    hintDe:
      'Wer bei Rückfragen erreichbar ist (Studienteam, Ambulanz, Notfallhinweis falls zutreffend).',
  },
  {
    id: 'documentation_complete',
    labelDe: 'Dokumentation für diese Untersuchung ist vollständig',
    hintDe:
      'Fragebogen, Einwilligung und relevante Notizen sind für diese Sitzung vollständig und nachvollziehbar.',
  },
];
