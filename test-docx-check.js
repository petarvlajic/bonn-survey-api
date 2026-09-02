const mammoth = require('mammoth');

const docxPath = './assets/consent/patienteninformation-einwilligung-erwachsene.docx';

async function test() {
  try {
    console.log('🧪 Checking DOCX file...\n');
    
    const result = await mammoth.extractRawText({ path: docxPath });
    const text = result.value;
    
    if (text.includes('dominik.neles@ukabon.de')) {
      console.log('✅ DOCX contains NEW email: dominik.neles@ukabon.de');
    } else if (text.includes('dominik.nelles@ukbonn.de')) {
      console.log('❌ DOCX still has OLD email: dominik.nelles@ukbonn.de');
    } else {
      console.log('❌ No email found in DOCX');
    }
    
    // Show relevant lines
    const lines = text.split('\n').filter(l => l.toLowerCase().includes('dominik') || l.toLowerCase().includes('neles'));
    console.log('\nRelevant lines:');
    lines.slice(0, 5).forEach(l => console.log('  ' + l));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
