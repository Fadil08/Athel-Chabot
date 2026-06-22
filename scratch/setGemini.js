const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Update chatbot id=3 (ai generate) to use Gemini
db.run(`
  UPDATE chatbots SET 
    aiEnabled = 1,
    aiProvider = 'gemini',
    aiApiKey = 'AIzaSyAvGI_LWXN8LrorYeY7-shaahgpY5Ur5gg',
    aiModel = 'gemini-1.5-flash',
    aiSystemPrompt = 'Anda adalah asisten AI yang cerdas dan membantu. Jawab pertanyaan berdasarkan konteks dokumen yang diberikan dengan jelas dan ramah.'
  WHERE id = 3
`, function(err) {
  if (err) {
    console.error('❌ Gagal update:', err.message);
  } else {
    console.log('✅ Berhasil! Chatbot "ai generate" sekarang menggunakan Google Gemini.');
    console.log('   Provider : gemini');
    console.log('   Model    : gemini-1.5-flash');
    console.log('   AI Key   : AIzaSy...5Ur5gg (tersimpan)');
  }
  
  // Verify
  db.get('SELECT id, name, aiEnabled, aiProvider, aiModel FROM chatbots WHERE id = 3', (err, row) => {
    if (row) console.log('\n📊 Verifikasi DB:', row);
    db.close();
  });
});
