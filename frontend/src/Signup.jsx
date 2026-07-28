import React, { useState } from 'react'
import { API_BASE } from './api'

export default function Signup({ onSignup }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('member')
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Signup failed')
      onSignup(data.token)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={submit}>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ 
          display: 'block', 
          color: '#F5F4EE', 
          fontWeight: '600', 
          marginBottom: '8px',
          fontSize: '14px'
        }}>Name <span style={{ color: '#A6A29A', fontWeight: '400' }}>(optional)</span></label>
        <input 
          type="text"
          value={name} 
          onChange={e => setName(e.target.value)}
          style={{
            width: '100%',
            padding: '14px 16px',
            backgroundColor: '#1F1E1D',
            border: '1px solid #3A3937',
            borderRadius: '12px',
            color: '#F5F4EE',
            fontSize: '15px'
          }}
          placeholder="Your name"
        />
      </div>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ 
          display: 'block', 
          color: '#F5F4EE', 
          fontWeight: '600', 
          marginBottom: '8px',
          fontSize: '14px'
        }}>I am a...</label>
        <select 
          value={role} 
          onChange={e => setRole(e.target.value)}
          style={{
            width: '100%',
            padding: '14px 16px',
            backgroundColor: '#1F1E1D',
            border: '1px solid #3A3937',
            borderRadius: '12px',
            color: '#F5F4EE',
            fontSize: '15px',
            cursor: 'pointer'
          }}
        >
          <option value="member">Gym Member</option>
          <option value="manager">Gym Manager</option>
        </select>
      </div>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ 
          display: 'block', 
          color: '#F5F4EE', 
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
            backgroundColor: '#1F1E1D',
            border: '1px solid #3A3937',
            borderRadius: '12px',
            color: '#F5F4EE',
            fontSize: '15px'
          }}
          placeholder="your.email@example.com"
        />
      </div>
      <div style={{ marginBottom: '24px' }}>
        <label style={{ 
          display: 'block', 
          color: '#F5F4EE', 
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
            backgroundColor: '#1F1E1D',
            border: '1px solid #3A3937',
            borderRadius: '12px',
            color: '#F5F4EE',
            fontSize: '15px'
          }}
          placeholder="••••••••"
        />
      </div>
      <button 
        type="submit"
        style={{
          width: '100%',
          padding: '16px',
          backgroundColor: '#D97757',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '9999px',
          fontSize: '16px',
          fontWeight: '700',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
        onMouseOver={e => e.target.style.backgroundColor = '#C4664A'}
        onMouseOut={e => e.target.style.backgroundColor = '#D97757'}
      >
        Create Account
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
