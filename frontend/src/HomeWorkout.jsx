import React, { useState } from 'react'
import { API_BASE } from './api'

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
    <div style={{
      backgroundColor: '#27272a',
      borderRadius: '20px',
      border: '1px solid #3f3f46',
      padding: '24px',
      ...style
    }}>{children}</div>
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
    <div>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#fafafa', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>🏠</span> Home Workout
            </div>
            <div style={{ color: '#a1a1aa', marginTop: 6 }}>Can't make it to the gym today? Get a bodyweight-only routine.</div>
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
            <div style={{ fontSize: 22, color: '#fafafa', fontWeight: 800 }}>{plan.title} {level && chip(level.toUpperCase())}</div>
            {chip(`⏱ ${plan.est_time_min} min`)}
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
          <div style={{ color: '#a1a1aa' }}>No plan yet. Pick a difficulty and click “Give me a workout”.</div>
        </Card>
      )}
    </div>
  )
}
