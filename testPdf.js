const fs = require('fs');
const path = require('path');
const pdfProcessor = require('./pdfProcessor');

try {
  const filePath = path.join(__dirname, 'uploads', '1781837346322-SIM Akademik untuk SD, SMP, dan SMK_ Desain dan Spesifikasi.pdf');
  const buffer = fs.readFileSync(filePath);

  console.log('File loaded. Buffer size:', buffer.length);
  
  pdfProcessor.processPdf(buffer, 'test.pdf', 1)
    .then(excerpts => {
      console.log('Success! Extracted excerpts count:', excerpts.length);
      if (excerpts.length > 0) {
        console.log('First excerpt preview:', excerpts[0].content.substring(0, 150));
      }
    })
    .catch(err => {
      console.error('Extraction Promise Rejected with error:', err);
    });
} catch (e) {
  console.error('File load or execution failed:', e);
}
