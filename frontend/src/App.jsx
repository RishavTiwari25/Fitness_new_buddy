import React, { useState } from 'react'
import Login from './Login'
import Signup from './Signup'
import Dashboard from './Dashboard'

export default function App() {
  const [view, setView] = useState('login');
  const [token, setToken] = useState(localStorage.getItem('token'));

  function handleLogin(t) {
    localStorage.setItem('token', t);
    setToken(t);
  }

  function handleLogout() {
    localStorage.removeItem('token');
    setToken(null);
    setView('login');
  }

  if (token) return <Dashboard token={token} onLogout={handleLogout} />

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', fontFamily: 'Arial, sans-serif' }}>
      <h1>Fitness Buddy</h1>
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => setView('login')} disabled={view === 'login'}>Login</button>
        <button onClick={() => setView('signup')} disabled={view === 'signup'} style={{ marginLeft: 8 }}>Signup</button>
      </div>
      {view === 'login' ? <Login onLogin={handleLogin} /> : <Signup onSignup={handleLogin} />}
    </div>
  )
}
