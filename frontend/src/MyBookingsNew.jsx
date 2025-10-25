import React, { useEffect, useState } from 'react'
import { API_BASE } from './api'

export default function MyBookingsNew({ token }) {
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('')

  async function load() {
    const res = await fetch(`${API_BASE}/api/my/bookings-advanced`, { headers: { Authorization: 'Bearer ' + token } })
    const json = await res.json()
    if (res.ok) setItems(json); else setStatus(json.error || 'Failed to load')
  }
  useEffect(() => { load() }, [])

  async function release(bookingId) {
    const res = await fetch(`${API_BASE}/api/release`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ bookingId }) })
    const json = await res.json()
    if (res.ok) { setStatus('Released'); load() } else setStatus(json.error || 'Failed to release')
  }

  return (
    <div>
      <h3>My Bookings</h3>
      {status && <div style={{ color: status.includes('Failed') ? 'red' : '#333' }}>{status}</div>}
      {items.length === 0 && <div style={{ color: '#666' }}>No upcoming bookings.</div>}
      {items.map(b => (
        <div key={b.id} style={{ borderBottom: '1px solid #eee', padding: '6px 0' }}>
          <div><strong>{b.equipment_name}</strong> at {new Date(b.slot_time).toLocaleString()}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{b.booking_type}</div>
          <button onClick={() => release(b.id)}>Release</button>
        </div>
      ))}
    </div>
  )
}
