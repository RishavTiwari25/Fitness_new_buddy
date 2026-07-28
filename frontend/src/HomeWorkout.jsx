import React, { useState } from 'react'
import { motion } from 'motion/react'
import { API_BASE } from './api'
import Icon from './components/Icon'

export default function HomeWorkout({ token }) {
  const [level, setLevel] = useState('easy')
  const [plan, setPlan] = useState(null)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function getPlan() {
    setMsg(''); setPlan(null); setLoading(true)
    try {
      const r = await fetch(`${API_BASE}/api/home-workout?level=${encodeURIComponent(level)}`, { headers: { Authorization: 'Bearer ' + token } })
      const j = await r.json(); if (r.ok) setPlan(j); else setMsg(j.error || 'Failed to load plan')
    } catch (e) { setMsg('Failed to load plan') } finally { setLoading(false) }
  }

  const Card = ({ children, style }) => (
    <div className="card" style={{ padding: '24px', ...style }}>{children}</div>
  )

  const chip = (text, color = '#D0FD3E') => (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 10px',
      backgroundColor: '#18181b',
      border: `1px solid ${color}`,
      color: '#fafafa',
      borderRadius: 9999,
      fontSize: 12,
      fontWeight: 700
    }}>{text}</span>
  )

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 18, mass: 0.9 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div className="font-display" style={{ fontSize: 28, fontWeight: 700, color: '#fafafa', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="neu-badge" style={{ width: 44, height: 44 }}><Icon name="dumbbell" size={22} color="#D0FD3E" /></span> Home Workout
            </div>
            <div style={{ color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>Can't make it to the gym today? Get a bodyweight-only routine.</div>
          </div>
          <div style={{ height: 32, width: 4, background: '#D0FD3E', borderRadius: 999 }} />
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ color: '#fafafa', fontWeight: 600 }}>Difficulty:</div>
          <select
            value={level}
            onChange={e => setLevel(e.target.value)}
            style={{
              backgroundColor: '#18181b',
              color: '#fafafa',
              border: '2px solid #3f3f46',
              borderRadius: 12,
              padding: '8px 12px',
              outline: 'none',
            }}
            onFocus={e => e.currentTarget.style.borderColor = '#D0FD3E'}
            onBlur={e => e.currentTarget.style.borderColor = '#3f3f46'}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <button
            onClick={getPlan}
            disabled={loading}
            style={{
              padding: '10px 16px',
              backgroundColor: loading ? '#52525b' : '#D0FD3E',
              color: '#18181b',
              border: 'none',
              borderRadius: 12,
              fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.backgroundColor = '#c4ed38' } }}
            onMouseLeave={e => { if (!loading) { e.currentTarget.style.backgroundColor = '#D0FD3E' } }}
          >
            {loading ? 'Generating…' : 'Give me a workout'}
          </button>
        </div>

        {msg && (
          <div style={{ marginTop: 12, padding: '10px 12px', background: '#3f3f46', color: '#fafafa', borderRadius: 10 }}>{msg}</div>
        )}
      </Card>

      {/* Plan card */}
      {plan ? (
        <Card style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="font-display" style={{ fontSize: 22, color: '#fafafa', fontWeight: 700 }}>{plan.title} {level && chip(level.toUpperCase())}</div>
            {chip(<><Icon name="activity" size={12} color="#D0FD3E" /> {plan.est_time_min} min</>)}
          </div>
          <ol style={{ marginTop: 8, color: '#d4d4d8', paddingLeft: 20 }}>
            {plan.exercises.map((e, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 800, color: '#fafafa' }}>{e.name}</span>
                <span style={{ color: '#a1a1aa' }}>: {e.prescription}</span>
              </li>
            ))}
          </ol>
        </Card>
      ) : (
        <Card style={{ marginTop: 16, background: '#1f1f22' }}>
          <div style={{ color: 'rgba(255,255,255,0.5)' }}>No plan yet. Pick a difficulty and click “Give me a workout”.</div>
        </Card>
      )}
    </motion.div>
  )
}
