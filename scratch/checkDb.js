const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    return;
  }
  
  db.all("SELECT * FROM documents", (err, rows) => {
    if (err) console.error(err);
    else console.log('Documents in database:', rows);
  });

  db.all("SELECT count(*) as count FROM knowledgeBase", (err, rows) => {
    if (err) console.error(err);
    else console.log('KnowledgeBase excerpt count:', rows);
  });

  db.all("SELECT * FROM chatbots", (err, rows) => {
    if (err) console.error(err);
    else console.log('Chatbots in database:', rows);
  });

  db.all("SELECT * FROM intents", (err, rows) => {
    if (err) console.error(err);
    else console.log('Intents in database:', rows);
  });
});
