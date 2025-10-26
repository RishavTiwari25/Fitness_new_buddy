import React, { useEffect, useState } from 'react'
import { API_BASE } from './api'
import GymQRCode from './GymQRCode'

function EquipmentRow({ eq, onEdit, onDelete }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
      <div>
        <strong>{eq.name}</strong> {eq.quantity ? `x${eq.quantity}` : ''}
        <div style={{ fontSize: 12 }}>{eq.notes}</div>
      </div>
      <div>
        <button onClick={() => onEdit(eq)}>Edit</button>
        <button onClick={() => onDelete(eq.id)} style={{ marginLeft: 8 }}>Delete</button>
      </div>
    </div>
  )
}

export default function AdminPanel({ token }) {
  const [gyms, setGyms] = useState([])
  const [selectedGym, setSelectedGym] = useState(null)
  const [equipment, setEquipment] = useState([])
  const [occupancy, setOccupancy] = useState(null)
  const [present, setPresent] = useState([])
  const [bookings, setBookings] = useState([])
  const [memberships, setMemberships] = useState([])
  const [saveMsg, setSaveMsg] = useState('')
  const [openPaymentsFor, setOpenPaymentsFor] = useState({})
  const [paymentsCache, setPaymentsCache] = useState({})
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [eqName, setEqName] = useState('')
  const [eqNotes, setEqNotes] = useState('')
  const [eqQuantity, setEqQuantity] = useState(1)
  const [editing, setEditing] = useState(null)

  async function loadGyms() {
    const res = await fetch(`${API_BASE}/api/gyms`, { headers: { Authorization: 'Bearer ' + token } })
    const data = await res.json()
    setGyms(data)
  }

  useEffect(() => { loadGyms() }, [])

  async function createGym(e) {
    e.preventDefault()
    const res = await fetch(`${API_BASE}/api/gyms`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ name, location })
    })
    const data = await res.json()
    if (res.ok) {
      // Refresh the gyms list from server and auto-select the newly created gym
      await loadGyms()
      setName(''); setLocation('')
      if (data && data.id) {
        setSelectedGym(data.id)
        await loadEquipment(data.id)
      }
    } else {
      alert(data.error || 'Failed')
    }
  }

  async function loadEquipment(gymId) {
    setEquipment([])
    setSelectedGym(gymId)
    const res = await fetch(`${API_BASE}/api/gyms/${gymId}/equipment`, { headers: { Authorization: 'Bearer ' + token } })
    const data = await res.json()
    setEquipment(data)
    // also load occupancy and presence list
    loadOccupancy(gymId)
    loadPresence(gymId)
    loadBookings(gymId)
    loadMemberships(gymId)
  }

  async function addEquipment(e) {
    e.preventDefault()
    if (!selectedGym) return alert('Select a gym first')
    const res = await fetch(`${API_BASE}/api/gyms/${selectedGym}/equipment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ name: eqName, notes: eqNotes, quantity: Number(eqQuantity) })
    })
    const data = await res.json()
    if (res.ok) {
      setEquipment(prev => [...prev, data])
      setEqName(''); setEqNotes(''); setEqQuantity(1)
      loadOccupancy(selectedGym)
    } else alert(data.error || 'Failed')
  }

  async function deleteEquipment(id) {
    if (!confirm('Delete equipment?')) return
  const res = await fetch(`${API_BASE}/api/equipment/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
    const data = await res.json()
    if (res.ok) {
      setEquipment(prev => prev.filter(e => e.id !== id))
      loadOccupancy(selectedGym)
    }
    else alert(data.error || 'Failed')
  }

  function startEdit(eq) {
    setEditing(eq.id)
    setEqName(eq.name); setEqNotes(eq.notes); setEqQuantity(eq.quantity || 1)
  }

  async function saveEdit(e) {
    e.preventDefault()
    if (!editing) return
    const res = await fetch(`${API_BASE}/api/equipment/${editing}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ name: eqName, notes: eqNotes, quantity: Number(eqQuantity) })
    })
    const data = await res.json()
    if (res.ok) {
      setEquipment(prev => prev.map(p => p.id === data.id ? data : p))
      setEditing(null); setEqName(''); setEqNotes(''); setEqQuantity(1)
      loadOccupancy(selectedGym)
    } else alert(data.error || 'Failed')
  }

  async function loadOccupancy(gymId) {
    if (!gymId) return
    try {
      const res = await fetch(`${API_BASE}/api/gyms/${gymId}/occupancy`, { headers: { Authorization: 'Bearer ' + token } })
      const data = await res.json()
      if (res.ok) setOccupancy(data.count)
    } catch (_) {}
  }

  async function loadPresence(gymId) {
    if (!gymId) return
    try {
      const res = await fetch(`${API_BASE}/api/gyms/${gymId}/presence`, { headers: { Authorization: 'Bearer ' + token } })
      const data = await res.json()
      if (res.ok && data && Array.isArray(data.members)) setPresent(data.members)
      else setPresent([])
    } catch (_) { setPresent([]) }
  }

  async function loadBookings(gymId) {
    if (!gymId) return
    try {
      const res = await fetch(`${API_BASE}/api/gyms/${gymId}/bookings`, { headers: { Authorization: 'Bearer ' + token } })
      const data = await res.json()
      if (res.ok && data && Array.isArray(data.bookings)) setBookings(data.bookings)
      else setBookings([])
    } catch (_) { setBookings([]) }
  }

  useEffect(() => {
    if (selectedGym) {
      loadOccupancy(selectedGym)
      loadPresence(selectedGym)
      loadBookings(selectedGym)
      loadMemberships(selectedGym)
      const t = setInterval(() => {
        loadOccupancy(selectedGym)
        loadPresence(selectedGym)
        loadBookings(selectedGym)
      }, 5000)
      return () => clearInterval(t)
    }
  }, [selectedGym])

  async function loadMemberships(gymId){
    try {
      const r = await fetch(`${API_BASE}/api/owner/memberships?gymId=${gymId}`, { headers: { Authorization: 'Bearer ' + token } })
      const j = await r.json(); if (r.ok) setMemberships(j)
    } catch {}
  }

  async function saveMembership(user_id, monthly_fee, next_due_date){
    setSaveMsg('')
    const r = await fetch(`${API_BASE}/api/owner/memberships/upsert`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ user_id, monthly_fee: Number(monthly_fee), next_due_date }) })
    const j = await r.json(); if (r.ok) { setSaveMsg('Saved'); loadMemberships(selectedGym) } else { setSaveMsg(j.error || 'Failed to save') }
  }

  async function remind(user_id){
    const r = await fetch(`${API_BASE}/api/owner/memberships/${user_id}/remind`, { method: 'POST', headers: { Authorization: 'Bearer ' + token } })
    if (r.ok) setSaveMsg('Reminder sent (in-app)')
  }

  async function recordPayment(user_id, amount){
    const r = await fetch(`${API_BASE}/api/owner/payments/record`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ user_id, amount: Number(amount), method: 'cash' }) })
    const j = await r.json(); if (r.ok) { setSaveMsg('Payment recorded'); loadMemberships(selectedGym) } else setSaveMsg(j.error || 'Failed to record payment')
  }

  async function toggleViewPayments(user_id){
    setOpenPaymentsFor(prev => ({ ...prev, [user_id]: !prev[user_id] }))
    // lazy-load payments if not in cache
    if (!paymentsCache[user_id]) {
      try {
        const r = await fetch(`${API_BASE}/api/owner/payments?userId=${user_id}`, { headers: { Authorization: 'Bearer ' + token } })
        const j = await r.json()
        if (Array.isArray(j)) setPaymentsCache(prev => ({ ...prev, [user_id]: j }))
      } catch {}
    }
  }

  return (
    <div>
      <h3>Gym Owner Admin</h3>
      <section style={{ marginBottom: 16 }}>
        <h4>Create a Gym</h4>
        <form onSubmit={createGym}>
          <div><input placeholder="Gym name" value={name} onChange={e => setName(e.target.value)} /></div>
          <div style={{ marginTop: 6 }}><input placeholder="Location" value={location} onChange={e => setLocation(e.target.value)} /></div>
          <div style={{ marginTop: 6 }}><button type="submit" style={{ backgroundColor: '#D0FD3E', color: '#18181b', borderRadius: '9999px', padding: '12px 24px', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Create Gym</button></div>
        </form>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h4>Your Gyms</h4>
        <div>
          {gyms.map(g => (
            <div key={g.id} style={{ padding: 6 }}>
              <button onClick={() => loadEquipment(g.id)}>{g.name} {g.location ? `(${g.location})` : ''}</button>
            </div>
          ))}
          {gyms.length === 0 && <p>No gyms yet.</p>}
        </div>
      </section>

      {selectedGym && (
        <section>
          <h4>Equipment for gym #{selectedGym}</h4>
          <GymQRCode gymId={selectedGym} />
          <div style={{ margin: '10px 0' }}>
            <strong>Currently checked in:</strong> {occupancy ?? '—'}
            <div style={{ marginTop: 6 }}>
              {present.length === 0 && <div style={{ color: '#666' }}>No members inside.</div>}
              {present.map(m => (
                <div key={m.presence_id} style={{ fontSize: 14, padding: '4px 0', borderBottom: '1px solid #eee' }}>
                  <div><strong>{m.name || m.email}</strong></div>
                  <div style={{ color: '#777' }}>{m.email}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>since {m.checkin_at}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            {equipment.map(eq => <EquipmentRow key={eq.id} eq={eq} onEdit={startEdit} onDelete={deleteEquipment} />)}
            {equipment.length === 0 && <p>No equipment.</p>}
          </div>

          <form onSubmit={editing ? saveEdit : addEquipment} style={{ marginTop: 12 }}>
            <div><input placeholder="Equipment name" value={eqName} onChange={e => setEqName(e.target.value)} /></div>
            <div style={{ marginTop: 6 }}><input placeholder="Notes" value={eqNotes} onChange={e => setEqNotes(e.target.value)} /></div>
            <div style={{ marginTop: 6 }}><input type="number" min={1} value={eqQuantity} onChange={e => setEqQuantity(e.target.value)} /></div>
            <div style={{ marginTop: 6 }}>
              <button type="submit" style={{ backgroundColor: '#D0FD3E', color: '#18181b', borderRadius: '9999px', padding: '12px 24px', border: 'none', cursor: 'pointer', fontWeight: 600 }}>{editing ? 'Save' : 'Add Equipment'}</button>
              {editing && <button type="button" onClick={() => { setEditing(null); setEqName(''); setEqNotes(''); setEqQuantity(1) }} style={{ marginLeft: 8, backgroundColor: '#3f3f46', color: '#fafafa', borderRadius: '9999px', padding: '12px 24px', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>}
            </div>
          </form>
        </section>
      )}

      {selectedGym && (
        <section style={{ marginTop: 16 }}>
          <h4>Active equipment bookings</h4>
          <div>
            {bookings.length === 0 && <div style={{ color: '#666' }}>No active bookings.</div>}
            {bookings.map(b => (
              <div key={b.booking_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                <div>
                  <strong>{b.equipment_name}</strong>
                  <div style={{ fontSize: 12 }}>by {b.user_name || b.user_email} since {b.started_at}</div>
                </div>
                <div>
                  <button onClick={async () => {
                    const res = await fetch(`${API_BASE}/api/equipment/${b.equipment_id}/release`, { method: 'POST', headers: { Authorization: 'Bearer ' + token } })
                    const data = await res.json()
                    if (res.ok) {
                      loadBookings(selectedGym)
                    } else {
                      alert(data.error || 'Failed to release')
                    }
                  }}>Force release</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {selectedGym && (
        <section style={{ marginTop: 16 }}>
          <h4>Memberships & Payments</h4>
          {saveMsg && <div style={{ marginBottom: 6 }}>{saveMsg}</div>}
          <div>
            {memberships.length === 0 && <div style={{ color: '#666' }}>No members in this gym yet.</div>}
            {memberships.map(m => (
              <div key={m.user_id}>
                <div style={{ display:'grid', gridTemplateColumns: '1fr 140px 160px 1fr', gap: 8, padding: '6px 0', borderBottom: '1px solid #eee' }}>
                  <div>
                    <div><strong>{m.name || m.email}</strong></div>
                    <div style={{ fontSize: 12, color: '#777' }}>{m.email}</div>
                    {m.last_payment_at && <div style={{ fontSize: 12, color: '#555' }}>Last payment: {m.last_payment_at}</div>}
                  </div>
                  <div>
                    <input type="number" placeholder="Monthly fee" defaultValue={m.monthly_fee || ''} onBlur={e => m._fee = e.target.value} />
                  </div>
                  <div>
                    <input type="date" defaultValue={m.next_due_date || ''} onBlur={e => m._due = e.target.value} />
                  </div>
                  <div>
                    <button onClick={() => saveMembership(
                      m.user_id,
                      (m._fee ?? m.monthly_fee ?? 0),
                      (m._due ?? (m.next_due_date || null))
                    )}>Save</button>
                    <button onClick={() => remind(m.user_id)} style={{ marginLeft: 6 }}>Remind</button>
                    <button onClick={() => { const amt = prompt('Amount paid', String(m.monthly_fee || '')); if (amt) recordPayment(m.user_id, amt) }} style={{ marginLeft: 6 }}>Record Payment</button>
                    <button onClick={() => toggleViewPayments(m.user_id)} style={{ marginLeft: 6 }}>{openPaymentsFor[m.user_id] ? 'Hide Payments' : 'View Payments'}</button>
                  </div>
                </div>
                {openPaymentsFor[m.user_id] && (
                  <div style={{ padding: '6px 0 12px 0', borderBottom: '1px solid #f0f0f0', marginLeft: 8 }}>
                    <div style={{ fontSize: 12, color: '#333', marginBottom: 4 }}>Recent payments:</div>
                    {(!paymentsCache[m.user_id] || paymentsCache[m.user_id].length === 0) && (
                      <div style={{ fontSize: 12, color: '#777' }}>No payments.</div>
                    )}
                    {paymentsCache[m.user_id] && paymentsCache[m.user_id].length > 0 && (
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {paymentsCache[m.user_id].map(p => (
                          <li key={p.id} style={{ fontSize: 13 }}>
                            ₹{p.amount} — {p.method || '—'} on {p.created_at}{p.txn_ref ? ` (ref: ${p.txn_ref})` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
