import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { PDFDocument as PdfLibDocument } from 'pdf-lib';
import { buildConsentPdfBuffer, formatConsentBannerDate } from './consentPatientDocument';

export interface ResponseLikeForConsentPdf {
  intervieweeName?: string;
  birthDate?: string;
  completedAt?: Date;
  signatureBase64?: string;
  /** Populated user doc with `profile.examinerSignatureBase64`, or an ObjectId before populate. */
  userId?: unknown;
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

function dataUrlMime(input: string): string | null {
  const m = /^data:([^;,]+)/i.exec(input.trim());
  return m ? m[1].toLowerCase() : null;
}

/**
 * PDFKit only embeds PNG/JPEG. App signatures are SVG (`data:image/svg+xml;base64,...`).
 */
export async function imageBufferForPdfEmbedding(
  input: string | undefined | null
): Promise<Buffer | null> {
  const raw = parseDataUrlImageToBuffer(input);
  if (!raw) return null;

  const mime = typeof input === 'string' ? dataUrlMime(input) : null;
  const looksLikeSvg =
    mime === 'image/svg+xml' ||
    (raw.length > 4 && raw.subarray(0, 5).toString('utf8').trimStart().startsWith('<'));

  try {
    if (looksLikeSvg) {
      return await sharp(raw, { density: 150 }).png().toBuffer();
    }
    return await sharp(raw).png().toBuffer();
  } catch (e) {
    console.warn('[consentEmailPdf] imageBufferForPdfEmbedding failed:', (e as Error).message);
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
 * Final PDF for consent email: signature cover (participant + examiner) first,
 * then the official Patienteninformation / Einwilligung document from server assets (DOCX→PDF pipeline).
 * Does not use the client-generated “template” PDF.
 */
export async function buildFinalConsentEmailPdf(doc: ResponseLikeForConsentPdf): Promise<Buffer | null> {
  const name = (doc.intervieweeName || '').trim();
  const rawDate =
    doc.birthDate && String(doc.birthDate).trim()
      ? String(doc.birthDate).trim()
      : doc.completedAt
        ? doc.completedAt.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
  const dateLabel = formatConsentBannerDate(rawDate);

  let official: Buffer;
  let pdfSource: string;
  try {
    const built = await buildConsentPdfBuffer(name, rawDate);
    official = built.buffer;
    pdfSource = built.source;
    console.log(`[consentEmailPdf] Official document source: ${pdfSource}`);
  } catch (e) {
    console.error('[consentEmailPdf] Failed to build official consent PDF:', (e as Error).message);
    return null;
  }

  const examinerProfile =
    doc.userId &&
    typeof doc.userId === 'object' &&
    doc.userId !== null &&
    'profile' in doc.userId
      ? (doc.userId as { profile?: { examinerSignatureBase64?: string } }).profile
      : undefined;

  const [participantSig, examinerSig] = await Promise.all([
    imageBufferForPdfEmbedding(doc.signatureBase64),
    imageBufferForPdfEmbedding(examinerProfile?.examinerSignatureBase64),
  ]);

  try {
    const cover = await buildConsentSignaturesCoverPdf({
      intervieweeName: name,
      dateLabel,
      participantSignature: participantSig,
      examinerSignature: examinerSig,
    });
    const merged = await mergePdfBuffers(cover, official);
    console.log(
      `[consentEmailPdf] Merged PDF: cover + ${pdfSource}, pages≈${(await PdfLibDocument.load(merged)).getPageCount()}`
    );
    return merged;
  } catch (e) {
    console.error(
      '[consentEmailPdf] Failed to merge cover + official, falling back to official only:',
      (e as Error).message
    );
    return official;
  }
}
