import { describe, expect, it } from 'vitest';
import PDFDocument from 'pdfkit';
import { PDFDocument as PdfLibDocument } from 'pdf-lib';
import {
  buildFinalConsentEmailPdf,
  consentIntroPageIndex,
  consentSignaturePageIndex,
  mergePdfBuffers,
  parseDataUrlImageToBuffer,
  stampSignaturesOnOfficialPdf,
} from '../src/utils/consentEmailPdf';
import fs from 'fs';
import path from 'path';
import { signatureToImageBuffer } from '../src/utils/signatureImage';

async function onePagePdf(label: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(12).text(label);
    doc.end();
  });
}

describe('consentEmailPdf', () => {
  it('mergePdfBuffers appends all pages from both inputs', async () => {
    const front = await onePagePdf('cover');
    const back = await onePagePdf('official');
    const merged = await mergePdfBuffers(front, back);
    const doc = await PdfLibDocument.load(merged);
    expect(doc.getPageCount()).toBe(2);
  });

  it('parseDataUrlImageToBuffer accepts data URLs and raw base64', () => {
    const b64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const fromDataUrl = parseDataUrlImageToBuffer(`data:image/png;base64,${b64}`);
    expect(fromDataUrl).not.toBeNull();
    expect(fromDataUrl!.length).toBeGreaterThan(20);
    expect(parseDataUrlImageToBuffer(b64)).toEqual(fromDataUrl);
    expect(parseDataUrlImageToBuffer('')).toBeNull();
  });

  it('consent page indices: 8-page PDF narrative on page 7, signatures on page 8', () => {
    expect(consentIntroPageIndex(8)).toBe(6);
    expect(consentSignaturePageIndex(8)).toBe(7);
    expect(consentIntroPageIndex(9)).toBe(0);
    expect(consentSignaturePageIndex(9)).toBe(7);
    expect(consentSignaturePageIndex(1)).toBe(0);
  });

  it('stampSignaturesOnOfficialPdf keeps all pages and stamps signature page', async () => {
    const bundled = path.join(
      process.cwd(),
      'assets/consent/patienteninformation-einwilligung-erwachsene.pdf'
    );
    if (!fs.existsSync(bundled)) return;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><path d="M10 40 L190 40" stroke="black" stroke-width="3" fill="none"/></svg>`;
    const sig = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    const participantSig = await signatureToImageBuffer(sig);
    const official = fs.readFileSync(bundled);
    const stamped = await stampSignaturesOnOfficialPdf(official, {
      participantSignature: participantSig,
      examinerSignature: participantSig,
      intervieweeName: 'Test Test',
      examinerName: 'Petar Vlajic',
      dateLabel: '15.05.2026',
    });
    const doc = await PdfLibDocument.load(stamped);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(6);
  });

  it('buildFinalConsentEmailPdf stamps official document with embedded SVG signatures', async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><path d="M10 40 L190 40" stroke="black" stroke-width="3" fill="none"/></svg>`;
    const sig = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    const bundled = path.join(
      process.cwd(),
      'assets/consent/patienteninformation-einwilligung-erwachsene.pdf'
    );
    if (!fs.existsSync(bundled)) return;

    const pdf = await buildFinalConsentEmailPdf(
      {
        intervieweeName: 'Test Test',
        birthDate: '2000-01-01',
        signatureBase64: sig,
        answers: [
          { questionId: 'consentExplainedBy', value: 'Examiner' },
          { questionId: 'consentDiscussionPoints', value: 'Discussion points test' },
        ],
      },
      { examinerSignatureBase64: sig }
    );
    expect(pdf).not.toBeNull();
    const doc = await PdfLibDocument.load(pdf!);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(6);
  });

  it('signatureToImageBuffer converts SVG data URLs to PNG for PDFKit', async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><path d="M10 25 L90 25" stroke="black" stroke-width="2" fill="none"/></svg>`;
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    const png = await signatureToImageBuffer(dataUrl);
    expect(png).not.toBeNull();
    expect(png!.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a'); // PNG magic
  });
});
