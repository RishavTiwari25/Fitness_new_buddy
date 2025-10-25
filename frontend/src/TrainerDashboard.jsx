import React, { useEffect, useState } from 'react'
import { API_BASE } from './api'

export default function TrainerDashboard({ token }) {
  const [clients, setClients] = useState([])
  const [selected, setSelected] = useState(null)
  const [logs, setLogs] = useState([])
  const [bookings, setBookings] = useState([])
  const [msg, setMsg] = useState('')
  const [newClientId, setNewClientId] = useState('')

  async function loadClients(){
    try { const r = await fetch(`${API_BASE}/api/trainer/clients`, { headers: { Authorization: 'Bearer ' + token } }); const j = await r.json(); if (r.ok) setClients(j) } catch {}
  }
  async function loadBookings(){
    try { const r = await fetch(`${API_BASE}/api/trainer/gym/bookings`, { headers: { Authorization: 'Bearer ' + token } }); const j = await r.json(); if (r.ok) setBookings(j) } catch {}
  }
  useEffect(() => { loadClients(); loadBookings(); }, [token])

  async function addClient(){
    setMsg('')
    if (!newClientId) return
    const r = await fetch(`${API_BASE}/api/trainer/clients`, { method:'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ client_id: parseInt(newClientId, 10) }) })
    const j = await r.json(); if (r.ok) { setMsg('Added client'); setNewClientId(''); loadClients() } else setMsg(j.error || 'Failed to add client')
  }

  async function removeClient(id){
    setMsg('')
    const r = await fetch(`${API_BASE}/api/trainer/clients/${id}`, { method:'DELETE', headers: { Authorization: 'Bearer ' + token } })
    if (r.ok) { setMsg('Removed'); loadClients(); if (selected===id) { setSelected(null); setLogs([]) } }
  }

  async function viewLogs(id){
    setSelected(id); setLogs([]); setMsg('')
    const r = await fetch(`${API_BASE}/api/trainer/clients/${id}/diet-logs`, { headers: { Authorization: 'Bearer ' + token } })
    const j = await r.json(); if (r.ok) setLogs(j); else setMsg(j.error || 'No access to logs')
  }

  async function releaseEquipment(equipmentId){
    setMsg('')
    const r = await fetch(`${API_BASE}/api/trainer/equipment/${equipmentId}/release`, { method:'POST', headers: { Authorization: 'Bearer ' + token } })
    const j = await r.json(); if (r.ok) { setMsg('Released booking'); loadBookings() } else setMsg(j.error || 'Failed to release')
  }

  return (
    <div>
      <h3>Trainer Dashboard</h3>
      {msg && <div style={{ marginBottom: 8 }}>{msg}</div>}
      <div style={{ display:'flex', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ width: 320 }}>
          <h4>Clients</h4>
          <div style={{ display:'flex', gap: 6 }}>
            <input placeholder="Client user id" value={newClientId} onChange={e => setNewClientId(e.target.value)} />
            <button onClick={addClient}>Add</button>
          </div>
          <ul style={{ marginTop: 8 }}>
            {clients.map(c => (
              <li key={c.id}>
                <span style={{ cursor:'pointer', textDecoration: selected===c.id ? 'underline' : 'none' }} onClick={() => viewLogs(c.id)}>
                  {c.name || c.email} (#{c.id})
                </span>
                <button onClick={() => removeClient(c.id)} style={{ marginLeft: 6 }}>Remove</button>
              </li>
            ))}
            {clients.length === 0 && <div style={{ color:'#666' }}>No clients yet.</div>}
          </ul>
        </div>

        <div style={{ flex: 1 }}>
          <h4>Client Diet Logs</h4>
          {selected == null && <div style={{ color:'#666' }}>Select a client</div>}
          {logs.length > 0 && (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr><th align="left">Date</th><th align="left">Summary</th><th align="left">Calories</th></tr></thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id}><td>{l.date}</td><td>{l.items_text}</td><td>{l.calories ?? '-'}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ width: 360 }}>
          <h4>Gym Active Bookings</h4>
          {bookings.length === 0 && <div style={{ color:'#666' }}>None</div>}
          {bookings.map(b => (
            <div key={b.booking_id} style={{ borderBottom: '1px solid #eee', padding:'6px 0' }}>
              <div><strong>{b.equipment_name}</strong></div>
              <div style={{ fontSize:12 }}>by {b.user_name || b.user_email}, since {b.started_at}</div>
              <button onClick={() => releaseEquipment(b.equipment_id)} style={{ marginTop: 4 }}>Release</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
