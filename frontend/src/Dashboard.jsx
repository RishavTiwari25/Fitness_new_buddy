import React, { useEffect, useState } from 'react'
import Profile from './Profile'
import AdminPanel from './AdminPanel'

function parseJwt(token) {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload))
  } catch (e) {
    return {}
  }
}

export default function Dashboard({ token, onLogout }) {
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState(null)
  const [view, setView] = useState('profile')
  const payload = parseJwt(token)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('http://localhost:4000/api/profile', {
          headers: { Authorization: 'Bearer ' + token }
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to fetch')
        setProfile(data)
      } catch (err) {
        setError(err.message)
      }
    }
    load()
  }, [token])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h2>Dashboard</h2>
        <div>
          <button onClick={() => setView('profile')}>Profile</button>
          {payload.role === 'owner' && <button onClick={() => setView('admin')} style={{ marginLeft: 8 }}>Admin</button>}
          <button onClick={onLogout} style={{ marginLeft: 8 }}>Logout</button>
        </div>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {view === 'profile' && <Profile token={token} profile={profile} onUpdate={setProfile} />}
      {view === 'admin' && payload.role === 'owner' && <AdminPanel token={token} />}

      <hr />
      <p>Use the Profile page to set your username. Gym Owners can register gyms and manage equipment in the Admin section.</p>
    </div>
  )
}
