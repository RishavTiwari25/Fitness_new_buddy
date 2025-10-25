import React, { useEffect, useState } from 'react'
import { API_BASE } from './api'

export default function EquipmentSlots({ token, equipment, onBooked }) {
  const [status, setStatus] = useState('')
  const [data, setData] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [haveActive, setHaveActive] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  async function load() {
    const res = await fetch(`${API_BASE}/api/equipment/status/${equipment.id}`, { headers: { Authorization: 'Bearer ' + token } })
    const json = await res.json()
    if (res.ok) setData(json); else setStatus(json.error || 'Failed to load')
  }
  useEffect(() => {
    load()
    // Also load whether user already has an active upcoming booking
    fetch(`${API_BASE}/api/my/bookings-advanced`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(list => setHaveActive(Array.isArray(list) && list.length > 0))
      .catch(() => {})
  }, [equipment?.id])

  async function book(slotTime) {
    setStatus('')
    const res = await fetch(`${API_BASE}/api/book`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ equipmentId: equipment.id, slotTime }) })
    const json = await res.json()
    if (res.ok) { setStatus(json.message || 'Booked'); onBooked?.(); load() } else setStatus(json.error || 'Failed')
  }

  async function takeIdle(slotTime) {
    setStatus('')
    const res = await fetch(`${API_BASE}/api/book/take-idle-slot`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ equipmentId: equipment.id, slotTime }) })
    const json = await res.json()
    if (res.ok) { setStatus('Took idle slot'); onBooked?.(); load() } else setStatus(json.error || 'Failed')
  }

  if (!equipment) return null
  const slots = data?.slots || []

  return (
    <div>
      <h4>{equipment.name} — Time Slots</h4>
      {status && <div style={{ color: status.includes('Failed') || status.includes('error') ? 'red' : '#333' }}>{status}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
        {slots.map(s => {
          const t = new Date(s.slotTime)
          const label = t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
          const full = s.count >= 2
          const started = now >= t.getTime() + 5*60000
          return (
            <div key={s.slotTime} style={{ border: '1px solid #eee', padding: 8 }}>
              <div><strong>{label}</strong></div>
              <div style={{ fontSize: 12, color: full ? '#b00' : '#090' }}>{s.count}/2 booked</div>
              <div style={{ marginTop: 6 }}>
                {!full && !haveActive && <button onClick={() => book(s.slotTime)}>{s.count === 0 ? 'Book' : 'Book (1 spot left)'}</button>}
                {!full && haveActive && <span style={{ color: '#666', fontSize: 12 }}>You already have a slot</span>}
                {full && started && <button onClick={() => takeIdle(s.slotTime)} style={{ marginLeft: 6 }}>Take Idle Slot</button>}
                {full && !started && <span style={{ color: '#666', fontSize: 12 }}>Full</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
