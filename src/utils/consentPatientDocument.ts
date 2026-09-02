import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import PDFDocument from 'pdfkit';
import { PDFDocument as PdfLibDocument } from 'pdf-lib';

export const CONSENT_DOC_BASENAME = 'patienteninformation-einwilligung-erwachsene';

/** Optional extra pages (e.g. missing chapter from Word export). Drop as `…-appendix.pdf` next to main PDF. */
export function consentAppendixPdfPath(): string {
  return path.join(consentAssetDir(), `${CONSENT_DOC_BASENAME}-appendix.pdf`);
}

async function mergeConsentAppendixIfPresent(mainPdf: Buffer): Promise<Buffer> {
  const appendixPath = consentAppendixPdfPath();
  if (!fs.existsSync(appendixPath)) {
    return mainPdf;
  }
  try {
    const merged = await PdfLibDocument.create();
    const mainDoc = await PdfLibDocument.load(mainPdf);
    const appendixDoc = await PdfLibDocument.load(fs.readFileSync(appendixPath));
    const mainCopied = await merged.copyPages(mainDoc, mainDoc.getPageIndices());
    mainCopied.forEach((p) => merged.addPage(p));
    const appendixCopied = await merged.copyPages(appendixDoc, appendixDoc.getPageIndices());
    appendixCopied.forEach((p) => merged.addPage(p));
    return Buffer.from(await merged.save());
  } catch (err) {
    console.warn('[consent] Failed to merge appendix PDF; using main document only.', err);
    return mainPdf;
  }
}

export class ConsentDocxMissingError extends Error {
  constructor(message = 'Consent DOCX asset not found') {
    super(message);
    this.name = 'ConsentDocxMissingError';
  }
}

/** Stable path regardless of pm2 `cwd` (dist/utils → project root/assets/consent). */
function consentAssetDir(): string {
  return path.resolve(__dirname, '..', '..', 'assets', 'consent');
}

export function consentDocxPath(): string {
  return path.join(consentAssetDir(), `${CONSENT_DOC_BASENAME}.docx`);
}

export function consentBundledPdfPath(): string {
  return path.join(consentAssetDir(), `${CONSENT_DOC_BASENAME}.pdf`);
}

export function formatConsentBannerDate(dateInput: string | undefined): string {
  const raw = (dateInput || '').trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) {
    const [, y, m, d] = iso;
    return `${d}.${m}.${y}`;
  }
  return raw || new Date().toISOString().split('T')[0];
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let cacheMtimeMs = -1;
let cachedHtmlBody = '';
let cachedRawText = '';

async function refreshDocxCache(): Promise<void> {
  const docxPath = consentDocxPath();
  if (!fs.existsSync(docxPath)) {
    throw new ConsentDocxMissingError();
  }
  const stat = fs.statSync(docxPath);
  if (stat.mtimeMs === cacheMtimeMs && cachedHtmlBody && cachedRawText) {
    return;
  }
  const buffer = fs.readFileSync(docxPath);
  const [htmlResult, textResult] = await Promise.all([
    mammoth.convertToHtml({ buffer }),
    mammoth.extractRawText({ buffer }),
  ]);
  cachedHtmlBody = htmlResult.value;
  cachedRawText = textResult.value.trim();
  cacheMtimeMs = stat.mtimeMs;
}

export async function buildConsentHtmlDocument(name: string, dateISOOrDisplay: string): Promise<string> {
  await refreshDocxCache();
  const dateShown = formatConsentBannerDate(dateISOOrDisplay);
  const nameSafe = escapeHtml(name.trim());
  const dateSafe = escapeHtml(dateShown);
  const banner = `<div class="banner">
<p><strong>Ort, Datum:</strong> Bonn, ${dateSafe}</p>
<p><strong>Name der teilnehmenden Person:</strong> ${nameSafe || '______________________________'}</p>
</div>`;
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  body{margin:0;padding:14px 16px 36px;color:#111;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.48;-webkit-text-size-adjust:100%;}
  .banner{margin-bottom:14px;padding:12px;border:2px solid #000;background:#fafafa;}
  .banner p{margin:0 0 8px;font-size:15px;}
  .doc{font-size:15px;line-height:1.48;color:#111;}
  .doc p{margin:0 0 10px;}
  .doc ul,.doc ol{margin:0 0 10px;padding-left:1.35rem;}
  .doc li{margin-bottom:4px;}
  .doc strong{font-weight:700;}
  .doc table{border-collapse:collapse;width:100%;margin:12px 0;font-size:14px;}
  .doc td,.doc th{border:1px solid #ccc;padding:6px;text-align:left;vertical-align:top;}
  .footnote{margin-top:22px;padding-top:12px;border-top:1px solid #ddd;font-size:12px;line-height:1.45;color:#555;}
</style>
</head>
<body>
${banner}
<div class="doc">${cachedHtmlBody}</div>
<p class="footnote">Hinweis: Sollte eine Druckversion Seiten fehlen, wenden Sie sich bitte an die Studienstelle. Für den PDF-E-Mail-Versand kann auf dem Server optional eine Zusatzdatei <code>${CONSENT_DOC_BASENAME}-appendix.pdf</code> angehängt werden.</p>
</body>
</html>`;
}

function renderLegacyConsentPdfBuffer(name: string, dateShown: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text('Patientinformation und Einwilligung', { underline: true });
    doc.moveDown(0.7);
    doc.fontSize(11).text('Herz Check Bonn');
    doc.moveDown();
    doc
      .fontSize(10)
      .text(
        'Dieses Dokument informiert uber die freiwillige Teilnahme am Screeningprojekt. ' +
          'Die Teilnahme ersetzt keine arztliche Diagnostik oder Behandlung. ' +
          'Gesundheitsdaten werden nur fur die Projektdurchfuhrung, Dokumentation und anonymisierte Auswertung verarbeitet.'
      );
    doc.moveDown(0.8);
    doc
      .fontSize(10)
      .text(
        'Sie konnen Ihre Einwilligung jederzeit fur die Zukunft widerrufen. ' +
          'Bei Fragen wenden Sie sich bitte an das Herz Check Bonn Team.'
      );
    doc.moveDown(1.2);

    doc.fontSize(10).text(`Name (Druckbuchstaben): ${name || '__________________________'}`);
    doc.moveDown(0.6);
    doc.text(`Datum: ${dateShown}`);
    doc.moveDown(1.2);
    doc.text('Unterschrift teilnehmende Person: __________________________');
    doc.moveDown(1.2);
    doc.text('Unterschrift aufklarende Person: __________________________');

    doc.end();
  });
}

export async function buildConsentPdfBuffer(
  name: string,
  dateISOOrDisplay: string
): Promise<{ buffer: Buffer; source: 'bundled-pdf' | 'docx-text' | 'legacy-placeholder' }> {
  const bundled = consentBundledPdfPath();
  if (fs.existsSync(bundled)) {
    const merged = await mergeConsentAppendixIfPresent(fs.readFileSync(bundled));
    console.log(`[consent] Using bundled official PDF: ${bundled} (${merged.length} bytes)`);
    return { buffer: merged, source: 'bundled-pdf' };
  }
  console.warn(`[consent] Bundled PDF not found at ${bundled}; falling back to DOCX text export`);

  const dateShown = formatConsentBannerDate(dateISOOrDisplay);
  try {
    await refreshDocxCache();
  } catch (e) {
    if (e instanceof ConsentDocxMissingError) {
      const buffer = await mergeConsentAppendixIfPresent(await renderLegacyConsentPdfBuffer(name, dateShown));
      return { buffer, source: 'legacy-placeholder' };
    }
    throw e;
  }

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(10).text(`Name (Druckbuchstaben): ${name || '__________________________'}`);
    doc.moveDown(0.5);
    doc.text(`Datum: ${dateShown}`);
    doc.moveDown(0.8);

    // Split raw text by line breaks and render each line separately to preserve formatting
    const lines = cachedRawText.split('\n').map(line => line.trim()).filter(line => line);
    doc.fontSize(10);
    lines.forEach((line, idx) => {
      doc.text(line, { width: 504, align: 'left' });
      if (idx < lines.length - 1) {
        doc.moveDown(0.15);
      }
    });

    doc.end();
  });

  const merged = await mergeConsentAppendixIfPresent(buffer);
  return { buffer: merged, source: 'docx-text' };
}