require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const dbManager = require('./db');
const chatbotEngine = require('./chatbotEngine');
const pdfProcessor = require('./pdfProcessor');
const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'chatagentive-super-secret-key-9988';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Configure upload directory
const UPLOAD_DIR = process.env.VERCEL
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer config for PDF uploading
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf') {
      return cb(new Error('Hanya file PDF yang diperbolehkan!'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

async function startServer() {
  const server = app.listen(PORT, () => {
    console.log(`🤖 Aethel server running on http://localhost:${PORT}`);
    console.log(`🔑 Login page: http://localhost:${PORT}/login.html`);
    console.log(`📊 Dashboard page: http://localhost:${PORT}/index.html`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} already in use. Please stop the process using that port or set PORT to a different value.`);
      process.exit(1);
    }
    console.error('Server error:', err);
    process.exit(1);
  });
}

// Initialize DB Manager and start the server only after successful DB init
dbManager.init()
  .then(() => {
    console.log('Database initialized successfully.');
    return startServer();
  })
  .catch(err => {
    console.error('Database initialization failed:', err);
    process.exit(1);
  });

// ==========================================
// 1. Authentication Endpoints
// ==========================================

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Nama, Email, dan Password wajib diisi' });
  }

  try {
    const existing = await dbManager.getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'Email sudah terdaftar' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await dbManager.createUser({
      email,
      password: hashedPassword,
      name
    });

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan Password wajib diisi' });
  }

  try {
    const user = await dbManager.getUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'Email atau Password salah' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ error: 'Email atau Password salah' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/auth/profile', authMiddleware, async (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  try {
    const user = await dbManager.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User tidak ditemukan' });
    }

    const updateData = {};

    if (name) updateData.name = name;
    
    if (email && email !== user.email) {
      const existing = await dbManager.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: 'Email sudah terdaftar' });
      }
      updateData.email = email;
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Password saat ini diperlukan untuk mengganti password baru' });
      }
      const dbUser = await dbManager.getUserByEmail(user.email);
      const match = await bcrypt.compare(currentPassword, dbUser.password);
      if (!match) {
        return res.status(400).json({ error: 'Password saat ini salah' });
      }
      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    await dbManager.updateUser(userId, updateData);
    
    const updatedUser = await dbManager.getUserById(userId);
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. Chatbots Management Endpoints (Protected)
// ==========================================

app.get('/api/chatbots', authMiddleware, async (req, res) => {
  try {
    const chatbots = await dbManager.getChatbots(req.user.id);
    res.json(chatbots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chatbots', authMiddleware, async (req, res) => {
  const { name, businessType } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Nama chatbot wajib diisi' });
  }

  try {
    // Generate secure agent key
    const agentKey = crypto.randomBytes(24).toString('hex');
    const newBot = await dbManager.addChatbot({
      userId: req.user.id,
      name,
      businessType: businessType || 'Other',
      agentKey
    });
    res.json(newBot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/chatbots/:id', authMiddleware, async (req, res) => {
  try {
    // Verify bot belongs to user
    const bot = await dbManager.getChatbotById(req.params.id, req.user.id);
    if (!bot) {
      return res.status(404).json({ error: 'Chatbot tidak ditemukan' });
    }

    await dbManager.deleteChatbot(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. Per-chatbot Configurations & CRUD (Protected)
// ==========================================

// Middleware helper to authorize chatbot access
async function authorizeBot(req, res, next) {
  const { chatbotId } = req.params;
  try {
    const bot = await dbManager.getChatbotById(chatbotId, req.user.id);
    if (!bot) {
      return res.status(404).json({ error: 'Akses ditolak: Chatbot tidak ditemukan' });
    }
    req.chatbot = bot;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

app.get('/api/chatbots/:chatbotId/config', authMiddleware, authorizeBot, (req, res) => {
  const bot = req.chatbot;
  // Mask API key if set
  const maskedApiKey = bot.aiApiKey ? '****************' : '';
  res.json({
    name: bot.name,
    businessType: bot.businessType,
    agentKey: bot.agentKey,
    aiEnabled: bot.aiEnabled,
    aiProvider: bot.aiProvider,
    aiModel: bot.aiModel,
    aiSystemPrompt: bot.aiSystemPrompt,
    aiApiKey: maskedApiKey,
    branding: bot.branding,
    nlp: bot.nlp
  });
});

app.post('/api/chatbots/:chatbotId/config', authMiddleware, authorizeBot, async (req, res) => {
  const { chatbotId } = req.params;
  const { name, aiEnabled, aiProvider, aiApiKey, aiModel, aiSystemPrompt, branding, nlp } = req.body;

  const updateFields = {
    name,
    aiEnabled,
    aiProvider,
    aiModel,
    aiSystemPrompt,
    branding,
    nlp
  };

  // If a new API key is provided and it's not the masked template, update it
  if (aiApiKey !== undefined && aiApiKey !== '****************') {
    updateFields.aiApiKey = aiApiKey;
  }

  try {
    await dbManager.updateChatbot(chatbotId, updateFields, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chatbots/:chatbotId/config/rotate-key', authMiddleware, authorizeBot, async (req, res) => {
  const { chatbotId } = req.params;
  const newAgentKey = crypto.randomBytes(24).toString('hex');
  try {
    await dbManager.updateChatbot(chatbotId, { agentKey: newAgentKey }, req.user.id);
    res.json({ success: true, agentKey: newAgentKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test AI connection endpoint
app.post('/api/chatbots/:chatbotId/test-ai', authMiddleware, authorizeBot, async (req, res) => {
  const bot = req.chatbot;
  const { provider, apiKey, model } = req.body;

  const testProvider = provider || bot.aiProvider;
  const testKey = (apiKey && apiKey !== '****************') ? apiKey : bot.aiApiKey;
  const testModel = model || bot.aiModel;

  if (!testProvider) return res.status(400).json({ error: 'Provider belum dikonfigurasi' });
  if (!testKey && testProvider !== 'ollama') return res.status(400).json({ error: 'API Key belum dikonfigurasi' });

  try {
    const aiService = require('./aiService');
    const result = await aiService.generateResponse(
      testProvider, testKey, testModel,
      'You are a helpful assistant.',
      'Respond with exactly: "Connection OK"',
      ''
    );
    res.json({ success: true, response: result.responseText, provider: testProvider, model: testModel });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Stats endpoint per chatbot
app.get('/api/chatbots/:chatbotId/stats', authMiddleware, authorizeBot, async (req, res) => {
  const { chatbotId } = req.params;
  try {
    const intents = await dbManager.getIntents(chatbotId);
    const docs = await dbManager.getDocuments(chatbotId);
    const kb = await dbManager.getKnowledgeBase(chatbotId);
    const bot = await dbManager.getChatbotById(chatbotId, req.user.id);
    res.json({
      intentsCount: intents.length,
      documentsCount: docs.length,
      kbExcerptsCount: kb.length,
      processedDocs: docs.filter(d => d.status === 'processed').length,
      failedDocs: docs.filter(d => d.status === 'failed').length,
      tokenUsage: bot ? (bot.tokenUsage || 0) : 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch available Ollama models from a given endpoint
app.post('/api/ollama/models', authMiddleware, async (req, res) => {
  const { endpoint } = req.body;
  const baseUrl = endpoint || 'http://localhost:11434';
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const models = (data.models || []).map(m => m.name);
    res.json({ models });
  } catch (err) {
    res.status(400).json({ error: `Tidak bisa terhubung ke Ollama: ${err.message}` });
  }
});


app.get('/api/chatbots/:chatbotId/intents', authMiddleware, authorizeBot, async (req, res) => {
  try {
    const intents = await dbManager.getIntents(req.params.chatbotId);
    res.json(intents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chatbots/:chatbotId/intents', authMiddleware, authorizeBot, async (req, res) => {
  const { chatbotId } = req.params;
  let { keywords, response, category } = req.body;
  if (!keywords || !response) {
    return res.status(400).json({ error: 'Keywords dan response harus diisi' });
  }

  if (typeof keywords === 'string') {
    keywords = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
  }

  try {
    const newIntent = await dbManager.addIntent(chatbotId, {
      keywords,
      response,
      category: category || 'General'
    });
    res.json(newIntent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/chatbots/:chatbotId/intents/:id', authMiddleware, authorizeBot, async (req, res) => {
  const { chatbotId, id } = req.params;
  let { keywords, response, category } = req.body;

  if (!keywords || !response) {
    return res.status(400).json({ error: 'Keywords dan response harus diisi' });
  }

  if (typeof keywords === 'string') {
    keywords = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
  }

  try {
    const updated = await dbManager.updateIntent(id, chatbotId, {
      keywords,
      response,
      category: category || 'General'
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/chatbots/:chatbotId/intents/:id', authMiddleware, authorizeBot, async (req, res) => {
  const { chatbotId, id } = req.params;
  try {
    await dbManager.deleteIntent(id, chatbotId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PDF Documents Scoped
app.get('/api/chatbots/:chatbotId/documents', authMiddleware, authorizeBot, async (req, res) => {
  try {
    const docs = await dbManager.getDocuments(req.params.chatbotId);
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chatbots/:chatbotId/documents', authMiddleware, authorizeBot, upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File PDF harus diunggah' });
  }

  const { chatbotId } = req.params;
  const filePath = req.file.path;
  const fileName = req.file.originalname;

  // Strict validation: Check PDF magic bytes (%PDF)
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(4);
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);
    if (buffer.toString() !== '%PDF') {
      try { fs.unlinkSync(filePath); } catch (e) {}
      return res.status(400).json({ error: 'File bukan format PDF asli!' });
    }
  } catch (err) {
    try { fs.unlinkSync(filePath); } catch (e) {}
    return res.status(400).json({ error: 'Gagal memvalidasi isi file PDF!' });
  }

  const documentId = Date.now().toString();

  try {
    const doc = await dbManager.addDocument(chatbotId, {
      id: documentId,
      name: fileName,
      sizeBytes: req.file.size,
      status: 'processing'
    });

    // Extract PDF in background
    fs.readFile(filePath, async (err, data) => {
      if (err) {
        console.error('File read error:', err);
        await dbManager.updateDocumentStatus(documentId, chatbotId, 'failed');
        return;
      }
      try {
        const excerpts = await pdfProcessor.processPdf(data, fileName, documentId);
        // Excerpts need to carry chatbotId
        const excerptsWithBotId = excerpts.map(e => ({ ...e, chatbotId }));
        await dbManager.addKnowledgeBase(chatbotId, excerptsWithBotId);
        await dbManager.updateDocumentStatus(documentId, chatbotId, 'processed');
      } catch (pdfErr) {
        console.error('PDF extraction failed:', pdfErr);
        await dbManager.updateDocumentStatus(documentId, chatbotId, 'failed');
      }
    });

    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/chatbots/:chatbotId/documents/:id', authMiddleware, authorizeBot, async (req, res) => {
  const { chatbotId, id } = req.params;
  try {
    const docs = await dbManager.getDocuments(chatbotId);
    const doc = docs.find(d => d.id === id);
    
    await dbManager.deleteDocument(id, chatbotId);

    if (doc) {
      const files = fs.readdirSync(UPLOAD_DIR);
      const matchedFile = files.find(f => f.endsWith(doc.name));
      if (matchedFile) {
        try {
          fs.unlinkSync(path.join(UPLOAD_DIR, matchedFile));
        } catch (e) {}
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chatbots/:chatbotId/documents/:id/reprocess', authMiddleware, authorizeBot, async (req, res) => {
  const { chatbotId, id } = req.params;
  try {
    const docs = await dbManager.getDocuments(chatbotId);
    const doc = docs.find(d => d.id === id);
    if (!doc) return res.status(404).json({ error: 'Dokumen tidak ditemukan' });

    const files = fs.readdirSync(UPLOAD_DIR);
    const matchedFile = files.find(f => f.endsWith(doc.name));
    if (!matchedFile) return res.status(404).json({ error: 'File fisik tidak ditemukan' });

    const filePath = path.join(UPLOAD_DIR, matchedFile);
    const buffer = fs.readFileSync(filePath);
    
    await dbManager.clearKnowledgeBase(id, chatbotId);
    const excerpts = await pdfProcessor.processPdf(buffer, doc.name, id);
    const excerptsWithBotId = excerpts.map(e => ({ ...e, chatbotId }));
    await dbManager.addKnowledgeBase(chatbotId, excerptsWithBotId);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/chatbots/:chatbotId/documents/:id/text', authMiddleware, authorizeBot, async (req, res) => {
  const { chatbotId, id } = req.params;
  try {
    const kb = await dbManager.getKnowledgeBase(chatbotId);
    const docExcerpts = kb.filter(k => k.documentId === id);
    res.json(docExcerpts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/chatbots/:chatbotId/documents/:id/auto-intents', authMiddleware, authorizeBot, async (req, res) => {
  const { chatbotId, id } = req.params;
  try {
    const kb = await dbManager.getKnowledgeBase(chatbotId);
    const docExcerpts = kb.filter(k => k.documentId === id);
    const autoIntents = pdfProcessor.autoGenerateIntents(docExcerpts);
    res.json(autoIntents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. Public Chatbots Widget API (No Auth)
// ==========================================

// Chat endpoint (CORS enabled)
app.post('/api/chatbots/:chatbotId/chat', async (req, res) => {
  const { chatbotId } = req.params;
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Parameter message diperlukan' });
  }

  try {
    const answer = await chatbotEngine.findAnswer(chatbotId, message);
    res.json(answer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Embed configurations endpoint
app.get('/api/chatbots/:chatbotId/embed-config', async (req, res) => {
  const { chatbotId } = req.params;
  try {
    const bot = await dbManager.getChatbotById(chatbotId);
    if (!bot) {
      return res.status(404).json({ error: 'Chatbot tidak ditemukan' });
    }
    res.json({
      name: bot.name,
      branding: bot.branding
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public chat endpoint by agentKey
app.post('/api/agents/:agentKey/chat', async (req, res) => {
  const { agentKey } = req.params;
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Parameter message diperlukan' });

  try {
    const bot = await dbManager.getChatbotByAgentKey(agentKey);
    if (!bot) return res.status(404).json({ error: 'Chatbot tidak ditemukan' });

    const answer = await chatbotEngine.findAnswer(bot.id, message);
    res.json(answer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public config endpoint by agentKey
app.get('/api/agents/:agentKey/config', async (req, res) => {
  const { agentKey } = req.params;
  try {
    const bot = await dbManager.getChatbotByAgentKey(agentKey);
    if (!bot) return res.status(404).json({ error: 'Chatbot tidak ditemukan' });

    res.json({
      id: bot.id,
      name: bot.name,
      branding: bot.branding
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. Global Settings Endpoints (Protected)
// ==========================================
app.get('/api/settings', authMiddleware, (req, res) => {
  try {
    const config = dbManager.readConfig();
    const safeConfig = {
      storageBackend: config.storageBackend,
      nlp: config.nlp || { similarityThreshold: 0.6, stemmingEnabled: true, stopWordsEnabled: true, language: 'id' },
      branding: config.branding || { fallbackMessage: '', greetingMessage: '', widgetTitle: '', welcomeText: '' }
    };
    res.json(safeConfig);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', authMiddleware, (req, res) => {
  const { storageBackend, nlp, branding } = req.body;
  try {
    const config = dbManager.readConfig();
    if (storageBackend) config.storageBackend = storageBackend;
    if (nlp) config.nlp = nlp;
    if (branding) config.branding = branding;
    dbManager.writeConfig(config);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// The server is started after successful DB initialization in the startup logic above.


module.exports = app;

