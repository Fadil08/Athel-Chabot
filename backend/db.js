const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const CONFIG_FILE = path.join(__dirname, 'config.json');

// Standard AES-256-CBC encryption helper for AI API Keys
function encrypt(text) {
  if (!text) return '';
  if (text === '****************') return text;
  
  try {
    const keyString = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'chatagentive-super-secret-key-9988';
    const key = crypto.createHash('sha256').update(keyString).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (err) {
    console.error('Encryption failed:', err);
    return text;
  }
}

function decrypt(text) {
  if (!text) return '';
  if (text === '****************') return text;
  if (!text.includes(':')) return text; // Fallback for raw text

  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = parts.join(':');
    const keyString = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'chatagentive-super-secret-key-9988';
    const key = crypto.createHash('sha256').update(keyString).digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return text;
  }
}

function readConfig() {
  let config;
  if (!fs.existsSync(CONFIG_FILE)) {
    config = {
      storageBackend: process.env.STORAGE_BACKEND?.toLowerCase() || 'json',
      databaseConfig: {
        sqlite: {
          filename: process.env.SQLITE_FILENAME || 'database.sqlite'
        },
        mysql: {
          host:     process.env.DB_HOST     || 'localhost',
          port:     parseInt(process.env.DB_PORT || '3306'),
          user:     process.env.DB_USER     || 'root',
          password: process.env.DB_PASSWORD || '',
          database: process.env.DB_NAME     || 'chatbot_db'
        },
        mongodb: {
          uri: process.env.MONGO_URI || 'mongodb://localhost:27017/chatbot_akademik'
        },
        postgres: {
          host:     process.env.DB_HOST     || 'localhost',
          port:     parseInt(process.env.DB_PORT || '5432'),
          user:     process.env.DB_USER     || 'postgres',
          password: process.env.DB_PASSWORD || '',
          database: process.env.DB_NAME     || 'chatbot_akademik'
        }
      }
    };
  } else {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    if (!config.databaseConfig) config.databaseConfig = {};
    if (!config.databaseConfig.sqlite) config.databaseConfig.sqlite = {};
    if (!config.databaseConfig.mysql) config.databaseConfig.mysql = {};
    if (!config.databaseConfig.mongodb) config.databaseConfig.mongodb = {};
    if (!config.databaseConfig.postgres) config.databaseConfig.postgres = {};

    if (process.env.DB_HOST)     config.databaseConfig.mysql.host     = process.env.DB_HOST;
    if (process.env.DB_PORT)     config.databaseConfig.mysql.port     = parseInt(process.env.DB_PORT);
    if (process.env.DB_USER)     config.databaseConfig.mysql.user     = process.env.DB_USER;
    if (process.env.DB_PASSWORD) config.databaseConfig.mysql.password = process.env.DB_PASSWORD;
    if (process.env.DB_NAME)     config.databaseConfig.mysql.database = process.env.DB_NAME;
    if (process.env.SQLITE_FILENAME) config.databaseConfig.sqlite.filename = process.env.SQLITE_FILENAME;
    if (process.env.MONGO_URI) config.databaseConfig.mongodb.uri = process.env.MONGO_URI;
    if (process.env.STORAGE_BACKEND) config.storageBackend = process.env.STORAGE_BACKEND.toLowerCase();
    if (!config.storageBackend) config.storageBackend = 'json';
  }

  return config;
}

function writeConfig(config) {
  config.storageBackend = config.storageBackend || 'json';
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

let activeAdapter = null;

function getAdapter() {
  if (activeAdapter) return activeAdapter;
  const config = readConfig();
  const backend = (process.env.STORAGE_BACKEND || config.storageBackend || 'json').toLowerCase();

  switch (backend) {
    case 'sqlite':
      activeAdapter = new (require('./adapters/sqliteAdapter'))(config.databaseConfig.sqlite);
      break;
    case 'json':
      activeAdapter = new (require('./adapters/jsonAdapter'))();
      break;
    case 'mysql':
      activeAdapter = new (require('./adapters/mysqlAdapter'))(config.databaseConfig.mysql);
      break;
    case 'postgres':
      activeAdapter = new (require('./adapters/sqlAdapter'))('postgres', config.databaseConfig.postgres);
      break;
    case 'mongodb':
      activeAdapter = new (require('./adapters/mongoAdapter'))(config.databaseConfig.mongodb);
      break;
    default:
      throw new Error(`Unknown storage backend "${backend}". Valid values are json, sqlite, mysql, postgres, mongodb.`);
  }

  return activeAdapter;
}

module.exports = {
  readConfig,
  writeConfig,

  async init() {
    const adapter = getAdapter();
    await adapter.init();
  },

  // Auth Users
  async createUser(user)         { return await getAdapter().createUser(user); },
  async getUserByEmail(email)    { return await getAdapter().getUserByEmail(email); },
  async getUserById(id)          { return await getAdapter().getUserById(id); },
  async updateUser(id, data)     { return await getAdapter().updateUser(id, data); },

  // Chatbots
  async getChatbots(userId) {
    const bots = await getAdapter().getChatbots(userId);
    return bots.map(b => {
      if (b.aiApiKey) b.aiApiKey = decrypt(b.aiApiKey);
      return b;
    });
  },
  async getChatbotById(id, userId) {
    const bot = await getAdapter().getChatbotById(id, userId);
    if (bot && bot.aiApiKey) bot.aiApiKey = decrypt(bot.aiApiKey);
    return bot;
  },
  async getChatbotByAgentKey(agentKey) {
    const bot = await getAdapter().getChatbotByAgentKey(agentKey);
    if (bot && bot.aiApiKey) bot.aiApiKey = decrypt(bot.aiApiKey);
    return bot;
  },
  async addChatbot(bot) {
    if (bot.aiApiKey) bot.aiApiKey = encrypt(bot.aiApiKey);
    return await getAdapter().addChatbot(bot);
  },
  async updateChatbot(id, data, userId) {
    if (data.aiApiKey) data.aiApiKey = encrypt(data.aiApiKey);
    return await getAdapter().updateChatbot(id, data, userId);
  },
  async deleteChatbot(id, userId)        { return await getAdapter().deleteChatbot(id, userId); },

  // Intents
  async getIntents(chatbotId)                  { return await getAdapter().getIntents(chatbotId); },
  async addIntent(chatbotId, intent)           { return await getAdapter().addIntent(chatbotId, intent); },
  async updateIntent(id, chatbotId, intent)    { return await getAdapter().updateIntent(id, chatbotId, intent); },
  async deleteIntent(id, chatbotId)            { return await getAdapter().deleteIntent(id, chatbotId); },

  // Documents
  async getDocuments(chatbotId)                       { return await getAdapter().getDocuments(chatbotId); },
  async addDocument(chatbotId, doc)                   { return await getAdapter().addDocument(chatbotId, doc); },
  async deleteDocument(id, chatbotId)                 { return await getAdapter().deleteDocument(id, chatbotId); },
  async updateDocumentStatus(id, chatbotId, status)   { return await getAdapter().updateDocumentStatus(id, chatbotId, status); },

  // Knowledge Base
  async getKnowledgeBase(chatbotId)              { return await getAdapter().getKnowledgeBase(chatbotId); },
  async addKnowledgeBase(chatbotId, excerpts)    { return await getAdapter().addKnowledgeBase(chatbotId, excerpts); },
  async clearKnowledgeBase(documentId, chatbotId) { return await getAdapter().clearKnowledgeBase(documentId, chatbotId); },

  // Stats optimized helper
  async getStats(chatbotId, userId) {
    const adapter = getAdapter();
    if (typeof adapter.getStats === 'function') {
      return await adapter.getStats(chatbotId, userId);
    }
    // Fallback to legacay full database select for adapters without optimized implementation
    const intents = await adapter.getIntents(chatbotId);
    const docs = await adapter.getDocuments(chatbotId);
    const kb = await adapter.getKnowledgeBase(chatbotId);
    const bot = await adapter.getChatbotById(chatbotId, userId);
    return {
      intentsCount: intents.length,
      documentsCount: docs.length,
      kbExcerptsCount: kb.length,
      processedDocs: docs.filter(d => d.status === 'processed').length,
      failedDocs: docs.filter(d => d.status === 'failed').length,
      tokenUsage: bot ? (bot.tokenUsage || 0) : 0
    };
  }
};
