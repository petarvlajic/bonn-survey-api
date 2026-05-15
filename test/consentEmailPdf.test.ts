import { describe, expect, it } from 'vitest';
import PDFDocument from 'pdfkit';
import { PDFDocument as PdfLibDocument } from 'pdf-lib';
import { mergePdfBuffers, parseDataUrlImageToBuffer } from '../src/utils/consentEmailPdf';

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
});
