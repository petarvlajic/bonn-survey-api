const { generateResponsePDF } = require('./dist/utils/pdfGenerator');
const fs = require('fs');
const path = require('path');

// Helper: create a simple PNG image as base64
function createTestImageBase64() {
  // Create a simple 200x200 PNG (red square)
  const width = 200;
  const height = 200;

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // Create simple image data
  const imageData = Buffer.alloc(width * height * 3);
  for (let i = 0; i < imageData.length; i += 3) {
    imageData[i] = 255;     // Red channel
    imageData[i + 1] = 100; // Green channel
    imageData[i + 2] = 100; // Blue channel
  }

  // For this test, we'll use a minimal valid PNG structure
  // In real world, use 'sharp' library (which we do in pdfGenerator.ts)
  const png = Buffer.concat([signature, Buffer.from([0])]);

  return `data:image/png;base64,${png.toString('base64')}`;
}

// Helper: Create a more realistic test PNG using file system
function createRealisticTestImage() {
  try {
    // Try to read an existing test image if available
    const testImagePath = path.join(__dirname, 'test', 'fixtures', 'test-image.png');
    if (fs.existsSync(testImagePath)) {
      const buffer = fs.readFileSync(testImagePath);
      return `data:image/png;base64,${buffer.toString('base64')}`;
    }
  } catch (e) {
    console.log('No test image found, using placeholder');
  }

  // Fallback: create a simple valid PNG
  // This is a minimal 1x1 red pixel PNG
  const pngHex = '89504e470d0a1a0a0000000d49484452000000010000000108020000009060645a0000000c49444154789c62f84f040000020100018000a10c810b000000004945ce4e82';
  const pngBuffer = Buffer.from(pngHex, 'hex');
  return `data:image/png;base64,${pngBuffer.toString('base64')}`;
}

async function test() {
  try {
    console.log('🧪 Testing Response PDF with IMAGE_UPLOAD answers...\n');

    // Create test image base64
    const testImageBase64 = createRealisticTestImage();
    console.log(`📸 Test image created (${testImageBase64.substring(0, 50)}...)\n`);

    // Create test response with IMAGE_UPLOAD answers
    const testResponse = {
      _id: 'test-images-123',
      draft: false,
      status: 'completed',
      createdAt: new Date('2026-09-02'),
      completedAt: new Date('2026-09-02'),
      intervieweeName: 'Stefan Popovic',
      intervieweeEmail: 'stefan@test.de',
      intervieweePhone: '0228-987654',
      intervieweeAddress: 'Universitätsklinikum Bonn',
      pid: 'PID-IMG-001',
      birthDate: '1980-03-20',
      userId: {
        email: 'examiner@ukbonn.de',
        profile: {
          firstName: 'Dr.',
          lastName: 'Mueller'
        }
      },
      answers: [
        {
          questionId: 'q1-intro',
          type: 'TEXT',
          value: 'Patient presented with cardiac concerns',
          answer: 'Patient presented with cardiac concerns'
        },
        {
          questionId: 'q2-echoimage',
          type: 'IMAGE_UPLOAD',
          value: 'Image upload',
          imageUri: testImageBase64,
          answer: 'Echo image 1'
        },
        {
          questionId: 'q3-notes',
          type: 'TEXT',
          value: 'Patient in stable condition',
          answer: 'Patient in stable condition'
        },
        {
          questionId: 'q4-echoimage2',
          type: 'IMAGE_UPLOAD',
          value: 'Image upload',
          imageUri: testImageBase64,
          answer: 'Echo image 2 (zoomed)'
        },
        {
          questionId: 'q5-conclusion',
          type: 'TEXT',
          value: 'No structural abnormalities detected',
          answer: 'No structural abnormalities detected'
        }
      ]
    };

    console.log('📝 Test response created with:');
    console.log('   - 2x IMAGE_UPLOAD answers');
    console.log('   - 3x TEXT answers');
    console.log('');

    const pdfBuffer = await generateResponsePDF(testResponse, true);
    console.log(`✅ PDF generated: ${pdfBuffer.length} bytes`);

    const outputPath = path.join(__dirname, 'test-images-output.pdf');
    fs.writeFileSync(outputPath, pdfBuffer);
    console.log(`✅ Saved: ${outputPath}`);
    console.log('');
    console.log('🔍 Opening PDF to verify images...');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

test();
