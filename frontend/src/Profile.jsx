import React, { useEffect, useState } from 'react'

export default function Profile({ token, profile, onUpdate }) {
  const [name, setName] = useState(profile ? profile.name : '')
  const [gymId, setGymId] = useState(profile ? profile.gym_id : null)
  const [gyms, setGyms] = useState([])
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    setName(profile ? profile.name : '')
    setGymId(profile ? profile.gym_id : null)
  }, [profile])

  useEffect(() => {
    async function loadGyms() {
      try {
        const res = await fetch('http://localhost:4000/api/gyms', { headers: { Authorization: 'Bearer ' + token } })
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
      const res = await fetch('http://localhost:4000/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ name, gym_id: gymId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      onUpdate(data)
      setMsg('Saved')
    } catch (err) {
      setMsg(err.message)
    }
  }

  return (
    <div>
      <h3>Profile</h3>
      <form onSubmit={save}>
        <div>
          <label>Username</label><br />
          <input value={name || ''} onChange={e => setName(e.target.value)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <label>Gym (select if you're a member)</label><br />
          <select value={gymId || ''} onChange={e => setGymId(e.target.value || null)}>
            <option value="">-- none --</option>
            {gyms.map(g => <option key={g.id} value={g.id}>{g.name} {g.location ? `(${g.location})` : ''}</option>)}
          </select>
        </div>
        <div style={{ marginTop: 8 }}>
          <button type="submit">Save</button>
        </div>
        {msg && <p>{msg}</p>}
      </form>
    </div>
  )
}
