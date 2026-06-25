import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch } from './api';
import './Dashboard.css';

export default function Dashboard() {
  const [view, setView] = useState('chatbots'); // chatbots, analytics, settings
  const [theme, setTheme] = useState(localStorage.getItem('aethel_theme') || 'dark');
  const [user, setUser] = useState({});
  const [chatbots, setChatbots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const navigate = useNavigate();

  // Create bot form
  const [createOpen, setCreateOpen] = useState(false);
  const [newBotName, setNewBotName] = useState('');
  const [selectedBizType, setSelectedBizType] = useState('Ecommerce');
  const [creating, setCreating] = useState(false);

  // Delete bot state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // bot object
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Profile / Settings form
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Stats / Analytics data
  const [analyticsData, setAnalyticsData] = useState([]);
  const [globalStats, setGlobalStats] = useState({ totalDocs: 0, totalIntents: 0, totalKb: 0, totalTokens: 0 });

  const token = localStorage.getItem('aethel_token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const u = JSON.parse(localStorage.getItem('aethel_user') || '{}');
      setUser(u);
      setProfileName(u.name || '');
      setProfileEmail(u.email || '');
    } catch {}

    loadChatbots();
  }, [token]);

  useEffect(() => {
    document.body.className = theme === 'light' ? 'light-theme' : '';
    localStorage.setItem('aethel_theme', theme);
  }, [theme]);

  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'info' });
    }, 3500);
  };

  const loadChatbots = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/chatbots', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('aethel_token');
        navigate('/login');
        return;
      }
      const data = await res.json();
      const bots = Array.isArray(data) ? data : (data.chatbots || []);
      setChatbots(bots);
      if (view === 'analytics') {
        loadAnalytics(bots);
      }
    } catch (err) {
      showToast('Could not reach the server. Check your connection.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    if (!newBotName.trim()) return;

    setCreating(true);
    try {
      const res = await apiFetch('/api/chatbots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newBotName.trim(), businessType: selectedBizType })
      });

      if (res.ok) {
        setCreateOpen(false);
        setNewBotName('');
        showToast(`Agent "${newBotName}" created successfully! 🎉`, 'success');
        await loadChatbots();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to create agent.', 'error');
      }
    } catch {
      showToast('Connection error. Please try again.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/chatbots/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setDeleteOpen(false);
        setDeleteTarget(null);
        setDeleteConfirmText('');
        showToast(`Agent deleted successfully.`, 'error');
        await loadChatbots();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Delete failed.', 'error');
      }
    } catch {
      showToast('Connection error. Please try again.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!profileName || !profileEmail) {
      showToast('Name and Email are required.', 'error');
      return;
    }

    setSavingSettings(true);
    try {
      const body = { name: profileName, email: profileEmail };
      if (newPassword) {
        if (newPassword !== confirmNewPassword) {
          showToast('New passwords do not match.', 'error');
          setSavingSettings(false);
          return;
        }
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }

      const res = await apiFetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (res.ok) {
        showToast('Settings saved successfully! 🎉', 'success');
        localStorage.setItem('aethel_user', JSON.stringify(data.user));
        setUser(data.user);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        showToast(data.error || 'Failed to update profile.', 'error');
      }
    } catch {
      showToast('Connection error. Please try again.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const loadAnalytics = async (bots = chatbots) => {
    try {
      const results = await Promise.all(
        bots.map(async (bot) => {
          const statsRes = await apiFetch(`/api/chatbots/${bot.id}/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const stats = await statsRes.json();
          return { bot, stats };
        })
      );
      setAnalyticsData(results);

      // Summarize global metrics
      let docs = 0, intents = 0, kb = 0, tokens = 0;
      results.forEach(r => {
        docs += r.stats.documentsCount || 0;
        intents += r.stats.intentsCount || 0;
        kb += r.stats.kbExcerptsCount || 0;
        tokens += r.stats.tokenUsage || 0;
      });
      setGlobalStats({ totalDocs: docs, totalIntents: intents, totalKb: kb, totalTokens: tokens });
    } catch (err) {
      console.error('Failed to load analytics statistics:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('aethel_token');
    localStorage.removeItem('aethel_user');
    navigate('/login');
  };

  const BIZ_MAP = {
    'Ecommerce':   { emoji: '🛒', color: 'hsl(25,90%,55%)',  bg: 'rgba(255,160,30,.12)'  },
    'SaaS':        { emoji: '☁️', color: 'hsl(210,90%,60%)', bg: 'rgba(59,130,246,.12)'  },
    'Agency':      { emoji: '💼', color: 'hsl(260,70%,65%)', bg: 'rgba(139,92,246,.12)'  },
    'Healthcare':  { emoji: '❤️', color: 'hsl(347,80%,60%)', bg: 'rgba(255,90,121,.12)'  },
    'Education':   { emoji: '🎓', color: 'hsl(160,75%,42%)', bg: 'rgba(16,185,129,.12)'  },
    'Real Estate': { emoji: '🏠', color: 'hsl(38,90%,50%)',  bg: 'rgba(245,158,11,.12)'  },
    'Other':       { emoji: '•••', color: 'hsl(220,15%,60%)', bg: 'rgba(148,163,184,.1)'  },
  };

  const getBiz = (type) => BIZ_MAP[type] || { emoji: '🤖', color: 'hsl(347,100%,68%)', bg: 'rgba(255,90,121,.12)' };

  const getAIInfo = (bot) => {
    if (!bot.aiEnabled) return { dot: 'muted', label: 'Engine', provider: 'Local NLP' };
    const p = (bot.aiProvider || '').toLowerCase();
    if (p.includes('gemini')) return { dot: 'blue', label: 'AI Engine', provider: 'Gemini 2.5 Flash' };
    if (p.includes('ollama')) return { dot: 'green', label: 'AI Engine', provider: 'Ollama' };
    return { dot: 'green', label: 'AI Engine', provider: bot.aiProvider || 'AI Model' };
  };

  // Compile biz distribution for analytics
  const getBizDistribution = () => {
    const counts = {};
    chatbots.forEach(b => {
      const type = b.businessType || 'Other';
      counts[type] = (counts[type] || 0) + 1;
    });
    const total = chatbots.length || 1;
    return Object.entries(counts).map(([type, count]) => ({
      type,
      count,
      pct: Math.round((count / total) * 100)
    })).sort((a,b) => b.count - a.count);
  };

  return (
    <div className="dashboard-wrapper">
      <div className="orb-canvas">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      <div className="app">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="logo" style={{ cursor: 'pointer' }} onClick={() => setView('chatbots')}>
            <img src={theme === 'light' ? '/logo-light.png' : '/logo.png'} alt="Aethel Logo" className="logo-icon" style={{ background: 'none', objectFit: 'cover' }} />
            <span className="logo-text">Aethel</span>
          </div>

          <nav className="nav">
            <span className="nav-label">Workspace</span>

            <a href="#" className={`nav-item ${view === 'chatbots' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setView('chatbots'); }}>
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="8" width="18" height="13" rx="3" />
                <path d="M8 8V6a4 4 0 0 1 8 0v2" />
                <circle cx="9" cy="15" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="15" cy="15" r="1.5" fill="currentColor" stroke="none" />
              </svg>
              <span>AI Chatbots</span>
            </a>

            <a href="#" className={`nav-item ${view === 'analytics' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setView('analytics'); loadAnalytics(); }}>
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <span>Analytics</span>
            </a>

            <a href="#" className={`nav-item ${view === 'settings' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setView('settings'); }}>
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.07 4.93a10 10 0 0 1 1.41 1.41M4.93 4.93a10 10 0 0 0-1.41 1.41M4.93 19.07a10 10 0 0 0 1.41 1.41M19.07 19.07a10 10 0 0 1-1.41 1.41M20.66 9A9.97 9.97 0 0 1 21 12h-2M3.34 9A9.97 9.97 0 0 0 3 12h2M14.83 3.34A9.97 9.97 0 0 1 12 3v2M14.83 20.66A9.97 9.97 0 0 1 12 21v-2M9.17 3.34A9.97 9.97 0 0 0 12 3v2M9.17 20.66A9.97 9.97 0 0 0 12 21v-2" />
              </svg>
              <span>Settings</span>
            </a>

            {user.role === 'admin' && (
              <Link to="/admin-dashboard" className="nav-item" style={{ marginTop: '1rem', color: '#ff6b6b' }}>
                <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                <span>Admin Panel</span>
              </Link>
            )}

            <a href="#" className="nav-item" onClick={(e) => { e.preventDefault(); setTheme(theme === 'dark' ? 'light' : 'dark'); }}>
              {theme === 'dark' ? (
                <>
                  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                  <span>Dark Mode</span>
                </>
              )}
            </a>
          </nav>

          <div className="sidebar-footer">
            <div className="profile-card">
              <div className="profile-avatar">{user.name ? user.name.charAt(0).toUpperCase() : 'U'}</div>
              <div className="profile-info">
                <div className="profile-name">{user.name || 'User'}</div>
                <div className="profile-email">{user.email || '—'}</div>
              </div>
            </div>
            <button className="logout-btn" onClick={handleLogout}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign out
            </button>
          </div>
        </aside>

        {/* MAIN BODY */}
        <main className="main">
          {/* VIEW: CHATBOTS */}
          {view === 'chatbots' && (
            <div id="panel-chatbots">
              <div className="top-header">
                <div className="top-header-left">
                  <h1>AI Chatbots</h1>
                  <p>Manage and deploy your intelligent agents</p>
                </div>
                <button className="btn-create" onClick={() => setCreateOpen(true)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Create New Agent
                </button>
              </div>

              <div className="stats-row">
                <div className="stat-card">
                  <div className="stat-top">
                    <span className="stat-label">Total Chatbots</span>
                    <div className="stat-icon pink">🤖</div>
                  </div>
                  <div className="stat-value">{chatbots.length}</div>
                  <div className="stat-sub">Deployed agents</div>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <span className="stat-label">AI-Powered</span>
                    <div className="stat-icon blue">⚡</div>
                  </div>
                  <div className="stat-value">{chatbots.filter(b => b.aiEnabled).length}</div>
                  <div className="stat-sub">Using AI engine</div>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <span className="stat-label">Local NLP</span>
                    <div className="stat-icon green">🧠</div>
                  </div>
                  <div className="stat-value">{chatbots.filter(b => !b.aiEnabled).length}</div>
                  <div className="stat-sub">Classic engine bots</div>
                </div>
              </div>

              <div className="section-title">
                Your Agents
                <span className="section-title-count">{chatbots.length}</span>
              </div>

              {loading ? (
                <div className="loading-grid">
                  {[1, 2, 3].map(i => (
                    <div className="loading-card" key={i}>
                      <div className="skel-row">
                        <div className="skeleton skel-xl"></div>
                        <div style={{ flex: 1 }}>
                          <div className="skeleton skel-h" style={{ width: '60%', marginBottom: '10px' }}></div>
                          <div className="skeleton skel-h" style={{ width: '40%' }}></div>
                        </div>
                      </div>
                      <div className="skeleton skel-h"></div>
                      <div className="skeleton skel-h" style={{ width: '80%' }}></div>
                    </div>
                  ))}
                </div>
              ) : chatbots.length === 0 ? (
                <div className="empty-state show">
                  <div className="empty-icon">🤖</div>
                  <h3>No agents yet</h3>
                  <p>Create your first AI chatbot agent to get started. It only takes a few seconds.</p>
                </div>
              ) : (
                <div className="chatbots-grid">
                  {chatbots.map((bot, i) => {
                    const biz = getBiz(bot.businessType);
                    const ai = getAIInfo(bot);
                    return (
                      <div className="chatbot-card" key={bot.id} style={{ animation: `cardIn 0.45s ease ${i * 80}ms forwards` }}>
                        <div className="card-inner">
                          <div className="card-top">
                            <div className="bot-avatar" style={{ backgroundColor: biz.bg, color: biz.color, fontSize: bot.businessType === 'Other' ? '14px' : '24px' }}>
                              {biz.emoji}
                            </div>
                            <button className="delete-btn" title="Delete agent" onClick={() => { setDeleteTarget(bot); setDeleteOpen(true); }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                              </svg>
                            </button>
                          </div>
                          <div className="bot-name">{bot.name}</div>
                          <div className="business-badge">{bot.businessType || 'General'}</div>
                          <div className="ai-status">
                            <span className={`ai-dot ${ai.dot}`}></span>
                            <span className="ai-label">{ai.label}</span>
                            <span className="ai-provider">{ai.provider}</span>
                          </div>
                        </div>
                        <div className="card-footer">
                          <Link to={`/admin?chatbotId=${bot.id}`} className="open-agent-link">
                            Open Agent
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                            </svg>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIEW: ANALYTICS */}
          {view === 'analytics' && (
            <div id="panel-analytics">
              <div className="top-header">
                <div className="top-header-left">
                  <h1>Analytics Overview</h1>
                  <p>Knowledge base depth and agent configurations across all chatbots</p>
                </div>
              </div>

              <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <div className="stat-card">
                  <div className="stat-top">
                    <span className="stat-label">Total Documents</span>
                    <div className="stat-icon pink">📄</div>
                  </div>
                  <div className="stat-value">{globalStats.totalDocs}</div>
                  <div className="stat-sub">PDF sources uploaded</div>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <span className="stat-label">Total Intents</span>
                    <div className="stat-icon blue">💬</div>
                  </div>
                  <div className="stat-value">{globalStats.totalIntents}</div>
                  <div className="stat-sub">NLP match patterns</div>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <span className="stat-label">Knowledge Base Size</span>
                    <div className="stat-icon green">📚</div>
                  </div>
                  <div className="stat-value">{globalStats.totalKb}</div>
                  <div className="stat-sub">Parsed text excerpts</div>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <span className="stat-label">Total Token Usage</span>
                    <div className="stat-icon" style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#fbbf24', fontSize: '20px' }}>⚡</div>
                  </div>
                  <div className="stat-value" style={{ color: '#fbbf24' }}>{globalStats.totalTokens}</div>
                  <div className="stat-sub">AI requests tokens</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginTemplateRows: 'auto' }}>
                {/* Health Table */}
                <div className="card analytics-table-card">
                  <div className="card-title">Chatbot Health & Depth</div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Chatbot</th>
                          <th>Engine</th>
                          <th>Intents</th>
                          <th>PDFs</th>
                          <th>KB Excerpts</th>
                          <th>Token Usage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyticsData.map(({ bot, stats }) => (
                          <tr key={bot.id}>
                            <td style={{ fontWeight: 600 }}>{bot.name}</td>
                            <td>{bot.aiEnabled ? 'AI' : 'Local NLP'}</td>
                            <td>{stats.intentsCount}</td>
                            <td>{stats.documentsCount}</td>
                            <td>{stats.kbExcerptsCount}</td>
                            <td>{stats.tokenUsage}</td>
                          </tr>
                        ))}
                        {analyticsData.length === 0 && (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', color: 'var(--muted)' }}>No data available</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Biz Distribution */}
                <div className="card analytics-biz-card">
                  <div className="card-title">Business Type Distribution</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {getBizDistribution().map(({ type, count, pct }) => {
                      const biz = getBiz(type);
                      return (
                        <div className="progress-bar-container" key={type}>
                          <div className="progress-bar-label-row">
                            <span>{biz.emoji} {type}</span>
                            <span>{count} bot ({pct}%)</span>
                          </div>
                          <div className="progress-bar-wrap">
                            <div className="progress-bar-fill" style={{ width: `${pct}%`, backgroundColor: biz.color || 'var(--primary)' }}></div>
                          </div>
                        </div>
                      );
                    })}
                    {chatbots.length === 0 && <span style={{ color: 'var(--muted)', fontSize: '13px' }}>No chatbots deployed</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: SETTINGS */}
          {view === 'settings' && (
            <div id="panel-settings">
              <div className="top-header">
                <div className="top-header-left">
                  <h1>Account Settings</h1>
                  <p>Update your personal information and manage your login credentials</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '30px' }}>
                <div className="card panel-card">
                  <div className="card-title">👤 Profile Information</div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="settingName">Full Name</label>
                    <input type="text" className="form-input" id="settingName" value={profileName} onChange={(e) => setProfileName(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="settingEmail">Email Address</label>
                    <input type="email" className="form-input" id="settingEmail" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} />
                  </div>
                </div>

                <div className="card panel-card">
                  <div className="card-title">🔒 Change Password</div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="settingCurrentPassword">Current Password</label>
                    <input type="password" className="form-input" id="settingCurrentPassword" placeholder="Required to change password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="settingNewPassword">New Password</label>
                    <input type="password" className="form-input" id="settingNewPassword" placeholder="Enter new password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="settingConfirmPassword">Confirm New Password</label>
                    <input type="password" className="form-input" id="settingConfirmPassword" placeholder="Repeat new password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '30px' }}>
                <button className="btn-create" onClick={handleSaveSettings} disabled={savingSettings} style={{ background: 'linear-gradient(135deg, var(--success), #059669)', boxShadow: '0 4px 18px rgba(16,185,129,.35)' }}>
                  {savingSettings ? <div className="spinner"></div> : <span>💾</span>}
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* CREATE MODAL */}
      {createOpen && (
        <div className="modal-overlay open">
          <div className="modal-box">
            <div className="modal-gradient-bar"></div>
            <div className="modal-body">
              <div className="modal-header">
                <div>
                  <div className="modal-title">Create New Agent</div>
                  <div className="modal-desc">Deploy a new AI chatbot for your business</div>
                </div>
                <button className="modal-close" onClick={() => setCreateOpen(false)}>✕</button>
              </div>

              <form onSubmit={handleCreateAgent}>
                <div className="form-group">
                  <label className="form-label" htmlFor="agentName">Agent Name</label>
                  <input className="form-input" type="text" id="agentName" placeholder="e.g. ShopBot, SupportAI…" value={newBotName} onChange={(e) => setNewBotName(e.target.value)} required />
                </div>

                <div className="form-group">
                  <label className="form-label">Business Type</label>
                  <div className="business-grid">
                    {Object.keys(BIZ_MAP).map(type => {
                      const biz = BIZ_MAP[type];
                      return (
                        <div key={type} className={`biz-item ${selectedBizType === type ? 'selected' : ''} ${type === 'Other' ? 'span2' : ''}`} onClick={() => setSelectedBizType(type)}>
                          <span className="biz-emoji">{biz.emoji}</span>
                          <span className="biz-label">{type}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button type="submit" className="btn-primary" disabled={creating}>
                  {creating ? (
                    <div className="spinner"></div>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12l7 7 7-7" />
                    </svg>
                  )}
                  Create Agent
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteOpen && deleteTarget && (
        <div className="modal-overlay open">
          <div className="modal-box">
            <div className="modal-gradient-bar" style={{ background: 'linear-gradient(90deg,hsl(0,85%,58%),hsl(25,100%,55%))' }}></div>
            <div className="modal-body">
              <div className="modal-header">
                <div>
                  <div className="modal-title">Delete Agent</div>
                  <div className="modal-desc">This action is permanent and irreversible</div>
                </div>
                <button className="modal-close" onClick={() => setDeleteOpen(false)}>✕</button>
              </div>

              <div className="delete-warning">
                <span className="delete-warning-icon">⚠️</span>
                <div className="delete-warning-text">
                  You are about to permanently delete <span className="delete-warning-name">"{deleteTarget.name}"</span>.
                  All intents, documents, and knowledge base files will be lost.
                </div>
              </div>

              <div className="form-group">
                <p className="confirm-hint">Type <strong>{deleteTarget.name}</strong> to confirm:</p>
                <input className="form-input" type="text" placeholder="Type the agent name…" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} />
              </div>

              <button className="btn-danger" onClick={handleDeleteAgent} disabled={deleting || deleteConfirmText !== deleteTarget.name}>
                {deleting ? <div className="spinner"></div> : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                )}
                Delete Permanently
              </button>
              <button className="btn-ghost" onClick={() => setDeleteOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST SYSTEM */}
      {toast.show && (
        <div className="toast-container">
          <div className={`toast ${toast.type} show`}>
            <div className="toast-dot"></div>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
