import PDFDocument from 'pdfkit';
import { formatStoredAnswerValue } from './answerDisplay';
import { QUESTION_LABELS } from './questionLabels';

/** Display order for patient-filled questionnaire (Cardio Check + Einwilligung). */
export const PATIENT_QUESTIONNAIRE_ORDER: string[] = [
  'name',
  'email',
  'intervieweePhone',
  'intervieweeAddress',
  'preferredContactMethod',
  'birthDate',
  'date',
  'hasChestComplaints',
  'painType',
  'painTypeOther',
  'complaintsSince',
  'painIntensity',
  'complaintsOccur',
  'complaintsDuration',
  'painRadiation',
  'whatHelps',
  'whatWorsens',
  'accompanyingSymptoms',
  'breathlessnessOnExertion',
  'breathlessnessSince',
  'breathlessnessLying',
  'swollenLegs',
  'pulsingChest',
  'earNoise',
  'dizzinessSyncope',
  'reducedCapacity',
  'nightCough',
  'palpitations',
  'valveDisease',
  'valveTypes',
  'heartDiseases',
  'riskFactors',
  'previousExams',
  'echoFreeText',
];

/** Already on the official UKB consent PDF; omit from patient Q&A appendix. */
const SKIP_IN_APPENDIX = new Set([
  'signature',
  'consentExplainedBy',
  'consentDiscussionPoints',
]);

type AnswerRow = {
  questionId: string;
  type?: string;
  value?: unknown;
  answer?: unknown;
  imageUri?: string;
  fileUri?: string;
};

function formatAnswerForPdf(row: AnswerRow): string {
  return formatStoredAnswerValue(row);
}

function questionLabel(questionId: string): string {
  return QUESTION_LABELS[questionId] || questionId;
}

function sortPatientAnswers(answers: AnswerRow[]): AnswerRow[] {
  const orderIndex = new Map(PATIENT_QUESTIONNAIRE_ORDER.map((id, i) => [id, i]));
  return [...answers].sort((a, b) => {
    const ia = orderIndex.get(a.questionId) ?? 9999;
    const ib = orderIndex.get(b.questionId) ?? 9999;
    if (ia !== ib) return ia - ib;
    return a.questionId.localeCompare(b.questionId);
  });
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) {
    doc.addPage();
  }
}

/**
 * PDF appendix: full patient questionnaire with chosen answers (German).
 * Appended after UKB consent document in the email attachment.
 */
export async function buildPatientQuestionnairePdf(params: {
  intervieweeName?: string;
  pid?: string;
  birthDate?: string;
  answers?: AnswerRow[];
}): Promise<Buffer> {
  const rows = (params.answers || []).filter(
    (a) => a?.questionId && !SKIP_IN_APPENDIX.has(a.questionId)
  );
  const withValue = rows.filter((r) => {
    const v = formatAnswerForPdf(r);
    return v !== '—';
  });

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).fillColor('#1a237e').text('Ihr ausgefüllter Fragebogen', { align: 'center' });
    doc.moveDown(0.3);
    doc
      .fontSize(10)
      .fillColor('#555555')
      .text('Herz Check Bonn – Ihre Angaben und gewählten Antworten', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(11).fillColor('#000000');

    if (params.intervieweeName) doc.text(`Name: ${params.intervieweeName}`);
    if (params.pid) doc.text(`PID: ${params.pid}`);
    if (params.birthDate) doc.text(`Geburtsdatum: ${params.birthDate}`);
    doc.moveDown(0.8);

    if (withValue.length === 0) {
      doc.fontSize(11).text('Keine gespeicherten Antworten im Fragebogen.');
      doc.end();
      return;
    }

    const sorted = sortPatientAnswers(withValue);
    sorted.forEach((row, index) => {
      ensureSpace(doc, 52);
      const label = questionLabel(row.questionId);
      const valueText = formatAnswerForPdf(row);
      doc.fontSize(11).fillColor('#333333').text(`${index + 1}. ${label}`, {
        continued: false,
      });
      doc.fontSize(10).fillColor('#000000').text(`Antwort: ${valueText}`, { indent: 14 });
      doc.moveDown(0.55);
    });

    doc.end();
  });
}
