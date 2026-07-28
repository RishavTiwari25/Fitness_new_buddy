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

  const chip = (text, color = '#D97757') => (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 10px',
      backgroundColor: '#1F1E1D',
      border: `1px solid ${color}`,
      color: '#F5F4EE',
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
            <div className="font-display" style={{ fontSize: 28, fontWeight: 700, color: '#F5F4EE', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="neu-badge" style={{ width: 44, height: 44 }}><Icon name="dumbbell" size={22} color="#D97757" /></span> Home Workout
            </div>
            <div style={{ color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>Can't make it to the gym today? Get a bodyweight-only routine.</div>
          </div>
          <div style={{ height: 32, width: 4, background: '#D97757', borderRadius: 999 }} />
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ color: '#F5F4EE', fontWeight: 600 }}>Difficulty:</div>
          <select
            value={level}
            onChange={e => setLevel(e.target.value)}
            style={{
              backgroundColor: '#1F1E1D',
              color: '#F5F4EE',
              border: '2px solid #3A3937',
              borderRadius: 12,
              padding: '8px 12px',
              outline: 'none',
            }}
            onFocus={e => e.currentTarget.style.borderColor = '#D97757'}
            onBlur={e => e.currentTarget.style.borderColor = '#3A3937'}
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
              backgroundColor: loading ? '#4C4A46' : '#D97757',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 12,
              fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.backgroundColor = '#C4664A' } }}
            onMouseLeave={e => { if (!loading) { e.currentTarget.style.backgroundColor = '#D97757' } }}
          >
            {loading ? 'Generating…' : 'Give me a workout'}
          </button>
        </div>

        {msg && (
          <div style={{ marginTop: 12, padding: '10px 12px', background: '#3A3937', color: '#F5F4EE', borderRadius: 10 }}>{msg}</div>
        )}
      </Card>

      {/* Plan card */}
      {plan ? (
        <Card style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="font-display" style={{ fontSize: 22, color: '#F5F4EE', fontWeight: 700 }}>{plan.title} {level && chip(level.toUpperCase())}</div>
            {chip(<><Icon name="activity" size={12} color="#D97757" /> {plan.est_time_min} min</>)}
          </div>
          <ol style={{ marginTop: 8, color: '#D9D5CC', paddingLeft: 20 }}>
            {plan.exercises.map((e, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 800, color: '#F5F4EE' }}>{e.name}</span>
                <span style={{ color: '#A6A29A' }}>: {e.prescription}</span>
              </li>
            ))}
          </ol>
        </Card>
      ) : (
        <Card style={{ marginTop: 16, background: '#262624' }}>
          <div style={{ color: 'rgba(255,255,255,0.5)' }}>No plan yet. Pick a difficulty and click “Give me a workout”.</div>
        </Card>
      )}
    </motion.div>
  )
}
