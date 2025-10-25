import React, { useState } from 'react'
import { API_BASE } from './api'

export default function HomeWorkout({ token }) {
  const [level, setLevel] = useState('easy')
  const [plan, setPlan] = useState(null)
  const [msg, setMsg] = useState('')

  async function getPlan() {
    setMsg(''); setPlan(null)
    try {
      const r = await fetch(`${API_BASE}/api/home-workout?level=${encodeURIComponent(level)}`, { headers: { Authorization: 'Bearer ' + token } })
      const j = await r.json(); if (r.ok) setPlan(j); else setMsg(j.error || 'Failed to load plan')
    } catch (e) { setMsg('Failed to load plan') }
  }

  return (
    <div>
      <h3>Home Workout</h3>
      <p>Can't make it to the gym today? Get a bodyweight-only routine.</p>
      <div>
        <label>Difficulty: </label>
        <select value={level} onChange={e => setLevel(e.target.value)}>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <button onClick={getPlan} style={{ marginLeft: 8 }}>Give me a workout</button>
      </div>
      {msg && <div style={{ marginTop: 8 }}>{msg}</div>}
      {plan && (
        <div style={{ marginTop: 12 }}>
          <h4>{plan.title}</h4>
          <div>Estimated time: {plan.est_time_min} min</div>
          <ol style={{ marginTop: 8 }}>
            {plan.exercises.map((e, i) => (
              <li key={i}><strong>{e.name}</strong>: {e.prescription}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
