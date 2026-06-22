const mysql = require('mysql2/promise');

class MysqlAdapter {
  constructor(config) {
    this.config = {
      host:     config?.host     || 'localhost',
      port:     config?.port     || 3306,
      user:     config?.user     || 'root',
      password: config?.password || '',
      database: config?.database || 'chatbot_db',
      waitForConnections: true,
      connectionLimit:    10,
      queueLimit:         0,
      charset:            'utf8mb4'
    };
    this.pool = null;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  async query(sql, params = []) {
    const [rows] = await this.pool.execute(sql, params);
    return rows;
  }

  async run(sql, params = []) {
    const [result] = await this.pool.execute(sql, params);
    return result;
  }

  // ─── Init / Create Tables ─────────────────────────────────────────────────────

  async init() {
    // First connect WITHOUT database to create it if needed
    const tempPool = await mysql.createConnection({
      host:     this.config.host,
      port:     this.config.port,
      user:     this.config.user,
      password: this.config.password,
      charset:  'utf8mb4'
    });
    await tempPool.execute(
      `CREATE DATABASE IF NOT EXISTS \`${this.config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await tempPool.end();

    // Create connection pool to the target database
    this.pool = mysql.createPool(this.config);

    // Create tables
    await this.query(`
      CREATE TABLE IF NOT EXISTS users (
        id       INT AUTO_INCREMENT PRIMARY KEY,
        email    VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name     VARCHAR(255)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS chatbots (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        userId         INT,
        name           VARCHAR(255),
        businessType   VARCHAR(100),
        agentKey       VARCHAR(255) UNIQUE,
        aiEnabled      TINYINT(1) DEFAULT 0,
        aiProvider     VARCHAR(100),
        aiApiKey       TEXT,
        aiModel        VARCHAR(255),
        aiSystemPrompt TEXT,
        branding       LONGTEXT,
        nlp            TEXT,
        tokenUsage     INT DEFAULT 0,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS intents (
        id        INT AUTO_INCREMENT PRIMARY KEY,
        chatbotId INT,
        keywords  TEXT,
        response  TEXT,
        category  VARCHAR(255),
        documentId VARCHAR(255),
        FOREIGN KEY (chatbotId) REFERENCES chatbots(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id         VARCHAR(64) PRIMARY KEY,
        chatbotId  INT,
        name       VARCHAR(500),
        uploadDate VARCHAR(50),
        sizeBytes  BIGINT,
        status     VARCHAR(50),
        FOREIGN KEY (chatbotId) REFERENCES chatbots(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS knowledgeBase (
        id         VARCHAR(128) PRIMARY KEY,
        chatbotId  INT,
        documentId VARCHAR(64),
        content    LONGTEXT,
        pageNumber INT,
        filename   VARCHAR(500),
        FOREIGN KEY (chatbotId)  REFERENCES chatbots(id)  ON DELETE CASCADE,
        FOREIGN KEY (documentId) REFERENCES documents(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Migration to add documentId to intents table if not exists
    try {
      await this.query("ALTER TABLE intents ADD COLUMN documentId VARCHAR(255)");
    } catch (e) {
      // Ignore if already exists
    }

    // Migration to add tokenUsage to chatbots table if not exists
    try {
      await this.query("ALTER TABLE chatbots ADD COLUMN tokenUsage INT DEFAULT 0");
    } catch (e) {
      // Ignore if already exists
    }
  }

  // ─── Auth & Users ─────────────────────────────────────────────────────────────

  async createUser(user) {
    const result = await this.run(
      'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
      [user.email, user.password, user.name]
    );
    return { id: result.insertId, email: user.email, name: user.name };
  }

  async getUserByEmail(email) {
    const rows = await this.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  }

  async getUserById(id) {
    const rows = await this.query('SELECT id, email, name FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  }

  async updateUser(id, userData) {
    const sets = [];
    const params = [];
    if (userData.name !== undefined) { sets.push("name = ?"); params.push(userData.name); }
    if (userData.email !== undefined) { sets.push("email = ?"); params.push(userData.email); }
    if (userData.password !== undefined) { sets.push("password = ?"); params.push(userData.password); }
    if (sets.length === 0) return true;
    params.push(id);
    await this.run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
    return true;
  }

  // ─── Chatbots Management ──────────────────────────────────────────────────────

  _parseBot(row) {
    if (!row) return null;
    return {
      ...row,
      aiEnabled: !!row.aiEnabled,
      branding:  row.branding ? JSON.parse(row.branding) : null,
      nlp:       row.nlp      ? JSON.parse(row.nlp)      : null
    };
  }

  async getChatbots(userId) {
    const rows = await this.query('SELECT * FROM chatbots WHERE userId = ?', [userId]);
    return rows.map(r => this._parseBot(r));
  }

  async getChatbotById(id, userId) {
    let rows;
    if (userId) {
      rows = await this.query('SELECT * FROM chatbots WHERE id = ? AND userId = ?', [id, userId]);
    } else {
      rows = await this.query('SELECT * FROM chatbots WHERE id = ?', [id]);
    }
    return this._parseBot(rows[0] || null);
  }

  async getChatbotByAgentKey(agentKey) {
    const rows = await this.query('SELECT * FROM chatbots WHERE agentKey = ?', [agentKey]);
    return this._parseBot(rows[0] || null);
  }

  async addChatbot(bot) {
    const defaultBranding = JSON.stringify({
      widgetTitle:     bot.name,
      welcomeText:     'Siap membantu Anda 24/7',
      greetingMessage: `Halo! Selamat datang di ${bot.name}. Ada yang bisa saya bantu?`,
      fallbackMessage: 'Maaf, saya belum mengerti pertanyaan Anda.'
    });
    const defaultNlp = JSON.stringify({
      similarityThreshold: 0.6,
      stemmingEnabled:     1,
      stopWordsEnabled:    1,
      language:            'id'
    });
    const result = await this.run(
      `INSERT INTO chatbots (userId, name, businessType, agentKey, aiEnabled, branding, nlp)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
      [bot.userId, bot.name, bot.businessType || 'Other', bot.agentKey, defaultBranding, defaultNlp]
    );
    return { id: result.insertId, ...bot };
  }

  async updateChatbot(id, botData, userId) {
    const allowedFields = [
      'name', 'agentKey', 'aiEnabled', 'aiProvider', 'aiApiKey',
      'aiModel', 'aiSystemPrompt', 'branding', 'nlp', 'tokenUsage'
    ];
    const sets   = [];
    const params = [];

    for (const field of allowedFields) {
      if (botData[field] === undefined) continue;
      sets.push(`${field} = ?`);
      let val = botData[field];
      if (field === 'aiEnabled')            val = val ? 1 : 0;
      if (field === 'branding' || field === 'nlp') val = JSON.stringify(val);
      params.push(val);
    }

    if (sets.length === 0) return true;
    params.push(id);

    let sql = `UPDATE chatbots SET ${sets.join(', ')} WHERE id = ?`;
    if (userId) { sql += ' AND userId = ?'; params.push(userId); }

    await this.run(sql, params);
    return true;
  }

  async deleteChatbot(id, userId) {
    await this.run('DELETE FROM chatbots WHERE id = ? AND userId = ?', [id, userId]);
    return true;
  }

  // ─── Intents CRUD ─────────────────────────────────────────────────────────────

  async getIntents(chatbotId) {
    const rows = await this.query('SELECT * FROM intents WHERE chatbotId = ?', [chatbotId]);
    return rows.map(r => ({
      id:       r.id,
      keywords: JSON.parse(r.keywords),
      response: r.response,
      category: r.category,
      documentId: r.documentId || null
    }));
  }

  async addIntent(chatbotId, intent) {
    const keywordsStr = JSON.stringify(intent.keywords);
    const category    = intent.category || 'General';
    const docId       = intent.documentId || null;
    const result = await this.run(
      'INSERT INTO intents (chatbotId, keywords, response, category, documentId) VALUES (?, ?, ?, ?, ?)',
      [chatbotId, keywordsStr, intent.response, category, docId]
    );
    return { id: result.insertId, keywords: intent.keywords, response: intent.response, category, documentId: docId };
  }

  async updateIntent(id, chatbotId, updatedIntent) {
    const keywordsStr = JSON.stringify(updatedIntent.keywords);
    const category    = updatedIntent.category || 'General';
    await this.run(
      'UPDATE intents SET keywords = ?, response = ?, category = ? WHERE id = ? AND chatbotId = ?',
      [keywordsStr, updatedIntent.response, category, parseInt(id), chatbotId]
    );
    return { id: parseInt(id), keywords: updatedIntent.keywords, response: updatedIntent.response, category };
  }

  async deleteIntent(id, chatbotId) {
    await this.run('DELETE FROM intents WHERE id = ? AND chatbotId = ?', [parseInt(id), chatbotId]);
    return true;
  }

  // ─── Documents ────────────────────────────────────────────────────────────────

  async getDocuments(chatbotId) {
    return await this.query('SELECT * FROM documents WHERE chatbotId = ?', [chatbotId]);
  }

  async addDocument(chatbotId, doc) {
    const id         = doc.id         || Date.now().toString();
    const uploadDate = doc.uploadDate || new Date().toISOString();
    const status     = doc.status     || 'processed';
    await this.run(
      'INSERT INTO documents (id, chatbotId, name, uploadDate, sizeBytes, status) VALUES (?, ?, ?, ?, ?, ?)',
      [id, chatbotId, doc.name, uploadDate, doc.sizeBytes, status]
    );
    return { id, name: doc.name, uploadDate, sizeBytes: doc.sizeBytes, status };
  }

  async deleteDocument(id, chatbotId) {
    await this.run('DELETE FROM knowledgeBase WHERE documentId = ? AND chatbotId = ?', [id, chatbotId]);
    await this.run('DELETE FROM intents WHERE documentId = ? AND chatbotId = ?', [id, chatbotId]);
    await this.run('DELETE FROM documents WHERE id = ? AND chatbotId = ?', [id, chatbotId]);
    return true;
  }

  async updateDocumentStatus(id, chatbotId, status) {
    await this.run(
      'UPDATE documents SET status = ? WHERE id = ? AND chatbotId = ?',
      [status, id, chatbotId]
    );
    return true;
  }

  // ─── Knowledge Base ───────────────────────────────────────────────────────────

  async getKnowledgeBase(chatbotId) {
    return await this.query('SELECT * FROM knowledgeBase WHERE chatbotId = ?', [chatbotId]);
  }

  async addKnowledgeBase(chatbotId, excerpts) {
    if (!excerpts || excerpts.length === 0) return [];
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const prepared = [];
      for (let idx = 0; idx < excerpts.length; idx++) {
        const e  = excerpts[idx];
        const id = e.id || `${Date.now()}-${idx}`;
        await conn.execute(
          'INSERT INTO knowledgeBase (id, chatbotId, documentId, content, pageNumber, filename) VALUES (?, ?, ?, ?, ?, ?)',
          [id, chatbotId, e.documentId, e.content, e.pageNumber, e.filename]
        );
        prepared.push({ id, chatbotId, documentId: e.documentId, content: e.content, pageNumber: e.pageNumber, filename: e.filename });
      }
      await conn.commit();
      return prepared;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async clearKnowledgeBase(documentId, chatbotId) {
    await this.run(
      'DELETE FROM knowledgeBase WHERE documentId = ? AND chatbotId = ?',
      [documentId, chatbotId]
    );
  }

  async close() {
    if (this.pool) await this.pool.end();
  }
}

module.exports = MysqlAdapter;
