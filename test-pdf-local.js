#!/usr/bin/env node

const { buildConsentPdfBuffer } = require('./dist/utils/consentPatientDocument');
const { generateResponsePDF } = require('./dist/utils/pdfGenerator');
const fs = require('fs');
const path = require('path');

async function generateTestPDFs() {
  try {
    const outputDir = path.join(__dirname, 'test-output');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('🧪 LOKALNI TEST PDF GENERISANJA\n');
    console.log(`📁 Output folder: ${outputDir}\n`);

    // Test 1: Consent PDF
    console.log('1️⃣  Generiše CONSENT PDF...');
    try {
      const consentResult = await buildConsentPdfBuffer('Petar Vlajic', '2026-09-02');
      const consentPath = path.join(outputDir, 'test-consent.pdf');
      fs.writeFileSync(consentPath, consentResult.buffer);
      console.log(`   ✅ Source: ${consentResult.source}`);
      console.log(`   📄 Saved: ${consentPath}\n`);
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}\n`);
    }

    // Test 2: Response PDF
    console.log('2️⃣  Generiše RESPONSE PDF...');
    try {
      // Mock signature (simple SVG-generated PNG)
      const mockSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAABkCAYAAACW/C5zAAAAN0lEQVR4nO3BMQEAAADCoPVPbQhfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAOA1v9QAATX68/0AAAAASUVORK5CYII=';

      const testResponse = {
        _id: 'local-test-123',
        draft: false,
        status: 'completed',
        createdAt: new Date('2026-09-02'),
        completedAt: new Date('2026-09-02'),
        intervieweeName: 'Petar Vlajic',
        intervieweeEmail: 'petar@test.de',
        intervieweePhone: '+49 228 287 16075',
        intervieweeAddress: 'Bonn, Germany',
        pid: 'PID-TEST-001',
        birthDate: '1990-03-15',
        signatureBase64: mockSignature,
        userId: {
          email: 'examiner@ukbonn.de',
          profile: {
            firstName: 'Dr.',
            lastName: 'Mueller',
            examinerSignatureBase64: mockSignature
          }
        },
        answers: [
          {
            questionId: 'q1',
            type: 'TEXT',
            value: 'Test answer 1'
          },
          {
            questionId: 'q2',
            type: 'SINGLE_CHOICE',
            value: 'Yes'
          }
        ]
      };

      const responsePdf = await generateResponsePDF(testResponse, false);
      const responsePath = path.join(outputDir, 'test-response.pdf');
      fs.writeFileSync(responsePath, responsePdf);
      console.log(`   📄 Saved: ${responsePath}\n`);
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}\n`);
    }

    console.log('✅ LOKALNI TESTOVI GOTOVI!');
    console.log('');
    console.log('📖 Otvori PDF fajlove iz test-output/ foldera da vidis output');
    console.log('');
    console.log('💡 Savjet: Koristi "npm run test:pdf" da ponavljas testove');

  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  }
}

generateTestPDFs();
