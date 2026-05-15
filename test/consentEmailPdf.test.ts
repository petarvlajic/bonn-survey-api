import { describe, expect, it } from 'vitest';
import PDFDocument from 'pdfkit';
import { PDFDocument as PdfLibDocument } from 'pdf-lib';
import { mergePdfBuffers, parseDataUrlImageToBuffer } from '../src/utils/consentEmailPdf';
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

  it('signatureToImageBuffer converts SVG data URLs to PNG for PDFKit', async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><path d="M10 25 L90 25" stroke="black" stroke-width="2" fill="none"/></svg>`;
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    const png = await signatureToImageBuffer(dataUrl);
    expect(png).not.toBeNull();
    expect(png!.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a'); // PNG magic
  });
});
