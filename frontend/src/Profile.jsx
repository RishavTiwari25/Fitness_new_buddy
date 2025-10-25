import React, { useEffect, useState } from 'react'
import { API_BASE } from './api'

export default function Profile({ token, profile, onUpdate }) {
  const [name, setName] = useState(profile ? profile.name : '')
  const [gymId, setGymId] = useState(profile ? profile.gym_id : null)
  const [bio, setBio] = useState(profile ? (profile.bio || '') : '')
  const [allowShare, setAllowShare] = useState(!!(profile && profile.allow_calorie_share))
  const [avatarUrl, setAvatarUrl] = useState(profile ? profile.avatar_url : '')
  const [streaks, setStreaks] = useState({ gym_streak: null, diet_streak: null })
  const [gyms, setGyms] = useState([])
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    setName(profile ? profile.name : '')
    setGymId(profile ? profile.gym_id : null)
    setBio(profile ? (profile.bio || '') : '')
    setAllowShare(!!(profile && profile.allow_calorie_share))
    setAvatarUrl(profile ? profile.avatar_url : '')
  }, [profile])

  useEffect(() => {
    async function loadGyms() {
      try {
        const res = await fetch(`${API_BASE}/api/gyms`, { headers: { Authorization: 'Bearer ' + token } })
        const data = await res.json()
        setGyms(data)
      } catch (e) {
        // ignore
      }
    }
    loadGyms()
  }, [token])

  async function save(e) {
    e.preventDefault();
    setMsg(null)
    try {
      const res = await fetch(`${API_BASE}/api/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ name, gym_id: gymId, bio, allow_calorie_share: allowShare })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      onUpdate(data)
      setMsg('Saved')
    } catch (err) {
      setMsg(err.message)
    }
  }

  async function uploadAvatar(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setMsg(null)
    const fd = new FormData()
    fd.append('avatar', file)
    const res = await fetch(`${API_BASE}/api/profile/avatar`, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd })
    const data = await res.json()
    if (res.ok) {
      // Show immediate preview while server URL also updates
      try { setAvatarUrl(URL.createObjectURL(file)) } catch {}
      setAvatarUrl(data.avatar_url)
      onUpdate && onUpdate({ ...profile, avatar_url: data.avatar_url })
      setMsg('Avatar updated')
    } else {
      setMsg(data.error || 'Upload failed')
    }
  }

  useEffect(() => {
    async function loadStreak() {
      try {
        const res = await fetch(`${API_BASE}/api/me/streaks`, { headers: { Authorization: 'Bearer ' + token } })
        const data = await res.json()
        if (res.ok) setStreaks({ gym_streak: data.gym_streak, diet_streak: data.diet_streak })
      } catch {}
    }
    loadStreak()
  }, [token])

  return (
    <div>
      <h3>Profile</h3>
      <form onSubmit={save}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
          <img src={avatarUrl || 'https://via.placeholder.com/64'} alt="avatar" width={64} height={64} style={{ borderRadius: '50%', objectFit: 'cover' }} />
          <label style={{ cursor: 'pointer' }}>
            <span style={{ border: '1px solid #ccc', padding: '4px 8px' }}>Change Avatar</span>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadAvatar} />
          </label>
        </div>
        <div>
          <label>Username</label><br />
          <input value={name || ''} onChange={e => setName(e.target.value)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <label>Gym (select if you're a member)</label><br />
          <select value={gymId || ''} onChange={e => setGymId(e.target.value ? parseInt(e.target.value, 10) : null)}>
            <option value="">-- none --</option>
            {gyms.map(g => <option key={g.id} value={g.id}>{g.name} {g.location ? `(${g.location})` : ''}</option>)}
          </select>
        </div>
        <div style={{ marginTop: 8 }}>
          <label>Bio</label><br />
          <textarea rows={3} value={bio} onChange={e => setBio(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div style={{ marginTop: 8 }}>
          <label>
            <input type="checkbox" checked={allowShare} onChange={e => setAllowShare(e.target.checked)} />
            {' '}Allow followers to see my calorie intake
          </label>
        </div>
        {(streaks.gym_streak != null || streaks.diet_streak != null) && (
          <div style={{ marginTop: 8, color: '#555' }}>
            Gym streak: <strong>{streaks.gym_streak ?? 0} day{(streaks.gym_streak ?? 0) === 1 ? '' : 's'}</strong>
            {" "}| Diet streak: <strong>{streaks.diet_streak ?? 0} day{(streaks.diet_streak ?? 0) === 1 ? '' : 's'}</strong>
          </div>
        )}
        <div style={{ marginTop: 8 }}>
          <button type="submit">Save</button>
        </div>
        {msg && <p>{msg}</p>}
      </form>
    </div>
  )
}
