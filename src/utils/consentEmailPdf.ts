import PDFDocument from 'pdfkit';
import { PDFDocument as PdfLibDocument, StandardFonts } from 'pdf-lib';
import { buildConsentPdfBuffer, formatConsentBannerDate } from './consentPatientDocument';
import { buildPatientQuestionnairePdf } from './patientQuestionnairePdf';
import { signatureToImageBuffer } from './signatureImage';

export interface ResponseLikeForConsentPdf {
  intervieweeName?: string;
  pid?: string;
  birthDate?: string;
  completedAt?: Date;
  signatureBase64?: string;
  answers?: Array<{
    questionId: string;
    type?: string;
    value?: unknown;
    answer?: unknown;
    imageUri?: string;
    fileUri?: string;
  }>;
  /** Populated user doc with `profile.examinerSignatureBase64`, or an ObjectId before populate. */
  userId?: unknown;
}

function answerString(
  row: { value?: unknown; answer?: unknown } | undefined
): string {
  if (!row) return '';
  if (row.value != null && String(row.value).trim()) return String(row.value).trim();
  if (row.answer != null && String(row.answer).trim()) return String(row.answer).trim();
  return '';
}

export type BuildFinalConsentEmailPdfOptions = {
  /** SHK examiner signature (patient-bounded flow: use completing SHK, not response.userId). */
  examinerSignatureBase64?: string | null;
  /** Name of the aufklärende Person (SHK); falls back to `consentExplainedBy` answer. */
  examinerName?: string | null;
};

/** UKB bundled PDF: page indices depend on export (8-page vs legacy 9-page). */
export function consentIntroPageIndex(pageCount: number): number {
  if (pageCount < 1) return 0;
  // 8-page UKB PDF (~2026): “Ich wurde von …” / discussion block on page 7 → index 6.
  if (pageCount === 8) return 6;
  // Legacy 9-page: same narrative at the start of the document → page 1 → index 0.
  if (pageCount === 9) return 0;
  // Other lengths: assume narrative immediately before signature page.
  return Math.max(0, pageCount - 2);
}

/** Zero-based index of the page that carries participant / examiner signature fields. */
export function consentSignaturePageIndex(pageCount: number): number {
  if (pageCount < 1) return 0;
  // 8-page UKB PDF (~2026): signature block on last page → index 7.
  if (pageCount === 8) return 7;
  // Legacy 9-page: signatures on page 8 → index 7.
  if (pageCount === 9) return 7;
  return pageCount - 1;
}

/** Isti x za oba „Bonn, Datum“ / Ort+Datum polja na potpisnoj stranici. */
const SIGNATURE_DATE_X_PT = 143;

/**
 * Last page signature block (8-page UKB PDF). pdf-lib: origin bottom-left; veći y = više na stranici.
 * Podešeno da odgovara novom layoutu (2026).
 */
const UKB_SIGNATURE_LAYOUT = {
  /** LOCKED — ne menjati koordinate (korisnik potvrdio). */
  participantName: { x: 78, y: 684, size: 11, baselineFraction: 0.55 },
  participantDate: { x: SIGNATURE_DATE_X_PT, y: 650, size: 10 },
  participantSignature: { x: 315, y: 596, width: 200, height: 40, lift: 0.5 },
  examinerName: { x: 78, y: 513, size: 11 },
  examinerDate: { x: SIGNATURE_DATE_X_PT, y: 475, size: 10 },
  examinerSignature: { x: 315, y: 422, width: 200, height: 40, lift: 0.5 },
} as const;

/** A4 visina (pt) za procenat pomaka. */
const A4_HEIGHT_PT = 842;
/** Vertikalni pomak nadole od referenci 642 / 528. ~20% stranice + fine 2 pt. */
const INTRO_SHIFT_DOWN_PT = Math.round(A4_HEIGHT_PT * 0.2) + 2;
/** Nudge both blocks slightly right. */
const INTRO_SHIFT_RIGHT_PT = 40;
/** Ne klizeti ispod margin-a (pdf-lib y od dna). */
const INTRO_MIN_Y_DISCUSSION_PT = 52;
/** Minimalni razmak između imena i teksta „besprochen“ bloka. */
const INTRO_MIN_GAP_NAME_ABOVE_DISCUSSION_PT = 44;

/** Dodatno nadole samo za blok „Zusätzlich … besprochen“ (pt) — izbegava preklapanje sa telom teksta. */
const INTRO_DISCUSSION_EXTRA_DOWN_PT = 22;
/** Gornje polje (Ich wurde von …): spusti još malo (pt). */
const INTRO_NAME_EXTRA_DOWN_PT = 16;
/** Donje polje (besprochen): blago nagore (pt). */
const INTRO_DISCUSSION_RAISE_PT = 2;
/** Donje polje: pomeri u levo (pt, smanji x). */
const INTRO_DISCUSSION_NUDGE_LEFT_PT = 26;

function buildIntroNarrativePageLayout() {
  const rawNameY = 642 - INTRO_SHIFT_DOWN_PT;
  const rawDiscY = 528 - INTRO_SHIFT_DOWN_PT;
  let discussionY = Math.max(INTRO_MIN_Y_DISCUSSION_PT, rawDiscY);
  discussionY = Math.max(INTRO_MIN_Y_DISCUSSION_PT, discussionY - INTRO_DISCUSSION_EXTRA_DOWN_PT);
  discussionY += INTRO_DISCUSSION_RAISE_PT;
  let nameY = Math.max(INTRO_MIN_Y_DISCUSSION_PT + INTRO_MIN_GAP_NAME_ABOVE_DISCUSSION_PT, rawNameY);
  nameY -= INTRO_NAME_EXTRA_DOWN_PT;
  if (nameY < discussionY + INTRO_MIN_GAP_NAME_ABOVE_DISCUSSION_PT) {
    nameY = discussionY + INTRO_MIN_GAP_NAME_ABOVE_DISCUSSION_PT;
  }
  return {
    informedByName: {
      x: 122 + INTRO_SHIFT_RIGHT_PT,
      y: nameY,
      size: 10 as const,
      maxWidth: 380 as const,
    },
    discussionPoints: {
      x: 56 + INTRO_SHIFT_RIGHT_PT - INTRO_DISCUSSION_NUDGE_LEFT_PT,
      y: discussionY,
      size: 11 as const,
      maxWidth: 483 as const,
      lineHeight: 13 as const,
      maxLines: 14 as const,
    },
  };
}

/**
 * Narrative section page of UKB „Patienteninformation“ (8-page export: page 7).
 * Coordinates are pdf-lib (origin bottom-left). Re-calibrate if the template changes.
 */
const UKB_INTRO_NARRATIVE_PAGE = buildIntroNarrativePageLayout();

/** Raise text baseline above the rule (fraction of font size). */
function textBaselineY(lineY: number, fontSize: number, baselineFraction = 0.5): number {
  return lineY + Math.round(fontSize * baselineFraction);
}

/** Lift signature image upward (fraction of image height) so ink sits on the rule. */
function signatureBottomY(lineY: number, imageHeight: number, liftFraction: number): number {
  return lineY + Math.round(imageHeight * liftFraction);
}

/** Strip data URL prefix and return raw bytes, or null if missing/invalid. */
export function parseDataUrlImageToBuffer(input: string | undefined | null): Buffer | null {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim();
  if (!s) return null;
  const base64Part = s.includes(',') ? s.split(',').slice(1).join(',') : s;
  if (!base64Part) return null;
  try {
    const buf = Buffer.from(base64Part, 'base64');
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

export async function mergePdfBuffers(front: Buffer, back: Buffer): Promise<Buffer> {
  const merged = await PdfLibDocument.create();
  const frontDoc = await PdfLibDocument.load(front);
  const backDoc = await PdfLibDocument.load(back);
  const frontPages = await merged.copyPages(frontDoc, frontDoc.getPageIndices());
  frontPages.forEach((p) => merged.addPage(p));
  const backPages = await merged.copyPages(backDoc, backDoc.getPageIndices());
  backPages.forEach((p) => merged.addPage(p));
  return Buffer.from(await merged.save());
}

/**
 * First page(s): participant + examiner signatures (official UKB wording).
 * Caller appends the official Patienteninformation PDF (from bundled DOCX / PDF asset) after this buffer.
 */
export async function buildConsentSignaturesCoverPdf(params: {
  intervieweeName: string;
  dateLabel: string;
  participantSignature: Buffer | null;
  examinerSignature: Buffer | null;
}): Promise<Buffer> {
  const { intervieweeName, dateLabel, participantSignature, examinerSignature } = params;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(14).text('Herz Check Bonn – Einwilligung', { underline: true });
    doc.moveDown(0.6);
    doc
      .fontSize(10)
      .fillColor('#333')
      .text(
        'Unterschriftenblatt (Teil 1). Anschließend folgt die vollständige Patienteninformation und Einwilligungserklärung (offizielles UKB-Dokument).'
      );
    doc.moveDown(1);

    doc.fontSize(11).text(`Name der teilnehmenden Person: ${intervieweeName || '—'}`);
    doc.text(`Ort, Datum: Bonn, ${dateLabel}`);
    doc.moveDown(0.8);

    doc.fontSize(10).text('Unterschrift der teilnehmenden Person:', { continued: false });
    doc.moveDown(0.3);
    if (participantSignature) {
      try {
        doc.image(participantSignature, { fit: [420, 120] });
      } catch {
        doc.fillColor('#a00').text('(Signatur konnte nicht eingebettet werden.)');
      }
    } else {
      doc.fillColor('#666').text('(Keine Unterschrift gespeichert.)');
    }
    doc.moveDown(1.2);
    doc.fillColor('#000');

    doc.fontSize(10).text('Unterschrift der aufklärenden Person:', { continued: false });
    doc.moveDown(0.3);
    if (examinerSignature) {
      try {
        doc.image(examinerSignature, { fit: [420, 120] });
      } catch {
        doc.fillColor('#a00').text('(Signatur konnte nicht eingebettet werden.)');
      }
    } else {
      doc.fillColor('#666').text('(Keine Prüfperson-Unterschrift im SHK-Profil hinterlegt.)');
    }

    doc.end();
  });
}

/**
 * Overlays consent step fields onto the narrative page (page 7 of 8-page UKB PDF;
 * page 1 of legacy 9-page), after “Ich wurde von …” and below “… folgende Punkte besprochen:”.
 */
export async function stampConsentIntroOnOfficialPdf(
  officialPdf: Buffer,
  params: { informedByName: string; discussionPoints: string }
): Promise<Buffer> {
  const name = params.informedByName.trim();
  const discussion = consentDiscussionForPdfStamp(params.discussionPoints);
  if (!name && !discussion) return officialPdf;

  const doc = await PdfLibDocument.load(officialPdf);
  const n = doc.getPageCount();
  if (n < 1) return officialPdf;
  const pageIdx = Math.min(consentIntroPageIndex(n), n - 1);
  const page = doc.getPage(pageIdx);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const L = UKB_INTRO_NARRATIVE_PAGE;

  if (name) {
    let size: number = L.informedByName.size;
    const maxW = L.informedByName.maxWidth;
    let display = name;
    while (display.length > 2 && font.widthOfTextAtSize(display, size) > maxW) {
      size = Math.max(7, size - 0.5);
      if (size <= 7.2 && display.length > 42) {
        display = `${display.slice(0, 40)}…`;
        break;
      }
    }
    page.drawText(display, {
      x: L.informedByName.x,
      y: textBaselineY(L.informedByName.y, size),
      size,
      font,
      maxWidth: maxW,
    });
  }

  if (discussion) {
    page.drawText(discussion, {
      x: L.discussionPoints.x,
      y: textBaselineY(L.discussionPoints.y, L.discussionPoints.size),
      size: L.discussionPoints.size,
      font,
      maxWidth: L.discussionPoints.maxWidth,
      lineHeight: L.discussionPoints.lineHeight,
    });
  }

  return Buffer.from(await doc.save());
}

/** @deprecated Use stampConsentIntroOnOfficialPdf */
export const stampConsentIntroOnFirstPage = stampConsentIntroOnOfficialPdf;

/**
 * Stamp participant + examiner names, dates, and signatures onto the UKB signature page
 * (last page of 8-page export; page 8 of legacy 9-page).
 */
export async function stampSignaturesOnOfficialPdf(
  officialPdf: Buffer,
  params: {
    participantSignature: Buffer | null;
    examinerSignature: Buffer | null;
    intervieweeName: string;
    examinerName: string;
    dateLabel: string;
  }
): Promise<Buffer> {
  const doc = await PdfLibDocument.load(officialPdf);
  const pageIndex = consentSignaturePageIndex(doc.getPageCount());
  const page = doc.getPage(pageIndex);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const L = UKB_SIGNATURE_LAYOUT;
  const placeDate = params.dateLabel ? `Bonn, ${params.dateLabel}` : 'Bonn';

  const participantName = params.intervieweeName.trim();
  if (participantName) {
    page.drawText(participantName.toUpperCase(), {
      x: L.participantName.x,
      y: textBaselineY(
        L.participantName.y,
        L.participantName.size,
        L.participantName.baselineFraction
      ),
      size: L.participantName.size,
      font,
    });
  }
  page.drawText(placeDate, {
    x: L.participantDate.x,
    y: textBaselineY(L.participantDate.y, L.participantDate.size),
    size: L.participantDate.size,
    font,
  });

  const examinerName = params.examinerName.trim();
  if (examinerName) {
    page.drawText(examinerName, {
      x: L.examinerName.x,
      y: textBaselineY(L.examinerName.y, L.examinerName.size),
      size: L.examinerName.size,
      font,
    });
  }
  page.drawText(placeDate, {
    x: L.examinerDate.x,
    y: textBaselineY(L.examinerDate.y, L.examinerDate.size),
    size: L.examinerDate.size,
    font,
  });

  if (params.participantSignature) {
    const img = await doc.embedPng(params.participantSignature);
    const s = L.participantSignature;
    page.drawImage(img, {
      x: s.x,
      y: signatureBottomY(s.y, s.height, s.lift),
      width: s.width,
      height: s.height,
    });
  }
  if (params.examinerSignature) {
    const img = await doc.embedPng(params.examinerSignature);
    const s = L.examinerSignature;
    page.drawImage(img, {
      x: s.x,
      y: signatureBottomY(s.y, s.height, s.lift),
      width: s.width,
      height: s.height,
    });
  }

  return Buffer.from(await doc.save());
}

function participantSignatureRaw(doc: ResponseLikeForConsentPdf): string {
  const direct = doc.signatureBase64?.trim();
  if (direct) return direct;
  const legacy = (doc as { signature?: string }).signature?.trim();
  return legacy || '';
}

/** Treat default „Keine“ as no extra discussion to stamp on the UKB PDF. */
export function consentDiscussionForPdfStamp(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^keine$/i.test(trimmed)) return '';
  return trimmed;
}

function consentDiscussionPointsFromDoc(doc: ResponseLikeForConsentPdf): string {
  const answer = doc.answers?.find((a) => a.questionId === 'consentDiscussionPoints');
  return consentDiscussionForPdfStamp(answerString(answer));
}

function examinerNameFromDoc(
  doc: ResponseLikeForConsentPdf,
  options?: BuildFinalConsentEmailPdfOptions
): string {
  const fromOptions = options?.examinerName?.trim();
  if (fromOptions) return fromOptions;
  const answer = doc.answers?.find((a) => a.questionId === 'consentExplainedBy');
  const fromAnswer = answerString(answer);
  if (fromAnswer) return fromAnswer;
  const profile =
    doc.userId &&
    typeof doc.userId === 'object' &&
    doc.userId !== null &&
    'profile' in doc.userId
      ? (doc.userId as { profile?: { firstName?: string; lastName?: string } }).profile
      : undefined;
  return [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim();
}

function examinerSignatureFromDoc(
  doc: ResponseLikeForConsentPdf
): string | undefined {
  const profile =
    doc.userId &&
    typeof doc.userId === 'object' &&
    doc.userId !== null &&
    'profile' in doc.userId
      ? (doc.userId as { profile?: { examinerSignatureBase64?: string } }).profile
      : undefined;
  return profile?.examinerSignatureBase64;
}

function consentSigningDateIso(doc: ResponseLikeForConsentPdf): string {
  const dateAnswer = doc.answers?.find((a) => a.questionId === 'date');
  const d = answerString(dateAnswer);
  if (d) return d;
  if (doc.completedAt) return doc.completedAt.toISOString().split('T')[0];
  return new Date().toISOString().split('T')[0];
}

/**
 * Final PDF for consent email: full UKB Patienteninformation with text on page 1 + signatures on the signature page.
 */
export async function buildFinalConsentEmailPdf(
  doc: ResponseLikeForConsentPdf,
  options?: BuildFinalConsentEmailPdfOptions
): Promise<Buffer | null> {
  const name = (doc.intervieweeName || '').trim();
  const signingDateIso = consentSigningDateIso(doc);
  const dateLabel = formatConsentBannerDate(signingDateIso);

  let official: Buffer;
  let pdfSource: string;
  try {
    const built = await buildConsentPdfBuffer(name, signingDateIso);
    official = built.buffer;
    pdfSource = built.source;
    console.log(`[consentEmailPdf] Official document source: ${pdfSource}`);
  } catch (e) {
    console.error('[consentEmailPdf] Failed to build official consent PDF:', (e as Error).message);
    return null;
  }

  const examinerRaw =
    options?.examinerSignatureBase64?.trim() || examinerSignatureFromDoc(doc);
  const participantRaw = participantSignatureRaw(doc);

  const [participantSig, examinerSig] = await Promise.all([
    signatureToImageBuffer(participantRaw),
    signatureToImageBuffer(examinerRaw),
  ]);

  console.log('[consentEmailPdf] Signatures:', {
    participantStored: Boolean(participantRaw),
    participantEmbedded: Boolean(participantSig),
    examinerStored: Boolean(examinerRaw),
    examinerEmbedded: Boolean(examinerSig),
  });

  const examinerName = examinerNameFromDoc(doc, options);
  const discussion = consentDiscussionPointsFromDoc(doc);

  if (examinerName || discussion) {
    try {
      official = await stampConsentIntroOnOfficialPdf(official, {
        informedByName: examinerName,
        discussionPoints: discussion,
      });
      console.log('[consentEmailPdf] Stamped informed-by + discussion on narrative page');
    } catch (e) {
      console.warn('[consentEmailPdf] Could not stamp intro fields:', (e as Error).message);
    }
  }

  if (participantSig || examinerSig || name || examinerName) {
    try {
      official = await stampSignaturesOnOfficialPdf(official, {
        participantSignature: participantSig,
        examinerSignature: examinerSig,
        intervieweeName: name,
        examinerName,
        dateLabel,
      });
      console.log(
        '[consentEmailPdf] Stamped signatures on official UKB signature page (participant then examiner)'
      );
    } catch (e) {
      console.warn(
        '[consentEmailPdf] Could not stamp official PDF:',
        (e as Error).message
      );
    }
  }

  const hasPatientAnswers = (doc.answers || []).some(
    (a) => a?.questionId && a.questionId !== 'signature'
  );
  if (hasPatientAnswers) {
    try {
      const appendix = await buildPatientQuestionnairePdf({
        intervieweeName: name || doc.intervieweeName,
        pid: doc.pid,
        birthDate: doc.birthDate,
        answers: doc.answers,
      });
      official = await mergePdfBuffers(official, appendix);
      console.log('[consentEmailPdf] Appended patient questionnaire answers');
    } catch (e) {
      console.warn(
        '[consentEmailPdf] Could not append patient questionnaire:',
        (e as Error).message
      );
    }
  }

  const pageCount = (await PdfLibDocument.load(official)).getPageCount();
  console.log(`[consentEmailPdf] Final PDF: ${pdfSource}, pages=${pageCount}`);
  return official;
}
