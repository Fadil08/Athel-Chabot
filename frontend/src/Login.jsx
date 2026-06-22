import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: '', type: 'error' });
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setAlert({ show: false, message: '', type: 'error' });

    if (!email || !password) {
      setAlert({ show: true, message: 'Please fill in all fields.', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('aethel_token', data.token);
        localStorage.setItem('aethel_user', JSON.stringify(data.user));
        setAlert({ show: true, message: 'Login successful! Redirecting…', type: 'success' });
        setTimeout(() => {
          navigate('/');
        }, 600);
      } else {
        setAlert({ show: true, message: data.error || 'Invalid email or password. Please try again.', type: 'error' });
        setLoading(false);
      }
    } catch (err) {
      setAlert({ show: true, message: 'Unable to connect to the server. Please try again.', type: 'error' });
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      {/* Floating Orbs */}
      <div className="orb-field">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
        <div className="orb orb-4"></div>
      </div>

      <div className="wrapper">
        {/* LEFT PANEL */}
        <aside className="left-panel">
          <div className="left-content">
            <div className="brand-logo">
              <div className="logo-mark">Æ</div>
              <div className="brand-name">
                Aethel
                <span>Chatbot Platform</span>
              </div>
            </div>

            <h1 className="hero-heading">Your AI<br />Chatbot,<br />Reimagined.</h1>
            <p className="hero-sub">
              Deploy intelligent, context-aware chatbots powered by cutting-edge AI — no coding required.
            </p>

            <div className="features">
              <div className="feature-item">
                <div className="feature-icon">🤖</div>
                <div className="feature-text">
                  <strong>AI-Powered Responses</strong>
                  <p>Understands context, intent & nuance</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">⚡</div>
                <div className="feature-text">
                  <strong>Lightning Fast Setup</strong>
                  <p>Go live in minutes, not weeks</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🔒</div>
                <div className="feature-text">
                  <strong>Enterprise-Grade Security</strong>
                  <p>Your data stays private & protected</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT FORM PANEL */}
        <main className="right-panel">
          <div className="auth-card">
            <div className="card-header">
              <h2>Welcome back 👋</h2>
              <p>Sign in to your Aethel account</p>
            </div>

            {alert.show && (
              <div className={`alert-box ${alert.type} show ${alert.type === 'error' ? 'shake' : ''}`} role="alert">
                <span className="alert-icon">{alert.type === 'error' ? '⚠️' : '✅'}</span>
                <span className="alert-text">{alert.message}</span>
              </div>
            )}

            <form onSubmit={handleLogin} novalidate>
              <div className="form-group">
                <label htmlFor="email">
                  <span className="lbl-icon">✉️</span> Email Address
                </label>
                <div className="input-wrap">
                  <input
                    type="email"
                    id="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password">
                  <span className="lbl-icon">🔑</span> Password
                </label>
                <div className="input-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="toggle-pw"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    {!showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn-submit" disabled={loading}>
                {!loading ? (
                  <span className="btn-text">Sign In</span>
                ) : (
                  <span className="btn-spinner" style={{ display: 'flex' }}>
                    <div className="spinner"></div>
                    Signing in…
                  </span>
                )}
              </button>
            </form>

            <div className="divider">or</div>

            <div className="card-footer">
              Don't have an account? <Link to="/register">Create one free →</Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
