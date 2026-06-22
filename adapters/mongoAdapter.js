class MongoAdapter {
  constructor(config) {
    this.uri = config ? config.uri : 'mongodb://localhost:27017/chatbot_akademik';
    this.client = null;
    this.db = null;
  }

  async init() {
    let MongoClient;
    try {
      MongoClient = require('mongodb').MongoClient;
    } catch (err) {
      throw new Error('Driver MongoDB tidak terinstal. Silakan jalankan `npm install mongodb` untuk menggunakan backend ini.');
    }

    this.client = new MongoClient(this.uri);
    await this.client.connect();
    this.db = this.client.db();
    
    // Seed default intents if empty
    const count = await this.db.collection('intents').countDocuments();
    if (count === 0) {
      await this.db.collection('intents').insertMany([
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
      ]);
    }
  }

  async getIntents() {
    return await this.db.collection('intents').find({}).toArray();
  }

  async addIntent(intent) {
    const newIntent = {
      id: intent.id || Date.now(),
      keywords: intent.keywords,
      response: intent.response,
      category: intent.category || 'General',
      documentId: intent.documentId || null
    };
    await this.db.collection('intents').insertOne(newIntent);
    return newIntent;
  }

  async updateIntent(id, updatedIntent) {
    const query = { id: parseInt(id) };
    const update = {
      $set: {
        keywords: updatedIntent.keywords,
        response: updatedIntent.response,
        category: updatedIntent.category || 'General'
      }
    };
    await this.db.collection('intents').updateOne(query, update);
    return { id: parseInt(id), ...updatedIntent };
  }

  async deleteIntent(id) {
    await this.db.collection('intents').deleteOne({ id: parseInt(id) });
    return true;
  }

  async getDocuments() {
    return await this.db.collection('documents').find({}).toArray();
  }

  async addDocument(doc) {
    const newDoc = {
      id: doc.id || Date.now().toString(),
      name: doc.name,
      uploadDate: doc.uploadDate || new Date().toISOString(),
      sizeBytes: doc.sizeBytes,
      status: doc.status || 'processed'
    };
    await this.db.collection('documents').insertOne(newDoc);
    return newDoc;
  }

  async deleteDocument(id) {
    await this.db.collection('documents').deleteOne({ id });
    await this.db.collection('intents').deleteMany({ documentId: id });
    await this.db.collection('knowledgeBase').deleteMany({ documentId: id });
    return true;
  }

  async updateDocumentStatus(id, status) {
    await this.db.collection('documents').updateOne({ id }, { $set: { status } });
    return true;
  }

  async getKnowledgeBase() {
    return await this.db.collection('knowledgeBase').find({}).toArray();
  }

  async addKnowledgeBase(excerpts) {
    const prepared = excerpts.map((e, idx) => ({
      id: e.id || `${Date.now()}-${idx}`,
      documentId: e.documentId,
      content: e.content,
      pageNumber: e.pageNumber,
      filename: e.filename
    }));
    if (prepared.length > 0) {
      await this.db.collection('knowledgeBase').insertMany(prepared);
    }
    return prepared;
  }

  async clearKnowledgeBase(documentId) {
    await this.db.collection('knowledgeBase').deleteMany({ documentId });
  }

  async importData(data) {
    await this.db.collection('intents').deleteMany({});
    await this.db.collection('documents').deleteMany({});
    await this.db.collection('knowledgeBase').deleteMany({});

    if (data.intents && data.intents.length > 0) {
      await this.db.collection('intents').insertMany(data.intents);
    }
    if (data.documents && data.documents.length > 0) {
      await this.db.collection('documents').insertMany(data.documents);
    }
    const kbItems = data.kb || data.knowledgeBase || [];
    if (kbItems.length > 0) {
      await this.db.collection('knowledgeBase').insertMany(kbItems);
    }
  }

  async close() {
    if (this.client) {
      await this.client.close();
    }
  }
}

module.exports = MongoAdapter;
