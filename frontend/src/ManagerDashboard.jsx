import React, { useEffect, useState } from 'react'
import { API_BASE } from './api'
import Icon from './components/Icon'
import GymQRCode from './GymQRCode'
import Feed from './Feed'

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

export default function ManagerDashboard({ token, activeTabProp }) {
  const [gyms, setGyms] = useState([])
  const [selectedGym, setSelectedGym] = useState(null)
  const [equipment, setEquipment] = useState([])
  const [occupancy, setOccupancy] = useState(null)
  const [present, setPresent] = useState([])
  const [bookings, setBookings] = useState([])
  const [memberships, setMemberships] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [saveMsg, setSaveMsg] = useState('')
  const [openPaymentsFor, setOpenPaymentsFor] = useState({})
  const [paymentsCache, setPaymentsCache] = useState({})
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newTimings, setNewTimings] = useState('')
  const [newContact, setNewContact] = useState('')
  const [newAmenities, setNewAmenities] = useState('')
  const [eqName, setEqName] = useState('')
  const [eqNotes, setEqNotes] = useState('')
  const [eqQuantity, setEqQuantity] = useState(1)
  const [editing, setEditing] = useState(null)

  // Gym Profile States
  const [profDesc, setProfDesc] = useState('')
  const [profTimings, setProfTimings] = useState('')
  const [profContact, setProfContact] = useState('')
  const [profAmenities, setProfAmenities] = useState('')
  const [profMsg, setProfMsg] = useState('')

  // Trainer States
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [logs, setLogs] = useState([])
  const [newClientId, setNewClientId] = useState('')
  const [trainerMsg, setTrainerMsg] = useState('')
  const [activeTab, setActiveTab] = useState(activeTabProp || 'overview')

  useEffect(() => {
    if (activeTabProp) setActiveTab(activeTabProp)
  }, [activeTabProp])

  async function loadGyms() {
    const res = await fetch(`${API_BASE}/api/gyms`, { headers: { Authorization: 'Bearer ' + token } })
    const data = await res.json()
    if (res.ok) setGyms(data)
  }

  useEffect(() => { loadGyms(); loadClients(); }, [token])

  async function loadClients() {
    try { const r = await fetch(`${API_BASE}/api/manager/clients`, { headers: { Authorization: 'Bearer ' + token } }); const j = await r.json(); if (r.ok) setClients(j) } catch {}
  }
  async function addClient() {
    setTrainerMsg('')
    if (!newClientId) return
    const r = await fetch(`${API_BASE}/api/manager/clients`, { method:'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ client_id: parseInt(newClientId, 10) }) })
    const j = await r.json(); if (r.ok) { setTrainerMsg('Added client'); setNewClientId(''); loadClients() } else setTrainerMsg(j.error || 'Failed to add client')
  }
  async function removeClient(id) {
    setTrainerMsg('')
    const r = await fetch(`${API_BASE}/api/manager/clients/${id}`, { method:'DELETE', headers: { Authorization: 'Bearer ' + token } })
    if (r.ok) { setTrainerMsg('Removed'); loadClients(); if (selectedClient===id) { setSelectedClient(null); setLogs([]) } }
  }
  async function viewLogs(id) {
    setSelectedClient(id); setLogs([]); setTrainerMsg('')
    const r = await fetch(`${API_BASE}/api/manager/clients/${id}/diet-logs`, { headers: { Authorization: 'Bearer ' + token } })
    const j = await r.json(); if (r.ok) setLogs(j); else setTrainerMsg(j.error || 'No access to logs')
  }

  async function createGym(e) {
    e.preventDefault()
    const res = await fetch(`${API_BASE}/api/gyms`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ name, location, description: newDesc, timings: newTimings, contact_info: newContact, amenities: newAmenities })
    })
    const data = await res.json()
    if (res.ok) {
      // Refresh the gyms list from server and auto-select the newly created gym
      await loadGyms()
      setName(''); setLocation(''); setNewDesc(''); setNewTimings(''); setNewContact(''); setNewAmenities('');
      if (data && data.id) {
        setSelectedGym(data.id)
        await loadEquipment(data.id)
      }
    } else {
      alert(data.error || 'Failed')
    }
  }

  async function loadEquipment(gymId) {
    setSelectedGym(gymId)
    setSaveMsg('')
    const [eRes, pRes, bRes, mRes, lRes] = await Promise.all([
      fetch(`${API_BASE}/api/gyms/${gymId}/equipment`, { headers: { Authorization: 'Bearer ' + token } }),
      fetch(`${API_BASE}/api/gyms/${gymId}/presence`, { headers: { Authorization: 'Bearer ' + token } }),
      fetch(`${API_BASE}/api/gyms/${gymId}/bookings`, { headers: { Authorization: 'Bearer ' + token } }),
      fetch(`${API_BASE}/api/manager/memberships?gymId=${gymId}`, { headers: { Authorization: 'Bearer ' + token } }),
      fetch(`${API_BASE}/api/management/manager/leaderboard?gymId=${gymId}`, { headers: { Authorization: 'Bearer ' + token } })
    ])
    if (eRes.ok) setEquipment(await eRes.json())
    if (pRes.ok) {
      const { present } = await pRes.json()
      setOccupancy(present.length)
      setPresent(present)
    }
    if (bRes.ok) setBookings(await bRes.json())
    if (mRes.ok) setMemberships(await mRes.json())
    if (lRes.ok) setLeaderboard(await lRes.json())
    
    // Set gym profile states
    const gymObj = gyms.find(g => g.id === gymId)
    if (gymObj) {
      setProfDesc(gymObj.description || '')
      setProfTimings(gymObj.timings || '')
      setProfContact(gymObj.contact_info || '')
      setProfAmenities(gymObj.amenities || '')
    }
    
    loadOccupancy(gymId)
  }

  async function saveGymProfile(e) {
    e.preventDefault()
    setProfMsg('')
    const res = await fetch(`${API_BASE}/api/gyms/${selectedGym}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        description: profDesc,
        timings: profTimings,
        contact_info: profContact,
        amenities: profAmenities
      })
    })
    const data = await res.json()
    if (res.ok) {
      setProfMsg('Profile updated successfully!')
      loadGyms()
    } else {
      setProfMsg(data.error || 'Failed to update profile')
    }
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

  useEffect(() => {
    if (selectedGym) {
      const t = setInterval(() => {
        loadOccupancy(selectedGym)
      }, 5000)
      return () => clearInterval(t)
    }
  }, [selectedGym])

  async function saveMembership(user_id, monthly_fee, next_due_date){
    setSaveMsg('')
    const r = await fetch(`${API_BASE}/api/manager/memberships/upsert`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ user_id, monthly_fee: Number(monthly_fee), next_due_date }) })
    const j = await r.json(); if (r.ok) { setSaveMsg('Saved'); loadMemberships(selectedGym) } else { setSaveMsg(j.error || 'Failed to save') }
  }

  async function approveMembership(user_id) {
    setSaveMsg('')
    const r = await fetch(`${API_BASE}/api/manager/memberships/${user_id}/approve`, { method: 'POST', headers: { Authorization: 'Bearer ' + token } })
    const j = await r.json();
    if (r.ok) { setSaveMsg('Approved'); loadMemberships(selectedGym); } else { setSaveMsg(j.error || 'Failed to approve'); }
  }

  async function remind(user_id){
    const r = await fetch(`${API_BASE}/api/manager/memberships/${user_id}/remind`, { method: 'POST', headers: { Authorization: 'Bearer ' + token } })
    if (r.ok) setSaveMsg('Reminder sent (in-app)')
  }

  async function recordPayment(user_id, amount){
    const r = await fetch(`${API_BASE}/api/manager/payments/record`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ user_id, amount: Number(amount), method: 'cash' }) })
    const j = await r.json(); if (r.ok) { setSaveMsg('Payment recorded'); loadMemberships(selectedGym) } else setSaveMsg(j.error || 'Failed to record payment')
  }

  async function toggleViewPayments(user_id){
    setOpenPaymentsFor(prev => ({ ...prev, [user_id]: !prev[user_id] }))
    // lazy-load payments if not in cache
    if (!paymentsCache[user_id]) {
      try {
        const r = await fetch(`${API_BASE}/api/manager/payments?userId=${user_id}`, { headers: { Authorization: 'Bearer ' + token } })
        const j = await r.json()
        if (Array.isArray(j)) setPaymentsCache(prev => ({ ...prev, [user_id]: j }))
      } catch {}
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#18181b', padding: '24px' }}>
      <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fafafa', marginBottom: 16 }}>Gym Manager</h2>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Left column: Create + Gyms */}
        <div style={{ width: 340, position: 'sticky', top: 24 }}>
          <div style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <h4 style={{ color: '#fafafa', marginBottom: 10 }}>Create a Gym</h4>
            <form onSubmit={createGym}>
              <div>
                <input placeholder="Gym name *" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46', borderRadius: 10 }} required />
              </div>
              <div style={{ marginTop: 8 }}>
                <input placeholder="Location" value={location} onChange={e => setLocation(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46', borderRadius: 10 }} />
              </div>
              <div style={{ marginTop: 8 }}>
                <textarea placeholder="Description" value={newDesc} onChange={e => setNewDesc(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46', borderRadius: 10, resize: 'vertical' }} rows={2} />
              </div>
              <div style={{ marginTop: 8 }}>
                <input placeholder="Timings (e.g., 6 AM - 10 PM)" value={newTimings} onChange={e => setNewTimings(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46', borderRadius: 10 }} />
              </div>
              <div style={{ marginTop: 8 }}>
                <input placeholder="Contact Info" value={newContact} onChange={e => setNewContact(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46', borderRadius: 10 }} />
              </div>
              <div style={{ marginTop: 8 }}>
                <input placeholder="Amenities (comma separated)" value={newAmenities} onChange={e => setNewAmenities(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46', borderRadius: 10 }} />
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
              {activeTab === 'overview' && (
              <div style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: 16, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ color: '#fafafa', margin: 0 }}>Overview — Gym #{selectedGym}</h3>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 12, padding: 24, textAlign: 'center' }}>
                      <div style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Total Live Users</div>
                      <div style={{ color: '#D0FD3E', fontSize: 48, fontWeight: 800, lineHeight: 1 }}>{occupancy ?? '0'}</div>
                    </div>
                    <div style={{ border: '1px dashed #3f3f46', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ color: '#a1a1aa', marginBottom: 6 }}>QR for this gym</div>
                      <GymQRCode gymId={selectedGym} />
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ color: '#a1a1aa', marginBottom: 6, fontWeight: 600 }}>Currently inside</div>
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
              )}

              {/* Section: Gym Profile */}
              {activeTab === 'overview' && (
              <div style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: 16, padding: 16, marginTop: 16 }}>
                <h3 style={{ color: '#fafafa', marginTop: 0 }}>Gym Profile</h3>
                {profMsg && <div style={{ marginBottom: 12, color: profMsg.includes('success') ? '#D0FD3E' : '#ef4444' }}>{profMsg}</div>}
                <form onSubmit={saveGymProfile} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', color: '#a1a1aa', fontSize: 14, marginBottom: 4 }}>Description</label>
                    <textarea placeholder="e.g., A state of the art facility..." value={profDesc} onChange={e => setProfDesc(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46', borderRadius: 10, minHeight: 60, fontFamily: 'inherit' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', color: '#a1a1aa', fontSize: 14, marginBottom: 4 }}>Timings</label>
                      <input placeholder="e.g., 6:00 AM - 10:00 PM" value={profTimings} onChange={e => setProfTimings(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46', borderRadius: 10 }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', color: '#a1a1aa', fontSize: 14, marginBottom: 4 }}>Contact Info</label>
                      <input placeholder="Phone / Email" value={profContact} onChange={e => setProfContact(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46', borderRadius: 10 }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#a1a1aa', fontSize: 14, marginBottom: 4 }}>Amenities (comma separated)</label>
                    <input placeholder="e.g., WiFi, Showers, Lockers, Parking" value={profAmenities} onChange={e => setProfAmenities(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#18181b', color: '#fafafa', border: '1px solid #3f3f46', borderRadius: 10 }} />
                  </div>
                  <div>
                    <button type="submit" style={{ backgroundColor: '#D0FD3E', color: '#18181b', borderRadius: 9999, padding: '10px 16px', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Save Profile</button>
                  </div>
                </form>
              </div>
              )}

              {/* Section: Equipment */}
              {activeTab === 'equipment' && (
              <>
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
              <div style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: 16, padding: 16, marginTop: 16 }}>
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
              </>
              )}

              {/* Section: Memberships & Payments */}
              {activeTab === 'members' && (
              <div style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: 16, padding: 16 }}>
                <h3 style={{ color: '#fafafa', marginTop: 0 }}>Memberships & Payments</h3>
                {saveMsg && <div style={{ marginBottom: 6, color: '#a1a1aa' }}>{saveMsg}</div>}
                <div>
                  {memberships.length === 0 && <div style={{ color: '#666' }}>No members in this gym yet.</div>}
                  {memberships.map(m => (
                    <div key={m.user_id} style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#fafafa', display: 'flex', alignItems: 'center', gap: 8 }}>
                            {m.name || m.email}
                            {m.status === 'pending' && <span style={{ fontSize: 11, background: '#ef4444', color: '#fff', padding: '2px 8px', borderRadius: 9999, fontWeight: 600 }}>Pending Approval</span>}
                          </div>
                          <div style={{ fontSize: 14, color: '#a1a1aa', marginTop: 2 }}>{m.email}</div>
                          {m.status !== 'pending' && m.last_payment_at && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>Last payment: {m.last_payment_at}</div>}
                        </div>
                        {m.status === 'pending' ? (
                          <button onClick={() => approveMembership(m.user_id)} style={{ background: '#D0FD3E', color: '#18181b', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>Approve Request</button>
                        ) : (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button onClick={() => remind(m.user_id)} style={{ background: '#27272a', color: '#fafafa', border: '1px solid #3f3f46', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}><Icon name="bell" size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />Remind</button>
                            <button onClick={() => { const amt = prompt('Amount paid', String(m.monthly_fee || '')); if (amt) recordPayment(m.user_id, amt) }} style={{ background: '#27272a', color: '#fafafa', border: '1px solid #3f3f46', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}><Icon name="dollar" size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />Record Payment</button>
                            <button onClick={() => toggleViewPayments(m.user_id)} style={{ background: '#27272a', color: '#fafafa', border: '1px solid #3f3f46', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{openPaymentsFor[m.user_id] ? 'Hide History' : 'View History'}</button>
                          </div>
                        )}
                      </div>

                      {m.status !== 'pending' && (
                        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px dashed #3f3f46', display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: 150 }}>
                            <label style={{ display: 'block', fontSize: 12, color: '#a1a1aa', marginBottom: 6, fontWeight: 600 }}>Monthly Fee (₹)</label>
                            <input type="number" placeholder="Amount" defaultValue={m.monthly_fee || ''} onBlur={e => m._fee = e.target.value} style={{ width: '100%', padding: '10px 12px', background: '#27272a', color: '#fafafa', border: '1px solid #3f3f46', borderRadius: 8 }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 150 }}>
                            <label style={{ display: 'block', fontSize: 12, color: '#a1a1aa', marginBottom: 6, fontWeight: 600 }}>Next Due Date</label>
                            <input type="date" defaultValue={m.next_due_date || ''} onBlur={e => m._due = e.target.value} style={{ width: '100%', padding: '10px 12px', background: '#27272a', color: '#fafafa', border: '1px solid #3f3f46', borderRadius: 8 }} />
                          </div>
                          <div>
                            <button onClick={() => saveMembership(
                              m.user_id,
                              (m._fee ?? m.monthly_fee ?? 0),
                              (m._due ?? (m.next_due_date || null))
                            )} style={{ background: '#D0FD3E', color: '#18181b', border: 'none', borderRadius: 8, padding: '11px 24px', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>Save Changes</button>
                          </div>
                        </div>
                      )}

                      {openPaymentsFor[m.user_id] && (
                        <div style={{ padding: '12px', background: '#27272a', borderRadius: 8, marginTop: 16 }}>
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
              )}
            </>
          )}

          {activeTab === 'feed' && (
            <div style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: 16, padding: 16 }}>
              <Feed token={token} />
            </div>
          )}
          {activeTab === 'leaderboard' && (
            <div style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: 16, padding: 16 }}>
              <h3 style={{ color: '#fafafa', marginTop: 0 }}>Gym Streak Leaderboard</h3>
              <div style={{ marginTop: 16 }}>
                {leaderboard.length === 0 && <div style={{ color: '#666' }}>No members in this gym yet.</div>}
                {leaderboard.map((m, idx) => (
                  <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #3f3f46', background: idx === 0 ? '#1f2937' : 'transparent', borderRadius: idx === 0 ? 8 : 0 }}>
                    <div style={{ width: 40, fontSize: 20, fontWeight: 800, color: idx === 0 ? '#D0FD3E' : '#a1a1aa' }}>#{idx + 1}</div>
                    <div style={{ flex: 1, fontSize: 16, fontWeight: 600, color: '#fafafa' }}>{m.name}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#D0FD3E' }}><Icon name="flame" size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />{m.gym_streak} days</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
