import PDFDocument from 'pdfkit';
import { PDFDocument as PdfLibDocument, StandardFonts } from 'pdf-lib';
import { buildConsentPdfBuffer, formatConsentBannerDate } from './consentPatientDocument';
import { signatureToImageBuffer } from './signatureImage';

export interface ResponseLikeForConsentPdf {
  intervieweeName?: string;
  birthDate?: string;
  completedAt?: Date;
  signatureBase64?: string;
  answers?: Array<{ questionId: string; value?: unknown }>;
  /** Populated user doc with `profile.examinerSignatureBase64`, or an ObjectId before populate. */
  userId?: unknown;
}

export type BuildFinalConsentEmailPdfOptions = {
  /** SHK examiner signature (patient-bounded flow: use completing SHK, not response.userId). */
  examinerSignatureBase64?: string | null;
  /** Name of the aufklärende Person (SHK); falls back to `consentExplainedBy` answer. */
  examinerName?: string | null;
};

/** UKB bundled PDF: signature block is on the page before the trailing blank footer page. */
export function consentSignaturePageIndex(pageCount: number): number {
  if (pageCount >= 2) return pageCount - 2;
  return Math.max(0, pageCount - 1);
}

/** A4 UKB export (page 8 of 9): pdf-lib coords, origin bottom-left (calibrated on bundled PDF). */
const UKB_SIGNATURE_LAYOUT = {
  participantName: { x: 78, y: 702, size: 11 },
  participantDate: { x: 78, y: 582, size: 10 },
  participantSignature: { x: 325, y: 570, width: 235, height: 50 },
  examinerName: { x: 78, y: 508, size: 11 },
  examinerDate: { x: 78, y: 418, size: 10 },
  examinerSignature: { x: 325, y: 405, width: 235, height: 50 },
} as const;

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
 * Stamp participant + examiner names, dates, and signatures onto the UKB signature page
 * (second-to-last page in the bundled 9-page export; last page is blank except footer).
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
  const page = doc.getPages()[pageIndex];
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const L = UKB_SIGNATURE_LAYOUT;
  const placeDate = params.dateLabel ? `Bonn, ${params.dateLabel}` : 'Bonn';

  const participantName = params.intervieweeName.trim();
  if (participantName) {
    page.drawText(participantName.toUpperCase(), {
      x: L.participantName.x,
      y: L.participantName.y,
      size: L.participantName.size,
      font,
    });
  }
  page.drawText(placeDate, {
    x: L.participantDate.x,
    y: L.participantDate.y,
    size: L.participantDate.size,
    font,
  });

  const examinerName = params.examinerName.trim();
  if (examinerName) {
    page.drawText(examinerName, {
      x: L.examinerName.x,
      y: L.examinerName.y,
      size: L.examinerName.size,
      font,
    });
  }
  page.drawText(placeDate, {
    x: L.examinerDate.x,
    y: L.examinerDate.y,
    size: L.examinerDate.size,
    font,
  });

  if (params.participantSignature) {
    const img = await doc.embedPng(params.participantSignature);
    const s = L.participantSignature;
    page.drawImage(img, { x: s.x, y: s.y, width: s.width, height: s.height });
  }
  if (params.examinerSignature) {
    const img = await doc.embedPng(params.examinerSignature);
    const s = L.examinerSignature;
    page.drawImage(img, { x: s.x, y: s.y, width: s.width, height: s.height });
  }

  // Drop trailing blank page (footer-only) from Word export when present.
  if (doc.getPageCount() >= 2) {
    const trailing = doc.getPages()[doc.getPageCount() - 1];
    const { height } = trailing.getSize();
    if (pageIndex === doc.getPageCount() - 2 && height > 0) {
      doc.removePage(doc.getPageCount() - 1);
    }
  }

  return Buffer.from(await doc.save());
}

function participantSignatureRaw(doc: ResponseLikeForConsentPdf): string {
  const direct = doc.signatureBase64?.trim();
  if (direct) return direct;
  const legacy = (doc as { signature?: string }).signature?.trim();
  return legacy || '';
}

function examinerNameFromDoc(
  doc: ResponseLikeForConsentPdf,
  options?: BuildFinalConsentEmailPdfOptions
): string {
  const fromOptions = options?.examinerName?.trim();
  if (fromOptions) return fromOptions;
  const answer = doc.answers?.find((a) => a.questionId === 'consentExplainedBy');
  const fromAnswer =
    answer?.value != null && String(answer.value).trim()
      ? String(answer.value).trim()
      : '';
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
  if (dateAnswer?.value != null && String(dateAnswer.value).trim()) {
    return String(dateAnswer.value).trim();
  }
  if (doc.completedAt) return doc.completedAt.toISOString().split('T')[0];
  return new Date().toISOString().split('T')[0];
}

/**
 * Final PDF for consent email: official UKB Patienteninformation with signatures on page 8.
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

  const pageCount = (await PdfLibDocument.load(official)).getPageCount();
  console.log(`[consentEmailPdf] Final PDF: ${pdfSource}, pages=${pageCount}`);
  return official;
}
