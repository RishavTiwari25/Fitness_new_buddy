import React, { useEffect, useState } from 'react'
import { API_BASE } from './api'
import Icon from './components/Icon'

export default function EquipmentSlots({ token, equipment, onBooked }) {
  const [status, setStatus] = useState('')
  const [data, setData] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [haveActive, setHaveActive] = useState(false)
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [alternatives, setAlternatives] = useState([])
  const [loadingAlts, setLoadingAlts] = useState(false)

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
    if (res.ok) { 
      setStatus(json.message || 'Booked')
      onBooked?.()
      load()
    } else {
      setStatus(json.error || 'Failed')
    }
  }

  async function takeIdle(slotTime) {
    setStatus('')
    const res = await fetch(`${API_BASE}/api/book/take-idle-slot`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ equipmentId: equipment.id, slotTime }) })
    const json = await res.json()
    if (res.ok) { 
      setStatus('Took idle slot')
      onBooked?.()
      load()
    } else {
      setStatus(json.error || 'Failed')
    }
  }

  async function loadAlternatives() {
    setLoadingAlts(true)
    // Get target muscle from equipment name (simple heuristic)
    let muscle = 'Chest'
    const name = equipment.name.toLowerCase()
    if (name.includes('leg') || name.includes('squat')) muscle = 'Legs'
    else if (name.includes('back') || name.includes('row')) muscle = 'Back'
    else if (name.includes('shoulder')) muscle = 'Shoulders'
    else if (name.includes('arm') || name.includes('curl')) muscle = 'Arms'
    else if (name.includes('core') || name.includes('ab')) muscle = 'Core'

    try {
      const res = await fetch(`${API_BASE}/api/exercises/alternatives?targetMuscle=${encodeURIComponent(muscle)}`, {
        headers: { Authorization: 'Bearer ' + token }
      })
      const data = await res.json()
      if (res.ok && Array.isArray(data)) {
        setAlternatives(data)
        setShowAlternatives(true)
      } else {
        setStatus('No alternatives found')
      }
    } catch (err) {
      setStatus('Failed to load alternatives')
    } finally {
      setLoadingAlts(false)
    }
  }

  if (!equipment) return null
  const slots = data?.slots || []

  return (
    <div style={{ position: 'relative' }}>
      {/* Status Message */}
      {status && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '16px',
          backgroundColor: status.includes('Failed') || status.includes('error') || status.includes('already') 
            ? '#fee2e2' 
            : '#d1fae5',
          color: status.includes('Failed') || status.includes('error') || status.includes('already')
            ? '#991b1b'
            : '#065f46',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: '600',
          border: status.includes('Failed') || status.includes('error') || status.includes('already')
            ? '1px solid #fecaca'
            : '1px solid #a7f3d0'
        }}>
          {status}
        </div>
      )}

      {/* Header with Alternatives Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h4 style={{
          color: '#F5F4EE',
          fontSize: '18px',
          fontWeight: '700',
          margin: 0
        }}>
          Available Time Slots
        </h4>
        <button
          onClick={loadAlternatives}
          disabled={loadingAlts}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3A3937',
            color: '#D97757',
            border: '1px solid #D97757',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: loadingAlts ? 'wait' : 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          onMouseEnter={(e) => {
            if (!loadingAlts) {
              e.target.style.backgroundColor = '#4C4A46'
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3A3937'
          }}
        >
          {loadingAlts ? 'Loading…' : 'View Alternatives'}
        </button>
      </div>

      {/* Slots Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
        gap: '12px' 
      }}>
        {slots.map(s => {
          const t = new Date(s.slotTime)
          const label = t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
          const full = s.count >= 2
          const started = now >= t.getTime() + 5*60000
          const oneLeft = s.count === 1

          return (
            <div 
              key={s.slotTime} 
              style={{ 
                backgroundColor: '#262624',
                border: '1px solid #3A3937',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                transition: 'border-color 0.2s'
              }}
            >
              {/* Time Label */}
              <div style={{
                fontSize: '16px',
                fontWeight: '700',
                color: '#F5F4EE'
              }}>
                {label}
              </div>

              {/* Capacity Status */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: full ? '#dc2626' : oneLeft ? '#f59e0b' : '#22c55e'
                }} />
                <span style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: full ? '#fca5a5' : oneLeft ? '#fcd34d' : '#86efac'
                }}>
                  {s.count}/2 booked
                </span>
              </div>

              {/* Action Buttons */}
              <div style={{ marginTop: 'auto' }}>
                {/* User already has a slot */}
                {haveActive && (
                  <div style={{
                    fontSize: '12px',
                    color: '#A6A29A',
                    fontStyle: 'italic',
                    textAlign: 'center',
                    padding: '8px'
                  }}>
                    You already have a booking
                  </div>
                )}

                {/* Slot available - Primary (full availability) */}
                {!full && !haveActive && s.count === 0 && (
                  <button
                    onClick={() => book(s.slotTime)}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      backgroundColor: '#D97757',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#C4664A'
                      e.target.style.transform = 'translateY(-1px)'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = '#D97757'
                      e.target.style.transform = 'translateY(0)'
                    }}
                  >
                    <Icon name="bookmark" size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} />Book
                  </button>
                )}

                {/* Slot available - Secondary (1 spot left) */}
                {!full && !haveActive && s.count === 1 && (
                  <button
                    onClick={() => book(s.slotTime)}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      backgroundColor: '#3A3937',
                      color: '#F5F4EE',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#4C4A46'
                      e.target.style.transform = 'translateY(-1px)'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = '#3A3937'
                      e.target.style.transform = 'translateY(0)'
                    }}
                  >
                    <Icon name="alert" size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} />Book (1 spot left)
                  </button>
                )}

                {/* Slot full - Join Waitlist */}
                {full && !started && !haveActive && (
                  <button
                    onClick={() => book(s.slotTime)}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      backgroundColor: 'transparent',
                      color: '#D97757',
                      border: '2px solid #D97757',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = 'rgba(217, 119, 87, 0.1)'
                      e.target.style.transform = 'translateY(-1px)'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'transparent'
                      e.target.style.transform = 'translateY(0)'
                    }}
                  >
                    <Icon name="plus" size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} />Join Waitlist
                  </button>
                )}

                {/* Slot full and started - Take Idle */}
                {full && started && !haveActive && (
                  <button
                    onClick={() => takeIdle(s.slotTime)}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      backgroundColor: '#3A3937',
                      color: '#F5F4EE',
                      border: '1px solid #4C4A46',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#4C4A46'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = '#3A3937'
                    }}
                  >
                    <Icon name="bolt" size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} />Take Idle Slot
                  </button>
                )}

                {/* Slot full and not started */}
                {full && !started && haveActive && (
                  <div style={{
                    fontSize: '12px',
                    color: '#dc2626',
                    fontWeight: '600',
                    textAlign: 'center',
                    padding: '8px'
                  }}>
                    Full
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* No Slots Message */}
      {slots.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          backgroundColor: '#262624',
          borderRadius: '12px',
          border: '1px solid #3A3937'
        }}>
          <div style={{ marginBottom: '12px' }}><Icon name="calendar" size={28} color="#D97757" /></div>
          <div style={{ color: '#A6A29A', fontSize: '14px' }}>
            No upcoming time slots available
          </div>
        </div>
      )}

      {/* Alternative Exercises Modal */}
      {showAlternatives && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowAlternatives(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              zIndex: 999,
              animation: 'fadeIn 0.3s ease-out'
            }}
          />

          {/* Modal */}
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: '80vh',
              backgroundColor: '#262624',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              zIndex: 1000,
              animation: 'slideUp 0.3s ease-out',
              boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #3A3937',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{
                  fontSize: '24px',
                  fontWeight: '800',
                  color: '#D97757',
                  margin: '0 0 4px 0'
                }}>
                  Alternative Exercises
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: '#A6A29A',
                  margin: 0
                }}>
                  Try these exercises while {equipment.name} is busy
                </p>
              </div>
              <button
                onClick={() => setShowAlternatives(false)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#3A3937',
                  border: 'none',
                  color: '#F5F4EE',
                  fontSize: '20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#4C4A46'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#3A3937'}
              >
                ×
              </button>
            </div>

            {/* Modal Content (Scrollable) */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px'
            }}>
              {alternatives.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#A6A29A'
                }}>
                  <div style={{ marginBottom: '16px' }}><Icon name="help" size={38} color="#D97757" /></div>
                  <div>No alternative exercises found</div>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '16px'
                }}>
                  {alternatives.map(alt => (
                    <div
                      key={alt.id}
                      style={{
                        backgroundColor: '#1F1E1D',
                        borderRadius: '12px',
                        padding: '20px',
                        border: '1px solid #3A3937',
                        transition: 'border-color 0.2s, transform 0.2s',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#D97757'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#3A3937'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }}
                    >
                      {/* Exercise Icon */}
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        backgroundColor: '#3A3937',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                        marginBottom: '12px'
                      }}>
                        <Icon name="dumbbell" size={24} color="#D97757" />
                      </div>

                      {/* Exercise Name */}
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '700',
                        color: '#F5F4EE',
                        marginBottom: '8px',
                        lineHeight: '1.3'
                      }}>
                        {alt.exercise_name}
                      </h4>

                      {/* Target Muscle Tag */}
                      <div style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        backgroundColor: '#D97757',
                        color: '#FFFFFF',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        marginBottom: '12px'
                      }}>
                        {alt.target_muscle}
                      </div>

                      {/* Equipment Needed */}
                      {alt.equipment_needed && (
                        <div style={{
                          fontSize: '13px',
                          color: '#A6A29A',
                          marginBottom: '8px'
                        }}>
                          Equipment: <span style={{ color: '#D9D5CC' }}>{alt.equipment_needed}</span>
                        </div>
                      )}

                      {/* Instructions Preview */}
                      {alt.instructions && (
                        <p style={{
                          fontSize: '13px',
                          color: '#A6A29A',
                          lineHeight: '1.5',
                          margin: 0
                        }}>
                          {alt.instructions.length > 100 
                            ? alt.instructions.substring(0, 100) + '...' 
                            : alt.instructions}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CSS Animations */}
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { 
                transform: translateY(100%);
                opacity: 0;
              }
              to { 
                transform: translateY(0);
                opacity: 1;
              }
            }
          `}</style>
        </>
      )}
    </div>
  )
}
