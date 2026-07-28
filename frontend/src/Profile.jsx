import React, { useEffect, useState } from 'react'
import { API_BASE } from './api'
import Icon from './components/Icon'

const roleBadge = { display: 'inline-flex', alignItems: 'center', gap: 6 }

export default function Profile({ token, profile, onUpdate }) {
  const [name, setName] = useState(profile ? profile.name : '')
  const [gymId, setGymId] = useState(profile ? profile.gym_id : null)
  const [bio, setBio] = useState(profile ? (profile.bio || '') : '')
  const [allowShare, setAllowShare] = useState(!!(profile && profile.allow_calorie_share))
  const [avatarUrl, setAvatarUrl] = useState(profile ? profile.avatar_url : '')
  const [streaks, setStreaks] = useState({ gym_streak: null, diet_streak: null })
  const [points, setPoints] = useState(0)
  const [followers, setFollowers] = useState({ count: 0, list: [], open: false })
  const [following, setFollowing] = useState({ count: 0, list: [], open: false })
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
  if (followersRes.ok) setFollowers(prev => ({ ...prev, count: followersData.length, list: followersData }))

  const followingRes = await fetch(`${API_BASE}/api/me/following`, { headers: { Authorization: 'Bearer ' + token } })
        const followingData = await followingRes.json()
  if (followingRes.ok) setFollowing(prev => ({ ...prev, count: followingData.length, list: followingData }))
  async function refreshSocial() {
    try {
      const fr = await fetch(`${API_BASE}/api/me/followers`, { headers: { Authorization: 'Bearer ' + token } })
      const fl = await fetch(`${API_BASE}/api/me/following`, { headers: { Authorization: 'Bearer ' + token } })
      const frJ = await fr.json(); const flJ = await fl.json();
      if (fr.ok) setFollowers(prev => ({ ...prev, count: frJ.length, list: frJ }))
      if (fl.ok) setFollowing(prev => ({ ...prev, count: flJ.length, list: flJ }))
    } catch {}
  }

  async function removeFollower(userId) {
    await fetch(`${API_BASE}/api/me/followers/${userId}/remove`, { method: 'POST', headers: { Authorization: 'Bearer ' + token } })
    refreshSocial()
  }

  async function unfollowUser(userId) {
    await fetch(`${API_BASE}/api/unfollow/${userId}`, { method: 'POST', headers: { Authorization: 'Bearer ' + token } })
    refreshSocial()
  }
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
      backgroundColor: '#1F1E1D',
      padding: '24px'
    }}>
      {/* Header Section with Avatar */}
      <div style={{
        backgroundColor: '#262624',
        borderRadius: '20px',
        padding: '40px',
        marginBottom: '24px',
        border: '1px solid #3A3937',
        textAlign: 'center'
      }}>
        {/* Large Circular Avatar */}
        <div style={{
          position: 'relative',
          display: 'inline-block',
          marginBottom: '24px'
        }}>
          <img 
            src={avatarUrl ? (avatarUrl.startsWith('http') ? avatarUrl : `${API_BASE}${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}`) : 'https://via.placeholder.com/160'} 
            alt="avatar" 
            style={{
              width: '160px',
              height: '160px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '4px solid #D97757',
              boxShadow: '0 8px 24px rgba(217, 119, 87, 0.2)'
            }}
          />
          
          {/* Change Avatar Button (Overlay) */}
          <label style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            width: '40px',
            height: '40px',
            backgroundColor: '#D97757',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            border: '3px solid #262624',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            transition: 'transform 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <span style={{ display: 'inline-flex' }}><Icon name="camera" size={18} color="#0a0a0a" /></span>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadAvatar} />
          </label>
        </div>

        {/* Username */}
        <h1 style={{
          fontSize: '32px',
          fontWeight: '800',
          color: '#F5F4EE',
          marginBottom: '8px'
        }}>
          @{name || profile?.email?.split('@')[0] || 'User'}
        </h1>

        {/* Role Badge */}
        <div style={{
          display: 'inline-block',
          padding: '6px 16px',
          backgroundColor: user.role === 'owner' ? '#dc2626' : 
                          user.role === 'trainer' ? '#f59e0b' : '#D97757',
          color: user.role === 'owner' || user.role === 'trainer' ? '#F5F4EE' : '#1F1E1D',
          borderRadius: '20px',
          fontSize: '13px',
          fontWeight: '700',
          textTransform: 'uppercase',
          marginBottom: '16px'
        }}>
          {user.role === 'owner' ? <span style={roleBadge}><Icon name="trophy" size={14} /> Gym Owner</span> :
           user.role === 'trainer' ? <span style={roleBadge}><Icon name="dumbbell" size={14} /> Trainer</span> : <span style={roleBadge}><Icon name="user" size={14} /> Member</span>}
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
              {Array.from({ length: Math.max(0, Math.floor(parseFloat(trainerRating) || 0)) }).map((_, i) => (
                <Icon key={i} name="star" size={16} color="#fbbf24" />
              ))}
            </div>
            <span style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#F5F4EE'
            }}>
              {trainerRating}
            </span>
            <span style={{
              fontSize: '14px',
              color: '#A6A29A'
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
            backgroundColor: isEditing ? '#3A3937' : '#D97757',
            color: isEditing ? '#F5F4EE' : '#1F1E1D',
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
          {isEditing ? <span style={roleBadge}><Icon name="close" size={15} /> Cancel Edit</span> : <span style={roleBadge}><Icon name="edit" size={15} /> Edit Profile</span>}
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
          backgroundColor: '#262624',
          borderRadius: '20px',
          padding: '32px',
          marginBottom: '24px',
          border: '1px solid #3A3937'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '800',
            color: '#D97757',
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
                color: '#A6A29A',
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
                  backgroundColor: '#1F1E1D',
                  color: '#F5F4EE',
                  border: '2px solid #3A3937',
                  borderRadius: '12px',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#D97757'}
                onBlur={(e) => e.target.style.borderColor = '#3A3937'}
              />
            </div>

            {/* Gym Selector */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#A6A29A',
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
                  backgroundColor: '#1F1E1D',
                  color: '#F5F4EE',
                  border: '2px solid #3A3937',
                  borderRadius: '12px',
                  fontSize: '15px',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#D97757'}
                onBlur={(e) => e.target.style.borderColor = '#3A3937'}
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
                color: '#A6A29A',
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
                  backgroundColor: '#1F1E1D',
                  color: '#F5F4EE',
                  border: '2px solid #3A3937',
                  borderRadius: '12px',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  lineHeight: '1.5'
                }}
                onFocus={(e) => e.target.style.borderColor = '#D97757'}
                onBlur={(e) => e.target.style.borderColor = '#3A3937'}
              />
            </div>

            {/* Privacy Checkbox */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px',
              backgroundColor: '#1F1E1D',
              borderRadius: '12px',
              border: '1px solid #3A3937'
            }}>
              <input
                type="checkbox"
                checked={allowShare}
                onChange={e => setAllowShare(e.target.checked)}
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: 'pointer',
                  accentColor: '#D97757'
                }}
              />
              <label style={{
                fontSize: '14px',
                color: '#D9D5CC',
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
                backgroundColor: '#D97757',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '9999px',
                fontSize: '16px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginTop: '8px'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#C4664A'
                e.target.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#D97757'
                e.target.style.transform = 'translateY(0)'
              }}
            >
              <span style={roleBadge}><Icon name="check" size={16} /> Save Changes</span>
            </button>
          </form>
        </div>
      )}

      {/* About Card */}
      <div style={{
        backgroundColor: '#262624',
        borderRadius: '20px',
        padding: '32px',
        marginBottom: '24px',
        border: '1px solid #3A3937'
      }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: '800',
          color: '#D97757',
          marginBottom: '16px'
        }}>
          About
        </h2>
        <p style={{
          fontSize: '15px',
          lineHeight: '1.7',
          color: '#D9D5CC',
          margin: 0
        }}>
          {bio || 'No bio yet. Click "Edit Profile" to add information about yourself!'}
        </p>
      </div>

      {/* Stats Card */}
      <div style={{
        backgroundColor: '#262624',
        borderRadius: '20px',
        padding: '32px',
        border: '1px solid #3A3937'
      }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: '800',
          color: '#D97757',
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
            backgroundColor: '#1F1E1D',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid #3A3937',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '8px' }}><Icon name="flame" size={30} color="#D97757" /></div>
            <div style={{
              fontSize: '28px',
              fontWeight: '800',
              color: '#F5F4EE',
              marginBottom: '4px'
            }}>
              {streaks.gym_streak ?? 0}
            </div>
            <div style={{
              fontSize: '13px',
              color: '#A6A29A',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: '600'
            }}>
              Gym Streak (days)
            </div>
          </div>

          {/* Diet Streak */}
          <div style={{
            backgroundColor: '#1F1E1D',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid #3A3937',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '8px' }}><Icon name="diet" size={30} color="#D97757" /></div>
            <div style={{
              fontSize: '28px',
              fontWeight: '800',
              color: '#F5F4EE',
              marginBottom: '4px'
            }}>
              {streaks.diet_streak ?? 0}
            </div>
            <div style={{
              fontSize: '13px',
              color: '#A6A29A',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: '600'
            }}>
              Diet Streak (days)
            </div>
          </div>

          {/* Reward Points */}
          <div style={{
            backgroundColor: '#1F1E1D',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid #3A3937',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '8px' }}><Icon name="trophy" size={30} color="#D97757" /></div>
            <div style={{
              fontSize: '28px',
              fontWeight: '800',
              color: '#D97757',
              marginBottom: '4px'
            }}>
              {points}
            </div>
            <div style={{
              fontSize: '13px',
              color: '#A6A29A',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: '600'
            }}>
              Reward Points
            </div>
          </div>

          {/* Followers */}
          <div style={{
            backgroundColor: '#1F1E1D',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid #3A3937',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '8px' }}><Icon name="users" size={30} color="#D97757" /></div>
            <div style={{
              fontSize: '28px',
              fontWeight: '800',
              color: '#F5F4EE',
              marginBottom: '4px'
            }} onClick={() => setFollowers(prev => ({ ...prev, open: !prev.open }))}>
              {followers.count}
            </div>
            <div style={{
              fontSize: '13px',
              color: '#A6A29A',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: '600'
            }}>
              Followers
            </div>
            {followers.open && (
              <div style={{ textAlign: 'left', marginTop: 12, maxHeight: 220, overflow: 'auto', display: 'grid', gap: 8 }}>
                {followers.list.map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#0f0f10', border: '1px solid #3A3937', borderRadius: 12, padding: 10 }}>
                    <img src={u.avatar_url ? (u.avatar_url.startsWith('http') ? u.avatar_url : `${API_BASE}${u.avatar_url.startsWith('/') ? '' : '/'}${u.avatar_url}`) : 'https://via.placeholder.com/32'} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                    <div style={{ flex: 1, color: '#F5F4EE', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || `User #${u.id}`}</div>
                    <button onClick={() => removeFollower(u.id)} className="btn-secondary rounded-full" style={{ padding: '6px 10px' }}>Remove</button>
                  </div>
                ))}
                {followers.list.length === 0 && <div className="text-secondary">No followers yet.</div>}
              </div>
            )}
          </div>

          {/* Following */}
          <div style={{
            backgroundColor: '#1F1E1D',
            padding: '20px',
            borderRadius: '16px',
            border: '1px solid #3A3937',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '8px' }}><Icon name="heart" size={30} color="#D97757" /></div>
            <div style={{
              fontSize: '28px',
              fontWeight: '800',
              color: '#F5F4EE',
              marginBottom: '4px'
            }} onClick={() => setFollowing(prev => ({ ...prev, open: !prev.open }))}>
              {following.count}
            </div>
            <div style={{
              fontSize: '13px',
              color: '#A6A29A',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: '600'
            }}>
              Following
            </div>
            {following.open && (
              <div style={{ textAlign: 'left', marginTop: 12, maxHeight: 220, overflow: 'auto', display: 'grid', gap: 8 }}>
                {following.list.map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#0f0f10', border: '1px solid #3A3937', borderRadius: 12, padding: 10 }}>
                    <img src={u.avatar_url ? (u.avatar_url.startsWith('http') ? u.avatar_url : `${API_BASE}${u.avatar_url.startsWith('/') ? '' : '/'}${u.avatar_url}`) : 'https://via.placeholder.com/32'} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                    <div style={{ flex: 1, color: '#F5F4EE', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || `User #${u.id}`}</div>
                    <button onClick={() => unfollowUser(u.id)} className="btn-secondary rounded-full" style={{ padding: '6px 10px' }}>Unfollow</button>
                  </div>
                ))}
                {following.list.length === 0 && <div className="text-secondary">You aren’t following anyone yet.</div>}
              </div>
            )}
          </div>

          {/* Experience (for trainers) */}
          {isTrainer && (
            <div style={{
              backgroundColor: '#1F1E1D',
              padding: '20px',
              borderRadius: '16px',
              border: '1px solid #3A3937',
              textAlign: 'center'
            }}>
              <div style={{ marginBottom: '8px' }}><Icon name="star" size={30} color="#D97757" /></div>
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
                color: '#A6A29A',
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
