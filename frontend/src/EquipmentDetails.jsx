import React, { useState, useEffect } from 'react'
import { API_BASE } from './api'
import Icon from './components/Icon'
import EquipmentSlots from './EquipmentSlots'

export default function EquipmentDetails({ equipment, token, onBack, onBooked }) {
  const [showSlots, setShowSlots] = useState(false)
  const [booking, setBooking] = useState(null)

  // Parse JWT to get user info
  function parseJwt(tk) {
    try { return JSON.parse(atob(tk.split('.')[1])) } catch { return {} }
  }
  const user = parseJwt(token)

  useEffect(() => {
    // Check if user has a booking for this equipment
    if (equipment.booking_id && equipment.booking_user_id === user.id) {
      setBooking({
        id: equipment.booking_id,
        started_at: equipment.booking_started_at
      })
    }
  }, [equipment])

  // Get enhanced metadata for the equipment
  function getEquipmentMeta(eq) {
    const name = eq.name.toLowerCase()
    
    // Difficulty heuristic
    let difficulty = 'Medium'
    let difficultyColor = '#f59e0b' // orange
    let difficultyEmoji = 'bolt'
    
    if (name.includes('dumbbell') || name.includes('bench') || name.includes('mat')) {
      difficulty = 'Beginner'
      difficultyColor = '#22c55e'
      difficultyEmoji = 'star'
    } else if (name.includes('barbell') || name.includes('squat') || name.includes('deadlift')) {
      difficulty = 'Advanced'
      difficultyColor = '#dc2626'
      difficultyEmoji = 'flame'
    }

    // Time estimate
    let time = '30 min'
    if (name.includes('cardio') || name.includes('treadmill') || name.includes('bike')) {
      time = '45 min'
    } else if (name.includes('warm') || name.includes('stretch')) {
      time = '15 min'
    }

    // Target muscles
    let muscles = 'Full Body'
    let muscleEmoji = 'dumbbell'
    
    if (name.includes('chest') || name.includes('bench') || name.includes('press')) {
      muscles = 'Chest'
      muscleEmoji = 'activity'
    } else if (name.includes('leg') || name.includes('squat') || name.includes('lunge')) {
      muscles = 'Legs'
      muscleEmoji = 'activity'
    } else if (name.includes('back') || name.includes('row') || name.includes('pull')) {
      muscles = 'Back'
      muscleEmoji = 'activity'
    } else if (name.includes('shoulder') || name.includes('lateral')) {
      muscles = 'Shoulders'
      muscleEmoji = 'dumbbell'
    } else if (name.includes('arm') || name.includes('curl') || name.includes('tricep')) {
      muscles = 'Arms'
      muscleEmoji = 'dumbbell'
    } else if (name.includes('core') || name.includes('ab')) {
      muscles = 'Core'
      muscleEmoji = 'flame'
    }

    // Generate description based on equipment name
    let description = eq.notes || `The ${eq.name} is a versatile piece of gym equipment designed to help you build strength and improve your fitness. Perfect for both beginners and advanced athletes looking to enhance their workout routine.`

    // Instructions based on equipment type
    let instructions = [
      'Start with a proper warm-up to prepare your muscles',
      'Maintain proper form throughout the exercise',
      'Control the movement - no jerking or sudden movements',
      'Breathe properly: exhale during exertion, inhale during relaxation',
      'Start with lighter weights and gradually increase',
      'Cool down and stretch after your workout'
    ]

    if (name.includes('bench')) {
      instructions = [
        'Lie flat on the bench with feet firmly on the ground',
        'Grip the bar slightly wider than shoulder-width',
        'Lower the bar to your chest in a controlled manner',
        'Press the bar back up, fully extending your arms',
        'Keep your core engaged throughout the movement',
        'Use a spotter for safety with heavy weights'
      ]
    } else if (name.includes('squat')) {
      instructions = [
        'Position the bar on your upper back/traps',
        'Stand with feet shoulder-width apart',
        'Keep your chest up and core tight',
        'Lower down by bending knees and hips simultaneously',
        'Go down until thighs are parallel to ground',
        'Drive through your heels to return to starting position'
      ]
    } else if (name.includes('treadmill') || name.includes('cardio')) {
      instructions = [
        'Start with a 5-minute warm-up at low intensity',
        'Gradually increase speed to your target pace',
        'Maintain good posture - shoulders back, core engaged',
        'Land midfoot and roll through to your toes',
        'Stay hydrated throughout your session',
        'Cool down with 5 minutes of walking'
      ]
    }

    return { 
      difficulty, 
      difficultyColor, 
      difficultyEmoji,
      time, 
      muscles, 
      muscleEmoji,
      description,
      instructions
    }
  }

  const meta = getEquipmentMeta(equipment)
  const isBooked = !!equipment.booking_id
  const bookedByMe = isBooked && equipment.booking_user_id === user.id

  async function handleBooking() {
    if (bookedByMe) {
      // Release booking
      try {
        const res = await fetch(`${API_BASE}/api/equipment/${equipment.id}/release`, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token }
        })
        if (res.ok) {
          alert('Booking released successfully!')
          if (onBooked) onBooked()
        } else {
          const data = await res.json()
          alert(data.error || 'Failed to release booking')
        }
      } catch (err) {
        alert('Failed to release booking')
      }
    } else if (!isBooked) {
      // Try to book (requires being checked in)
      try {
        const res = await fetch(`${API_BASE}/api/equipment/${equipment.id}/book`, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token }
        })
        const data = await res.json()
        if (res.ok) {
          alert('Equipment booked successfully!')
          if (onBooked) onBooked()
        } else {
          alert(data.error || 'Failed to book equipment')
        }
      } catch (err) {
        alert('Failed to book equipment')
      }
    }
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: '#1F1E1D',
      paddingBottom: '40px'
    }}>
      {/* Header with Back Button */}
      <div style={{
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        backgroundColor: '#262624',
        borderBottom: '1px solid #3A3937'
      }}>
        <button
          onClick={onBack}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3A3937',
            color: '#F5F4EE',
            border: 'none',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#4C4A46'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#3A3937'}
        >
          ← Back to Browse
        </button>
        <h2 style={{ 
          color: '#F5F4EE', 
          fontSize: '20px', 
          fontWeight: '700',
          margin: 0 
        }}>
          Equipment Details
        </h2>
      </div>

      {/* Hero Image Section */}
      <div style={{
        width: '100%',
        height: '400px',
        background: 'linear-gradient(135deg, #3A3937 0%, #262624 50%, #1F1E1D 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Large Equipment Icon */}
        <div style={{
          fontSize: '160px',
          opacity: 0.3,
          filter: 'blur(2px)'
        }}>
          <Icon name="dumbbell" size={150} color="#D97757" />
        </div>
        
        {/* Overlay Equipment Name */}
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '24px',
          right: '24px'
        }}>
          <h1 style={{
            fontSize: '48px',
            fontWeight: '900',
            color: '#D97757',
            margin: 0,
            textShadow: '2px 2px 8px rgba(0,0,0,0.5)',
            lineHeight: '1.2'
          }}>
            {equipment.name}
          </h1>
        </div>
      </div>

      {/* Main Content Container */}
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '32px 24px' 
      }}>
        {/* About Section */}
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{
            fontSize: '28px',
            fontWeight: 600, fontFamily: 'var(--font-display)',
            color: '#F5F4EE',
            marginBottom: '16px'
          }}>
            About
          </h2>
          <p style={{
            fontSize: '16px',
            lineHeight: '1.8',
            color: '#A6A29A',
            backgroundColor: '#262624',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #3A3937'
          }}>
            {meta.description}
          </p>
        </section>

        {/* Stats Section */}
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{
            fontSize: '28px',
            fontWeight: 600, fontFamily: 'var(--font-display)',
            color: '#F5F4EE',
            marginBottom: '16px'
          }}>
            Stats
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '16px'
          }}>
            {/* Difficulty Card */}
            <div style={{
              backgroundColor: '#262624',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid #3A3937',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#A6A29A',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Difficulty Level
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  fontSize: '32px'
                }}>
                  <Icon name={meta.difficultyEmoji} size={20} color="#D97757" />
                </div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: meta.difficultyColor
                }}>
                  {meta.difficulty}
                </div>
              </div>
            </div>

            {/* Time/Duration Card */}
            <div style={{
              backgroundColor: '#262624',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid #3A3937',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#A6A29A',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Typical Duration
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  fontSize: '32px'
                }}>
                  <Icon name="clock" size={28} color="#D97757" />
                </div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#D97757'
                }}>
                  {meta.time}
                </div>
              </div>
            </div>

            {/* Target Muscle Card */}
            <div style={{
              backgroundColor: '#262624',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid #3A3937',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#A6A29A',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Target Muscle Group
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  fontSize: '32px'
                }}>
                  <Icon name={meta.muscleEmoji} size={20} color="#D97757" />
                </div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#F5F4EE'
                }}>
                  {meta.muscles}
                </div>
              </div>
            </div>

            {/* Quantity Card */}
            <div style={{
              backgroundColor: '#262624',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid #3A3937',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#A6A29A',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Available Quantity
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  fontSize: '32px'
                }}>
                  <Icon name="box" size={28} color="#D97757" />
                </div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#F5F4EE'
                }}>
                  {equipment.quantity || 1}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Instructions Section */}
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{
            fontSize: '28px',
            fontWeight: 600, fontFamily: 'var(--font-display)',
            color: '#F5F4EE',
            marginBottom: '16px'
          }}>
            How to Use
          </h2>
          <div style={{
            backgroundColor: '#262624',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #3A3937'
          }}>
            <ol style={{
              margin: 0,
              paddingLeft: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {meta.instructions.map((instruction, idx) => (
                <li key={idx} style={{
                  fontSize: '15px',
                  lineHeight: '1.6',
                  color: '#D9D5CC'
                }}>
                  {instruction}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Trainer/Instructor Section */}
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{
            fontSize: '28px',
            fontWeight: 600, fontFamily: 'var(--font-display)',
            color: '#F5F4EE',
            marginBottom: '16px'
          }}>
            Need Help?
          </h2>
          <div style={{
            backgroundColor: '#262624',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #3A3937',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3A3937'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#262624'}
          >
            {/* Trainer Avatar */}
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#D97757',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px'
            }}>
              <Icon name="user" size={28} color="#D97757" />
            </div>
            
            {/* Trainer Info */}
            <div style={{ flex: 1 }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#F5F4EE',
                marginBottom: '4px'
              }}>
                Ask a Trainer
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#A6A29A',
                margin: 0
              }}>
                Get personalized guidance from our certified fitness trainers
              </p>
            </div>

            {/* Arrow */}
            <div style={{
              fontSize: '24px',
              color: '#D97757'
            }}>
              →
            </div>
          </div>
        </section>

        {/* Availability & Booking Section */}
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{
            fontSize: '28px',
            fontWeight: 600, fontFamily: 'var(--font-display)',
            color: '#F5F4EE',
            marginBottom: '16px'
          }}>
            Availability
          </h2>
          
          <div style={{
            backgroundColor: '#262624',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #3A3937'
          }}>
            {/* Status Display */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              paddingBottom: '20px',
              borderBottom: '1px solid #3A3937'
            }}>
              <div>
                <div style={{
                  fontSize: '14px',
                  color: '#A6A29A',
                  marginBottom: '8px'
                }}>
                  Current Status
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: isBooked ? '#dc2626' : '#22c55e'
                  }} />
                  <span style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: isBooked ? '#dc2626' : '#22c55e'
                  }}>
                    {isBooked ? 'Currently Booked' : 'Available Now'}
                  </span>
                </div>
              </div>
              
              {isBooked && (
                <div style={{
                  fontSize: '13px',
                  color: '#A6A29A'
                }}>
                  {bookedByMe ? (
                    <span>You booked this at {equipment.booking_started_at}</span>
                  ) : (
                    <span>Booked by {equipment.booking_user_name || equipment.booking_user_email}</span>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              {/* Simple Booking Button */}
              {user.role === 'member' && (
                <button
                  onClick={handleBooking}
                  disabled={isBooked && !bookedByMe}
                  style={{
                    flex: '1',
                    minWidth: '200px',
                    padding: '16px 24px',
                    backgroundColor: bookedByMe ? '#dc2626' : 
                                     isBooked ? '#3A3937' : '#D97757',
                    color: bookedByMe ? '#F5F4EE' : 
                           isBooked ? '#A6A29A' : '#1F1E1D',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: isBooked && !bookedByMe ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!(isBooked && !bookedByMe)) {
                      e.target.style.opacity = '0.9'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.opacity = '1'
                  }}
                >
                  {bookedByMe ? '✓ Release Booking' : 
                   isBooked ? 'Not Available' : 
                   'Book Now (Instant)'}
                </button>
              )}

              {/* Advanced Slots Button */}
              <button
                onClick={() => setShowSlots(!showSlots)}
                style={{
                  flex: '1',
                  minWidth: '200px',
                  padding: '16px 24px',
                  backgroundColor: '#3A3937',
                  color: '#F5F4EE',
                  border: '2px solid #D97757',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#4C4A46'
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#3A3937'
                }}
              >
                <Icon name="calendar" size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />{showSlots ? 'Hide' : 'View'} Time Slots
              </button>
            </div>

            {/* Help Text */}
            {user.role === 'member' && (
              <p style={{
                marginTop: '16px',
                fontSize: '13px',
                color: '#A6A29A',
                lineHeight: '1.5'
              }}>
                <Icon name="bolt" size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} /><strong>Instant booking</strong> requires you to be checked in at the gym.
                Use <strong>Time Slots</strong> to reserve equipment for a specific 15-minute window.
              </p>
            )}
          </div>
        </section>

        {/* Time Slots Section (Expandable) */}
        {showSlots && (
          <section style={{
            marginBottom: '32px',
            backgroundColor: '#262624',
            padding: '24px',
            borderRadius: '16px',
            border: '2px solid #D97757'
          }}>
            <h3 style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#D97757',
              marginBottom: '16px'
            }}>
              Available Time Slots
            </h3>
            <EquipmentSlots 
              token={token} 
              equipment={equipment} 
              onBooked={() => {
                if (onBooked) onBooked()
                setShowSlots(false)
              }} 
            />
          </section>
        )}
      </div>
    </div>
  )
}
