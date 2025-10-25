import React, { useEffect, useMemo, useState } from 'react'
import { API_BASE } from './api'

function parseJwt(token) {
  try { return JSON.parse(atob(token.split('.')[1])) } catch { return {} }
}

export default function Rewards({ token }) {
  const payload = useMemo(() => parseJwt(token), [token])
  const isOwner = payload.role === 'owner'

  const [myRewards, setMyRewards] = useState([])
  const [available, setAvailable] = useState([])
  const [points, setPoints] = useState(0)
  const [form, setForm] = useState({ gym_id: '', name: '', cost_points: '', description: '' })
  const [msg, setMsg] = useState('')
  const [gyms, setGyms] = useState([])

  async function loadPoints() {
    try {
      const r = await fetch(`${API_BASE}/api/me/points`, { headers: { Authorization: 'Bearer ' + token } })
      const j = await r.json(); if (r.ok) setPoints(j.points || 0)
    } catch {}
  }

  async function loadAvailable() {
    try { const r = await fetch(`${API_BASE}/api/rewards/available`, { headers: { Authorization: 'Bearer ' + token } }); const j = await r.json(); if (r.ok) setAvailable(j) } catch {}
  }

  async function loadMyRewards() {
    if (!isOwner) return
    try { const r = await fetch(`${API_BASE}/api/rewards/my`, { headers: { Authorization: 'Bearer ' + token } }); const j = await r.json(); if (r.ok) setMyRewards(j) } catch {}
  }

  useEffect(() => { loadPoints(); loadAvailable(); loadMyRewards(); }, [token])
  useEffect(() => {
    async function loadGyms() {
      try { const r = await fetch(`${API_BASE}/api/gyms`, { headers: { Authorization: 'Bearer ' + token } }); const j = await r.json(); if (r.ok) setGyms(j) } catch {}
    }
    loadGyms()
  }, [token])

  async function claimDaily() {
    setMsg('')
    const r = await fetch(`${API_BASE}/api/me/claim-daily-points`, { method: 'POST', headers: { Authorization: 'Bearer ' + token } })
    const j = await r.json();
    if (r.ok) { setMsg(`Claimed ${j.awarded} points`); loadPoints() } else { setMsg(j.error || 'Failed to claim') }
  }

  async function createReward(e) {
    e.preventDefault(); setMsg('')
    const body = { ...form, gym_id: form.gym_id ? parseInt(form.gym_id, 10) : undefined, cost_points: form.cost_points ? parseInt(form.cost_points, 10) : undefined }
    const r = await fetch(`${API_BASE}/api/rewards`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) })
    const j = await r.json(); if (r.ok) { setForm({ gym_id: '', name: '', cost_points: '', description: '' }); setMsg('Created'); loadMyRewards(); loadAvailable(); }
    else setMsg(j.error || 'Failed to create')
  }

  async function redeem(id) {
    setMsg('')
    const r = await fetch(`${API_BASE}/api/rewards/${id}/redeem`, { method: 'POST', headers: { Authorization: 'Bearer ' + token } })
    const j = await r.json(); if (r.ok) { setMsg('Redeemed'); loadPoints() } else setMsg(j.error || 'Redeem failed')
  }

  return (
    <div>
      <h3>Rewards & Points</h3>
      <div style={{ marginBottom: 10 }}>Your points: <strong>{points}</strong></div>
      <button onClick={claimDaily}>Claim Daily Points</button>
      {msg && <div style={{ marginTop: 8 }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 24, marginTop: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h4>Available Rewards</h4>
          {available.length === 0 && <div style={{ color: '#666' }}>No rewards available for your gym yet.</div>}
          <ul>
            {available.map(r => (
              <li key={r.id} style={{ marginBottom: 8 }}>
                <strong>{r.name}</strong> - {r.cost_points} pts{r.description ? ` — ${r.description}` : ''}
                <div>
                  <button disabled={points < r.cost_points} onClick={() => redeem(r.id)}>
                    Redeem ({points < r.cost_points ? 'Not enough points' : 'Redeem now'})
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {isOwner && (
          <div style={{ width: 320 }}>
            <h4>Owner: Create Reward</h4>
            <form onSubmit={createReward}>
              <div>
                <label>Gym</label><br />
                <select value={form.gym_id} onChange={e => setForm(f => ({ ...f, gym_id: e.target.value }))}>
                  <option value="">-- select your gym --</option>
                  {gyms.map(g => (
                    <option key={g.id} value={g.id}>{g.name}{g.location ? ` (${g.location})` : ''} [#{g.id}]</option>
                  ))}
                </select>
              </div>
              <div style={{ marginTop: 8 }}>
                <label>Name</label><br />
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ marginTop: 8 }}>
                <label>Cost (points)</label><br />
                <input value={form.cost_points} onChange={e => setForm(f => ({ ...f, cost_points: e.target.value }))} />
              </div>
              <div style={{ marginTop: 8 }}>
                <label>Description</label><br />
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div style={{ marginTop: 8 }}>
                <button type="submit" disabled={!form.gym_id || !form.name || !form.cost_points}>Create</button>
              </div>
            </form>
            <div style={{ marginTop: 12 }}>
              <h5>My Rewards</h5>
              {myRewards.length === 0 && <div style={{ color: '#666' }}>No rewards yet.</div>}
              <ul>
                {myRewards.map(r => (
                  <li key={r.id}><strong>{r.name}</strong> - {r.cost_points} pts{r.description ? ` — ${r.description}` : ''}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
