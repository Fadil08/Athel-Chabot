import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch } from './api';
import './Login.css'; // sharing layout & styling with Login

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: '', type: 'error' });
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setAlert({ show: false, message: '', type: 'error' });

    if (!name || !email || !password || !confirmPassword) {
      setAlert({ show: true, message: 'Please fill in all fields.', type: 'error' });
      return;
    }

    if (password !== confirmPassword) {
      setAlert({ show: true, message: 'Passwords do not match.', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('aethel_token', data.token);
        localStorage.setItem('aethel_user', JSON.stringify(data.user));
        setAlert({ show: true, message: 'Registration successful! Redirecting…', type: 'success' });
        setTimeout(() => {
          navigate('/');
        }, 600);
      } else {
        setAlert({ show: true, message: data.error || 'Failed to register account.', type: 'error' });
        setLoading(false);
      }
    } catch (err) {
      setAlert({ show: true, message: 'Unable to connect to the server. Please try again.', type: 'error' });
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="orb-field">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
        <div className="orb orb-4"></div>
      </div>

      <div className="wrapper">
        <aside className="left-panel">
          <div className="left-content">
            <div className="brand-logo">
              <div className="logo-mark">Æ</div>
              <div className="brand-name">
                Aethel
                <span>Chatbot Platform</span>
              </div>
            </div>

            <h1 className="hero-heading">Start your<br />journey with<br />Aethel.</h1>
            <p className="hero-sub">
              Create an account and set up automated, intelligent administrative assistants in minutes.
            </p>

            <div className="features">
              <div className="feature-item">
                <div className="feature-icon">🚀</div>
                <div className="feature-text">
                  <strong>Easy setup</strong>
                  <p>Incorporate existing PDF & rule knowledge</p>
                </div>
              </div>
              <div className="feature-item">
                <div className="feature-icon">🛡️</div>
                <div className="feature-text">
                  <strong>Secured with Google Drive</strong>
                  <p>Keep training resources saved in the cloud</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="right-panel">
          <div className="auth-card">
            <div className="card-header">
              <h2>Create Account ✨</h2>
              <p>Sign up to start managing academic agents</p>
            </div>

            {alert.show && (
              <div className={`alert-box ${alert.type} show ${alert.type === 'error' ? 'shake' : ''}`} role="alert">
                <span className="alert-icon">{alert.type === 'error' ? '⚠️' : '✅'}</span>
                <span className="alert-text">{alert.message}</span>
              </div>
            )}

            <form onSubmit={handleRegister} noValidate>
              <div className="form-group">
                <label htmlFor="name">
                  <span className="lbl-icon">👤</span> Full Name
                </label>
                <div className="input-wrap">
                  <input
                    type="text"
                    id="name"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

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
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">
                  <span className="lbl-icon">🔁</span> Confirm Password
                </label>
                <div className="input-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                  <span className="btn-text">Register Account</span>
                ) : (
                  <span className="btn-spinner" style={{ display: 'flex' }}>
                    <div className="spinner"></div>
                    Registering…
                  </span>
                )}
              </button>
            </form>

            <div className="divider">or</div>

            <div className="card-footer">
              Already have an account? <Link to="/login">Sign in instead →</Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
