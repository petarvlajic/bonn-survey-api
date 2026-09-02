const { buildConsentHtmlDocument, buildConsentPdfBuffer } = require('./dist/utils/consentPatientDocument');
const fs = require('fs');

async function test() {
  try {
    console.log('🧪 Testing Full Consent PDF Generation...\n');
    
    const name = 'Stefan Popovic';
    const date = '2026-08-31';
    
    // Test HTML
    console.log('📄 Testing HTML generation...');
    const html = await buildConsentHtmlDocument(name, date);
    if (html.includes('dominik.neles@ukabon.de')) {
      console.log('✅ HTML contains NEW email: dominik.neles@ukabon.de');
    } else {
      console.log('❌ HTML missing new email');
    }
    
    // Test PDF
    console.log('\n📋 Testing PDF generation...');
    const result = await buildConsentPdfBuffer(name, date);
    console.log(`✓ PDF Size: ${result.buffer.length} bytes`);
    console.log(`✓ Source: ${result.source}`);
    
    fs.writeFileSync('/tmp/consent-test-full.pdf', result.buffer);
    console.log(`✓ Saved: /tmp/consent-test-full.pdf`);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

test();
