const { generateResponsePDF } = require('./dist/utils/pdfGenerator');
const fs = require('fs');

async function test() {
  try {
    console.log('🧪 Testing Response PDF with REAL image...\n');
    
    // Create a small test image (1x1 PNG for testing)
    const minimalPng = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
      0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xF8, 0x0F, 0x00, 0x00,
      0x01, 0x01, 0x00, 0x01, 0x18, 0xDD, 0x8D, 0xB4, 0x00, 0x00, 0x00, 0x00,
      0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    const base64Image = 'data:image/png;base64,' + minimalPng.toString('base64');
    
    // Create test response with IMAGE_UPLOAD answer
    const testResponse = {
      _id: 'test-img-123',
      draft: false,
      status: 'completed',
      createdAt: new Date('2026-08-31'),
      completedAt: new Date('2026-08-31'),
      intervieweeName: 'Stefan Popovic',
      intervieweeEmail: 'stefan@test.de',
      intervieweePhone: '0228-123456',
      intervieweeAddress: 'Bonn, Germany',
      pid: 'PID-123',
      birthDate: '1985-05-15',
      userId: {
        email: 'doctor@ukbonn.de',
        profile: {
          firstName: 'Dr.',
          lastName: 'Weber'
        }
      },
      answers: [
        {
          questionId: 'testImage',
          type: 'IMAGE_UPLOAD',
          imageUri: base64Image
        },
        {
          questionId: 'hasChestComplaints',
          type: 'SINGLE_CHOICE',
          value: 'Yes'
        }
      ]
    };
    
    const pdfBuffer = await generateResponsePDF(testResponse, false);
    console.log(`✓ PDF generated: ${pdfBuffer.length} bytes`);
    
    fs.writeFileSync('./response-with-image.pdf', pdfBuffer);
    console.log('✓ Saved: ./response-with-image.pdf');
    
    // Extract text to verify structure
    const { spawn } = require('child_process');
    const pdftotext = spawn('pdftotext', ['./response-with-image.pdf', '-']);
    let textOutput = '';
    
    pdftotext.stdout.on('data', (data) => {
      textOutput += data.toString();
    });
    
    pdftotext.on('close', (code) => {
      if (code === 0) {
        console.log('\n📝 PDF Content preview:');
        console.log(textOutput.split('\n').slice(0, 30).join('\n'));
      }
      process.exit(0);
    });
    
    pdftotext.on('error', () => {
      console.log('(pdftotext not available, but PDF was generated)');
      process.exit(0);
    });
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

test();
