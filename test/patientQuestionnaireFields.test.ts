import { describe, expect, it } from 'vitest';
import { PATIENT_QUESTIONNAIRE_ORDER } from '../src/utils/patientQuestionnairePdf';
import { QUESTION_LABELS } from '../src/utils/questionLabels';

describe('new fields in patient questionnaire / labels', () => {
  it('lists Standort, Hausarzt, Kardiologe right after the postal code', () => {
    const i = PATIENT_QUESTIONNAIRE_ORDER.indexOf('intervieweePostalCode');
    expect(PATIENT_QUESTIONNAIRE_ORDER.slice(i + 1, i + 4)).toEqual([
      'location',
      'familyDoctor',
      'cardiologist',
    ]);
  });

  it('has German labels for them', () => {
    expect(QUESTION_LABELS.location).toBe('Standort');
    expect(QUESTION_LABELS.familyDoctor).toBe('Hausarzt');
    expect(QUESTION_LABELS.cardiologist).toBe('Kardiologe');
  });
});
