import { describe, expect, it } from 'vitest';
import PDFDocument from 'pdfkit';
import { PDFDocument as PdfLibDocument } from 'pdf-lib';
import {
  buildFinalConsentEmailPdf,
  consentDiscussionForPdfStamp,
  consentIntroPageIndex,
  consentSignaturePageIndex,
  mergePdfBuffers,
  parseDataUrlImageToBuffer,
  stampSignaturesOnOfficialPdf,
} from '../src/utils/consentEmailPdf';
import { buildPatientQuestionnairePdf } from '../src/utils/patientQuestionnairePdf';
import fs from 'fs';
import path from 'path';
import { signatureToImageBuffer } from '../src/utils/signatureImage';
import { execSync } from 'child_process';

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
  it('consentDiscussionForPdfStamp treats „Keine“ as empty', () => {
    expect(consentDiscussionForPdfStamp('Keine')).toBe('');
    expect(consentDiscussionForPdfStamp('  keine  ')).toBe('');
    expect(consentDiscussionForPdfStamp('')).toBe('');
    expect(consentDiscussionForPdfStamp('Freiwilligkeit erläutert')).toBe(
      'Freiwilligkeit erläutert'
    );
  });

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

  it('buildPatientQuestionnairePdf produces at least one page with answers', async () => {
    const pdf = await buildPatientQuestionnairePdf({
      intervieweeName: 'Max Mustermann',
      birthDate: '01.01.1990',
      answers: [
        { questionId: 'name', value: 'Max Mustermann' },
        { questionId: 'hasChestComplaints', value: 'Ja' },
        { questionId: 'signature', value: 'data:image/png;base64,abc' },
      ],
    });
    const doc = await PdfLibDocument.load(pdf);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('buildFinalConsentEmailPdf appends patient questionnaire after consent document', async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><path d="M10 40 L190 40" stroke="black" stroke-width="3" fill="none"/></svg>`;
    const sig = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    const bundled = path.join(
      process.cwd(),
      'assets/consent/patienteninformation-einwilligung-erwachsene.pdf'
    );
    if (!fs.existsSync(bundled)) return;

    const withoutAppendix = await buildFinalConsentEmailPdf({
      intervieweeName: 'Test Test',
      signatureBase64: sig,
      answers: [],
    });
    const withAppendix = await buildFinalConsentEmailPdf({
      intervieweeName: 'Test Test',
      signatureBase64: sig,
      answers: [
        { questionId: 'name', value: 'Test Test' },
        { questionId: 'hasChestComplaints', value: 'Nein' },
        { questionId: 'consentExplainedBy', value: 'Examiner' },
      ],
    });
    expect(withoutAppendix).not.toBeNull();
    expect(withAppendix).not.toBeNull();
    const pagesWithout = (await PdfLibDocument.load(withoutAppendix!)).getPageCount();
    const pagesWith = (await PdfLibDocument.load(withAppendix!)).getPageCount();
    expect(pagesWith).toBeGreaterThan(pagesWithout);
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

  it('buildFinalConsentEmailPdf includes correct Datenschutzbeauftragter contact info (Dominik Nelles)', async () => {
    const bundled = path.join(
      process.cwd(),
      'assets/consent/patienteninformation-einwilligung-erwachsene.pdf'
    );
    if (!fs.existsSync(bundled)) return;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><path d="M10 40 L190 40" stroke="black" stroke-width="3" fill="none"/></svg>`;
    const sig = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

    const pdf = await buildFinalConsentEmailPdf({
      intervieweeName: 'Stefan Popovic',
      birthDate: '1985-03-15',
      signatureBase64: sig,
      pid: 'PID-2026-001',
      answers: [
        { questionId: 'consentExplainedBy', value: 'Dr. med. Dominik Nelles' },
        { questionId: 'consentDiscussionPoints', value: 'Freiwilligkeit erläutert' },
        { questionId: 'date', value: '2026-08-24' },
      ],
    });

    expect(pdf).not.toBeNull();
    expect(pdf!.length).toBeGreaterThan(50000); // PDF should be substantial

    // Save to temp file and extract text with pdftotext
    const tmpFile = path.join(process.cwd(), '.test-pdf-tmp.pdf');
    fs.writeFileSync(tmpFile, pdf!);

    try {
      // Extract text using pdftotext (available on system)
      const pdfText = execSync(`pdftotext "${tmpFile}" -`, { encoding: 'utf-8' }).toLowerCase();

      // Check for new Datenschutzbeauftragter contact
      expect(pdfText).toContain('dominik');
      expect(pdfText).toContain('nelles');
      expect(pdfText).toContain('dominik.nelles@ukbonn.de');

      // Should NOT contain old email anymore
      expect(pdfText).not.toContain('achim.flender@ukb.uni-bonn.de');
    } finally {
      // Clean up temp file
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    }

    // Verify page structure is intact
    const doc = await PdfLibDocument.load(pdf!);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(6);
  });

  it('generates PDF with IMAGE_UPLOAD answers embedded as actual images (not base64 text)', async () => {
    // Create a minimal 1x1 PNG image as base64
    const minimalPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const imageDataUrl = `data:image/jpeg;base64,${minimalPng}`;

    // Create a mock response with image answers
    const mockResponse = {
      _id: 'test-response-123',
      intervieweeName: 'Test User',
      intervieweeEmail: 'test@example.com',
      intervieweePhone: '123456789',
      draft: false,
      createdAt: new Date(),
      completedAt: new Date(),
      userId: { email: 'examiner@example.com', profile: {} },
      signatureBase64: null,
      answers: [
        {
          questionId: 'generalInfo_name',
          type: 'TEXT',
          value: 'Test User',
        },
        {
          questionId: 'echoPhotos_1',
          type: 'IMAGE_UPLOAD',
          imageUri: imageDataUrl,
          value: 'Echo Photo 1',
        },
      ],
    };

    // Import generateResponsePDF
    const { generateResponsePDF } = await import('../src/utils/pdfGenerator');

    // Generate PDF
    const pdfBuffer = await generateResponsePDF(mockResponse, false);

    // Verify PDF is generated with valid PDF structure
    expect(pdfBuffer).not.toBeNull();
    expect(pdfBuffer!.length).toBeGreaterThan(2000);
    expect(pdfBuffer![0]).toBe(0x25); // PDF magic: %
    expect(pdfBuffer![1]).toBe(0x50); // P
    expect(pdfBuffer![2]).toBe(0x44); // D
    expect(pdfBuffer![3]).toBe(0x46); // F

    // Save and extract text to verify image is embedded (not shown as base64)
    const tmpFile = path.join(process.cwd(), '.test-pdf-image-tmp.pdf');
    fs.writeFileSync(tmpFile, pdfBuffer!);

    try {
      // Extract text - should NOT show the long base64 string as text
      const pdfText = execSync(`pdftotext "${tmpFile}" -`, { encoding: 'utf-8' });

      // Should contain question or image indicator (PDF shows images with placeholder text)
      expect(pdfText.toLowerCase()).toMatch(/image|foto|anhang/);
      // Should NOT contain the massive base64 data displayed as text
      expect(pdfText.length).toBeLessThan(5000); // Text extract should be much smaller than image data

      // The long base64 string should not appear in extracted text (image is embedded, not text)
      expect(pdfText).not.toContain(minimalPng);
    } finally {
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    }
  });
});
