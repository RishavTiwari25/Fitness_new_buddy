import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { API_BASE } from './api'
import Icon from './components/Icon'

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
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 18, mass: 0.9 }}>
      <div className="card" style={{ padding: 20, marginTop: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="neu-badge" style={{ width: 46, height: 46 }}><Icon name="gift" size={22} color="#D97757" /></span>
          <div>
          <h3 className="font-display" style={{ fontSize: 20, marginBottom: 6 }}>Rewards & Points</h3>
          <div className="text-secondary" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13 }}>Your points</span>
            <span style={{
              background: 'rgba(217, 119, 87, 0.12)',
              color: 'var(--accent-lime)',
              border: '1px solid var(--accent-lime)',
              padding: '6px 10px',
              borderRadius: 9999,
              fontWeight: 700
            }}>{points}</span>
          </div>
          </div>
        </div>
        <button className="btn-primary rounded-full" onClick={claimDaily}>Claim Daily Points</button>
      </div>
      {msg && (
        <div className="card" style={{
          padding: 12,
          marginBottom: 16,
          background: 'rgba(217, 119, 87, 0.08)',
          border: '1px solid var(--accent-lime)',
          color: 'var(--accent-lime)',
          fontWeight: 600
        }}>{msg}</div>
      )}

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h4 style={{ marginBottom: 10 }}>Available Rewards</h4>
          {available.length === 0 && <div className="text-secondary">No rewards available for your gym yet.</div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {available.map(r => {
              const disabled = points < r.cost_points
              return (
                <div key={r.id} className="card" style={{ padding: 16, background: 'var(--bg-secondary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{r.name}</div>
                    <span style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      padding: '6px 10px',
                      borderRadius: 9999,
                      fontSize: 12
                    }}>{r.cost_points} pts</span>
                  </div>
                  {r.description && <div className="text-secondary" style={{ fontSize: 13, marginBottom: 12 }}>{r.description}</div>}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className={`rounded-full ${disabled ? 'btn-secondary' : 'btn-primary'}`}
                      disabled={disabled}
                      onClick={() => redeem(r.id)}
                      style={{ padding: '10px 16px', fontWeight: 700, opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
                    >
                      {disabled ? 'Not enough points' : 'Redeem now'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {isOwner && (
          <div style={{ width: 360 }}>
            <h4 style={{ marginBottom: 10 }}>Owner: Create Reward</h4>
            <div className="card" style={{ padding: 16 }}>
              <form onSubmit={createReward}>
                <div style={{ marginBottom: 10 }}>
                  <label className="text-secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Gym</label>
                  <select value={form.gym_id} onChange={e => setForm(f => ({ ...f, gym_id: e.target.value }))} style={{ width: '100%' }}>
                    <option value="">-- select your gym --</option>
                    {gyms.map(g => (
                      <option key={g.id} value={g.id}>{g.name}{g.location ? ` (${g.location})` : ''} [#{g.id}]</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label className="text-secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Name</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label className="text-secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Cost (points)</label>
                  <input value={form.cost_points} onChange={e => setForm(f => ({ ...f, cost_points: e.target.value }))} style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label className="text-secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Description</label>
                  <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ width: '100%' }} />
                </div>
                <div>
                  <button
                    type="submit"
                    className={`btn-primary rounded-full`}
                    disabled={!form.gym_id || !form.name || !form.cost_points}
                    style={{
                      opacity: !form.gym_id || !form.name || !form.cost_points ? 0.6 : 1,
                      cursor: !form.gym_id || !form.name || !form.cost_points ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>

            <div style={{ marginTop: 12 }}>
              <h5 style={{ marginBottom: 6 }}>My Rewards</h5>
              {myRewards.length === 0 && <div className="text-secondary">No rewards yet.</div>}
              <div style={{ display: 'grid', gap: 8 }}>
                {myRewards.map(r => (
                  <div key={r.id} className="card" style={{ padding: 12, background: 'var(--bg-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 600 }}>{r.name}{r.description ? ` — ${r.description}` : ''}</div>
                      <span style={{ fontSize: 12, background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '4px 8px', borderRadius: 9999 }}>{r.cost_points} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
