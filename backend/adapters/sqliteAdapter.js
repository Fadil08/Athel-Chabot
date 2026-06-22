const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class SqliteAdapter {
  constructor(config) {
    this.filename = config ? config.filename : 'database.sqlite';
    this.dbPath = path.isAbsolute(this.filename) ? this.filename : path.join(__dirname, '..', this.filename);
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) return reject(err);
        
        this.db.serialize(() => {
          // 1. Users Table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              email TEXT UNIQUE,
              password TEXT,
              name TEXT
            )
          `);

          // 2. Chatbots Table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS chatbots (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              userId INTEGER,
              name TEXT,
              businessType TEXT,
              agentKey TEXT UNIQUE,
              aiEnabled INTEGER DEFAULT 0,
              aiProvider TEXT,
              aiApiKey TEXT,
              aiModel TEXT,
              aiSystemPrompt TEXT,
              branding TEXT,
              nlp TEXT,
              tokenUsage INTEGER DEFAULT 0,
              FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
            )
          `);

          // 3. Intents Table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS intents (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              chatbotId INTEGER,
              keywords TEXT,
              response TEXT,
              category TEXT,
              documentId TEXT,
              FOREIGN KEY(chatbotId) REFERENCES chatbots(id) ON DELETE CASCADE
            )
          `);

          // 4. Documents Table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS documents (
              id TEXT PRIMARY KEY,
              chatbotId INTEGER,
              name TEXT,
              uploadDate TEXT,
              sizeBytes INTEGER,
              status TEXT,
              FOREIGN KEY(chatbotId) REFERENCES chatbots(id) ON DELETE CASCADE
            )
          `);

          // 5. KnowledgeBase Table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS knowledgeBase (
              id TEXT PRIMARY KEY,
              chatbotId INTEGER,
              documentId TEXT,
              content TEXT,
              pageNumber INTEGER,
              filename TEXT,
              FOREIGN KEY(chatbotId) REFERENCES chatbots(id) ON DELETE CASCADE,
              FOREIGN KEY(documentId) REFERENCES documents(id) ON DELETE CASCADE
            )
          `, (err2) => {
            if (err2) return reject(err2);
            // Run column migration for intents and chatbots
            this.db.run("ALTER TABLE intents ADD COLUMN documentId TEXT", (errAlter) => {
              this.db.run("ALTER TABLE chatbots ADD COLUMN tokenUsage INTEGER DEFAULT 0", (errAlter2) => {
                resolve();
              });
            });
          });
        });
      });
    });
  }

  // ==========================================
  // Auth & Users
  // ==========================================

  async createUser(user) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "INSERT INTO users (email, password, name) VALUES (?, ?, ?)",
        [user.email, user.password, user.name],
        function(err) {
          if (err) return reject(err);
          resolve({ id: this.lastID, email: user.email, name: user.name });
        }
      );
    });
  }

  async getUserByEmail(email) {
    return new Promise((resolve, reject) => {
      this.db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  async getUserById(id) {
    return new Promise((resolve, reject) => {
      this.db.get("SELECT id, email, name FROM users WHERE id = ?", [id], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  async updateUser(id, userData) {
    return new Promise((resolve, reject) => {
      const sets = [];
      const params = [];
      if (userData.name !== undefined) { sets.push("name = ?"); params.push(userData.name); }
      if (userData.email !== undefined) { sets.push("email = ?"); params.push(userData.email); }
      if (userData.password !== undefined) { sets.push("password = ?"); params.push(userData.password); }
      if (sets.length === 0) return resolve(true);
      params.push(id);
      this.db.run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params, (err) => {
        if (err) return reject(err);
        resolve(true);
      });
    });
  }

  // ==========================================
  // Chatbots Management
  // ==========================================

  async getChatbots(userId) {
    return new Promise((resolve, reject) => {
      this.db.all("SELECT * FROM chatbots WHERE userId = ?", [userId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map(row => ({
          ...row,
          aiEnabled: !!row.aiEnabled,
          branding: row.branding ? JSON.parse(row.branding) : null,
          nlp: row.nlp ? JSON.parse(row.nlp) : null
        })));
      });
    });
  }

  async getChatbotById(id, userId) {
    return new Promise((resolve, reject) => {
      const query = userId 
        ? "SELECT * FROM chatbots WHERE id = ? AND userId = ?" 
        : "SELECT * FROM chatbots WHERE id = ?";
      const params = userId ? [id, userId] : [id];

      this.db.get(query, params, (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(null);
        resolve({
          ...row,
          aiEnabled: !!row.aiEnabled,
          branding: row.branding ? JSON.parse(row.branding) : null,
          nlp: row.nlp ? JSON.parse(row.nlp) : null
        });
      });
    });
  }

  async getChatbotByAgentKey(agentKey) {
    return new Promise((resolve, reject) => {
      this.db.get("SELECT * FROM chatbots WHERE agentKey = ?", [agentKey], (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(null);
        resolve({
          ...row,
          aiEnabled: !!row.aiEnabled,
          branding: row.branding ? JSON.parse(row.branding) : null,
          nlp: row.nlp ? JSON.parse(row.nlp) : null
        });
      });
    });
  }

  async addChatbot(bot) {
    return new Promise((resolve, reject) => {
      const defaultBranding = JSON.stringify({
        widgetTitle: bot.name,
        welcomeText: 'Siap membantu Anda 24/7',
        greetingMessage: `Halo! Selamat datang di ${bot.name}. Ada yang bisa saya bantu?`,
        fallbackMessage: 'Maaf, saya belum mengerti pertanyaan Anda.'
      });
      const defaultNlp = JSON.stringify({
        similarityThreshold: 0.6,
        stemmingEnabled: 1,
        stopWordsEnabled: 1,
        language: 'id'
      });

      this.db.run(
        `INSERT INTO chatbots (userId, name, businessType, agentKey, aiEnabled, branding, nlp) 
         VALUES (?, ?, ?, ?, 0, ?, ?)`,
        [bot.userId, bot.name, bot.businessType || 'Other', bot.agentKey, defaultBranding, defaultNlp],
        function(err) {
          if (err) return reject(err);
          resolve({ id: this.lastID, ...bot });
        }
      );
    });
  }

  async updateChatbot(id, botData, userId) {
    return new Promise((resolve, reject) => {
      // Build dynamic SQL set clauses
      const sets = [];
      const params = [];
      
       const allowedFields = [
        'name', 'aiEnabled', 'aiProvider', 'aiApiKey', 'aiModel', 'aiSystemPrompt', 'branding', 'nlp', 'tokenUsage'
      ];

      for (const field of allowedFields) {
        if (botData[field] !== undefined) {
          sets.push(`${field} = ?`);
          
          let val = botData[field];
          if (field === 'aiEnabled') val = val ? 1 : 0;
          if (field === 'branding' || field === 'nlp') val = JSON.stringify(val);
          
          params.push(val);
        }
      }

      if (sets.length === 0) return resolve(true);

      params.push(id);
      let query = `UPDATE chatbots SET ${sets.join(', ')} WHERE id = ?`;

      if (userId) {
        query += ` AND userId = ?`;
        params.push(userId);
      }

      this.db.run(query, params, (err) => {
        if (err) return reject(err);
        resolve(true);
      });
    });
  }

  async deleteChatbot(id, userId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "DELETE FROM chatbots WHERE id = ? AND userId = ?",
        [id, userId],
        (err) => {
          if (err) return reject(err);
          resolve(true);
        }
      );
    });
  }

  // ==========================================
  // Intents CRUD
  // ==========================================

  async getIntents(chatbotId) {
    return new Promise((resolve, reject) => {
      this.db.all("SELECT * FROM intents WHERE chatbotId = ?", [chatbotId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map(row => ({
          id: row.id,
          keywords: JSON.parse(row.keywords),
          response: row.response,
          category: row.category,
          documentId: row.documentId || null
        })));
      });
    });
  }

  async addIntent(chatbotId, intent) {
    return new Promise((resolve, reject) => {
      const keywordsStr = JSON.stringify(intent.keywords);
      const category = intent.category || 'General';
      const docId = intent.documentId || null;
      
      this.db.run(
        "INSERT INTO intents (chatbotId, keywords, response, category, documentId) VALUES (?, ?, ?, ?, ?)",
        [chatbotId, keywordsStr, intent.response, category, docId],
        function(err) {
          if (err) return reject(err);
          resolve({
            id: this.lastID,
            keywords: intent.keywords,
            response: intent.response,
            category,
            documentId: docId
          });
        }
      );
    });
  }

  async updateIntent(id, chatbotId, updatedIntent) {
    return new Promise((resolve, reject) => {
      const keywordsStr = JSON.stringify(updatedIntent.keywords);
      const category = updatedIntent.category || 'General';
      
      this.db.run(
        "UPDATE intents SET keywords = ?, response = ?, category = ? WHERE id = ? AND chatbotId = ?",
        [keywordsStr, updatedIntent.response, category, parseInt(id), chatbotId],
        (err) => {
          if (err) return reject(err);
          resolve({
            id: parseInt(id),
            keywords: updatedIntent.keywords,
            response: updatedIntent.response,
            category
          });
        }
      );
    });
  }

  async deleteIntent(id, chatbotId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "DELETE FROM intents WHERE id = ? AND chatbotId = ?",
        [parseInt(id), chatbotId],
        (err) => {
          if (err) return reject(err);
          resolve(true);
        }
      );
    });
  }

  // ==========================================
  // Documents Library
  // ==========================================

  async getDocuments(chatbotId) {
    return new Promise((resolve, reject) => {
      this.db.all("SELECT * FROM documents WHERE chatbotId = ?", [chatbotId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  async addDocument(chatbotId, doc) {
    return new Promise((resolve, reject) => {
      const id = doc.id || Date.now().toString();
      const uploadDate = doc.uploadDate || new Date().toISOString();
      const status = doc.status || 'processed';
      
      this.db.run(
        "INSERT INTO documents (id, chatbotId, name, uploadDate, sizeBytes, status) VALUES (?, ?, ?, ?, ?, ?)",
        [id, chatbotId, doc.name, uploadDate, doc.sizeBytes, status],
        (err) => {
          if (err) return reject(err);
          resolve({ id, name: doc.name, uploadDate, sizeBytes: doc.sizeBytes, status });
        }
      );
    });
  }

  async deleteDocument(id, chatbotId) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run("DELETE FROM documents WHERE id = ? AND chatbotId = ?", [id, chatbotId]);
        this.db.run("DELETE FROM intents WHERE documentId = ? AND chatbotId = ?", [id, chatbotId]);
        this.db.run("DELETE FROM knowledgeBase WHERE documentId = ? AND chatbotId = ?", [id, chatbotId], (err) => {
          if (err) return reject(err);
          resolve(true);
        });
      });
    });
  }

  async updateDocumentStatus(id, chatbotId, status) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "UPDATE documents SET status = ? WHERE id = ? AND chatbotId = ?",
        [status, id, chatbotId],
        (err) => {
          if (err) return reject(err);
          resolve(true);
        }
      );
    });
  }

  // ==========================================
  // Knowledge Base (RAG context excerpts)
  // ==========================================

  async getKnowledgeBase(chatbotId) {
    return new Promise((resolve, reject) => {
      this.db.all("SELECT * FROM knowledgeBase WHERE chatbotId = ?", [chatbotId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  async addKnowledgeBase(chatbotId, excerpts) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run("BEGIN TRANSACTION");
        const stmt = this.db.prepare(
          `INSERT INTO knowledgeBase (id, chatbotId, documentId, content, pageNumber, filename) 
           VALUES (?, ?, ?, ?, ?, ?)`
        );
        
        const prepared = [];
        excerpts.forEach((e, idx) => {
          const id = e.id || `${Date.now()}-${idx}`;
          stmt.run([id, chatbotId, e.documentId, e.content, e.pageNumber, e.filename]);
          prepared.push({
            id,
            chatbotId,
            documentId: e.documentId,
            content: e.content,
            pageNumber: e.pageNumber,
            filename: e.filename
          });
        });
        
        stmt.finalize();
        this.db.run("COMMIT", (err) => {
          if (err) return reject(err);
          resolve(prepared);
        });
      });
    });
  }

  async clearKnowledgeBase(documentId, chatbotId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "DELETE FROM knowledgeBase WHERE documentId = ? AND chatbotId = ?",
        [documentId, chatbotId],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) return reject(err);
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = SqliteAdapter;
