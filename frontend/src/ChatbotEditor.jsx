import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { apiFetch } from './api';
import './ChatbotEditor.css';

function parseMarkdown(text) {
  if (!text) return '';
  let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  let lines = html.split('\n');
  let inList = false;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (/^[\*\-]\s+(.*)/.test(line)) {
      if (!inList) {
        lines[i] = '<ul style="margin: 4px 0 4px 20px; padding: 0;"><li>' + line.replace(/^[\*\-]\s+/, '') + '</li>';
        inList = true;
      } else {
        lines[i] = '<li>' + line.replace(/^[\*\-]\s+/, '') + '</li>';
      }
    } else {
      if (inList) { lines[i - 1] += '</ul>'; inList = false; }
      lines[i] = line;
    }
  }
  if (inList) lines[lines.length - 1] += '</ul>';
  html = lines.join('<br/>');
  html = html.replace(/<\/ul><br\/>/g, '</ul>');
  html = html.replace(/<ul(.*?)><br\/>/g, '<ul$1>');
  html = html.replace(/<\/li><br\/><li>/g, '</li><li>');
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color: inherit; text-decoration: underline;">$1</a>');
  return html;
}

export default function ChatbotEditor() {
  const [searchParams] = useSearchParams();
  const chatbotId = searchParams.get('chatbotId');
  const navigate = useNavigate();
  const token = localStorage.getItem('aethel_token');

  // Active tab: overview, ai-config, intents, kb, integration, playground
  const [activeTab, setActiveTab] = useState('overview');
  const [theme, setTheme] = useState(localStorage.getItem('aethel_theme') || 'dark');
  const [botConfig, setBotConfig] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  // AI Configuration State
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiProvider, setAiProvider] = useState('openai');
  const [aiModel, setAiModel] = useState('');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiSystemPrompt, setAiSystemPrompt] = useState('');
  const [similarityThreshold, setSimilarityThreshold] = useState(0.6);
  const [nlpEnabled, setNlpEnabled] = useState(true);
  const [nlpConfig, setNlpConfig] = useState({});
  const [botName, setBotName] = useState('Support Bot');
  const [agentKey, setAgentKey] = useState('');
  const [testingAI, setTestingAI] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Appearance / Branding State
  const [brandingConfig, setBrandingConfig] = useState({
    primaryColor: '#fb2c36',
    chatBackground: '#ffffff',
    headerBackground: '#fb2c36',
    headerTextColor: '#ffffff',
    userBubbleColor: '#fb2c36',
    userTextColor: '#ffffff',
    agentBubbleColor: '#f1f5f9',
    agentTextColor: '#0f172a',
    audioButtonColor: '#fb2c36',
    avatarUrl: '',
    floatingIconUrl: '',
    displayName: 'Support Bot',
    welcomeMessage: 'Hi! How can I help?'
  });

  // Intents State
  const [intents, setIntents] = useState([]);
  const [intentsLoading, setIntentsLoading] = useState(false);
  const [intentModalOpen, setIntentModalOpen] = useState(false);
  const [editingIntent, setEditingIntent] = useState(null); // null means adding new
  const [intentKeywords, setIntentKeywords] = useState('');
  const [intentResponse, setIntentResponse] = useState('');
  const [intentCategory, setIntentCategory] = useState('General');

  // Knowledge Base State
  const [documents, setDocuments] = useState([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [viewingDocText, setViewingDocText] = useState(null); // doc object for modal
  const [docTextContent, setDocTextContent] = useState('');
  const [docTextLoading, setDocTextLoading] = useState(false);

  // Playground State
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // WordPress Modal State
  const [wpModalOpen, setWpModalOpen] = useState(false);

  // Toast Helper
  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    if (!chatbotId) {
      navigate('/');
      return;
    }
    loadAllData();
  }, [token, chatbotId]);

  useEffect(() => {
    document.body.className = theme === 'light' ? 'light-theme' : '';
    localStorage.setItem('aethel_theme', theme);
  }, [theme]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      // Fetch Config and Stats in parallel to reduce loading latency
      const [configRes, statsRes] = await Promise.all([
        apiFetch(`/api/chatbots/${chatbotId}/config`, { headers }),
        apiFetch(`/api/chatbots/${chatbotId}/stats`, { headers })
      ]);

      if (configRes.ok) {
        const configData = await configRes.json();
        setBotConfig(configData);
        setAiEnabled(configData.aiEnabled || false);
        setAiProvider(configData.aiProvider || 'openai');
        setAiModel(configData.aiModel || '');
        setAiApiKey(configData.aiApiKey || '');
        setAiSystemPrompt(configData.aiSystemPrompt || '');
        setSimilarityThreshold(configData.nlp?.similarityThreshold || 0.6);
        setNlpEnabled(configData.nlp?.nlpEnabled !== false);
        setNlpConfig(configData.nlp || {});
        setBotName(configData.botName || 'Support Bot');
        setAgentKey(configData.agentKey || '');
        if (configData.branding) {
          // If it's a string, parse it. If it's an object, spread it.
          const parsedBranding = typeof configData.branding === 'string' 
            ? JSON.parse(configData.branding) 
            : configData.branding;
          setBrandingConfig(prev => ({ ...prev, ...parsedBranding }));
        }
      } else {
        showToast('Gagal memuat konfigurasi bot', 'error');
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error(err);
      showToast('Koneksi server bermasalah', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Reload stats helper
  const reloadStats = async () => {
    try {
      const statsRes = await apiFetch(`/api/chatbots/${chatbotId}/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error('Failed to reload stats', err);
    }
  };

  // Load Intents
  const loadIntents = async () => {
    setIntentsLoading(true);
    try {
      const res = await apiFetch(`/api/chatbots/${chatbotId}/intents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIntents(data);
      } else {
        showToast('Gagal memuat Q&A intents', 'error');
      }
    } catch (err) {
      showToast('Koneksi server bermasalah', 'error');
    } finally {
      setIntentsLoading(false);
    }
  };

  // Load Documents
  const loadDocuments = async () => {
    setKbLoading(true);
    try {
      const res = await apiFetch(`/api/chatbots/${chatbotId}/documents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      } else {
        showToast('Gagal memuat dokumen', 'error');
      }
    } catch (err) {
      showToast('Koneksi server bermasalah', 'error');
    } finally {
      setKbLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'intents') {
      loadIntents();
    } else if (activeTab === 'kb') {
      loadDocuments();
    } else if (activeTab === 'playground') {
      // Init preview welcome message
      setChatMessages([
        { sender: 'bot', text: `Halo! Saya adalah ${botName || 'AI Agent'}. Ada yang bisa saya bantu?`, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }
      ]);
    }
  }, [activeTab]);

  // AI config saving
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await apiFetch(`/api/chatbots/${chatbotId}/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: botName,
          aiEnabled,
          aiProvider,
          aiModel,
          aiApiKey,
          aiSystemPrompt,
          botName,
          nlp: {
            ...nlpConfig,
            similarityThreshold: parseFloat(similarityThreshold),
            nlpEnabled: nlpEnabled
          },
          branding: brandingConfig
        })
      });

      if (res.ok) {
        showToast('Konfigurasi bot berhasil disimpan!', 'success');
        reloadStats();
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Gagal menyimpan konfigurasi', 'error');
      }
    } catch (err) {
      showToast('Koneksi server bermasalah', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  // Rotate Agent Key
  const handleRotateKey = async () => {
    if (!window.confirm('Apakah Anda yakin ingin me-rotate API Key widget? Script widget lama pada website Anda tidak akan berfungsi.')) return;
    try {
      const res = await apiFetch(`/api/chatbots/${chatbotId}/config/rotate-key`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAgentKey(data.agentKey);
        showToast('API Key Widget berhasil di-rotate!', 'success');
      } else {
        showToast('Gagal me-rotate API Key', 'error');
      }
    } catch (err) {
      showToast('Koneksi server bermasalah', 'error');
    }
  };

  // Test AI connection
  const handleTestAI = async () => {
    setTestingAI(true);
    try {
      const res = await apiFetch(`/api/chatbots/${chatbotId}/test-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          provider: aiProvider,
          apiKey: aiApiKey,
          model: aiModel
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Koneksi AI OK: ${data.response}`, 'success');
      } else {
        showToast(data.error || 'Koneksi AI Gagal', 'error');
      }
    } catch (err) {
      showToast('Gagal menghubungi server untuk testing', 'error');
    } finally {
      setTestingAI(false);
    }
  };

  // Intent Actions
  const openIntentModal = (intent = null) => {
    if (intent) {
      setEditingIntent(intent);
      setIntentKeywords(intent.keywords.join(', '));
      setIntentResponse(intent.response);
      setIntentCategory(intent.category || 'General');
    } else {
      setEditingIntent(null);
      setIntentKeywords('');
      setIntentResponse('');
      setIntentCategory('General');
    }
    setIntentModalOpen(true);
  };

  const handleSaveIntent = async (e) => {
    e.preventDefault();
    if (!intentKeywords || !intentResponse) {
      showToast('Keywords dan response wajib diisi', 'error');
      return;
    }

    const body = {
      keywords: intentKeywords,
      response: intentResponse,
      category: intentCategory
    };

    try {
      const url = editingIntent 
        ? `/api/chatbots/${chatbotId}/intents/${editingIntent.id}`
        : `/api/chatbots/${chatbotId}/intents`;
      const method = editingIntent ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        showToast(editingIntent ? 'Q&A berhasil diperbarui!' : 'Q&A berhasil ditambahkan!', 'success');
        setIntentModalOpen(false);
        loadIntents();
        reloadStats();
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Gagal menyimpan Q&A', 'error');
      }
    } catch (err) {
      showToast('Koneksi server bermasalah', 'error');
    }
  };

  const handleDeleteIntent = async (id) => {
    if (!window.confirm('Hapus Q&A intent ini?')) return;
    try {
      const res = await apiFetch(`/api/chatbots/${chatbotId}/intents/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Q&A intent berhasil dihapus', 'success');
        loadIntents();
        reloadStats();
      } else {
        showToast('Gagal menghapus Q&A intent', 'error');
      }
    } catch (err) {
      showToast('Koneksi server bermasalah', 'error');
    }
  };

  // PDF Actions
  const handlePdfUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast('Pilih file PDF terlebih dahulu', 'error');
      return;
    }
    setUploadingPdf(true);
    try {
      const formData = new FormData();
      formData.append('pdf', selectedFile);

      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/chatbots/${chatbotId}/documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (res.ok) {
        showToast('PDF berhasil diunggah dan sedang diproses!', 'success');
        setSelectedFile(null);
        e.target.reset();
        loadDocuments();
        reloadStats();
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Gagal mengunggah PDF', 'error');
      }
    } catch (err) {
      showToast('Koneksi server bermasalah', 'error');
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleDeleteDoc = async (id) => {
    if (!window.confirm('Hapus dokumen ini? Konten text RAG yang diekstrak akan dihapus dari knowledge base.')) return;
    try {
      const res = await apiFetch(`/api/chatbots/${chatbotId}/documents/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Dokumen berhasil dihapus', 'success');
        loadDocuments();
        reloadStats();
      } else {
        showToast('Gagal menghapus dokumen', 'error');
      }
    } catch (err) {
      showToast('Koneksi server bermasalah', 'error');
    }
  };

  const handleReprocessDoc = async (id) => {
    showToast('Memulai pemrosesan ulang dokumen...', 'info');
    try {
      const res = await apiFetch(`/api/chatbots/${chatbotId}/documents/${id}/reprocess`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Dokumen berhasil diproses ulang!', 'success');
        loadDocuments();
        reloadStats();
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Gagal memproses ulang dokumen', 'error');
      }
    } catch (err) {
      showToast('Koneksi server bermasalah', 'error');
    }
  };

  const handleViewDocText = async (doc) => {
    setViewingDocText(doc);
    setDocTextContent('');
    setDocTextLoading(true);
    try {
      const res = await apiFetch(`/api/chatbots/${chatbotId}/documents/${doc.id}/text`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDocTextContent(data.extractedText || 'Tidak ada teks yang terekstrak.');
      } else {
        setDocTextContent('Gagal memuat isi teks dokumen.');
      }
    } catch (err) {
      setDocTextContent('Error koneksi server.');
    } finally {
      setDocTextLoading(false);
    }
  };

  const handleAutoGenerateIntents = async (doc) => {
    if (!window.confirm('Auto-generate akan menganalisa dokumen ini menggunakan AI dan menghasilkan Q&A intent baru secara otomatis. Lanjutkan?')) return;
    showToast('Menganalisa dokumen menggunakan AI...', 'info');
    try {
      const res = await apiFetch(`/api/chatbots/${chatbotId}/documents/${doc.id}/auto-intents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`Berhasil men-generate ${data.generatedCount || 0} Q&A intents baru!`, 'success');
        reloadStats();
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Gagal melakukan auto-generate Q&A', 'error');
      }
    } catch (err) {
      showToast('Koneksi server bermasalah', 'error');
    }
  };

  // Playground Sandbox Chat
  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = {
      sender: 'user',
      text: chatInput,
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    };

    setChatMessages(prev => [...prev, userMsg]);
    const currentInput = chatInput;
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await apiFetch(`/api/chatbots/${chatbotId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInput })
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, {
          sender: 'bot',
          text: data.response || 'Maaf, saya tidak mengerti maksud Anda.',
          time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          source: data.source // intent, ai, kb, drive, default
        }]);
      } else {
        showToast('Gagal mengirim pesan sandbox', 'error');
      }
    } catch (err) {
      showToast('Koneksi server bermasalah', 'error');
    } finally {
      setChatLoading(false);
    }
  };

  // Embed script generator
  const getEmbedScript = () => {
    const origin = window.location.origin;
    return `<!-- Athel AI Chatbot Widget -->
<script src="${origin}/widget.js" data-agent-key="${agentKey}" defer></script>`;
  };

  if (loading) {
    return (
      <div className="editor-loading-screen">
        <div className="editor-spinner"></div>
        <p>Memuat konfigurasi agent...</p>
      </div>
    );
  }

  return (
    <div className="editor-wrapper">
      {/* Background Orbs */}
      <div className="orb-canvas">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      <div className="editor-app">
        {/* Sidebar */}
        <aside className="editor-sidebar">
          <Link to="/" className="editor-back-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
            Kembali ke Dashboard
          </Link>

          <div className="editor-bot-title">
            <div className="editor-bot-avatar" style={{ background: `linear-gradient(135deg, var(--primary), var(--accent))` }}>
              {botName ? botName.charAt(0).toUpperCase() : 'A'}
            </div>
            <div>
              <h3>{botName}</h3>
              <p>ID: #{chatbotId}</p>
            </div>
          </div>

          <nav className="editor-nav">
            <button 
              className={`editor-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <svg className="editor-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></svg>
              Ringkasan
            </button>
            <button 
              className={`editor-nav-item ${activeTab === 'ai-config' ? 'active' : ''}`}
              onClick={() => setActiveTab('ai-config')}
            >
              <svg className="editor-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
              AI & Model
            </button>
            <button 
              className={`editor-nav-item ${activeTab === 'intents' ? 'active' : ''}`}
              onClick={() => setActiveTab('intents')}
            >
              <svg className="editor-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              Q&A Manual
            </button>
            <button 
              className={`editor-nav-item ${activeTab === 'kb' ? 'active' : ''}`}
              onClick={() => setActiveTab('kb')}
            >
              <svg className="editor-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
              Knowledge Base PDF
            </button>
            <button 
              className={`editor-nav-item ${activeTab === 'integration' ? 'active' : ''}`}
              onClick={() => setActiveTab('integration')}
            >
              <svg className="editor-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
              Integrasi Widget
            </button>
            <button 
              className={`editor-nav-item ${activeTab === 'playground' ? 'active' : ''}`}
              onClick={() => setActiveTab('playground')}
            >
              <svg className="editor-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              AI Playground
            </button>
            <button 
              className={`editor-nav-item ${activeTab === 'appearance' ? 'active' : ''}`}
              onClick={() => setActiveTab('appearance')}
              style={activeTab === 'appearance' ? {background: 'rgba(251, 44, 54, 0.1)', color: '#fb2c36', borderColor: '#fb2c36'} : {}}
            >
              <svg className="editor-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
              Appearance
            </button>
          </nav>

          <div className="editor-theme-select">
            <span className="theme-label">Tema UI</span>
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="theme-toggle-btn"
            >
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="editor-main">
          {activeTab === 'overview' && (
            <div className="editor-section">
              <div className="section-header">
                <h2>Ringkasan Dashboard</h2>
                <p>Status performa dan penggunaan resource AI agent Anda saat ini.</p>
              </div>

              {/* Stats Summary */}
              <div className="stats-row">
                <div className="stat-card">
                  <div className="stat-top">
                    <span className="stat-label">Document PDF</span>
                    <div className="stat-icon blue">📚</div>
                  </div>
                  <div className="stat-value">{stats?.documentsCount || 0}</div>
                  <div className="stat-sub">{stats?.processedDocs || 0} Terproses • {stats?.failedDocs || 0} Gagal</div>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span className="stat-label">Intents Q&A</span>
                    <div className="stat-icon pink">💬</div>
                  </div>
                  <div className="stat-value">{stats?.intentsCount || 0}</div>
                  <div className="stat-sub">Query pencocokan kata kunci</div>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span className="stat-label">Token AI Usage</span>
                    <div className="stat-icon green">⚡</div>
                  </div>
                  <div className="stat-value">{(stats?.tokenUsage || 0).toLocaleString()}</div>
                  <div className="stat-sub">Total token terpakai di LLM</div>
                </div>
              </div>

              {/* Bot Info Details */}
              <div className="editor-card card">
                <h3 className="card-title">Status Integrasi & Konfigurasi</h3>
                <div className="details-grid">
                  <div className="details-item">
                    <span className="details-label">Status Model AI</span>
                    <span className={`details-badge ${aiEnabled ? 'badge-success' : 'badge-muted'}`}>
                      {aiEnabled ? 'Aktif' : 'Non-aktif (Hanya Q&A)'}
                    </span>
                  </div>
                  <div className="details-item">
                    <span className="details-label">AI Provider</span>
                    <span className="details-value">{aiProvider ? aiProvider.toUpperCase() : '-'}</span>
                  </div>
                  <div className="details-item">
                    <span className="details-label">AI Model</span>
                    <span className="details-value">{aiModel || '-'}</span>
                  </div>
                  <div className="details-item">
                    <span className="details-label">Widget Key</span>
                    <span className="details-value code-font">{agentKey ? `${agentKey.substring(0, 10)}...` : '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai-config' && (
            <div className="editor-section">
              <div className="section-header">
                <h2>Konfigurasi AI & LLM Model</h2>
                <p>Sesuaikan penyedia kecerdasan buatan, API Key, model dan instruksi prompt untuk agen Anda.</p>
              </div>

              <form onSubmit={handleSaveConfig} className="config-form">
                <div className="editor-card card">
                  <div className="form-group">
                    <label>Nama Agent</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={botName}
                      onChange={(e) => setBotName(e.target.value)} 
                      required 
                    />
                  </div>

                  <div className="form-group toggle-group">
                    <div className="toggle-text">
                      <label>Aktifkan AI LLM</label>
                      <p className="form-hint">Jika dimatikan, bot hanya akan menjawab menggunakan manual Q&A dan Knowledge Base pencarian kata kunci.</p>
                    </div>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={aiEnabled} 
                        onChange={(e) => setAiEnabled(e.target.checked)} 
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>

                  <div className="form-group toggle-group">
                    <div className="toggle-text">
                      <label>Aktifkan Pemrosesan Bahasa (NLP)</label>
                      <p className="form-hint">Jika dimatikan, pencocokan kata harus persis/sama persis tanpa toleransi variasi kata (fuzzy matching) dan tidak menghapus kata hubung.</p>
                    </div>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={nlpEnabled} 
                        onChange={(e) => setNlpEnabled(e.target.checked)} 
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>

                  <div className="form-group">
                    <label>Sensitivitas Pencocokan Kata (Similarity Threshold)</label>
                    <input 
                      type="range" 
                      min="0.1" max="1.0" step="0.1"
                      className="form-input" 
                      value={similarityThreshold}
                      onChange={(e) => setSimilarityThreshold(e.target.value)} 
                      style={{padding: '0', cursor: 'pointer', height: 'auto'}}
                      disabled={!nlpEnabled}
                    />
                    <div className="form-hint" style={{marginTop: '4px', fontSize: '13px', opacity: nlpEnabled ? 1 : 0.5}}>
                      Skor: <strong>{similarityThreshold}</strong>. Semakin rendah nilai, semakin mudah cocok namun rawan salah tangkap. (Saran: 0.6 - 0.8)
                    </div>
                  </div>

                  {aiEnabled && (
                    <div className="ai-options-panel">
                      <div className="form-group">
                        <label>AI Provider</label>
                        <select 
                          className="form-input"
                          value={aiProvider}
                          onChange={(e) => setAiProvider(e.target.value)}
                        >
                          <option value="openai">OpenAI</option>
                          <option value="gemini">Google Gemini</option>
                          <option value="ollama">Ollama (Local Deployment)</option>
                        </select>
                      </div>

                      {aiProvider !== 'ollama' && (
                        <div className="form-group">
                          <label>API Key</label>
                          <input 
                            type="password" 
                            className="form-input code-font" 
                            value={aiApiKey} 
                            placeholder={aiApiKey ? '****************' : 'Masukkan API Key Anda'}
                            onChange={(e) => setAiApiKey(e.target.value)}
                          />
                        </div>
                      )}

                      <div className="form-group">
                        <label>Model Name</label>
                        <input 
                          type="text" 
                          className="form-input code-font" 
                          value={aiModel} 
                          placeholder={aiProvider === 'openai' ? 'gpt-4o-mini' : aiProvider === 'gemini' ? 'gemini-1.5-flash' : 'llama3'}
                          onChange={(e) => setAiModel(e.target.value)}
                          required={aiEnabled}
                        />
                      </div>

                      <div className="form-group">
                        <label>System Instruction Prompt (Kepribadian Agent)</label>
                        <textarea 
                          className="form-input text-area" 
                          rows="6"
                          value={aiSystemPrompt}
                          placeholder="Anda adalah asisten akademik yang ramah untuk universitas..."
                          onChange={(e) => setAiSystemPrompt(e.target.value)}
                        ></textarea>
                      </div>

                      <div className="form-group toggle-group" style={{marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)'}}>
                        <div className="toggle-text">
                          <label>Aktifkan Caching AI</label>
                          <p className="form-hint">Menyimpan dan menggunakan ulang jawaban AI jika pengunjung menanyakan frasa yang sama persis untuk menghemat kuota token API.</p>
                        </div>
                        <label className="switch">
                          <input 
                            type="checkbox" 
                            checked={cacheEnabled} 
                            onChange={(e) => setCacheEnabled(e.target.checked)} 
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>

                      <div className="form-group toggle-group">
                        <div className="toggle-text">
                          <label>Aktifkan Rate Limiter Publik</label>
                          <p className="form-hint">Membatasi jumlah pertanyaan beruntun menggunakan AI per alamat IP pengunjung (anti-spam).</p>
                        </div>
                        <label className="switch">
                          <input 
                            type="checkbox" 
                            checked={rateLimitEnabled} 
                            onChange={(e) => setRateLimitEnabled(e.target.checked)} 
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>

                      {rateLimitEnabled && (
                        <div className="form-group">
                          <label>Batas Maksimum Query AI (Per Jam)</label>
                          <input 
                            type="number" 
                            className="form-input" 
                            value={rateLimitMax}
                            onChange={(e) => setRateLimitMax(e.target.value)} 
                            min="1"
                            max="1000"
                            style={{width: '100px'}}
                          />
                          <div className="form-hint">Jumlah pertanyaan yang diizinkan sebelum dialihkan ke Manual Q&A.</div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="actions-row">
                    {aiEnabled && (
                      <button 
                        type="button" 
                        className="btn-ghost btn-test-connection" 
                        onClick={handleTestAI}
                        disabled={testingAI}
                      >
                        {testingAI ? 'Menguji...' : '🧪 Uji Koneksi AI'}
                      </button>
                    )}
                    <button 
                      type="submit" 
                      className="btn-primary" 
                      disabled={savingConfig}
                    >
                      {savingConfig ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="editor-section">
              <div className="section-header">
                <h2>Appearance Settings</h2>
                <p>Manage your AI agent's visual configuration, branding, and colors.</p>
              </div>

              <div className="appearance-container" style={{display: 'flex', gap: '2rem'}}>
                <form onSubmit={handleSaveConfig} className="config-form" style={{flex: 1}}>
                  <div className="editor-card card">
                    <h3 style={{marginBottom: '1rem'}}>Colors & Styling</h3>
                    
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                      <div className="form-group">
                        <label>Primary Color</label>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                          <input type="color" value={brandingConfig.primaryColor} onChange={(e) => setBrandingConfig({...brandingConfig, primaryColor: e.target.value})} style={{width: '36px', height: '36px', padding: '0', cursor: 'pointer'}} />
                          <input type="text" className="form-input" value={brandingConfig.primaryColor} onChange={(e) => setBrandingConfig({...brandingConfig, primaryColor: e.target.value})} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Chat Background</label>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                          <input type="color" value={brandingConfig.chatBackground} onChange={(e) => setBrandingConfig({...brandingConfig, chatBackground: e.target.value})} style={{width: '36px', height: '36px', padding: '0', cursor: 'pointer'}} />
                          <input type="text" className="form-input" value={brandingConfig.chatBackground} onChange={(e) => setBrandingConfig({...brandingConfig, chatBackground: e.target.value})} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Header Background</label>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                          <input type="color" value={brandingConfig.headerBackground} onChange={(e) => setBrandingConfig({...brandingConfig, headerBackground: e.target.value})} style={{width: '36px', height: '36px', padding: '0', cursor: 'pointer'}} />
                          <input type="text" className="form-input" value={brandingConfig.headerBackground} onChange={(e) => setBrandingConfig({...brandingConfig, headerBackground: e.target.value})} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Header Text Color</label>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                          <input type="color" value={brandingConfig.headerTextColor} onChange={(e) => setBrandingConfig({...brandingConfig, headerTextColor: e.target.value})} style={{width: '36px', height: '36px', padding: '0', cursor: 'pointer'}} />
                          <input type="text" className="form-input" value={brandingConfig.headerTextColor} onChange={(e) => setBrandingConfig({...brandingConfig, headerTextColor: e.target.value})} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>User Bubble Color</label>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                          <input type="color" value={brandingConfig.userBubbleColor} onChange={(e) => setBrandingConfig({...brandingConfig, userBubbleColor: e.target.value})} style={{width: '36px', height: '36px', padding: '0', cursor: 'pointer'}} />
                          <input type="text" className="form-input" value={brandingConfig.userBubbleColor} onChange={(e) => setBrandingConfig({...brandingConfig, userBubbleColor: e.target.value})} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>User Text Color</label>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                          <input type="color" value={brandingConfig.userTextColor} onChange={(e) => setBrandingConfig({...brandingConfig, userTextColor: e.target.value})} style={{width: '36px', height: '36px', padding: '0', cursor: 'pointer'}} />
                          <input type="text" className="form-input" value={brandingConfig.userTextColor} onChange={(e) => setBrandingConfig({...brandingConfig, userTextColor: e.target.value})} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Agent Bubble Color</label>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                          <input type="color" value={brandingConfig.agentBubbleColor} onChange={(e) => setBrandingConfig({...brandingConfig, agentBubbleColor: e.target.value})} style={{width: '36px', height: '36px', padding: '0', cursor: 'pointer'}} />
                          <input type="text" className="form-input" value={brandingConfig.agentBubbleColor} onChange={(e) => setBrandingConfig({...brandingConfig, agentBubbleColor: e.target.value})} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Agent Text Color</label>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                          <input type="color" value={brandingConfig.agentTextColor} onChange={(e) => setBrandingConfig({...brandingConfig, agentTextColor: e.target.value})} style={{width: '36px', height: '36px', padding: '0', cursor: 'pointer'}} />
                          <input type="text" className="form-input" value={brandingConfig.agentTextColor} onChange={(e) => setBrandingConfig({...brandingConfig, agentTextColor: e.target.value})} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Audio Button Color</label>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                          <input type="color" value={brandingConfig.audioButtonColor} onChange={(e) => setBrandingConfig({...brandingConfig, audioButtonColor: e.target.value})} style={{width: '36px', height: '36px', padding: '0', cursor: 'pointer'}} />
                          <input type="text" className="form-input" value={brandingConfig.audioButtonColor} onChange={(e) => setBrandingConfig({...brandingConfig, audioButtonColor: e.target.value})} />
                        </div>
                      </div>
                    </div>

                    <h3 style={{marginTop: '2rem', marginBottom: '1rem'}}>Branding</h3>
                    <div className="form-group">
                      <label>Chatbot Avatar / Logo URL</label>
                      <input type="url" className="form-input" value={brandingConfig.avatarUrl} onChange={(e) => setBrandingConfig({...brandingConfig, avatarUrl: e.target.value})} placeholder="https://example.com/avatar.png" />
                    </div>
                    <div className="form-group">
                      <label>Floating Button Icon URL</label>
                      <input type="url" className="form-input" value={brandingConfig.floatingIconUrl} onChange={(e) => setBrandingConfig({...brandingConfig, floatingIconUrl: e.target.value})} placeholder="https://example.com/icon.png" />
                    </div>
                    <div className="form-group">
                      <label>Display Name</label>
                      <input type="text" className="form-input" value={brandingConfig.displayName} onChange={(e) => setBrandingConfig({...brandingConfig, displayName: e.target.value})} placeholder="Support Bot" />
                    </div>
                    <div className="form-group">
                      <label>Welcome Message</label>
                      <input type="text" className="form-input" value={brandingConfig.welcomeMessage} onChange={(e) => setBrandingConfig({...brandingConfig, welcomeMessage: e.target.value})} placeholder="Hi! How can I help?" />
                    </div>

                    <div className="actions-row" style={{marginTop: '2rem'}}>
                      <button type="submit" className="btn-primary" disabled={savingConfig}>
                        {savingConfig ? 'Menyimpan...' : 'Save Appearance'}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Live Preview Pane */}
                <div style={{flex: 1, minWidth: '300px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '2rem', position: 'relative', overflow: 'hidden'}}>
                  <div style={{position: 'absolute', top: '10px'}}>
                    <span style={{background: '#fff', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', color: '#64748b'}}>Live Preview</span>
                  </div>
                  
                  {/* Fake Widget */}
                  <div style={{
                    width: '320px', 
                    height: '450px', 
                    background: brandingConfig.chatBackground, 
                    borderRadius: '16px', 
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    overflow: 'hidden',
                    border: '1px solid rgba(0,0,0,0.05)'
                  }}>
                    {/* Header */}
                    <div style={{
                      background: brandingConfig.headerBackground, 
                      color: brandingConfig.headerTextColor, 
                      padding: '16px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px'
                    }}>
                      {brandingConfig.avatarUrl ? (
                        <img src={brandingConfig.avatarUrl} style={{width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover'}} alt="avatar" />
                      ) : (
                        <div style={{width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>🤖</div>
                      )}
                      <div style={{fontWeight: '600', fontSize: '16px'}}>{brandingConfig.displayName || 'Support Bot'}</div>
                    </div>
                    
                    {/* Messages Area */}
                    <div style={{flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto'}}>
                      {/* Bot Message */}
                      <div style={{display: 'flex', gap: '8px', alignItems: 'flex-start'}}>
                        {brandingConfig.avatarUrl ? (
                          <img src={brandingConfig.avatarUrl} style={{width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', marginTop: '4px'}} alt="avatar" />
                        ) : (
                          <div style={{width: '24px', height: '24px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', marginTop: '4px'}}>🤖</div>
                        )}
                        <div style={{
                          background: brandingConfig.agentBubbleColor, 
                          color: brandingConfig.agentTextColor, 
                          padding: '10px 14px', 
                          borderRadius: '12px', 
                          borderTopLeftRadius: '4px',
                          fontSize: '14px',
                          maxWidth: '80%'
                        }}>
                          {brandingConfig.welcomeMessage || 'Hi! How can I help?'}
                        </div>
                      </div>

                      {/* User Message */}
                      <div style={{display: 'flex', justifyContent: 'flex-end'}}>
                        <div style={{
                          background: brandingConfig.userBubbleColor, 
                          color: brandingConfig.userTextColor, 
                          padding: '10px 14px', 
                          borderRadius: '12px', 
                          borderTopRightRadius: '4px',
                          fontSize: '14px',
                          maxWidth: '80%'
                        }}>
                          I need some help!
                        </div>
                      </div>
                    </div>

                    {/* Input Area */}
                    <div style={{padding: '12px 16px', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', gap: '8px', alignItems: 'center'}}>
                      <div style={{flex: 1, background: '#f1f5f9', borderRadius: '20px', padding: '8px 16px', fontSize: '14px', color: '#64748b'}}>
                        Type a message...
                      </div>
                      <div style={{width: '32px', height: '32px', borderRadius: '50%', background: brandingConfig.audioButtonColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                      </div>
                    </div>
                  </div>

                  {/* Floating button preview */}
                  <div style={{position: 'absolute', bottom: '24px', right: '24px'}}>
                    <div style={{width: '48px', height: '48px', borderRadius: '50%', background: brandingConfig.primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'}}>
                      {brandingConfig.floatingIconUrl ? (
                        <img src={brandingConfig.floatingIconUrl} style={{width: '24px', height: '24px', objectFit: 'contain'}} alt="icon" />
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'intents' && (
            <div className="editor-section">
              <div className="section-header top-actions">
                <div>
                  <h2>Database Q&A Manual</h2>
                  <p>Jawaban instan untuk pertanyaan umum yang didefinisikan secara manual.</p>
                </div>
                <button className="btn-create" onClick={() => openIntentModal()}>
                  + Tambah Q&A Baru
                </button>
              </div>

              {intentsLoading ? (
                <div className="section-loading">
                  <div className="editor-spinner"></div>
                  <p>Memuat database Q&A...</p>
                </div>
              ) : intents.length === 0 ? (
                <div className="empty-state show">
                  <span className="empty-icon">💬</span>
                  <h3>Database Q&A Kosong</h3>
                  <p>Belum ada rule pencocokan kata kunci. Tambahkan pertanyaan manual untuk response instan dengan tingkat presisi tinggi.</p>
                </div>
              ) : (
                <div className="intents-list">
                  {intents.map((intent) => (
                    <div key={intent.id} className="intent-card card">
                      <div className="intent-card-header">
                        <span className="category-badge">{intent.category || 'General'}</span>
                        <div className="intent-card-actions">
                          <button className="icon-btn-edit" onClick={() => openIntentModal(intent)}>✏️ Edit</button>
                          <button className="icon-btn-delete" onClick={() => handleDeleteIntent(intent.id)}>🗑️ Hapus</button>
                        </div>
                      </div>
                      <div className="intent-keywords">
                        <strong>Kata Kunci:</strong>
                        <div className="keywords-tags">
                          {intent.keywords.map((kw, i) => (
                            <span key={i} className="kw-tag">{kw}</span>
                          ))}
                        </div>
                      </div>
                      <div className="intent-response">
                        <strong>Jawaban:</strong>
                        <p>{intent.response}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'kb' && (
            <div className="editor-section">
              <div className="section-header">
                <h2>Knowledge Base PDF (RAG)</h2>
                <p>Unggah file dokumen referensi (seperti panduan akademik, syarat pendaftaran) untuk dipelajari oleh AI agent.</p>
              </div>

              {/* Upload Form */}
              <div className="editor-card card upload-card">
                <h3 className="card-title">Unggah Dokumen Baru</h3>
                <form onSubmit={handlePdfUpload} className="upload-form">
                  <div className="file-drop-area">
                    <input 
                      type="file" 
                      accept=".pdf"
                      onChange={(e) => setSelectedFile(e.target.files[0])}
                      required 
                    />
                    <div className="drop-overlay">
                      <span>📁 {selectedFile ? selectedFile.name : 'Pilih file PDF (Maks 10MB)'}</span>
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className="btn-primary" 
                    disabled={uploadingPdf || !selectedFile}
                  >
                    {uploadingPdf ? 'Mengunggah & Memproses...' : 'Mulai Upload PDF'}
                  </button>
                </form>
              </div>

              <h3 className="section-subtitle">Daftar Dokumen</h3>
              
              {kbLoading ? (
                <div className="section-loading">
                  <div className="editor-spinner"></div>
                  <p>Memuat list dokumen...</p>
                </div>
              ) : documents.length === 0 ? (
                <div className="empty-state show">
                  <span className="empty-icon">📚</span>
                  <h3>Belum Ada Dokumen</h3>
                  <p>Unggah file PDF agar AI agen memiliki basis pengetahuan khusus universitas/bisnis Anda.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nama File</th>
                        <th>Status</th>
                        <th>Halaman</th>
                        <th>Ukuran KB</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc) => (
                        <tr key={doc.id}>
                          <td className="doc-name-cell">
                            <strong>{doc.fileName}</strong>
                            {doc.error && <p className="doc-err-text">{doc.error}</p>}
                          </td>
                          <td>
                            <span className={`status-badge status-${doc.status}`}>
                              {doc.status === 'processed' ? 'Sukses' : doc.status === 'failed' ? 'Gagal' : 'Memproses...'}
                            </span>
                          </td>
                          <td>{doc.pagesCount || '-'}</td>
                          <td>{doc.fileSizeBytes ? Math.round(doc.fileSizeBytes / 1024) : '-'} KB</td>
                          <td>
                            <div className="doc-actions-row">
                              <button 
                                className="action-btn text-btn"
                                onClick={() => handleViewDocText(doc)}
                                disabled={doc.status !== 'processed'}
                              >
                                🔍 Lihat Teks
                              </button>
                              <button 
                                className="action-btn generate-btn"
                                onClick={() => handleAutoGenerateIntents(doc)}
                                disabled={doc.status !== 'processed'}
                                title="Gunakan AI untuk menghasilkan FAQ dari isi PDF"
                              >
                                ⚡ Auto Q&A
                              </button>
                              <button 
                                className="action-btn reprocess-btn"
                                onClick={() => handleReprocessDoc(doc.id)}
                                title="Proses Ulang PDF"
                              >
                                🔄 Reproses
                              </button>
                              <button 
                                className="action-btn delete-btn-cell"
                                onClick={() => handleDeleteDoc(doc.id)}
                                title="Hapus Dokumen"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'integration' && (
            <div className="editor-section">
              <div className="section-header">
                <h2>Integrasi Chatbot Widget</h2>
                <p>Pasang chatbot widget interaktif pada website Anda dengan mudah menggunakan script berikut.</p>
              </div>

              <div className="editor-card card">
                <h3 className="card-title">Script Pemasangan Widget</h3>
                <p className="integration-desc">
                  Salin dan tempelkan kode script HTML berikut di bagian akhir tag <code>&lt;/body&gt;</code> pada file HTML website Anda.
                </p>

                <div className="code-block-container">
                  <pre className="code-block">
                    <code>{getEmbedScript()}</code>
                  </pre>
                  <button 
                    className="btn-ghost copy-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(getEmbedScript());
                      showToast('Script disalin ke clipboard!', 'success');
                    }}
                  >
                    📋 Salin Kode
                  </button>
                </div>

                <div className="integration-options" style={{ marginBottom: '24px' }}>
                  <h4>Integrasi yang Tersedia</h4>
                  <div className="integration-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                    
                    {/* WordPress Card */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '12px',
                      padding: '16px 20px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                          fontSize: '24px',
                          background: 'rgba(33, 117, 155, 0.1)',
                          color: '#21759b',
                          width: '48px',
                          height: '48px',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          🌐
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <h5 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>WordPress</h5>
                          <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--muted)' }}>Hubungkan chatbot dengan situs WordPress Anda</p>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        className="btn-primary" 
                        style={{ width: 'auto', padding: '8px 20px', fontSize: '13px' }}
                        onClick={() => setWpModalOpen(true)}
                      >
                        Hubungkan
                      </button>
                    </div>

                    {/* Shopify Card */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '12px',
                      padding: '16px 20px',
                      opacity: 0.6
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                          fontSize: '24px',
                          background: 'rgba(149, 190, 29, 0.1)',
                          color: '#95be1d',
                          width: '48px',
                          height: '48px',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          🛒
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <h5 style={{ margin: 0, fontSize: '15px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            Shopify <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'var(--muted)' }}>Segera Hadir</span>
                          </h5>
                          <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'var(--muted)' }}>Integrasikan dengan toko Shopify Anda</p>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        className="btn-ghost" 
                        disabled 
                        style={{ width: 'auto', padding: '8px 20px', fontSize: '13px', cursor: 'not-allowed' }}
                      >
                        Hubungkan
                      </button>
                    </div>

                  </div>
                </div>

                <div className="integration-options" style={{ paddingTop: '24px' }}>
                  <h4>Opsi Kustomisasi & Rotate Key</h4>
                  <p className="integration-desc">
                    Jika widget Anda dicurigai disalahgunakan atau digunakan oleh situs lain tanpa izin, Anda dapat men-generate ulang Widget Key baru di bawah ini.
                  </p>
                  <div className="rotate-key-section">
                    <div className="agent-key-display">
                      <span>Widget Key Saat Ini:</span>
                      <strong className="code-font">{agentKey}</strong>
                    </div>
                    <button 
                      type="button" 
                      className="btn-danger rotate-btn"
                      onClick={handleRotateKey}
                    >
                      🔄 Rotate Widget Key
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'playground' && (
            <div className="editor-section playground-section">
              <div className="section-header">
                <h2>AI Sandbox Playground</h2>
                <p>Uji coba interaksi chatbot Anda secara langsung sebelum live di website publik.</p>
              </div>

              <div className="playground-container">
                <div className="chat-console">
                  <div className="chat-console-header">
                    <div className="console-bot-avatar">🤖</div>
                    <div>
                      <h4>Pratinjau Percakapan ({botName})</h4>
                      <span className="console-status-dot"></span>
                      <span className="console-status-text">Online</span>
                    </div>
                  </div>

                  <div className="chat-messages-area">
                    {chatMessages.map((msg, idx) => (
                      <div key={idx} className={`chat-bubble-row ${msg.sender}`}>
                        <div className="chat-bubble">
                          {msg.sender === 'bot' ? (
                            <p style={{lineHeight: 1.5, margin: 0}} dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.text) }}></p>
                          ) : (
                            <p>{msg.text}</p>
                          )}
                          <span className="chat-time">
                            {msg.time}
                            {msg.source && <span className="msg-source-tag">source: {msg.source}</span>}
                          </span>
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="chat-bubble-row bot">
                        <div className="chat-bubble typing-bubble">
                          <div className="typing-dots">
                            <span></span><span></span><span></span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSendChatMessage} className="chat-console-input-form">
                    <input 
                      type="text" 
                      className="console-input" 
                      placeholder="Ketik pesan untuk menguji AI Agent..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={chatLoading}
                    />
                    <button 
                      type="submit" 
                      className="console-send-btn"
                      disabled={chatLoading || !chatInput.trim()}
                    >
                      Send
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Intents Add/Edit Modal */}
      {intentModalOpen && (
        <div className="modal-overlay open">
          <div className="modal-box">
            <div className="modal-gradient-bar"></div>
            <div className="modal-body">
              <div className="modal-header">
                <div>
                  <h3 className="modal-title">{editingIntent ? 'Edit Q&A Intent' : 'Tambah Q&A Intent'}</h3>
                  <p className="modal-desc">Definisikan keyword dan response yang sesuai.</p>
                </div>
                <button className="modal-close" onClick={() => setIntentModalOpen(false)}>×</button>
              </div>

              <form onSubmit={handleSaveIntent}>
                <div className="form-group">
                  <label>Kategori</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="General, Admisi, Kontak, dll."
                    value={intentCategory}
                    onChange={(e) => setIntentCategory(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Kata Kunci (Keywords)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Contoh: pendaftaran, biaya, spp (pisahkan dengan koma)"
                    value={intentKeywords}
                    onChange={(e) => setIntentKeywords(e.target.value)}
                    required
                  />
                  <p className="form-hint">Sistem akan mencocokkan kata kunci ini dengan input user.</p>
                </div>

                <div className="form-group">
                  <label>Response / Jawaban Instan</label>
                  <textarea 
                    className="form-input text-area" 
                    rows="4"
                    placeholder="Tulis jawaban lengkap yang akan diberikan kepada user..."
                    value={intentResponse}
                    onChange={(e) => setIntentResponse(e.target.value)}
                    required
                  ></textarea>
                </div>

                <button type="submit" className="btn-primary">
                  {editingIntent ? 'Simpan Perubahan' : 'Tambah Intent'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Extracted PDF Text Modal */}
      {viewingDocText && (
        <div className="modal-overlay open">
          <div className="modal-box text-view-modal">
            <div className="modal-gradient-bar"></div>
            <div className="modal-body">
              <div className="modal-header">
                <div>
                  <h3 className="modal-title">Extracted Text: {viewingDocText.fileName}</h3>
                  <p className="modal-desc">Teks mentah yang berhasil diekstrak dan masuk index RAG.</p>
                </div>
                <button className="modal-close" onClick={() => setViewingDocText(null)}>×</button>
              </div>

              <div className="doc-text-container">
                {docTextLoading ? (
                  <div className="section-loading">
                    <div className="editor-spinner"></div>
                    <p>Memuat isi teks dokumen...</p>
                  </div>
                ) : (
                  <pre className="extracted-pre">{docTextContent}</pre>
                )}
              </div>

              <button className="btn-ghost" onClick={() => setViewingDocText(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* WordPress Integration Modal */}
      {wpModalOpen && (
        <div className="modal-overlay open">
          <div className="modal-box" style={{ maxWidth: '550px' }}>
            <div className="modal-gradient-bar"></div>
            <div className="modal-body">
              <div className="modal-header">
                <div>
                  <h3 className="modal-title">WordPress Integration</h3>
                  <p className="modal-desc">Ikuti langkah-langkah berikut untuk mengintegrasikan Aethel dengan situs WordPress Anda.</p>
                </div>
                <button className="modal-close" onClick={() => setWpModalOpen(false)}>×</button>
              </div>

              <div style={{ color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: '1.5rem', margin: '1.5rem 0', textAlign: 'left' }}>
                <div>
                  <h4 style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--primary)' }}>1. Install Plugin Header/Footer</h4>
                  <p style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: '1.6' }}>
                    Masuk ke dashboard WordPress Anda, pergi ke <strong>Plugins &gt; Add New</strong>. Cari dan install plugin gratis seperti <strong>"WPCode"</strong> atau <strong>"Insert Headers and Footers"</strong>, lalu aktifkan.
                  </p>
                </div>

                <div>
                  <h4 style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--primary)' }}>2. Salin Script Pemasangan</h4>
                  <p style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: '1.6', marginBottom: '0.8rem' }}>
                    Salin kode script widget Anda berikut ini:
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                    <code style={{ fontFamily: 'monospace', fontSize: '11.5px', flex: 1, wordBreak: 'break-all', color: 'var(--primary)', whiteSpace: 'pre-wrap' }}>{getEmbedScript()}</code>
                    <button 
                      type="button"
                      className="btn-ghost"
                      style={{ padding: '6px 12px', fontSize: '11px', width: 'auto', alignSelf: 'flex-start' }}
                      onClick={() => {
                        navigator.clipboard.writeText(getEmbedScript());
                        showToast('Script disalin!', 'success');
                      }}
                    >
                      📋 Salin
                    </button>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--primary)' }}>3. Tempel Script di WordPress</h4>
                  <p style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: '1.6' }}>
                    Buka pengaturan plugin yang baru diinstall (misal: <strong>Code Snippets &gt; Header & Footer</strong>). Tempelkan script tadi ke dalam kotak <strong>Header</strong> atau <strong>Footer</strong>, lalu klik <strong>Save Changes</strong>. Widget akan otomatis muncul di website WordPress Anda.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button className="btn-primary" style={{ width: 'auto', padding: '8px 24px' }} onClick={() => setWpModalOpen(false)}>Selesai</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <div className={`toast-container`}>
        <div className={`toast ${toast.show ? 'show' : ''} ${toast.type}`}>
          <span className="toast-dot"></span>
          <span>{toast.message}</span>
        </div>
      </div>
    </div>
  );
}
