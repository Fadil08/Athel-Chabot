const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'database.json');

class JsonAdapter {
  constructor() {
    this.dbPath = DB_FILE;
  }

  async init() {
    if (!fs.existsSync(this.dbPath)) {
      const initialData = {
        users: [],
        chatbots: [],
        intents: [
          {
            id: 1,
            keywords: ['jam', 'operasional', 'buka', 'tutup'],
            response: 'Akademik buka Senin-Jumat pukul 08.00-16.00 WIB',
            category: 'Informasi Umum'
          },
          {
            id: 2,
            keywords: ['pendaftaran', 'daftar', 'registrasi'],
            response: 'Pendaftaran mahasiswa baru dibuka setiap bulan Juni-Juli. Silakan kunjungi website pmb.kampus.ac.id',
            category: 'Pendaftaran'
          }
        ],
        documents: [],
        knowledgeBase: []
      };
      fs.writeFileSync(this.dbPath, JSON.stringify(initialData, null, 2), 'utf8');
    }
  }

  _read() {
    const data = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
    data.users = data.users || [];
    data.chatbots = data.chatbots || [];
    data.intents = data.intents || [];
    data.documents = data.documents || [];
    data.knowledgeBase = data.knowledgeBase || [];
    return data;
  }

  _write(data) {
    data.users = data.users || [];
    data.chatbots = data.chatbots || [];
    data.intents = data.intents || [];
    data.documents = data.documents || [];
    data.knowledgeBase = data.knowledgeBase || [];
    fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2), 'utf8');
  }

  async createUser(user) {
    const db = this._read();
    const existing = db.users.find(u => u.email === user.email);
    if (existing) throw new Error('Email sudah terdaftar');

    const newUser = {
      id: db.users.length > 0 ? Math.max(...db.users.map(u => u.id)) + 1 : 1,
      email: user.email,
      password: user.password,
      name: user.name
    };
    db.users.push(newUser);
    this._write(db);
    return { id: newUser.id, email: newUser.email, name: newUser.name };
  }

  async getUserByEmail(email) {
    const db = this._read();
    return db.users.find(u => u.email === email) || null;
  }

  async getUserById(id) {
    const db = this._read();
    const user = db.users.find(u => u.id === parseInt(id, 10));
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.name };
  }

  async updateUser(id, userData) {
    const db = this._read();
    const userIndex = db.users.findIndex(u => u.id === parseInt(id, 10));
    if (userIndex === -1) throw new Error('User tidak ditemukan');
    
    if (userData.name !== undefined) db.users[userIndex].name = userData.name;
    if (userData.email !== undefined) {
      const existing = db.users.find(u => u.email === userData.email && u.id !== parseInt(id, 10));
      if (existing) throw new Error('Email sudah digunakan');
      db.users[userIndex].email = userData.email;
    }
    if (userData.password !== undefined) db.users[userIndex].password = userData.password;
    
    this._write(db);
    return { id: db.users[userIndex].id, email: db.users[userIndex].email, name: db.users[userIndex].name };
  }

  async getChatbots(userId) {
    const db = this._read();
    return db.chatbots
      .filter(bot => bot.userId === parseInt(userId, 10))
      .map(bot => ({
        ...bot,
        aiEnabled: !!bot.aiEnabled,
        branding: bot.branding ? JSON.parse(bot.branding) : null,
        nlp: bot.nlp ? JSON.parse(bot.nlp) : null
      }));
  }

  async getChatbotById(id, userId) {
    const db = this._read();
    const bot = db.chatbots.find(b => b.id === parseInt(id, 10) && (userId ? b.userId === parseInt(userId, 10) : true));
    if (!bot) return null;
    return {
      ...bot,
      aiEnabled: !!bot.aiEnabled,
      branding: bot.branding ? JSON.parse(bot.branding) : null,
      nlp: bot.nlp ? JSON.parse(bot.nlp) : null
    };
  }

  async getChatbotByAgentKey(agentKey) {
    const db = this._read();
    const bot = db.chatbots.find(b => b.agentKey === agentKey);
    if (!bot) return null;
    return {
      ...bot,
      aiEnabled: !!bot.aiEnabled,
      branding: bot.branding ? JSON.parse(bot.branding) : null,
      nlp: bot.nlp ? JSON.parse(bot.nlp) : null
    };
  }

  async addChatbot(bot) {
    const db = this._read();
    const newChatbot = {
      id: db.chatbots.length > 0 ? Math.max(...db.chatbots.map(c => c.id)) + 1 : 1,
      userId: bot.userId,
      name: bot.name,
      businessType: bot.businessType || 'Other',
      agentKey: bot.agentKey,
      aiEnabled: bot.aiEnabled ? 1 : 0,
      aiProvider: bot.aiProvider || null,
      aiApiKey: bot.aiApiKey || null,
      aiModel: bot.aiModel || null,
      aiSystemPrompt: bot.aiSystemPrompt || null,
      branding: bot.branding ? JSON.stringify(bot.branding) : JSON.stringify({
        widgetTitle: bot.name,
        welcomeText: 'Siap membantu Anda 24/7',
        greetingMessage: `Halo! Selamat datang di ${bot.name}. Ada yang bisa saya bantu?`,
        fallbackMessage: 'Maaf, saya belum mengerti pertanyaan Anda.'
      }),
      nlp: bot.nlp ? JSON.stringify(bot.nlp) : JSON.stringify({
        similarityThreshold: 0.6,
        stemmingEnabled: 1,
        stopWordsEnabled: 1,
        language: 'id'
      })
    };
    db.chatbots.push(newChatbot);
    this._write(db);
    return newChatbot;
  }

  async updateChatbot(id, botData, userId) {
    const db = this._read();
    const index = db.chatbots.findIndex(b => b.id === parseInt(id, 10) && b.userId === parseInt(userId, 10));
    if (index === -1) throw new Error('Chatbot tidak ditemukan');

    const allowedFields = [
      'name', 'aiEnabled', 'aiProvider', 'aiApiKey', 'aiModel', 'aiSystemPrompt', 'branding', 'nlp', 'tokenUsage'
    ];

    for (const field of allowedFields) {
      if (botData[field] !== undefined) {
        db.chatbots[index][field] = field === 'aiEnabled'
          ? (botData[field] ? 1 : 0)
          : (field === 'branding' || field === 'nlp')
            ? JSON.stringify(botData[field])
            : botData[field];
      }
    }

    this._write(db);
    return db.chatbots[index];
  }

  async deleteChatbot(id, userId) {
    const db = this._read();
    const chatbotId = parseInt(id, 10);
    const bot = db.chatbots.find(b => b.id === chatbotId && b.userId === parseInt(userId, 10));
    if (!bot) return false;

    db.chatbots = db.chatbots.filter(b => !(b.id === chatbotId && b.userId === parseInt(userId, 10)));
    db.intents = db.intents.filter(i => i.chatbotId !== chatbotId);
    db.documents = db.documents.filter(d => d.chatbotId !== chatbotId);
    db.knowledgeBase = db.knowledgeBase.filter(k => k.chatbotId !== chatbotId);
    this._write(db);
    return true;
  }

  async getIntents(chatbotId) {
    const db = this._read();
    return (db.intents || []).filter(intent => intent.chatbotId === parseInt(chatbotId, 10));
  }

  async addIntent(chatbotId, intent) {
    const db = this._read();
    if (!db.intents) db.intents = [];
    const newIntent = {
      id: intent.id || Date.now(),
      chatbotId: parseInt(chatbotId, 10),
      keywords: intent.keywords,
      response: intent.response,
      category: intent.category || 'General',
      documentId: intent.documentId || null
    };
    db.intents.push(newIntent);
    this._write(db);
    return newIntent;
  }

  async updateIntent(id, chatbotId, updatedIntent) {
    const db = this._read();
    if (!db.intents) db.intents = [];
    const index = db.intents.findIndex(i => i.id === parseInt(id, 10) && i.chatbotId === parseInt(chatbotId, 10));
    if (index === -1) throw new Error('Intent tidak ditemukan');

    db.intents[index] = {
      ...db.intents[index],
      keywords: updatedIntent.keywords,
      response: updatedIntent.response,
      category: updatedIntent.category || 'General'
    };
    this._write(db);
    return db.intents[index];
  }

  async deleteIntent(id, chatbotId) {
    const db = this._read();
    if (!db.intents) db.intents = [];
    db.intents = db.intents.filter(i => !(i.id === parseInt(id, 10) && i.chatbotId === parseInt(chatbotId, 10)));
    this._write(db);
    return true;
  }

  async getDocuments(chatbotId) {
    const db = this._read();
    return (db.documents || []).filter(d => parseInt(d.chatbotId, 10) === parseInt(chatbotId, 10));
  }

  async addDocument(chatbotId, doc) {
    const db = this._read();
    if (!db.documents) db.documents = [];
    const newDoc = {
      id: doc.id || Date.now().toString(),
      chatbotId: parseInt(chatbotId, 10),
      name: doc.name,
      uploadDate: doc.uploadDate || new Date().toISOString(),
      sizeBytes: doc.sizeBytes,
      status: doc.status || 'processed'
    };
    db.documents.push(newDoc);
    this._write(db);
    return newDoc;
  }

  async deleteDocument(id, chatbotId) {
    const db = this._read();
    if (db.documents) {
      db.documents = db.documents.filter(d => !(d.id === id && parseInt(d.chatbotId, 10) === parseInt(chatbotId, 10)));
    }
    if (db.knowledgeBase) {
      db.knowledgeBase = db.knowledgeBase.filter(k => !(k.documentId === id && parseInt(k.chatbotId, 10) === parseInt(chatbotId, 10)));
    }
    if (db.intents) {
      db.intents = db.intents.filter(i => !(i.documentId === id && parseInt(i.chatbotId, 10) === parseInt(chatbotId, 10)));
    }
    this._write(db);
    return true;
  }

  async updateDocumentStatus(id, chatbotId, status) {
    const db = this._read();
    const doc = db.documents.find(d => d.id === id && parseInt(d.chatbotId, 10) === parseInt(chatbotId, 10));
    if (doc) {
      doc.status = status;
      this._write(db);
    }
    return true;
  }

  async getKnowledgeBase(chatbotId) {
    const db = this._read();
    return (db.knowledgeBase || []).filter(k => parseInt(k.chatbotId, 10) === parseInt(chatbotId, 10));
  }

  async addKnowledgeBase(chatbotId, excerpts) {
    const db = this._read();
    if (!db.knowledgeBase) db.knowledgeBase = [];
    const prepared = excerpts.map((e, idx) => ({
      id: e.id || `${Date.now()}-${idx}`,
      chatbotId: parseInt(chatbotId, 10),
      documentId: e.documentId,
      content: e.content,
      pageNumber: e.pageNumber,
      filename: e.filename
    }));
    db.knowledgeBase.push(...prepared);
    this._write(db);
    return prepared;
  }

  async clearKnowledgeBase(documentId, chatbotId) {
    const db = this._read();
    if (db.knowledgeBase) {
      db.knowledgeBase = db.knowledgeBase.filter(k => !(k.documentId === documentId && parseInt(k.chatbotId, 10) === parseInt(chatbotId, 10)));
    }
    this._write(db);
  }

  async importData(data) {
    const db = this._read();
    db.intents = data.intents || [];
    db.documents = data.documents || [];
    db.knowledgeBase = data.kb || data.knowledgeBase || [];
    this._write(db);
  }
}

module.exports = JsonAdapter;
