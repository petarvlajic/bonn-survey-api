const { buildConsentPdfBuffer } = require('./dist/utils/consentPatientDocument');
const fs = require('fs');

async function test() {
  try {
    console.log('🧪 Testing Consent PDF with new contact...\n');
    
    const result = await buildConsentPdfBuffer('Stefan Popovic', '2026-08-24');
    console.log(`✓ PDF Size: ${result.buffer.length} bytes`);
    
    fs.writeFileSync('/tmp/consent-test.pdf', result.buffer);
    console.log(`✓ Saved: /tmp/consent-test.pdf`);
    
    // Convert to text to check
    const text = result.buffer.toString('latin1');

    if (text.includes('Dominik')) {
      console.log('✅ Contains: Dominik Nelles');
    }

    if (text.includes('dominik.neles@ukabon.de')) {
      console.log('✅ Contains NEW email: dominik.neles@ukabon.de');
    } else if (text.includes('dominik.nelles@ukbonn.de')) {
      console.log('❌ Still contains OLD email: dominik.nelles@ukbonn.de');
    } else {
      console.log('❌ Email address not found in PDF');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

test();
