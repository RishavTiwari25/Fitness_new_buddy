import React, { useEffect, useState } from 'react'
import { API_BASE } from './api'

export default function Profile({ token, profile, onUpdate }) {
  const [name, setName] = useState(profile ? profile.name : '')
  const [gymId, setGymId] = useState(profile ? profile.gym_id : null)
  const [bio, setBio] = useState(profile ? (profile.bio || '') : '')
  const [allowShare, setAllowShare] = useState(!!(profile && profile.allow_calorie_share))
  const [avatarUrl, setAvatarUrl] = useState(profile ? profile.avatar_url : '')
  const [streaks, setStreaks] = useState({ gym_streak: null, diet_streak: null })
  const [points, setPoints] = useState(0)
  const [followers, setFollowers] = useState({ count: 0, list: [] })
  const [following, setFollowing] = useState({ count: 0, list: [] })
  const [gyms, setGyms] = useState([])
  const [msg, setMsg] = useState(null)
  const [isEditing, setIsEditing] = useState(false)

  // Parse JWT to get user role
  function parseJwt(tk) {
    try { return JSON.parse(atob(tk.split('.')[1])) } catch { return {} }
  }
  const user = parseJwt(token)
  const isTrainer = user.role === 'trainer'

  useEffect(() => {
    setName(profile ? profile.name : '')
    setGymId(profile ? profile.gym_id : null)
    setBio(profile ? (profile.bio || '') : '')
    setAllowShare(!!(profile && profile.allow_calorie_share))
    setAvatarUrl(profile ? profile.avatar_url : '')
  }, [profile])

  useEffect(() => {
    async function loadData() {
      try {
        // Load gyms
        const gymsRes = await fetch(`${API_BASE}/api/gyms`, { headers: { Authorization: 'Bearer ' + token } })
        const gymsData = await gymsRes.json()
        setGyms(gymsData)

        // Load streaks
        const streaksRes = await fetch(`${API_BASE}/api/me/streaks`, { headers: { Authorization: 'Bearer ' + token } })
        const streaksData = await streaksRes.json()
        if (streaksRes.ok) setStreaks({ gym_streak: streaksData.gym_streak, diet_streak: streaksData.diet_streak })

        // Load points
        const pointsRes = await fetch(`${API_BASE}/api/me/points`, { headers: { Authorization: 'Bearer ' + token } })
        const pointsData = await pointsRes.json()
        if (pointsRes.ok) setPoints(pointsData.points || 0)

        // Load followers/following
        const followersRes = await fetch(`${API_BASE}/api/me/followers`, { headers: { Authorization: 'Bearer ' + token } })
        const followersData = await followersRes.json()
        if (followersRes.ok) setFollowers({ count: followersData.length, list: followersData })

        const followingRes = await fetch(`${API_BASE}/api/me/following`, { headers: { Authorization: 'Bearer ' + token } })
        const followingData = await followingRes.json()
        if (followingRes.ok) setFollowing({ count: followingData.length, list: followingData })
      } catch (e) {
        console.error('Failed to load profile data:', e)
      }
    }
    loadData()
  }, [token])

  async function save(e) {
    e.preventDefault();
    setMsg(null)
    try {
      const res = await fetch(`${API_BASE}/api/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ name, gym_id: gymId, bio, allow_calorie_share: allowShare })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      onUpdate(data)
      setMsg('Profile updated successfully! ✓')
      setIsEditing(false)
    } catch (err) {
      setMsg(err.message)
    }
  }

  async function uploadAvatar(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setMsg(null)
    const fd = new FormData()
    fd.append('avatar', file)
    const res = await fetch(`${API_BASE}/api/profile/avatar`, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd })
    const data = await res.json()
    if (res.ok) {
      try { setAvatarUrl(URL.createObjectURL(file)) } catch {}
      setAvatarUrl(data.avatar_url)
      onUpdate && onUpdate({ ...profile, avatar_url: data.avatar_url })
      setMsg('Avatar updated successfully! ✓')
    } else {
      setMsg(data.error || 'Upload failed')
    }
  }

  // Calculate "rating" for trainers (mock based on followers)
  const trainerRating = isTrainer ? Math.min(5, Math.floor((followers.count / 10) * 5) + 3.5).toFixed(1) : null

  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: '#18181b',
      padding: '24px'
    }}>
      {/* Header Section with Avatar */}
      <div style={{
        backgroundColor: '#27272a',
        borderRadius: '20px',
        padding: '40px',
        marginBottom: '24px',
        border: '1px solid #3f3f46',
        textAlign: 'center'
      }}>
        {/* Large Circular Avatar */}
        <div style={{
          position: 'relative',
          display: 'inline-block',
          marginBottom: '24px'
        }}>
          <img 
            src={avatarUrl || 'https://via.placeholder.com/160'} 
            alt="avatar" 
            style={{
              width: '160px',
              height: '160px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '4px solid #D0FD3E',
              boxShadow: '0 8px 24px rgba(208, 253, 62, 0.2)'
            }}
          />
          
          {/* Change Avatar Button (Overlay) */}
          <label style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            width: '40px',
            height: '40px',
            backgroundColor: '#D0FD3E',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            border: '3px solid #27272a',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            transition: 'transform 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <span style={{ fontSize: '20px' }}>📷</span>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadAvatar} />
          </label>
        </div>

        {/* Username */}
        <h1 style={{
          fontSize: '32px',
          fontWeight: '800',
          color: '#fafafa',
          marginBottom: '8px'
        }}>
          @{name || profile?.email?.split('@')[0] || 'User'}
        </h1>

        {/* Role Badge */}
        <div style={{
          display: 'inline-block',
          padding: '6px 16px',
          backgroundColor: user.role === 'owner' ? '#dc2626' : 
                          user.role === 'trainer' ? '#f59e0b' : '#D0FD3E',
          color: user.role === 'owner' || user.role === 'trainer' ? '#fafafa' : '#18181b',
          borderRadius: '20px',
          fontSize: '13px',
          fontWeight: '700',
          textTransform: 'uppercase',
          marginBottom: '16px'
        }}>
          {user.role === 'owner' ? '👑 Gym Owner' : 
           user.role === 'trainer' ? '🏋️ Trainer' : '💪 Member'}
        </div>

        {/* Trainer Rating */}
        {isTrainer && trainerRating && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '12px'
          }}>
            <div style={{ color: '#fbbf24', fontSize: '20px' }}>
              {'⭐'.repeat(Math.floor(parseFloat(trainerRating)))}
            </div>
            <span style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#fafafa'
            }}>
              {trainerRating}
            </span>
            <span style={{
              fontSize: '14px',
              color: '#a1a1aa'
            }}>
              ({followers.count} followers)
            </span>
          </div>
        )}

        {/* Edit Profile Button */}
        <button
          onClick={() => setIsEditing(!isEditing)}
          style={{
            marginTop: '20px',
            padding: '12px 32px',
            backgroundColor: isEditing ? '#3f3f46' : '#D0FD3E',
            color: isEditing ? '#fafafa' : '#18181b',
            border: 'none',
            borderRadius: '9999px',
            fontSize: '14px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.target.style.opacity = '0.9'
          }}
          onMouseLeave={(e) => {
            e.target.style.opacity = '1'
          }}
        >
          {isEditing ? '✕ Cancel Edit' : '✏️ Edit Profile'}
        </button>
      </div>

      {/* Message Banner */}
      {msg && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '16px',
          backgroundColor: msg.includes('✓') ? '#d1fae5' : '#fee2e2',
          color: msg.includes('✓') ? '#065f46' : '#991b1b',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: '600',
          border: msg.includes('✓') ? '1px solid #a7f3d0' : '1px solid #fecaca',
          textAlign: 'center'
        }}>
          {msg}
        </div>
      )}

      {/* Edit Form (Conditional) */}
      {isEditing && (
        <div style={{
          backgroundColor: '#27272a',
          borderRadius: '20px',
          padding: '32px',
          marginBottom: '24px',
          border: '1px solid #3f3f46'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '800',
            color: '#D0FD3E',
            marginBottom: '24px'
          }}>
            Edit Profile
          </h2>

          <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Username Input */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#a1a1aa',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Username
              </label>
              <input
                value={name || ''}
                onChange={e => setName(e.target.value)}
                placeholder="Enter your username"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: '#18181b',
                  color: '#fafafa',
                  border: '2px solid #3f3f46',
                  borderRadius: '12px',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#D0FD3E'}
                onBlur={(e) => e.target.style.borderColor = '#3f3f46'}
              />
            </div>

            {/* Gym Selector */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#a1a1aa',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Home Gym
              </label>
              <select
                value={gymId || ''}
                onChange={e => setGymId(e.target.value ? parseInt(e.target.value, 10) : null)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: '#18181b',
                  color: '#fafafa',
                  border: '2px solid #3f3f46',
                  borderRadius: '12px',
                  fontSize: '15px',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#D0FD3E'}
                onBlur={(e) => e.target.style.borderColor = '#3f3f46'}
              >
                <option value="">-- Select your gym --</option>
                {gyms.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name} {g.location ? `(${g.location})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Bio Textarea */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#a1a1aa',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Bio
              </label>
              <textarea
                rows={4}
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: '#18181b',
                  color: '#fafafa',
                  border: '2px solid #3f3f46',
                  borderRadius: '12px',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  lineHeight: '1.5'
                }}
                onFocus={(e) => e.target.style.borderColor = '#D0FD3E'}
                onBlur={(e) => e.target.style.borderColor = '#3f3f46'}
              />
            </div>

            {/* Privacy Checkbox */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px',
              backgroundColor: '#18181b',
              borderRadius: '12px',
              border: '1px solid #3f3f46'
            }}>
              <input
                type="checkbox"
                checked={allowShare}
                onChange={e => setAllowShare(e.target.checked)}
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: 'pointer',
                  accentColor: '#D0FD3E'
                }}
              />
              <label style={{
                fontSize: '14px',
                color: '#d4d4d8',
                cursor: 'pointer'
              }}>
                Allow followers to see my calorie intake
              </label>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              style={{
                padding: '14px',
                backgroundColor: '#D0FD3E',
                color: '#18181b',
                border: 'none',
                borderRadius: '9999px',
                fontSize: '16px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginTop: '8px'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#c4ed38'
                e.target.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#D0FD3E'
                e.target.style.transform = 'translateY(0)'
              }}
            >
              💾 Save Changes
            </button>
          </form>
        </div>
      )}

      {/* About Card */}
      <div style={{
        backgroundColor: '#27272a',
        borderRadius: '20px',
        padding: '32px',
        marginBottom: '24px',
        border: '1px solid #3f3f46'
      }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: '800',
          color: '#D0FD3E',
          marginBottom: '16px'
        }}>
          About
        </h2>
        <p style={{
          fontSize: '15px',
          lineHeight: '1.7',
          color: '#d4d4d8',
          margin: 0
        }}>
          {bio || 'No bio yet. Click "Edit Profile" to add information about yourself!'}
        </p>
      </div>

      {/* Stats Card */}
      <div style={{
        backgroundColor: '#27272a',
        borderRadius: '20px',
        padding: '32px',
        border: '1px solid #3f3f46'
      }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: '800',
          color: '#D0FD3E',
          marginBottom: '24px'
        }}>
          Stats
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px'
        }}>
          {/* Gym Streak */}
          <div style={{
            backgroundColor: '#18181b',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid #3f3f46',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>🔥</div>
            <div style={{
              fontSize: '28px',
              fontWeight: '800',
              color: '#fafafa',
              marginBottom: '4px'
            }}>
              {streaks.gym_streak ?? 0}
            </div>
            <div style={{
              fontSize: '13px',
              color: '#a1a1aa',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: '600'
            }}>
              Gym Streak (days)
            </div>
          </div>

          {/* Diet Streak */}
          <div style={{
            backgroundColor: '#18181b',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid #3f3f46',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>🍎</div>
            <div style={{
              fontSize: '28px',
              fontWeight: '800',
              color: '#fafafa',
              marginBottom: '4px'
            }}>
              {streaks.diet_streak ?? 0}
            </div>
            <div style={{
              fontSize: '13px',
              color: '#a1a1aa',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: '600'
            }}>
              Diet Streak (days)
            </div>
          </div>

          {/* Reward Points */}
          <div style={{
            backgroundColor: '#18181b',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid #3f3f46',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>🏆</div>
            <div style={{
              fontSize: '28px',
              fontWeight: '800',
              color: '#D0FD3E',
              marginBottom: '4px'
            }}>
              {points}
            </div>
            <div style={{
              fontSize: '13px',
              color: '#a1a1aa',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: '600'
            }}>
              Reward Points
            </div>
          </div>

          {/* Followers */}
          <div style={{
            backgroundColor: '#18181b',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid #3f3f46',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>👥</div>
            <div style={{
              fontSize: '28px',
              fontWeight: '800',
              color: '#fafafa',
              marginBottom: '4px'
            }}>
              {followers.count}
            </div>
            <div style={{
              fontSize: '13px',
              color: '#a1a1aa',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: '600'
            }}>
              Followers
            </div>
          </div>

          {/* Following */}
          <div style={{
            backgroundColor: '#18181b',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid #3f3f46',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>💚</div>
            <div style={{
              fontSize: '28px',
              fontWeight: '800',
              color: '#fafafa',
              marginBottom: '4px'
            }}>
              {following.count}
            </div>
            <div style={{
              fontSize: '13px',
              color: '#a1a1aa',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: '600'
            }}>
              Following
            </div>
          </div>

          {/* Experience (for trainers) */}
          {isTrainer && (
            <div style={{
              backgroundColor: '#18181b',
              padding: '20px',
              borderRadius: '16px',
              border: '1px solid #3f3f46',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>⭐</div>
              <div style={{
                fontSize: '28px',
                fontWeight: '800',
                color: '#fbbf24',
                marginBottom: '4px'
              }}>
                {Math.floor(Math.random() * 5) + 2}+
              </div>
              <div style={{
                fontSize: '13px',
                color: '#a1a1aa',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: '600'
              }}>
                Years Experience
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
