import React, { useState } from 'react'
import { API_BASE } from './api'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      onLogin(data.token)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={submit}>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ 
          display: 'block', 
          color: '#fafafa', 
          fontWeight: '600', 
          marginBottom: '8px',
          fontSize: '14px'
        }}>Email</label>
        <input 
          type="email"
          value={email} 
          onChange={e => setEmail(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '14px 16px',
            backgroundColor: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: '12px',
            color: '#fafafa',
            fontSize: '15px',
            transition: 'all 0.3s ease'
          }}
          placeholder="your.email@example.com"
        />
      </div>
      <div style={{ marginBottom: '24px' }}>
        <label style={{ 
          display: 'block', 
          color: '#fafafa', 
          fontWeight: '600', 
          marginBottom: '8px',
          fontSize: '14px'
        }}>Password</label>
        <input 
          type="password" 
          value={password} 
          onChange={e => setPassword(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '14px 16px',
            backgroundColor: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: '12px',
            color: '#fafafa',
            fontSize: '15px',
            transition: 'all 0.3s ease'
          }}
          placeholder="••••••••"
        />
      </div>
      <button 
        type="submit"
        style={{
          width: '100%',
          padding: '16px',
          backgroundColor: '#D0FD3E',
          color: '#18181b',
          border: 'none',
          borderRadius: '9999px',
          fontSize: '16px',
          fontWeight: '700',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
        onMouseOver={e => e.target.style.backgroundColor = '#bef334'}
        onMouseOut={e => e.target.style.backgroundColor = '#D0FD3E'}
      >
        Login to Your Account
      </button>
      {error && (
        <div style={{ 
          marginTop: '16px',
          padding: '12px',
          backgroundColor: '#7f1d1d',
          border: '1px solid #991b1b',
          borderRadius: '8px',
          color: '#fca5a5',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}
    </form>
  )
}
