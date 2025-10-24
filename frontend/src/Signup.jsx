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
      <div>
        <label>Name (optional)</label><br />
        <input value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div>
        <label>Role</label><br />
        <select value={role} onChange={e => setRole(e.target.value)}>
          <option value="member">Member</option>
          <option value="trainer">Trainer</option>
          <option value="owner">Gym Owner</option>
        </select>
      </div>
      <div>
        <label>Email</label><br />
        <input value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div>
        <label>Password</label><br />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
      </div>
      <div style={{ marginTop: 8 }}>
        <button type="submit">Signup</button>
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  )
}
