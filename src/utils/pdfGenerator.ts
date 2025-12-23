import PDFDocument from 'pdfkit';
import { Response as ResponseModel } from '../models/Response';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Generate PDF buffer from response
 */
export const generateResponsePDF = async (
  response: any,
  saveToDisk: boolean = false
): Promise<Buffer> => {
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

      // Header
      doc.fontSize(20).text('Survey Response', { align: 'center' });
      doc.moveDown();

      // Response details
      doc.fontSize(14).text('Response Details', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      doc.text(`ID: ${response._id}`);
      doc.text(
        `Interviewer: ${(response.userId as any)?.email || 'N/A'} ${
          (response.userId as any)?.profile
            ? `(${(response.userId as any).profile.firstName} ${(response.userId as any).profile.lastName})`
            : ''
        }`
      );
      doc.text(`Status: ${response.draft ? 'Draft' : 'Completed'}`);
      doc.text(`Created At: ${response.createdAt.toLocaleString()}`);
      if (response.completedAt) {
        doc.text(`Completed At: ${response.completedAt.toLocaleString()}`);
      }
      doc.moveDown();

      // Interviewee information
      if (response.intervieweeName || response.intervieweeEmail || response.intervieweePhone) {
        doc.fontSize(14).text('Interviewee Information', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12);
        if (response.intervieweeName) doc.text(`Name: ${response.intervieweeName}`);
        if (response.intervieweeEmail) doc.text(`Email: ${response.intervieweeEmail}`);
        if (response.intervieweePhone) doc.text(`Phone: ${response.intervieweePhone}`);
        doc.moveDown();
      }

      // Answers
      if (response.answers && response.answers.length > 0) {
        doc.fontSize(14).text('Answers', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12);

        response.answers.forEach((answer: any, index: number) => {
          doc.text(`Question ${index + 1}:`, { continued: false });
          doc.text(`Type: ${answer.type}`);
          
          // Format value based on type
          let valueText = '';
          if (answer.type === 'MULTIPLE_CHOICE' && Array.isArray(answer.value)) {
            valueText = answer.value.join(', ');
          } else if (answer.type === 'SINGLE_CHOICE' || answer.type === 'TEXT') {
            valueText = String(answer.value || '');
          } else if (answer.type === 'NUMBER' || answer.type === 'RATING') {
            valueText = String(answer.value || '');
          } else if (answer.type === 'DATE') {
            valueText = answer.value ? new Date(answer.value).toLocaleDateString() : '';
          } else {
            valueText = JSON.stringify(answer.value || '');
          }
          
          doc.text(`Value: ${valueText}`);
          if (answer.imageUri) doc.text(`Image: ${answer.imageUri}`);
          if (answer.fileUri) doc.text(`File: ${answer.fileUri}`);
          doc.moveDown(0.5);
        });
      }

      // Signature
      if (response.signatureBase64) {
        doc.moveDown();
        doc.fontSize(14).text('Signature', { underline: true });
        doc.moveDown(0.5);
        try {
          // Handle different base64 formats
          let imageData = response.signatureBase64;
          if (imageData.includes(',')) {
            imageData = imageData.split(',')[1];
          }
          const imageBuffer = Buffer.from(imageData, 'base64');
          doc.image(imageBuffer, {
            fit: [400, 200],
            align: 'center',
          });
        } catch (error) {
          doc.text('Signature image could not be displayed');
        }
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

