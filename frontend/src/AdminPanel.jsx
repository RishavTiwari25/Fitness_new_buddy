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
    <div style={{ minHeight: '100vh', backgroundColor: '#18181b', padding: '24px' }}>
      <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fafafa', marginBottom: 16 }}>Gym Owner Admin</h2>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Left column: Create + Gyms */}
        <div style={{ width: 340, position: 'sticky', top: 24 }}>
          <div style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <h4 style={{ color: '#fafafa', marginBottom: 10 }}>Create a Gym</h4>
            <form onSubmit={createGym}>
              <div>
                <input placeholder="Gym name" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46', borderRadius: 10 }} />
              </div>
              <div style={{ marginTop: 8 }}>
                <input placeholder="Location" value={location} onChange={e => setLocation(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46', borderRadius: 10 }} />
              </div>
              <div style={{ marginTop: 10 }}>
                <button type="submit" style={{ backgroundColor: '#D0FD3E', color: '#18181b', borderRadius: 9999, padding: '10px 16px', border: 'none', cursor: 'pointer', fontWeight: 700, width: '100%' }}>Create Gym</button>
              </div>
            </form>
          </div>

          <div style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: 16, padding: 16 }}>
            <h4 style={{ color: '#fafafa', marginBottom: 10 }}>Your Gyms</h4>
            <div>
              {gyms.map(g => (
                <div key={g.id} style={{ padding: 6 }}>
                  <button onClick={() => loadEquipment(g.id)} style={{ padding: '8px 12px', borderRadius: 9999, border: '1px solid #3f3f46', background: selectedGym === g.id ? '#D0FD3E' : '#3f3f46', color: selectedGym === g.id ? '#18181b' : '#fafafa', fontWeight: 700, cursor: 'pointer' }}>
                    {g.name} {g.location ? `(${g.location})` : ''}
                  </button>
                </div>
              ))}
              {gyms.length === 0 && <p style={{ color: '#a1a1aa' }}>No gyms yet.</p>}
            </div>
          </div>
        </div>

        {/* Right content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!selectedGym && (
            <div style={{ background: '#27272a', border: '1px solid #3f3f46', borderRadius: 16, padding: 24, color: '#a1a1aa' }}>
              Select a gym from the left to see equipment, bookings, and memberships.
            </div>
          )}

          {selectedGym && (
            <>
              {/* Section: Overview */}
              <div style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: 16, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ color: '#fafafa', margin: 0 }}>Overview — Gym #{selectedGym}</h3>
                  <span style={{ background: '#3f3f46', color: '#fafafa', padding: '6px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 700 }}>Checked in: {occupancy ?? '—'}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ border: '1px dashed #3f3f46', borderRadius: 12, padding: 12 }}>
                    <div style={{ color: '#a1a1aa', marginBottom: 6 }}>QR for this gym</div>
                    <GymQRCode gymId={selectedGym} />
                  </div>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ color: '#a1a1aa', marginBottom: 6 }}>Currently inside</div>
                    <div style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12, padding: 12, maxHeight: 220, overflow: 'auto' }}>
                      {present.length === 0 && <div style={{ color: '#666' }}>No members inside.</div>}
                      {present.map(m => (
                        <div key={m.presence_id} style={{ fontSize: 14, padding: '6px 0', borderBottom: '1px solid #2e2e31' }}>
                          <div><strong style={{ color: '#fafafa' }}>{m.name || m.email}</strong></div>
                          <div style={{ color: '#a1a1aa' }}>{m.email}</div>
                          <div style={{ fontSize: 12, color: '#9ca3af' }}>since {m.checkin_at}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Equipment */}
              <div style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: 16, padding: 16 }}>
                <h3 style={{ color: '#fafafa', marginTop: 0 }}>Equipment</h3>
                <div>
                  {equipment.map(eq => <EquipmentRow key={eq.id} eq={eq} onEdit={startEdit} onDelete={deleteEquipment} />)}
                  {equipment.length === 0 && <p style={{ color: '#a1a1aa' }}>No equipment.</p>}
                </div>

                <form onSubmit={editing ? saveEdit : addEquipment} style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 8 }}>
                  <input placeholder="Equipment name" value={eqName} onChange={e => setEqName(e.target.value)} style={{ padding: '10px 12px', background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46', borderRadius: 10 }} />
                  <input placeholder="Notes" value={eqNotes} onChange={e => setEqNotes(e.target.value)} style={{ padding: '10px 12px', background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46', borderRadius: 10 }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="number" min={1} value={eqQuantity} onChange={e => setEqQuantity(e.target.value)} style={{ width: 80, padding: '10px 12px', background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46', borderRadius: 10 }} />
                    <button type="submit" style={{ backgroundColor: '#D0FD3E', color: '#18181b', borderRadius: 9999, padding: '10px 16px', border: 'none', cursor: 'pointer', fontWeight: 700 }}>{editing ? 'Save' : 'Add'}</button>
                    {editing && <button type="button" onClick={() => { setEditing(null); setEqName(''); setEqNotes(''); setEqQuantity(1) }} style={{ backgroundColor: '#3f3f46', color: '#fafafa', borderRadius: 9999, padding: '10px 16px', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>}
                  </div>
                </form>
              </div>

              {/* Section: Active Bookings */}
              <div style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: 16, padding: 16 }}>
                <h3 style={{ color: '#fafafa', marginTop: 0 }}>Active Equipment Bookings</h3>
                <div>
                  {bookings.length === 0 && <div style={{ color: '#666' }}>No active bookings.</div>}
                  {bookings.map(b => (
                    <div key={b.booking_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #2e2e31' }}>
                      <div>
                        <strong style={{ color: '#fafafa' }}>{b.equipment_name}</strong>
                        <div style={{ fontSize: 12, color: '#a1a1aa' }}>by {b.user_name || b.user_email} since {b.started_at}</div>
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
                        }} style={{ background: '#3f3f46', color: '#fafafa', border: 'none', borderRadius: 9999, padding: '8px 12px', cursor: 'pointer' }}>Force release</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section: Memberships & Payments */}
              <div style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: 16, padding: 16 }}>
                <h3 style={{ color: '#fafafa', marginTop: 0 }}>Memberships & Payments</h3>
                {saveMsg && <div style={{ marginBottom: 6, color: '#a1a1aa' }}>{saveMsg}</div>}
                <div>
                  {memberships.length === 0 && <div style={{ color: '#666' }}>No members in this gym yet.</div>}
                  {memberships.map(m => (
                    <div key={m.user_id}>
                      <div style={{ display:'grid', gridTemplateColumns: '1fr 140px 160px 1fr', gap: 8, padding: '10px 0', borderBottom: '1px solid #2e2e31' }}>
                        <div>
                          <div><strong style={{ color: '#fafafa' }}>{m.name || m.email}</strong></div>
                          <div style={{ fontSize: 12, color: '#a1a1aa' }}>{m.email}</div>
                          {m.last_payment_at && <div style={{ fontSize: 12, color: '#9ca3af' }}>Last payment: {m.last_payment_at}</div>}
                        </div>
                        <div>
                          <input type="number" placeholder="Monthly fee" defaultValue={m.monthly_fee || ''} onBlur={e => m._fee = e.target.value} style={{ width: '100%', padding: '10px 12px', background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46', borderRadius: 10 }} />
                        </div>
                        <div>
                          <input type="date" defaultValue={m.next_due_date || ''} onBlur={e => m._due = e.target.value} style={{ width: '100%', padding: '10px 12px', background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46', borderRadius: 10 }} />
                        </div>
                        <div>
                          <button onClick={() => saveMembership(
                            m.user_id,
                            (m._fee ?? m.monthly_fee ?? 0),
                            (m._due ?? (m.next_due_date || null))
                          )} style={{ background: '#D0FD3E', color: '#18181b', border: 'none', borderRadius: 9999, padding: '8px 12px', cursor: 'pointer', fontWeight: 700 }}>Save</button>
                          <button onClick={() => remind(m.user_id)} style={{ marginLeft: 6, background: '#3f3f46', color: '#fafafa', border: 'none', borderRadius: 9999, padding: '8px 12px', cursor: 'pointer' }}>Remind</button>
                          <button onClick={() => { const amt = prompt('Amount paid', String(m.monthly_fee || '')); if (amt) recordPayment(m.user_id, amt) }} style={{ marginLeft: 6, background: '#3f3f46', color: '#fafafa', border: 'none', borderRadius: 9999, padding: '8px 12px', cursor: 'pointer' }}>Record Payment</button>
                          <button onClick={() => toggleViewPayments(m.user_id)} style={{ marginLeft: 6, background: '#3f3f46', color: '#fafafa', border: 'none', borderRadius: 9999, padding: '8px 12px', cursor: 'pointer' }}>{openPaymentsFor[m.user_id] ? 'Hide Payments' : 'View Payments'}</button>
                        </div>
                      </div>
                      {openPaymentsFor[m.user_id] && (
                        <div style={{ padding: '6px 0 12px 0', borderBottom: '1px solid #2e2e31', marginLeft: 8 }}>
                          <div style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 4 }}>Recent payments:</div>
                          {(!paymentsCache[m.user_id] || paymentsCache[m.user_id].length === 0) && (
                            <div style={{ fontSize: 12, color: '#777' }}>No payments.</div>
                          )}
                          {paymentsCache[m.user_id] && paymentsCache[m.user_id].length > 0 && (
                            <ul style={{ margin: 0, paddingLeft: 16 }}>
                              {paymentsCache[m.user_id].map(p => (
                                <li key={p.id} style={{ fontSize: 13, color: '#fafafa' }}>
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
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
