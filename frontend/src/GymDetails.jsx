import React, { useState, useEffect } from 'react'
import { API_BASE } from './api'
import Icon from './components/Icon'

export default function GymDetails({ token, gymId, onBack, onEnrolled }) {
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [enrollMsg, setEnrollMsg] = useState('')

  // Parse JWT to check current enrollment
  function parseJwt(tk) {
    try { return JSON.parse(atob(tk.split('.')[1])) } catch { return {} }
  }
  const user = parseJwt(token)
  
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/gyms/${gymId}/details`, { headers: { Authorization: 'Bearer ' + token } })
        const data = await res.json()
        if (res.ok) setDetails(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [gymId, token])

  async function enroll() {
    setEnrollMsg('')
    const res = await fetch(`${API_BASE}/api/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ gym_id: gymId })
    })
    const data = await res.json()
    if (res.ok) {
      setEnrollMsg('Successfully enrolled! Waiting for manager approval.')
      if (onEnrolled) onEnrolled(data)
    } else {
      setEnrollMsg(data.error || 'Failed to enroll')
    }
  }

  if (loading) return <div style={{ color: '#fafafa', padding: 24 }}>Loading gym details...</div>
  if (!details) return <div style={{ color: '#ef4444', padding: 24 }}>Failed to load gym details. <button onClick={onBack} style={{ background: '#3f3f46', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', marginLeft: 12 }}>Go Back</button></div>

  const isEnrolled = user.gym_id === parseInt(gymId, 10) || user.gym_id === String(gymId)

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#18181b', padding: '24px' }}>
      <button onClick={onBack} style={{ background: 'transparent', color: '#a1a1aa', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 24, fontSize: 16 }}>
        ← Back to Browse
      </button>

      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: 300 }}>
          <h1 style={{ fontSize: 42, fontWeight: 800, color: '#fafafa', margin: '0 0 8px 0' }}>{details.name}</h1>
          <p style={{ color: '#a1a1aa', fontSize: 16, margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="pin" size={15} color="#D0FD3E" /> {details.location || 'Location not specified'}</p>
          
          <div style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: 16, padding: 24, marginBottom: 24 }}>
            <h3 style={{ marginTop: 0, color: '#fafafa', fontSize: 18 }}>About</h3>
            <p style={{ color: '#d4d4d8', lineHeight: 1.6 }}>{details.description || 'No description provided.'}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: 16, padding: 16 }}>
              <div style={{ color: '#a1a1aa', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Timings</div>
              <div style={{ color: '#fafafa', fontWeight: 600 }}>{details.timings || 'Contact gym'}</div>
            </div>
            <div style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: 16, padding: 16 }}>
              <div style={{ color: '#a1a1aa', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Contact</div>
              <div style={{ color: '#fafafa', fontWeight: 600 }}>{details.contact_info || 'Not available'}</div>
            </div>
            <div style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: 16, padding: 16 }}>
              <div style={{ color: '#a1a1aa', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Equipment Count</div>
              <div style={{ color: '#fafafa', fontWeight: 600 }}>{details.equipment_count} machines</div>
            </div>
            <div style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: 16, padding: 16 }}>
              <div style={{ color: '#a1a1aa', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Amenities</div>
              <div style={{ color: '#fafafa', fontWeight: 600 }}>{details.amenities || 'Standard facilities'}</div>
            </div>
          </div>
          
          <div style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: 16, padding: 24 }}>
            <h3 style={{ marginTop: 0, color: '#fafafa', fontSize: 18 }}>Trainers</h3>
            {details.trainers && details.trainers.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
                {details.trainers.map(t => (
                  <div key={t.id} style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 12, padding: 12, textAlign: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 24, background: '#3f3f46', margin: '0 auto 8px auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D0FD3E', fontWeight: 700, fontSize: 20 }}>
                      {t.name ? t.name[0].toUpperCase() : 'T'}
                    </div>
                    <div style={{ color: '#fafafa', fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                    <div style={{ color: '#a1a1aa', fontSize: 12 }}>Trainer</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#a1a1aa' }}>No trainers listed for this gym.</div>
            )}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 260, position: 'sticky', top: 24 }}>
          <div style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: 16, padding: 24, textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#fafafa' }}>Ready to join?</h3>
            {enrollMsg && <div style={{ marginBottom: 16, color: enrollMsg.includes('success') ? '#D0FD3E' : '#ef4444', fontSize: 14, fontWeight: 600 }}>{enrollMsg}</div>}
            
            {isEnrolled ? (
              <div style={{ background: 'rgba(208, 253, 62, 0.1)', color: '#D0FD3E', padding: '16px', borderRadius: 12, fontWeight: 700 }}>
                You are currently enrolled here
              </div>
            ) : (
              <button onClick={enroll} style={{ background: '#D0FD3E', color: '#18181b', border: 'none', borderRadius: 12, padding: '16px 24px', cursor: 'pointer', fontWeight: 800, fontSize: 18, width: '100%', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(208,253,62,0.2)' }}>
                Enroll Now
              </button>
            )}
            
            {!isEnrolled && (
              <p style={{ color: '#a1a1aa', fontSize: 12, marginTop: 16 }}>
                Enrolling will send a request to the Gym Manager. You will need their approval to check in.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
