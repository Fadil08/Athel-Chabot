import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

const Login = lazy(() => import('./Login'));
const Register = lazy(() => import('./Register'));
const Dashboard = lazy(() => import('./Dashboard'));
const ChatbotEditor = lazy(() => import('./ChatbotEditor'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));

// A simple premium-looking fallback / loading spinner
function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      width: '100vw',
      backgroundColor: '#0a0a0c',
      color: '#fff',
      fontFamily: 'Outfit, sans-serif'
    }}>
      <div style={{
        border: '3px solid rgba(255,255,255,0.1)',
        borderTop: '3px solid #6366f1',
        borderRadius: '50%',
        width: '40px',
        height: '40px',
        animation: 'spin 1s linear infinite'
      }} />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<Dashboard />} />
          <Route path="/admin" element={<ChatbotEditor />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
