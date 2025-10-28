import React, { useEffect, useState } from 'react'
import { API_BASE } from './api'
import Logo from './components/Logo'
import { APP_NAME } from './branding'
import Profile from './Profile'
import AdminPanel from './AdminPanel'
import MemberHome from './MemberHome'
import Diet from './Diet'
import Feed from './Feed'
import MyBookingsNew from './MyBookingsNew'
import EquipmentSlots from './EquipmentSlots'
import Rewards from './Rewards'
import HomeWorkout from './HomeWorkout'
import TrainerDashboard from './TrainerDashboard'
import MyPayments from './MyPayments'
import ContactFooter from './ContactFooter'
import NotificationsBell from './NotificationsBell'
import BrowseEquipment from './BrowseEquipment'

function parseJwt(token) {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload))
  } catch (e) {
    return {}
  }
}

// Circular Progress Ring Component
function CircularProgress({ percentage, label, value, color = '#D0FD3E' }) {
  const size = 120
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#3f3f46"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
        {/* Center text */}
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dy="0.3em"
          fill="#fafafa"
          fontSize="24"
          fontWeight="700"
          transform={`rotate(90 ${size/2} ${size/2})`}
        >
          {value}
        </text>
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#fafafa', fontSize: '14px', fontWeight: '600' }}>{label}</div>
        <div style={{ color: '#a1a1aa', fontSize: '12px' }}>{Math.round(percentage)}%</div>
      </div>
    </div>
  )
}

export default function Dashboard({ token, onLogout }) {
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState(null)
  const [view, setView] = useState('home')
  const [selectedEquipment, setSelectedEquipment] = useState(null)
  const [streaks, setStreaks] = useState(null)
  const [points, setPoints] = useState(0)
  const [recentBookings, setRecentBookings] = useState([])
  const payload = parseJwt(token)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/profile`, {
          headers: { Authorization: 'Bearer ' + token }
        })
        const data = await res.json()
        if (!res.ok) {
          // If token is invalid/expired, force logout to fix refresh error states
          if (res.status === 401) {
            onLogout?.()
            return
          }
          throw new Error(data.error || 'Failed to fetch')
        }
        setProfile(data)
        
        // Load streaks data
        try {
          const streaksRes = await fetch(`${API_BASE}/api/me/streaks`, {
            headers: { Authorization: 'Bearer ' + token }
          })
          if (streaksRes.ok) {
            const streaksData = await streaksRes.json()
            setStreaks(streaksData)
          }
        } catch {}
        
        // Load points
        try {
          const pointsRes = await fetch(`${API_BASE}/api/me/points`, {
            headers: { Authorization: 'Bearer ' + token }
          })
          if (pointsRes.ok) {
            const pointsData = await pointsRes.json()
            setPoints(pointsData.points || 0)
          }
        } catch {}
        
        // Load recent bookings
        try {
          const bookingsRes = await fetch(`${API_BASE}/api/bookings/my`, {
            headers: { Authorization: 'Bearer ' + token }
          })
          if (bookingsRes.ok) {
            const bookingsData = await bookingsRes.json()
            setRecentBookings(bookingsData.slice(0, 3) || [])
          }
        } catch {}
      } catch (err) {
        setError(err.message)
      }
    }
    load()
  }, [token])

  const navButtonStyle = (isActive) => ({
    backgroundColor: isActive ? '#D0FD3E' : '#27272a',
    color: isActive ? '#000' : '#fafafa',
    border: isActive ? 'none' : '1px solid #52525b',
    padding: '10px 20px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    marginLeft: '8px'
  })

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#18181b', padding: '24px' }}>
      {/* Top Navigation Bar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '32px',
        padding: '16px 24px',
        backgroundColor: '#27272a',
        borderRadius: '20px',
        border: '1px solid #3f3f46'
      }}>
        <div>
          <Logo size={28} withText={true} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <button style={navButtonStyle(view === 'home')} onClick={() => setView('home')}>Home</button>
          <button style={navButtonStyle(view === 'profile')} onClick={() => setView('profile')}>Profile</button>
          <button style={navButtonStyle(view === 'browse')} onClick={() => setView('browse')}>Browse</button>
          {payload.role === 'owner' && <button style={navButtonStyle(view === 'admin')} onClick={() => setView('admin')}>Admin</button>}
          {payload.role === 'member' && <button style={navButtonStyle(view === 'member')} onClick={() => setView('member')}>Member</button>}
          {payload.role === 'member' && <button style={navButtonStyle(view === 'payments')} onClick={() => setView('payments')}>Payments</button>}
          {payload.role === 'trainer' && <button style={navButtonStyle(view === 'trainer')} onClick={() => setView('trainer')}>Trainer</button>}
          <button style={navButtonStyle(view === 'myBookingsNew')} onClick={() => setView('myBookingsNew')}>Bookings</button>
          <button style={navButtonStyle(view === 'diet')} onClick={() => setView('diet')}>Diet</button>
          <button style={navButtonStyle(view === 'feed')} onClick={() => setView('feed')}>Feed</button>
          <button style={navButtonStyle(view === 'rewards')} onClick={() => setView('rewards')}>Rewards</button>
          <button style={navButtonStyle(view === 'homeWorkout')} onClick={() => setView('homeWorkout')}>Workout</button>
          <NotificationsBell token={token} />
          <button style={{ ...navButtonStyle(false), backgroundColor: '#ef4444', border: 'none' }} onClick={onLogout}>Logout</button>
        </div>
      </div>

      {error && <p style={{ color: '#ef4444', padding: '12px', backgroundColor: '#27272a', borderRadius: '12px' }}>{error}</p>}

      {/* Home View with Daily Activity */}
      {view === 'home' && (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Welcome Header */}
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '36px', fontWeight: '800', color: '#fafafa', marginBottom: '8px' }}>
              Hello, {profile?.name || profile?.email || 'User'}! 👋
            </h1>
            <p style={{ color: '#a1a1aa', fontSize: '16px' }}>Ready to crush your fitness goals today?</p>
          </div>

          {/* Daily Activity Card */}
          <div style={{
            backgroundColor: '#27272a',
            borderRadius: '20px',
            padding: '32px',
            border: '1px solid #3f3f46',
            marginBottom: '24px'
          }}>
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#fafafa', marginBottom: '4px' }}>
                Your Progress
              </h3>
              <p style={{ color: '#a1a1aa', fontSize: '14px' }}>Track your streaks and points</p>
            </div>

            {/* Circular Progress Rings */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '32px',
              justifyItems: 'center'
            }}>
              <CircularProgress 
                percentage={streaks ? Math.min((streaks.gym_streak / 30) * 100, 100) : 0}
                label="Gym Streak"
                value={streaks ? `${streaks.gym_streak}d` : '0d'}
                color="#D0FD3E"
              />
              <CircularProgress 
                percentage={streaks ? Math.min((streaks.diet_streak / 30) * 100, 100) : 0}
                label="Diet Streak"
                value={streaks ? `${streaks.diet_streak}d` : '0d'}
                color="#D0FD3E"
              />
              <CircularProgress 
                percentage={points > 0 ? Math.min((points / 1000) * 100, 100) : 0}
                label="Points"
                value={points}
                color="#D0FD3E"
              />
            </div>
          </div>

          {/* Workouts/Bookings Section */}
          <div style={{
            backgroundColor: '#27272a',
            borderRadius: '20px',
            padding: '32px',
            border: '1px solid #3f3f46'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#fafafa' }}>Recent Bookings</h3>
              <button 
                onClick={() => setView('myBookingsNew')}
                style={{
                  background: 'transparent',
                  color: '#D0FD3E',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  padding: '8px 16px'
                }}
              >
                See All →
              </button>
            </div>
            {recentBookings.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {recentBookings.map((booking, idx) => (
                  <div key={idx} style={{
                    padding: '16px',
                    backgroundColor: '#3f3f46',
                    borderRadius: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ color: '#fafafa', fontWeight: '600', marginBottom: '4px' }}>
                        {booking.equipment_name || 'Equipment'}
                      </div>
                      <div style={{ color: '#a1a1aa', fontSize: '12px' }}>
                        {booking.slot_date} at {booking.slot_time}
                      </div>
                    </div>
                    <div style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      backgroundColor: booking.status === 'confirmed' ? '#065f46' : '#713f12',
                      color: booking.status === 'confirmed' ? '#6ee7b7' : '#fcd34d',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      {booking.status || 'pending'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#a1a1aa', fontSize: '14px' }}>
                No bookings yet. Book equipment slots to track your workouts!
              </p>
            )}
          </div>
        </div>
      )}

      {/* Other Views */}
      {view === 'profile' && <Profile token={token} profile={profile} onUpdate={setProfile} />}
      {view === 'browse' && <BrowseEquipment token={token} />}
      {view === 'admin' && payload.role === 'owner' && <AdminPanel token={token} />}
      {view === 'member' && payload.role === 'member' && <MemberHome token={token} defaultGymId={profile?.gym_id} />}
      {view === 'myBookingsNew' && <MyBookingsNew token={token} />}
      {view === 'diet' && <Diet token={token} />}
      {view === 'feed' && <Feed token={token} />}
      {view === 'rewards' && <Rewards token={token} />}
      {view === 'homeWorkout' && <HomeWorkout token={token} />}
      {view === 'trainer' && payload.role === 'trainer' && <TrainerDashboard token={token} />}
      {view === 'payments' && payload.role === 'member' && <MyPayments token={token} />}

      {/* Contact & Help Footer - Shows on all pages */}
      <ContactFooter />
    </div>
  )
}
