import PDFDocument from 'pdfkit';
import { Response as ResponseModel } from '../models/Response';
import * as fs from 'fs';
import * as path from 'path';
import { echoScreeningLinesForPdf, parseEchoScreeningStored } from './shkEchoScreening';
import { signatureToImageBuffer } from './signatureImage';
import { QUESTION_LABELS } from './questionLabels';

const QUESTION_TYPE_LABELS: Record<string, string> = {
  SINGLE_CHOICE: 'Single choice',
  MULTIPLE_CHOICE: 'Multiple choice',
  TEXT: 'Text',
  NUMBER: 'Number',
  RATING: 'Rating',
  DATE: 'Date',
  IMAGE_UPLOAD: 'Image',
  FILE_UPLOAD: 'File',
  GEOLOCATION: 'Location',
  SIGNATURE: 'Signature',
};

function getQuestionLabel(questionId: string, fallbackIndex: number): string {
  return QUESTION_LABELS[questionId] || `Question ${fallbackIndex}`;
}

function formatQuestionType(type: string): string {
  return QUESTION_TYPE_LABELS[type] || type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function formatAnswerValue(answer: any): string {
  if (answer.type === 'MULTIPLE_CHOICE' && Array.isArray(answer.value)) {
    return answer.value.join(', ');
  }
  if (answer.type === 'DATE' && answer.value) {
    return new Date(answer.value).toLocaleDateString();
  }
  if (answer.value === undefined || answer.value === null) return '—';
  return String(answer.value);
}

/**
 * Generate PDF buffer from response
 */
export const generateResponsePDF = async (
  response: any,
  saveToDisk: boolean = false
): Promise<Buffer> => {
  let signatureBuffer: Buffer | null = null;
  if (response.signatureBase64) {
    try {
      signatureBuffer = await signatureToImageBuffer(response.signatureBase64);
    } catch (e) {
      console.warn('[PDF] Signature conversion failed:', (e as Error).message);
    }
  }

  let examinerSignatureBuffer: Buffer | null = null;
  const examinerRaw = response.userId?.profile?.examinerSignatureBase64;
  if (examinerRaw) {
    try {
      examinerSignatureBuffer = await signatureToImageBuffer(examinerRaw);
    } catch (e) {
      console.warn('[PDF] Examiner signature conversion failed:', (e as Error).message);
    }
  }

  return new Promise((resolve, reject) => {
    try {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 50 });

      // Collect PDF chunks
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', async () => {
        const pdfBuffer = Buffer.concat(chunks);
        
        // Save to disk if requested
        if (saveToDisk) {
          try {
            const pdfDir = path.join(process.cwd(), 'pdfs');
            
            // Create pdfs directory if it doesn't exist
            if (!fs.existsSync(pdfDir)) {
              fs.mkdirSync(pdfDir, { recursive: true });
            }

            // Save PDF file
            const filename = `response-${response._id}-${Date.now()}.pdf`;
            const filepath = path.join(pdfDir, filename);
            fs.writeFileSync(filepath, pdfBuffer);
            
            console.log(`✅ PDF saved to: ${filepath}`);
          } catch (saveError) {
            console.error('❌ Error saving PDF to disk:', saveError);
            // Don't fail the request if save fails
          }
        }
        
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // —— Header ——
      doc.fontSize(22).text('Survey Response', { align: 'center' });
      doc.moveDown(1.2);

      // —— Response details ——
      doc.fontSize(13).fillColor('#333333').text('Response details', { underline: true });
      doc.moveDown(0.4);
      doc.fontSize(11).fillColor('#000000');
      doc.text(`ID: ${response._id}`);
      const interviewerName = (response.userId as any)?.profile
        ? `${(response.userId as any).profile.firstName} ${(response.userId as any).profile.lastName}`
        : '';
      doc.text(`Interviewer: ${(response.userId as any)?.email || 'N/A'}${interviewerName ? ` (${interviewerName})` : ''}`);
      doc.text(`Status: ${response.draft ? 'Draft' : 'Completed'}`);
      doc.text(`Created: ${response.createdAt.toLocaleString()}`);
      if (response.completedAt) {
        doc.text(`Completed: ${response.completedAt.toLocaleString()}`);
      }
      doc.moveDown(1);

      // —— Interviewee ——
      if (response.intervieweeName || response.intervieweeEmail || response.intervieweePhone) {
        doc.fontSize(13).fillColor('#333333').text('Interviewee', { underline: true });
        doc.moveDown(0.4);
        doc.fontSize(11).fillColor('#000000');
        if (response.intervieweeName) doc.text(`Name: ${response.intervieweeName}`);
        if (response.intervieweeEmail) doc.text(`Email: ${response.intervieweeEmail}`);
        if (response.intervieweePhone) doc.text(`Phone: ${response.intervieweePhone}`);
        doc.moveDown(1);
      }

      // —— Patienteninformation —— (dedicated summary page per Cardio Check export)
      doc.addPage();
      doc.fontSize(16).fillColor('#1a237e').text('Patienteninformation', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#666666').text('Patient information (summary)', { align: 'center' });
      doc.moveDown(1);
      doc.fontSize(11).fillColor('#000000');
      if (response.intervieweeName) doc.text(`Name: ${response.intervieweeName}`);
      if (response.pid) doc.text(`PID: ${response.pid}`);
      if (response.birthDate) doc.text(`Geburtsdatum: ${response.birthDate}`);
      if (response.intervieweeEmail) doc.text(`E-Mail: ${response.intervieweeEmail}`);
      if (response.intervieweePhone) doc.text(`Telefon: ${response.intervieweePhone}`);
      doc.moveDown(1.2);

      // —— Answers ——
      if (response.answers && response.answers.length > 0) {
        doc.fontSize(13).fillColor('#333333').text('Answers', { underline: true });
        doc.moveDown(0.6);

        response.answers.forEach((answer: any, index: number) => {
          const label = getQuestionLabel(answer.questionId, index + 1);
          const typeLabel = formatQuestionType(answer.type);
          const valueText = formatAnswerValue(answer);
          doc.fontSize(11).fillColor('#000000');
          doc.text(`${label} — ${typeLabel}`, { continued: false });
          doc.fontSize(10).fillColor('#444444');
          doc.text(valueText || '—', { indent: 12 });
          if (answer.imageUri) doc.text(`Attachment: ${answer.imageUri}`, { indent: 12 });
          if (answer.fileUri) doc.text(`File: ${answer.fileUri}`, { indent: 12 });
          doc.moveDown(0.6);
        });
        doc.moveDown(0.3);
      }

      const echoPayload = parseEchoScreeningStored(response?.shkFollowUp?.echoScreening);
      if (echoPayload) {
        doc.addPage();
        doc.fontSize(13).fillColor('#333333').text('Echo-Screening (SHK)', { underline: true });
        doc.moveDown(0.6);
        doc.fontSize(10).fillColor('#000000');
        for (const line of echoScreeningLinesForPdf(echoPayload)) {
          doc.text(line, { paragraphGap: 2 });
        }
        doc.moveDown(0.5);
      }

      // —— Signatures ——
      doc.addPage();
      doc.fontSize(13).fillColor('#333333').text('Signatures / Unterschriften', { underline: true });
      doc.moveDown(1);
      const sigY = doc.y;
      doc.fontSize(10).fillColor('#444444').text('Patient / Patient:in', 50, sigY, { continued: false });
      doc.fontSize(10).text('Prüfperson / Investigator', 280, sigY);

      doc.y = sigY + 16;
      const rowTop = doc.y;
      if (signatureBuffer && signatureBuffer.length > 0) {
        try {
          doc.image(signatureBuffer, 50, rowTop, { fit: [200, 100] });
        } catch (error) {
          doc.fontSize(10).text('Patient signature unavailable', 50, rowTop);
          console.warn('[PDF] Patient signature embed failed:', (error as Error).message);
        }
      } else if (response.signatureBase64) {
        doc.fontSize(10).text('Patient signature could not be decoded', 50, rowTop);
      }

      if (examinerSignatureBuffer && examinerSignatureBuffer.length > 0) {
        try {
          doc.image(examinerSignatureBuffer, 280, rowTop, { fit: [200, 100] });
        } catch (error) {
          doc.fontSize(10).text('Investigator signature unavailable', 280, rowTop);
          console.warn('[PDF] Examiner signature embed failed:', (error as Error).message);
        }
      }

      doc.y = rowTop + 110;

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Get PDF file path if it exists on disk
 */
export const getPDFPath = (responseId: string): string | null => {
  const pdfDir = path.join(process.cwd(), 'pdfs');
  if (!fs.existsSync(pdfDir)) {
    return null;
  }

  // Find PDF file for this response (may have timestamp)
  const files = fs.readdirSync(pdfDir);
  const pdfFile = files.find(file => 
    file.startsWith(`response-${responseId}-`) && file.endsWith('.pdf')
  );

  if (pdfFile) {
    return path.join(pdfDir, pdfFile);
  }

  return null;
};

/**
 * Delete PDF file from disk
 */
export const deletePDF = (responseId: string): boolean => {
  const pdfPath = getPDFPath(responseId);
  if (pdfPath && fs.existsSync(pdfPath)) {
    try {
      fs.unlinkSync(pdfPath);
      console.log(`✅ PDF deleted: ${pdfPath}`);
      return true;
    } catch (error) {
      console.error('❌ Error deleting PDF:', error);
      return false;
    }
  }
  return false;
};

