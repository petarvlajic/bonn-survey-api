const { buildConsentHtmlDocument } = require('./dist/utils/consentPatientDocument');
const puppeteer = require('puppeteer');
const fs = require('fs');

async function test() {
  try {
    console.log('🧪 Generating PDF from HTML...\n');
    
    const html = await buildConsentHtmlDocument('Stefan Popovic', '2026-08-31');
    
    // Save HTML for inspection
    fs.writeFileSync('/tmp/consent-test.html', html);
    console.log('✓ Saved HTML: /tmp/consent-test.html');
    
    // Try to generate PDF with puppeteer
    try {
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      await page.setContent(html);
      await page.pdf({ path: '/tmp/consent-puppeteer.pdf', format: 'A4' });
      await browser.close();
      console.log('✓ Generated PDF with puppeteer: /tmp/consent-puppeteer.pdf');
    } catch (e) {
      console.log('ℹ Puppeteer not available, HTML saved for manual conversion');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

test();
