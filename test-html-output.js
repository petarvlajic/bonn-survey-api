const { buildConsentHtmlDocument } = require('./dist/utils/consentPatientDocument');
const fs = require('fs');

async function test() {
  try {
    console.log('🧪 Generating HTML output...\n');
    
    const html = await buildConsentHtmlDocument('Stefan Popovic', '2026-08-31');
    
    fs.writeFileSync('./consent-test.html', html);
    console.log('✅ Saved HTML: ./consent-test.html');
    console.log('   Open in browser to preview');
    
    // Verify email
    if (html.includes('dominik.neles@ukabon.de')) {
      console.log('✅ Email in HTML: dominik.neles@ukabon.de ✓');
    } else {
      console.log('❌ Email NOT in HTML');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

test();
