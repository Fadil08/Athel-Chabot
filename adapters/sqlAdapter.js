class SqlAdapter {
  constructor(type, config) {
    this.type = type; // 'mysql' or 'postgres'
    this.config = config;
    this.client = null;
  }

  async init() {
    if (this.type === 'postgres') {
      let Client;
      try {
        Client = require('pg').Client;
      } catch (err) {
        throw new Error('Driver pg tidak terinstal. Silakan jalankan `npm install pg` untuk menggunakan backend PostgreSQL.');
      }
      this.client = new Client(this.config);
      await this.client.connect();

      // Create tables for postgres
      await this.client.query(`
        CREATE TABLE IF NOT EXISTS intents (
          id SERIAL PRIMARY KEY,
          keywords TEXT,
          response TEXT,
          category TEXT,
          documentId VARCHAR(255)
        )
      `);
      await this.client.query(`
        CREATE TABLE IF NOT EXISTS documents (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255),
          uploadDate VARCHAR(255),
          sizeBytes INTEGER,
          status VARCHAR(255)
        )
      `);
      await this.client.query(`
        CREATE TABLE IF NOT EXISTS knowledge_base (
          id VARCHAR(255) PRIMARY KEY,
          documentId VARCHAR(255),
          content TEXT,
          pageNumber INTEGER,
          filename VARCHAR(255)
        )
      `);

      // Seed if empty
      const res = await this.client.query("SELECT COUNT(*) as count FROM intents");
      if (parseInt(res.rows[0].count) === 0) {
        await this.client.query(
          "INSERT INTO intents (keywords, response, category) VALUES ($1, $2, $3)",
          [JSON.stringify(['jam', 'operasional', 'buka', 'tutup']), 'Akademik buka Senin-Jumat pukul 08.00-16.00 WIB', 'Informasi Umum']
        );
        await this.client.query(
          "INSERT INTO intents (keywords, response, category) VALUES ($1, $2, $3)",
          [JSON.stringify(['pendaftaran', 'daftar', 'registrasi']), 'Pendaftaran mahasiswa baru dibuka setiap bulan Juni-Juli. Silakan kunjungi website pmb.kampus.ac.id', 'Pendaftaran']
        );
      }

    } else if (this.type === 'mysql') {
      let mysql;
      try {
        mysql = require('mysql2/promise');
      } catch (err) {
        throw new Error('Driver mysql2 tidak terinstal. Silakan jalankan `npm install mysql2` untuk menggunakan backend MySQL.');
      }
      this.client = await mysql.createConnection(this.config);

      // Create tables for mysql
      await this.client.query(`
        CREATE TABLE IF NOT EXISTS intents (
          id INT AUTO_INCREMENT PRIMARY KEY,
          keywords TEXT,
          response TEXT,
          category VARCHAR(255),
          documentId VARCHAR(255)
        )
      `);
      await this.client.query(`
        CREATE TABLE IF NOT EXISTS documents (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255),
          uploadDate VARCHAR(255),
          sizeBytes INT,
          status VARCHAR(255)
        )
      `);
      await this.client.query(`
        CREATE TABLE IF NOT EXISTS knowledge_base (
          id VARCHAR(255) PRIMARY KEY,
          documentId VARCHAR(255),
          content TEXT,
          pageNumber INT,
          filename VARCHAR(255)
        )
      `);

      // Seed if empty
      const [rows] = await this.client.query("SELECT COUNT(*) as count FROM intents");
      const count = rows[0].count;
      if (count === 0) {
        await this.client.query(
          "INSERT INTO intents (keywords, response, category) VALUES (?, ?, ?)",
          [JSON.stringify(['jam', 'operasional', 'buka', 'tutup']), 'Akademik buka Senin-Jumat pukul 08.00-16.00 WIB', 'Informasi Umum']
        );
        await this.client.query(
          "INSERT INTO intents (keywords, response, category) VALUES (?, ?, ?)",
          [JSON.stringify(['pendaftaran', 'daftar', 'registrasi']), 'Pendaftaran mahasiswa baru dibuka setiap bulan Juni-Juli. Silakan kunjungi website pmb.kampus.ac.id', 'Pendaftaran']
        );
      }
    }

    // Run migrations
    try {
      if (this.type === 'postgres') {
        await this.client.query("ALTER TABLE intents ADD COLUMN IF NOT EXISTS documentId VARCHAR(255)");
      } else {
        await this.client.query("ALTER TABLE intents ADD COLUMN documentId VARCHAR(255)");
      }
    } catch (e) {
      // Ignore error if column already exists
    }
  }

  async getIntents() {
    if (this.type === 'postgres') {
      const res = await this.client.query("SELECT * FROM intents");
      return res.rows.map(row => ({
        id: row.id,
        keywords: JSON.parse(row.keywords),
        response: row.response,
        category: row.category,
        documentId: row.documentid || null
      }));
    } else {
      const [rows] = await this.client.query("SELECT * FROM intents");
      return rows.map(row => ({
        id: row.id,
        keywords: JSON.parse(row.keywords),
        response: row.response,
        category: row.category,
        documentId: row.documentId || null
      }));
    }
  }

  async addIntent(intent) {
    const keywordsStr = JSON.stringify(intent.keywords);
    const category = intent.category || 'General';
    const docId = intent.documentId || null;

    if (this.type === 'postgres') {
      const res = await this.client.query(
        "INSERT INTO intents (keywords, response, category, documentId) VALUES ($1, $2, $3, $4) RETURNING id",
        [keywordsStr, intent.response, category, docId]
      );
      return {
        id: res.rows[0].id,
        keywords: intent.keywords,
        response: intent.response,
        category,
        documentId: docId
      };
    } else {
      const [result] = await this.client.query(
        "INSERT INTO intents (keywords, response, category, documentId) VALUES (?, ?, ?, ?)",
        [keywordsStr, intent.response, category, docId]
      );
      return {
        id: result.insertId,
        keywords: intent.keywords,
        response: intent.response,
        category,
        documentId: docId
      };
    }
  }

  async updateIntent(id, updatedIntent) {
    const keywordsStr = JSON.stringify(updatedIntent.keywords);
    const category = updatedIntent.category || 'General';

    if (this.type === 'postgres') {
      await this.client.query(
        "UPDATE intents SET keywords = $1, response = $2, category = $3 WHERE id = $4",
        [keywordsStr, updatedIntent.response, category, parseInt(id)]
      );
    } else {
      await this.client.query(
        "UPDATE intents SET keywords = ?, response = ?, category = ? WHERE id = ?",
        [keywordsStr, updatedIntent.response, category, parseInt(id)]
      );
    }
    return { id: parseInt(id), ...updatedIntent };
  }

  async deleteIntent(id) {
    if (this.type === 'postgres') {
      await this.client.query("DELETE FROM intents WHERE id = $1", [parseInt(id)]);
    } else {
      await this.client.query("DELETE FROM intents WHERE id = ?", [parseInt(id)]);
    }
    return true;
  }

  async getDocuments() {
    if (this.type === 'postgres') {
      const res = await this.client.query("SELECT * FROM documents");
      return res.rows.map(row => ({
        id: row.id,
        name: row.name,
        uploadDate: row.uploaddate, // pg lowercases unquoted columns
        sizeBytes: row.sizebytes,
        status: row.status
      }));
    } else {
      const [rows] = await this.client.query("SELECT * FROM documents");
      return rows;
    }
  }

  async addDocument(doc) {
    const id = doc.id || Date.now().toString();
    const uploadDate = doc.uploadDate || new Date().toISOString();
    const status = doc.status || 'processed';

    if (this.type === 'postgres') {
      await this.client.query(
        "INSERT INTO documents (id, name, uploadDate, sizeBytes, status) VALUES ($1, $2, $3, $4, $5)",
        [id, doc.name, uploadDate, doc.sizeBytes, status]
      );
    } else {
      await this.client.query(
        "INSERT INTO documents (id, name, uploadDate, sizeBytes, status) VALUES (?, ?, ?, ?, ?)",
        [id, doc.name, uploadDate, doc.sizeBytes, status]
      );
    }
    return { id, name: doc.name, uploadDate, sizeBytes: doc.sizeBytes, status };
  }

  async deleteDocument(id) {
    if (this.type === 'postgres') {
      await this.client.query("DELETE FROM documents WHERE id = $1", [id]);
      await this.client.query("DELETE FROM intents WHERE documentId = $1", [id]);
      await this.client.query("DELETE FROM knowledge_base WHERE documentId = $1", [id]);
    } else {
      await this.client.query("DELETE FROM documents WHERE id = ?", [id]);
      await this.client.query("DELETE FROM intents WHERE documentId = ?", [id]);
      await this.client.query("DELETE FROM knowledge_base WHERE documentId = ?", [id]);
    }
    return true;
  }

  async updateDocumentStatus(id, status) {
    if (this.type === 'postgres') {
      await this.client.query("UPDATE documents SET status = $1 WHERE id = $2", [status, id]);
    } else {
      await this.client.query("UPDATE documents SET status = ? WHERE id = ?", [status, id]);
    }
    return true;
  }

  async getKnowledgeBase() {
    if (this.type === 'postgres') {
      const res = await this.client.query("SELECT * FROM knowledge_base");
      return res.rows.map(row => ({
        id: row.id,
        documentId: row.documentid,
        content: row.content,
        pageNumber: row.pagenumber,
        filename: row.filename
      }));
    } else {
      const [rows] = await this.client.query("SELECT * FROM knowledge_base");
      return rows.map(row => ({
        id: row.id,
        documentId: row.documentId,
        content: row.content,
        pageNumber: row.pageNumber,
        filename: row.filename
      }));
    }
  }

  async addKnowledgeBase(excerpts) {
    const prepared = [];
    for (let idx = 0; idx < excerpts.length; idx++) {
      const e = excerpts[idx];
      const id = e.id || `${Date.now()}-${idx}`;
      if (this.type === 'postgres') {
        await this.client.query(
          "INSERT INTO knowledge_base (id, documentId, content, pageNumber, filename) VALUES ($1, $2, $3, $4, $5)",
          [id, e.documentId, e.content, e.pageNumber, e.filename]
        );
      } else {
        await this.client.query(
          "INSERT INTO knowledge_base (id, documentId, content, pageNumber, filename) VALUES (?, ?, ?, ?, ?)",
          [id, e.documentId, e.content, e.pageNumber, e.filename]
        );
      }
      prepared.push({
        id,
        documentId: e.documentId,
        content: e.content,
        pageNumber: e.pageNumber,
        filename: e.filename
      });
    }
    return prepared;
  }

  async clearKnowledgeBase(documentId) {
    if (this.type === 'postgres') {
      await this.client.query("DELETE FROM knowledge_base WHERE documentId = $1", [documentId]);
    } else {
      await this.client.query("DELETE FROM knowledge_base WHERE documentId = ?", [documentId]);
    }
  }

  async importData(data) {
    if (this.type === 'postgres') {
      await this.client.query("DELETE FROM intents");
      await this.client.query("DELETE FROM documents");
      await this.client.query("DELETE FROM knowledge_base");

      if (data.intents) {
        for (const i of data.intents) {
          await this.client.query(
            "INSERT INTO intents (id, keywords, response, category) VALUES ($1, $2, $3, $4)",
            [i.id, JSON.stringify(i.keywords), i.response, i.category || 'General']
          );
        }
      }
      if (data.documents) {
        for (const d of data.documents) {
          await this.client.query(
            "INSERT INTO documents (id, name, uploadDate, sizeBytes, status) VALUES ($1, $2, $3, $4, $5)",
            [d.id, d.name, d.uploadDate, d.sizeBytes, d.status]
          );
        }
      }
      const kbItems = data.kb || data.knowledgeBase || [];
      for (const k of kbItems) {
        await this.client.query(
          "INSERT INTO knowledge_base (id, documentId, content, pageNumber, filename) VALUES ($1, $2, $3, $4, $5)",
          [k.id, k.documentId, k.content, k.pageNumber, k.filename]
        );
      }
    } else {
      await this.client.query("DELETE FROM intents");
      await this.client.query("DELETE FROM documents");
      await this.client.query("DELETE FROM knowledge_base");

      if (data.intents) {
        for (const i of data.intents) {
          await this.client.query(
            "INSERT INTO intents (id, keywords, response, category) VALUES (?, ?, ?, ?)",
            [i.id, JSON.stringify(i.keywords), i.response, i.category || 'General']
          );
        }
      }
      if (data.documents) {
        for (const d of data.documents) {
          await this.client.query(
            "INSERT INTO documents (id, name, uploadDate, sizeBytes, status) VALUES (?, ?, ?, ?, ?)",
            [d.id, d.name, d.uploadDate, d.sizeBytes, d.status]
          );
        }
      }
      const kbItems = data.kb || data.knowledgeBase || [];
      for (const k of kbItems) {
        await this.client.query(
          "INSERT INTO knowledge_base (id, documentId, content, pageNumber, filename) VALUES (?, ?, ?, ?, ?)",
          [k.id, k.documentId, k.content, k.pageNumber, k.filename]
        );
      }
    }
  }

  async close() {
    if (this.client) {
      if (this.type === 'postgres') {
        await this.client.end();
      } else {
        await this.client.end();
      }
    }
  }
}

module.exports = SqlAdapter;
