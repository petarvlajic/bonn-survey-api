const { generateResponsePDF } = require('./dist/utils/pdfGenerator');
const fs = require('fs');

async function test() {
  try {
    console.log('🧪 Testing Response PDF with Image...\n');
    
    // Create test response with image
    const testResponse = {
      _id: 'test-123',
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
          questionId: 'hasChestComplaints',
          type: 'SINGLE_CHOICE',
          value: 'Yes'
        },
        {
          questionId: 'painIntensity',
          type: 'RATING',
          value: 5
        },
        {
          questionId: 'signature',
          type: 'SIGNATURE',
          imageUri: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjUwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IGZpbGw9IiNmZmYiIHdpZHRoPSIyMDAiIGhlaWdodD0iNTAiLz48dGV4dCB4PSI1MCIgeT0iMzAiIGZvbnQtc2l6ZT0iMjAiPkpvaG4gRG9lPC90ZXh0Pjwvc3ZnPg=='
        }
      ]
    };
    
    const pdfBuffer = await generateResponsePDF(testResponse, false);
    console.log(`✓ PDF generated: ${pdfBuffer.length} bytes`);
    
    fs.writeFileSync('./response-test.pdf', pdfBuffer);
    console.log('✓ Saved: ./response-test.pdf');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

test();
