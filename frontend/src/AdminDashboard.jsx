import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch } from './api';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const [view, setView] = useState('users'); // users, chatbots
  const [theme, setTheme] = useState(localStorage.getItem('aethel_theme') || 'dark');
  const [user, setUser] = useState({});
  
  const [allUsers, setAllUsers] = useState([]);
  const [allChatbots, setAllChatbots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({ name: '', email: '', password: '', role: 'user', maxChatbots: 3 });
  const navigate = useNavigate();

  const token = localStorage.getItem('aethel_token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const u = JSON.parse(localStorage.getItem('aethel_user') || '{}');
      if (u.role !== 'admin') {
        navigate('/'); // Redirect non-admins
        return;
      }
      setUser(u);
    } catch {
      navigate('/login');
    }

    loadData();
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

  const loadData = async () => {
    setLoading(true);
    try {
      const usersRes = await apiFetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const chatbotsRes = await apiFetch('/api/admin/chatbots', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!usersRes.ok || !chatbotsRes.ok) {
        throw new Error('Gagal memuat data admin. Pastikan Anda memiliki akses.');
      }

      const usersData = await usersRes.json();
      const chatbotsData = await chatbotsRes.json();

      setAllUsers(usersData);
      setAllChatbots(chatbotsData);
    } catch (err) {
      showToast(err.message || 'Koneksi ke server gagal.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Yakin ingin menghapus user ini beserta semua chatbot-nya?')) return;
    
    try {
      const res = await apiFetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        showToast('User berhasil dihapus', 'success');
        loadData();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Gagal menghapus user.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan.', 'error');
    }
  };

  const handleDeleteChatbot = async (id) => {
    if (!window.confirm('Yakin ingin menghapus chatbot ini?')) return;

    try {
      const res = await apiFetch(`/api/admin/chatbots/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        showToast('Chatbot berhasil dihapus', 'success');
        loadData();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Gagal menghapus chatbot.', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan.', 'error');
    }
  };

  const openUserModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setUserFormData({ name: user.name, email: user.email, password: '', role: user.role || 'user', maxChatbots: user.maxChatbots !== undefined ? user.maxChatbots : 3 });
    } else {
      setEditingUser(null);
      setUserFormData({ name: '', email: '', password: '', role: 'user', maxChatbots: 3 });
    }
    setShowUserModal(true);
  };

  const closeUserModal = () => {
    setShowUserModal(false);
    setEditingUser(null);
  };

  const handleUserFormSubmit = async (e) => {
    e.preventDefault();
    const isEditing = !!editingUser;
    const url = isEditing ? `/api/admin/users/${editingUser.id}` : '/api/admin/users';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(userFormData)
      });

      if (res.ok) {
        showToast(`User berhasil ${isEditing ? 'diperbarui' : 'dibuat'}`, 'success');
        closeUserModal();
        loadData();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || `Gagal ${isEditing ? 'memperbarui' : 'membuat'} user.`, 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan jaringan.', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('aethel_token');
    localStorage.removeItem('aethel_user');
    navigate('/login');
  };

  const getOwnerName = (userId) => {
    const owner = allUsers.find(u => u.id === userId);
    return owner ? owner.email : `User #${userId}`;
  };

  return (
    <div className="admin-container">
      {toast.show && (
        <div className={`toast-notification ${toast.type}`}>
          <div className="toast-icon">
            {toast.type === 'success' ? '✅' : toast.type === 'error' ? '🚨' : 'ℹ️'}
          </div>
          <div className="toast-message">{toast.message}</div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-badge">🛡️</div>
          <h2>Aethel Admin</h2>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group">
            <span className="nav-label">Management</span>
            
            <a href="#" className={`nav-item ${view === 'users' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setView('users'); }}>
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <span>Users</span>
            </a>

            <a href="#" className={`nav-item ${view === 'chatbots' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setView('chatbots'); }}>
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              <span>Chatbots</span>
            </a>
          </div>

          <div className="nav-group" style={{ marginTop: 'auto' }}>
            <Link to="/" className="nav-item">
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
              <span>Back to App</span>
            </Link>

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
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="admin-content">
        <header className="admin-header">
          <div className="header-titles">
            <h1>{view === 'users' ? 'User Management' : 'Global Chatbots'}</h1>
            <p>Administer all users and system chatbots.</p>
          </div>
          <div className="header-actions">
            {view === 'users' && (
              <button className="btn primary" onClick={() => openUserModal()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Tambah User
              </button>
            )}
            <button className="btn outline" onClick={loadData}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
            </button>
            <div className="user-profile-btn" onClick={handleLogout} title="Logout">
              <div className="avatar">{user.name ? user.name.charAt(0).toUpperCase() : 'A'}</div>
              <span className="user-name">{user.name}</span>
            </div>
          </div>
        </header>

        <div className="admin-body scroll-container">
          {loading ? (
            <div className="admin-loading">
              <div className="spinner"></div>
              <p>Memuat data admin...</p>
            </div>
          ) : view === 'users' ? (
            <div className="table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nama</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Max Bots</th>
                    <th>Chatbots</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map(u => {
                    const uBots = allChatbots.filter(b => b.userId === u.id);
                    return (
                      <tr key={u.id}>
                        <td>#{u.id}</td>
                        <td>{u.name}</td>
                        <td>{u.email}</td>
                        <td>
                          <span className={`role-badge ${u.role}`}>{u.role}</span>
                        </td>
                        <td>{u.maxChatbots !== undefined ? u.maxChatbots : 3}</td>
                        <td>{uBots.length}</td>
                        <td>
                          <div className="action-buttons">
                            <button className="btn-icon edit" onClick={() => openUserModal(u)} title="Edit User">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button className="btn-icon delete" onClick={() => handleDeleteUser(u.id)} title="Hapus User" disabled={u.id === user.id}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {allUsers.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center">Tidak ada user ditemukan.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nama Chatbot</th>
                    <th>Pemilik (Email)</th>
                    <th>Tipe Bisnis</th>
                    <th>AI Enabled</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {allChatbots.map(bot => (
                    <tr key={bot.id}>
                      <td>#{bot.id}</td>
                      <td><strong>{bot.name}</strong></td>
                      <td>{getOwnerName(bot.userId)}</td>
                      <td>{bot.businessType}</td>
                      <td>
                        <span className={`status-badge ${bot.aiEnabled ? 'active' : 'inactive'}`}>
                          {bot.aiEnabled ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <Link to={`/admin?chatbotId=${bot.id}`} className="btn-icon edit" title="Edit Chatbot">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                          </Link>
                          <button className="btn-icon delete" onClick={() => handleDeleteChatbot(bot.id)} title="Hapus Chatbot">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {allChatbots.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center">Tidak ada chatbot ditemukan.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* User Modal */}
      {showUserModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>{editingUser ? 'Edit User' : 'Tambah User'}</h3>
              <button className="btn-close" onClick={closeUserModal}>×</button>
            </div>
            <form className="admin-modal-body" onSubmit={handleUserFormSubmit}>
              <div className="form-group">
                <label>Nama Lengkap</label>
                <input type="text" value={userFormData.name} onChange={e => setUserFormData({...userFormData, name: e.target.value})} required placeholder="John Doe" />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={userFormData.email} onChange={e => setUserFormData({...userFormData, email: e.target.value})} required placeholder="john@example.com" />
              </div>
              <div className="form-group">
                <label>{editingUser ? 'Password (kosongkan jika tidak ingin diubah)' : 'Password'}</label>
                <input type="text" value={userFormData.password} onChange={e => setUserFormData({...userFormData, password: e.target.value})} required={!editingUser} placeholder={editingUser ? "Kosongkan untuk tidak mengubah" : "Password rahasia"} />
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Role</label>
                  <select value={userFormData.role} onChange={e => setUserFormData({...userFormData, role: e.target.value})}>
                    <option value="user">User Biasa</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Limit Chatbot</label>
                  <input type="number" value={userFormData.maxChatbots} onChange={e => setUserFormData({...userFormData, maxChatbots: parseInt(e.target.value) || 0})} min="0" required />
                </div>
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="btn outline" onClick={closeUserModal}>Batal</button>
                <button type="submit" className="btn primary">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
