import React, { useEffect, useRef, useState } from 'react'
import { API_BASE } from './api'
import Icon from './components/Icon'
import EquipmentSlots from './EquipmentSlots'

// We'll dynamically import html5-qrcode when the user starts scanning.
let Html5QrcodeCtor

export default function MemberHome({ token, defaultGymId }) {
  const [gymId, setGymId] = useState(defaultGymId || null)
  const [gymName, setGymName] = useState('')
  const [gyms, setGyms] = useState([])
  const [count, setCount] = useState(null)
  const [status, setStatus] = useState('')
  const [scanning, setScanning] = useState(false)
  const scannerRef = useRef(null)
  const [equipment, setEquipment] = useState([])
  const [myBookings, setMyBookings] = useState([])
  const [showSlotsFor, setShowSlotsFor] = useState(null)
  const [showAlt, setShowAlt] = useState(null)
  const [alts, setAlts] = useState([])

  function parseJwt(tk) {
    try { return JSON.parse(atob(tk.split('.')[1])) } catch { return {} }
  }
  const me = parseJwt(token)

  async function fetchOccupancy(id) {
    if (!id) return
    try {
      const res = await fetch(`${API_BASE}/api/gyms/${id}/occupancy`, { headers: { Authorization: 'Bearer ' + token } })
      const data = await res.json()
      if (res.ok) {
        setCount(data.count)
        setGymName(data.gym_name)
      }
    } catch (_) {}
  }

  useEffect(() => {
    fetchOccupancy(gymId)
    if (gymId) {
      loadEquipmentStatus(gymId)
    }
    const t = setInterval(() => fetchOccupancy(gymId), 5000)
    return () => clearInterval(t)
  }, [gymId])

  useEffect(() => {
    // Load gyms list for manual fallback selection.
    async function loadGyms() {
      try {
        const res = await fetch(`${API_BASE}/api/gyms`, { headers: { Authorization: 'Bearer ' + token } })
        const data = await res.json()
        if (Array.isArray(data)) setGyms(data)
      } catch (_) {}
    }
    loadGyms()
    loadMyBookings()
  }, [token])

  async function toggleCheckIn(id) {
    if (!id) return
    const res = await fetch(`${API_BASE}/api/gyms/${id}/checkin`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token }
    })
    const data = await res.json()
    if (res.ok) {
      setStatus(data.action === 'checkin' ? 'Checked in' : 'Checked out')
      setGymId(id)
      setCount(data.count)
      fetchOccupancy(id)
      // Refresh equipment status when toggling presence
      loadEquipmentStatus(id)
    } else {
      setStatus(data.error || 'Failed')
    }
  }

  async function startScan() {
    // Dynamic import to avoid SSR/require issues
    if (!Html5QrcodeCtor) {
      try {
        const mod = await import('html5-qrcode')
        Html5QrcodeCtor = mod.Html5Qrcode
      } catch (e) {
        setStatus('Scanner not available in this environment')
        return
      }
    }
    setScanning(true)
    const id = 'qr-reader'
    if (!scannerRef.current) scannerRef.current = new Html5QrcodeCtor(id)
    const cfg = { fps: 10, qrbox: 250 }
    try {
      await scannerRef.current.start({ facingMode: 'environment' }, cfg, (decodedText) => {
        if (decodedText && decodedText.startsWith('GYM:')) {
          const idStr = decodedText.split(':')[1]
          const parsed = parseInt(idStr, 10)
          if (parsed) {
            stopScan()
            toggleCheckIn(parsed)
          }
        }
      })
    } catch (e) {
      setStatus('Camera error: ' + (e?.message || e))
      setScanning(false)
    }
  }

  async function stopScan() {
    if (scannerRef.current && scanning) {
      try { await scannerRef.current.stop() } catch (_) {}
    }
    setScanning(false)
  }

  async function loadEquipmentStatus(id) {
    if (!id) return
    try {
      const res = await fetch(`${API_BASE}/api/gyms/${id}/equipment-status`, { headers: { Authorization: 'Bearer ' + token } })
      const data = await res.json()
      if (res.ok && Array.isArray(data)) setEquipment(data)
    } catch (_) {}
  }

  async function loadMyBookings() {
    try {
      const res = await fetch(`${API_BASE}/api/me/bookings`, { headers: { Authorization: 'Bearer ' + token } })
      const data = await res.json()
      if (res.ok && Array.isArray(data)) setMyBookings(data)
    } catch (_) {}
  }

  async function bookEquipment(equipmentId) {
    const res = await fetch(`${API_BASE}/api/equipment/${equipmentId}/book`, { method: 'POST', headers: { Authorization: 'Bearer ' + token } })
    const data = await res.json()
    if (res.ok) {
      setStatus('Booked successfully')
      loadEquipmentStatus(gymId)
      loadMyBookings()
    } else {
      setStatus(data.error || 'Failed to book')
    }
  }

  async function releaseEquipment(equipmentId) {
    const res = await fetch(`${API_BASE}/api/equipment/${equipmentId}/release`, { method: 'POST', headers: { Authorization: 'Bearer ' + token } })
    const data = await res.json()
    if (res.ok) {
      setStatus('Released booking')
      loadEquipmentStatus(gymId)
      loadMyBookings()
    } else {
      setStatus(data.error || 'Failed to release')
    }
  }

  return (
    <div style={{ backgroundColor: '#09090b', minHeight: '100vh', padding: '24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 className="font-display" style={{ color: '#F5F4EE', fontSize: 28, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}><span className="neu-badge" style={{ width: 40, height: 40 }}><Icon name="user" size={20} color="#D97757" /></span> Member Home</h1>
            <div style={{ color: '#A6A29A', fontSize: 14 }}>Scan to check in, or choose a gym and manage equipment</div>
          </div>
          <div>
            <button
              onClick={scanning ? stopScan : startScan}
              style={{ backgroundColor: '#D97757', color: '#FFFFFF', borderRadius: '9999px', padding: '12px 18px', border: 'none', cursor: 'pointer', fontWeight: 700 }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#C4664A'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#D97757'}
            >
              {scanning ? 'Stop Scanner' : 'Check-in / Check-out (Scan QR)'}
            </button>
          </div>
        </div>

        {/* Scanner */}
        <div id="qr-reader" style={{ width: 360, height: scanning ? 360 : 0, overflow: 'hidden', border: scanning ? '1px solid #3A3937' : 'none', borderRadius: 12 }} />

        {/* Status */}
        {status && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 12, backgroundColor: status.toLowerCase().includes('fail') || status.toLowerCase().includes('error') ? '#991b1b' : '#064e3b', color: '#e5e7eb', fontWeight: 700, display: 'inline-block' }}>
            {status}
          </div>
        )}

        {/* Manual Check-in Card */}
        <div style={{ marginTop: 16, backgroundColor: '#262624', border: '1px solid #3A3937', borderRadius: 16, padding: 16 }}>
          <div style={{ color: '#D9D5CC', fontWeight: 700, marginBottom: 8 }}>Or select a gym to toggle check-in/out:</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={gymId || ''}
              onChange={e => setGymId(e.target.value ? parseInt(e.target.value, 10) : null)}
              style={{ backgroundColor: '#1F1E1D', color: '#F5F4EE', border: '1px solid #3A3937', borderRadius: 10, padding: '10px 12px', minWidth: 220 }}
            >
              <option value="">-- Select Gym --</option>
              {gyms.map(g => <option key={g.id} value={g.id}>{g.name}{g.location ? ` (${g.location})` : ''}</option>)}
            </select>
            <button
              style={{ backgroundColor: '#D97757', color: '#FFFFFF', borderRadius: '9999px', padding: '10px 16px', border: 'none', cursor: 'pointer', fontWeight: 700 }}
              onClick={() => toggleCheckIn(gymId)}
              disabled={!gymId}
            >
              Toggle Check-in
            </button>
          </div>
        </div>

        {/* Occupancy */}
        {gymId && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ backgroundColor: '#1F1E1D', color: '#F5F4EE', border: '1px solid #3A3937', padding: '8px 12px', borderRadius: 9999, fontWeight: 700 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Icon name="users" size={16} color="#D97757" /> People currently at {gymName || `Gym #${gymId}`}: {count ?? '—'}</span>
            </div>
          </div>
        )}

        {!gymId && (
          <p style={{ color: '#A6A29A', marginTop: 12 }}>Scan a gym QR or choose a gym to get started.</p>
        )}

        {/* Equipment List */}
        {gymId && (
          <div style={{ marginTop: 18 }}>
            <h2 className="font-display" style={{ color: '#F5F4EE', fontSize: 18, fontWeight: 700, margin: '6px 0 12px', display: 'flex', alignItems: 'center', gap: 10 }}><Icon name="box" size={18} color="#D97757" /> Equipment at this gym</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {equipment.map(eq => {
                const activeCount = Number(eq.active_count || 0)
                const qty = Number(eq.quantity || 1)
                const available = Math.max(0, qty - activeCount)
                const bookedByMe = !!eq.booked_by_me
                const iHaveBooking = myBookings && myBookings.length > 0
                return (
                  <div key={eq.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1F1E1D', border: '1px solid #3A3937', borderRadius: 14, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ color: '#F5F4EE', fontWeight: 700, fontSize: 16 }}>{eq.name} {qty ? `x${qty}` : ''}</div>
                      <div style={{ fontSize: 12, color: available > 0 ? '#22c55e' : '#f87171', fontWeight: 700 }}>
                        {available > 0 ? `Available (${available}/${qty})` : 'Fully booked'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {available > 0 && !iHaveBooking && !bookedByMe && (
                        <button onClick={() => bookEquipment(eq.id)} style={{ backgroundColor: '#D97757', color: '#FFFFFF', borderRadius: 9999, padding: '8px 14px', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Book</button>
                      )}
                      {bookedByMe && (
                        <button onClick={() => releaseEquipment(eq.id)} style={{ backgroundColor: '#3A3937', color: '#F5F4EE', borderRadius: 9999, padding: '8px 14px', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Release</button>
                      )}
                      <button style={{ backgroundColor: '#3A3937', color: '#F5F4EE', borderRadius: 9999, padding: '8px 14px', border: 'none', cursor: 'pointer', fontWeight: 700 }} onClick={() => setShowSlotsFor(eq)}>View Time Slots</button>
                    </div>
                  </div>
                )
              })}
              {equipment.length === 0 && <div style={{ color: '#A6A29A' }}>No equipment listed for this gym.</div>}
            </div>

            {myBookings.length > 0 && (
              <div style={{ marginTop: 12, backgroundColor: '#262624', border: '1px solid #3A3937', borderRadius: 12, padding: 12, color: '#F5F4EE' }}>
                <div style={{ fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: 6 }}>Your active booking:</div>
                {myBookings.map(b => (
                  <div key={b.id} style={{ fontSize: 14 }}>• {b.equipment_name} at {b.gym_name} since {b.started_at}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Slots Modal */}
        {showSlotsFor && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setShowSlotsFor(null)}>
            <div style={{ background: '#262624', border: '1px solid #3A3937', color: '#F5F4EE', padding: 16, width: 640, maxHeight: '80vh', overflow: 'auto', borderRadius: 16 }} onClick={e => e.stopPropagation()}>
              <h3 style={{ marginTop: 0, fontWeight: 600, fontFamily: 'var(--font-display)' }}>{showSlotsFor.name}</h3>
              <p style={{ color: '#A6A29A' }}>Book a 15-minute time slot, join waitlist when full, or take an idle slot after start.</p>
              <EquipmentSlots token={token} equipment={showSlotsFor} onBooked={() => { loadMyBookings(); }} />
              <div style={{ textAlign: 'right', marginTop: 10 }}>
                <button onClick={() => setShowSlotsFor(null)} style={{ backgroundColor: '#D97757', color: '#FFFFFF', borderRadius: '9999px', padding: '12px 24px', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
