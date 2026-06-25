require('dotenv').config();

// Polyfills for pdf-parse in serverless environments (like Vercel)
const DummyDOMMatrix = class DOMMatrix {
  constructor() { this.a=1;this.b=0;this.c=0;this.d=1;this.e=0;this.f=0; }
};
const DummyImageData = class ImageData {
  constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); }
};
const DummyPath2D = class Path2D {};

global.DOMMatrix = global.DOMMatrix || globalThis.DOMMatrix || DummyDOMMatrix;
global.ImageData = global.ImageData || globalThis.ImageData || DummyImageData;
global.Path2D = global.Path2D || globalThis.Path2D || DummyPath2D;

globalThis.DOMMatrix = global.DOMMatrix;
globalThis.ImageData = global.ImageData;
globalThis.Path2D = global.Path2D;

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

const adminMiddleware = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Akses ditolak: Hanya administrator yang diizinkan' });
  }
};

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'chatagentive-super-secret-key-9988';

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, mobile apps) or 'null' (local file testing)
    if (!origin || origin === 'null') return callback(null, true);

    // Mengizinkan semua origin agar widget bisa dipasang di website mana saja (Wordpress, dll)
    const allowed = true;

    if (allowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS: ' + origin));
    }
  },
  credentials: true
}));
app.use(bodyParser.json());
// Only serve backend's own public folder (e.g. widget.js, embed scripts)
// Frontend is a separate Vercel deployment — do NOT serve frontend/dist from here
app.use(express.static(path.join(__dirname, 'public')));

// Configure upload directory (local dev only)
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!process.env.VERCEL && !fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer config: use memoryStorage on Vercel (serverless), diskStorage locally
const storage = process.env.VERCEL
  ? multer.memoryStorage()
  : multer.diskStorage({
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

let isDbInitialized = false;
let dbInitPromise = null;

async function initDbIfNeeded() {
  if (isDbInitialized) return;
  if (!dbInitPromise) {
    dbInitPromise = dbManager.init().then(() => {
      isDbInitialized = true;
      console.log('Database initialized successfully.');
    }).catch(err => {
      console.error('Database initialization failed:', err);
      dbInitPromise = null;
      throw err;
    });
  }
  await dbInitPromise;
}

// Middleware to ensure DB is initialized before handling requests
app.use(async (req, res, next) => {
  try {
    await initDbIfNeeded();
    next();
  } catch (err) {
    res.status(500).json({ error: 'Database connection failed: ' + err.message });
  }
});

async function startServer() {
  const server = app.listen(PORT, () => {
    console.log(`🤖 Aethel server running on http://localhost:${PORT}`);
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

// Only start the listener if running locally (not in serverless env)
if (!process.env.VERCEL) {
  initDbIfNeeded().then(() => {
    startServer();
  }).catch(err => {
    console.error('Initial DB connect failed, will retry on request.');
  });
}

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

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
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

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role || 'user' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role || 'user' }
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
    const bot = await dbManager.getChatbotById(chatbotId, req.user.role === 'admin' ? null : req.user.id);
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
    const statsData = await dbManager.getStats(chatbotId, req.user.id);
    res.json(statsData);
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
    const kb = await dbManager.getKnowledgeBase(req.params.chatbotId);

    const mappedDocs = docs.map(doc => {
      const docExcerpts = kb.filter(k => k.documentId === doc.id);
      const pageNumbers = docExcerpts.map(e => e.pageNumber);
      const maxPage = pageNumbers.length > 0 ? Math.max(...pageNumbers) : 0;

      return {
        id: doc.id,
        chatbotId: doc.chatbotId,
        name: doc.name,
        fileName: doc.name,
        uploadDate: doc.uploadDate,
        sizeBytes: doc.sizeBytes,
        fileSizeBytes: doc.sizeBytes,
        status: doc.status,
        pagesCount: maxPage || 1
      };
    });

    res.json(mappedDocs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chatbots/:chatbotId/documents', authMiddleware, authorizeBot, upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File PDF harus diunggah' });
  }

  const { chatbotId } = req.params;
  const fileName = req.file.originalname;

  // Get file buffer - memoryStorage gives req.file.buffer, diskStorage needs to read from path
  let fileBuffer;
  if (req.file.buffer) {
    // Vercel / memoryStorage
    fileBuffer = req.file.buffer;
  } else {
    // Local / diskStorage
    const filePath = req.file.path;
    try {
      fileBuffer = fs.readFileSync(filePath);
    } catch (readErr) {
      console.error('Gagal membaca file lokal:', readErr);
      try { fs.unlinkSync(filePath); } catch (e) {}
      return res.status(500).json({ error: 'Gagal memproses file setelah upload' });
    }
  }

  // Strict validation: Check PDF magic bytes (%PDF)
  if (!fileBuffer || fileBuffer.slice(0, 4).toString() !== '%PDF') {
    if (req.file.path) { try { fs.unlinkSync(req.file.path); } catch (e) {} }
    return res.status(400).json({ error: 'File bukan format PDF asli!' });
  }

  const r2Service = require('./r2Service');
  const documentId = Date.now().toString();

  try {
    let finalDocId = documentId;

    // If Cloudflare R2 is configured, upload the file
    if (r2Service.isConfigured()) {
      try {
        const r2FileId = await r2Service.uploadFile(fileName, fileBuffer);
        finalDocId = r2FileId;
      } catch (r2Err) {
        console.error('Cloudflare R2 upload failed, falling back to local storage:', r2Err);
      }
    }

    const doc = await dbManager.addDocument(chatbotId, {
      id: finalDocId,
      name: fileName,
      sizeBytes: req.file.size,
      status: 'processing'
    });

    // Extract PDF and wait for completion (required for Vercel/serverless environments)
    try {
      const excerpts = await pdfProcessor.processPdf(fileBuffer, fileName, finalDocId);
      const excerptsWithBotId = excerpts.map(e => ({ ...e, chatbotId }));
      await dbManager.addKnowledgeBase(chatbotId, excerptsWithBotId);
      await dbManager.updateDocumentStatus(finalDocId, chatbotId, 'processed');
      doc.status = 'processed';

      // Cleanup local file if it exists on disk
      if (req.file.path) {
        try { fs.unlinkSync(req.file.path); } catch (e) {}
      }
    } catch (pdfErr) {
      console.error('PDF extraction failed:', pdfErr);
      await dbManager.updateDocumentStatus(finalDocId, chatbotId, 'failed');
      doc.status = 'failed';
    }

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

    // Delete from Cloudflare R2 if configured
    const r2Service = require('./r2Service');
    if (r2Service.isConfigured()) {
      await r2Service.deleteFile(id);
    }

    // Cleanup local file (if it exists)
    if (doc && fs.existsSync(UPLOAD_DIR)) {
      try {
        const files = fs.readdirSync(UPLOAD_DIR);
        const matchedFile = files.find(f => f.endsWith(doc.name));
        if (matchedFile) {
          fs.unlinkSync(path.join(UPLOAD_DIR, matchedFile));
        }
      } catch (e) {}
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

    let buffer;
    const r2Service = require('./r2Service');

    // Try finding the file locally first
    let matchedFile;
    if (fs.existsSync(UPLOAD_DIR)) {
      try {
        const files = fs.readdirSync(UPLOAD_DIR);
        matchedFile = files.find(f => f.endsWith(doc.name));
      } catch (e) {}
    }

    if (matchedFile) {
      const filePath = path.join(UPLOAD_DIR, matchedFile);
      buffer = fs.readFileSync(filePath);
    } else if (r2Service.isConfigured()) {
      // Download from Cloudflare R2 if not found locally
      try {
        buffer = await r2Service.downloadFile(id);
      } catch (dlErr) {
        console.error(`Gagal mendownload dari Cloudflare R2 untuk id ${id}:`, dlErr);
        return res.status(404).json({ error: 'File tidak ditemukan di lokal maupun Cloudflare R2' });
      }
    } else {
      return res.status(404).json({ error: 'File fisik tidak ditemukan' });
    }
    
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
    // Sort by pageNumber to maintain document order
    docExcerpts.sort((a, b) => (a.pageNumber - b.pageNumber) || a.id.localeCompare(b.id));
    const fullText = docExcerpts.map(e => e.content).join('\n\n');
    res.json({
      extractedText: fullText,
      excerpts: docExcerpts
    });
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
    const clientIp = req.ip || req.connection.remoteAddress;
    const answer = await chatbotEngine.findAnswer(chatbotId, message, clientIp);
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

    const clientIp = req.ip || req.connection.remoteAddress;
    const answer = await chatbotEngine.findAnswer(bot.id, message, clientIp);
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
// 4.5. Admin Endpoints (Protected & Admin Only)
// ==========================================
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await dbManager.getAllUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await dbManager.deleteUser(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/chatbots', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const chatbots = await dbManager.getAllChatbotsAdmin();
    res.json(chatbots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/chatbots/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const bot = await dbManager.getChatbotById(req.params.id, null);
    if (!bot) return res.status(404).json({ error: 'Chatbot tidak ditemukan' });
    await dbManager.deleteChatbot(req.params.id, bot.userId);
    res.json({ success: true });
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

