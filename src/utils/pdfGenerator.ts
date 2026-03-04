import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { Response as ResponseModel } from '../models/Response';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Convert signature (SVG or PNG/JPEG data URL) to a buffer PDFKit can embed.
 * PDFKit does not support SVG; the app sends data:image/svg+xml;base64,... so we convert to PNG.
 */
async function signatureToImageBuffer(signatureBase64: string): Promise<Buffer> {
  const isDataUrl = signatureBase64.includes(',');
  const mimeAndBase64 = signatureBase64.split(',')[0] || '';
  const base64Data = isDataUrl ? signatureBase64.split(',')[1] : signatureBase64;
  const buffer = Buffer.from(base64Data, 'base64');

  if (mimeAndBase64.includes('svg')) {
    return sharp(buffer, { density: 150 })
      .png()
      .toBuffer();
  }
  return buffer;
}

/**
 * Hardcoded labels — must match mobile app (Step1–Step7 + FormScreen q1–q10).
 * questionId → label as shown in the app.
 */
const QUESTION_LABELS: Record<string, string> = {
  // FormScreen / surveyTemplate (q1–q10)
  q1: 'Interviewee Name',
  q2: 'Contact Information',
  q3: 'Age Range',
  q4: 'Gender',
  q5: 'Topics of Interest',
  q6: 'Overall Satisfaction',
  q7: 'Additional Comments',
  q8: 'Date of Interview',
  q9: 'Location',
  q10: 'Photo (Optional)',
  // Step 1: General Information
  name: 'Name',
  email: 'Email',
  birthDate: 'Geburtsdatum (Birth Date)',
  date: 'Datum (Date)',
  // Step 2: Current Complaints
  hasChestComplaints: 'Haben Sie derzeit Beschwerden im Brustbereich?',
  painType: 'Art der Schmerzen (Type of pain)',
  painTypeOther: 'Specify other pain type',
  complaintsSince: 'Seit wann bestehen die Beschwerden? (Since when?)',
  painIntensity: 'Wie stark sind die Schmerzen (0–10)?',
  complaintsOccur: 'Treten die Beschwerden auf bei: (Complaints occur during)',
  complaintsDuration: 'Wie lange dauern die Beschwerden an? (Duration)',
  painRadiation: 'Strahlen die Schmerzen aus? (Pain radiation)',
  whatHelps: 'Was bessert die Beschwerden? (What helps?)',
  whatWorsens: 'Was verschlechtert die Beschwerden? (What worsens?)',
  // Step 3: Accompanying Symptoms
  accompanyingSymptoms: 'Begleitsymptome (Accompanying Symptoms)',
  // Step 4: Heart Valve Symptoms
  breathlessnessOnExertion: 'Haben Sie Atemnot bei körperlicher Belastung?',
  breathlessnessSince: 'Seit wann? (Since when?)',
  breathlessnessLying: 'Haben Sie Atemnot im Liegen?',
  swollenLegs: 'Haben Sie geschwollene Füße oder Beine bemerkt?',
  pulsingChest: 'Spüren Sie ein Pochen oder Klopfen im Brustkorb?',
  earNoise: 'Hören Sie ein Rauschen oder Pochen im Ohr?',
  dizzinessSyncope: 'Haben Sie Schwindel oder Bewusstseinsverluste?',
  reducedCapacity: 'Haben Sie verminderte körperliche Belastbarkeit bemerkt?',
  nightCough: 'Leiden Sie unter nächtlichem Husten?',
  palpitations: 'Haben Sie Herzklopfen oder Herzstolpern?',
  valveDisease: 'Wurde bei Ihnen bereits eine Herzklappenerkrankung festgestellt?',
  valveTypes: 'Herzklappenerkrankung (Valve types)',
  // Step 5: Pre-existing Conditions
  heartDiseases: 'Bestehen bekannte Herzerkrankungen?',
  riskFactors: 'Haben Sie folgende Erkrankungen oder Risikofaktoren?',
  // Step 6: Previous Examinations
  previousExams: 'Vorangegangene Untersuchungen / Eingriffe',
  // Step 7
  signature: 'Signature',
};

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

      // —— Signature ——
      if (signatureBuffer && signatureBuffer.length > 0) {
        doc.moveDown(0.8);
        doc.fontSize(13).fillColor('#333333').text('Signature', { underline: true });
        doc.moveDown(0.4);
        doc.fillColor('#000000');
        try {
          doc.image(signatureBuffer, {
            fit: [360, 160],
            align: 'center',
          });
        } catch (error) {
          console.warn('[PDF] doc.image(signature) failed:', (error as Error).message);
          doc.fontSize(11).text('Signature image could not be displayed');
        }
      } else if (response.signatureBase64) {
        doc.moveDown(0.8);
        doc.fontSize(13).fillColor('#333333').text('Signature', { underline: true });
        doc.moveDown(0.4);
        doc.fontSize(11).fillColor('#000000').text('Signature image could not be displayed');
      }

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

