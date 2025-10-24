import React, { useEffect, useState } from 'react'
import { API_BASE } from './api'
import Profile from './Profile'
import AdminPanel from './AdminPanel'
import MemberHome from './MemberHome'

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
        const res = await fetch(`${API_BASE}/api/profile`, {
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
          {payload.role === 'member' && <button onClick={() => setView('member')} style={{ marginLeft: 8 }}>Member</button>}
          <button onClick={onLogout} style={{ marginLeft: 8 }}>Logout</button>
        </div>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

  {view === 'profile' && <Profile token={token} profile={profile} onUpdate={setProfile} />}
  {view === 'admin' && payload.role === 'owner' && <AdminPanel token={token} />}
  {view === 'member' && payload.role === 'member' && <MemberHome token={token} defaultGymId={profile?.gym_id} />}

      <hr />
      <p>Use the Profile page to set your username. Gym Owners can register gyms and manage equipment in the Admin section. Members can scan the gym QR to check-in/out and see live occupancy.</p>
    </div>
  )
}
