import React, { useEffect, useRef, useState } from 'react'
import { API_BASE } from './api'

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

  return (
    <div>
      <h3>Member Home</h3>
      <div style={{ marginBottom: 8 }}>
        <button onClick={scanning ? stopScan : startScan}>{scanning ? 'Stop Scanner' : 'Check-in / Check-out (Scan QR)'}</button>
      </div>
      <div id="qr-reader" style={{ width: 320, height: scanning ? 320 : 0, overflow: 'hidden', border: scanning ? '1px solid #ccc' : 'none' }} />

      {status && <p>{status}</p>}

      {/* Manual fallback if camera/https not available */}
      <div style={{ marginTop: 12 }}>
        <div style={{ marginBottom: 6 }}>Or select a gym to toggle check-in/out:</div>
        <select value={gymId || ''} onChange={e => setGymId(e.target.value ? parseInt(e.target.value, 10) : null)}>
          <option value="">-- Select Gym --</option>
          {gyms.map(g => <option key={g.id} value={g.id}>{g.name}{g.location ? ` (${g.location})` : ''}</option>)}
        </select>
        <button style={{ marginLeft: 8 }} onClick={() => toggleCheckIn(gymId)} disabled={!gymId}>Toggle Check-in</button>
      </div>

      {gymId && (
        <div style={{ marginTop: 12 }}>
          <strong>People currently at {gymName || `Gym #${gymId}`}:</strong> {count ?? '—'}
        </div>
      )}

      {!gymId && (
        <p style={{ color: '#555' }}>Scan a gym QR to see and update occupancy.</p>
      )}
    </div>
  )
}
