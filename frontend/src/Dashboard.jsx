import React, { useEffect, useRef, useState } from 'react'
import { motion, animate, useReducedMotion } from 'motion/react'
import { API_BASE } from './api'
import Logo from './components/Logo'
import Icon from './components/Icon'
import Coach from './Coach'
import { APP_NAME } from './branding'
import Profile from './Profile'
import ManagerDashboard from './ManagerDashboard'
import MemberHome from './MemberHome'
import Diet from './Diet'
import Feed from './Feed'
import MyBookingsNew from './MyBookingsNew'
import EquipmentSlots from './EquipmentSlots'
import Rewards from './Rewards'
import HomeWorkout from './HomeWorkout'
import MyPayments from './MyPayments'
import ContactFooter from './ContactFooter'
import NotificationsBell from './NotificationsBell'
import BrowseEquipment from './BrowseEquipment'

const ACCENT = '#D0FD3E'
// Framewright easing: fast start, long decel to rest (easeOutExpo-ish)
const EASE = [0.22, 1, 0.36, 1]

// Weighty entrance with a single restrained overshoot (never a bounce)
const SPRING = { type: 'spring', stiffness: 120, damping: 18, mass: 0.9 }
const containerVar = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } }
const itemVar = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: SPRING } }

function parseJwt(token) {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload))
  } catch (e) {
    return {}
  }
}

// Count a number up to its target once, driven by motion (respects reduced-motion)
function CountUp({ to, duration = 1.2, format = (v) => Math.round(v).toString() }) {
  const ref = useRef(null)
  const reduce = useReducedMotion()
  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (reduce) { node.textContent = format(to); return }
    const controls = animate(0, to, {
      duration,
      ease: EASE,
      onUpdate: (v) => { node.textContent = format(v) },
    })
    return () => controls.stop()
  }, [to, duration, reduce])
  return <span ref={ref}>{format(reduce ? to : 0)}</span>
}

// Circular progress ring — the arc draws itself once, no perpetual motion at rest
function CircularProgress({ percentage, label, value, color = ACCENT }) {
  const size = 132
  const strokeWidth = 9
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference
  const reduce = useReducedMotion()

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px',
      width: '100%', padding: '22px 16px', borderRadius: 18,
      background: 'var(--neu-base)', boxShadow: 'var(--neu-raised)',
    }}>
      {/* Ring nested in a soft pressed well (neumorphism) */}
      <div style={{
        position: 'relative', width: size, height: size, borderRadius: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'var(--neu-pressed)',
      }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: reduce ? offset : circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.3, ease: EASE, delay: 0.1 }}
            style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
          />
        </svg>
        {/* Center value — sharp, level, still (framewright: readable content never moves) */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 700, color: '#fafafa', letterSpacing: '-0.02em',
        }}>
          {typeof value === 'number'
            ? <CountUp to={value} />
            : <span><CountUp to={parseInt(value) || 0} format={(v) => `${Math.round(v)}d`} /></span>}
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#fafafa', fontSize: '14px', fontWeight: 600 }}>{label}</div>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', marginTop: 2 }}>{Math.round(Math.min(percentage, 100))}% of goal</div>
      </div>
    </div>
  )
}

export default function Dashboard({ token, onLogout }) {
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState(null)
  const payload = parseJwt(token)
  const [view, setView] = useState(payload.role === 'manager' ? 'manager-overview' : 'home')
  const [selectedEquipment, setSelectedEquipment] = useState(null)
  const [streaks, setStreaks] = useState(null)
  const [points, setPoints] = useState(0)
  const [recentBookings, setRecentBookings] = useState([])

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/profile`, {
          headers: { Authorization: 'Bearer ' + token }
        })
        const data = await res.json()
        if (!res.ok) {
          if (res.status === 401) {
            onLogout?.()
            return
          }
          throw new Error(data.error || 'Failed to fetch')
        }
        setProfile(data)

        try {
          const streaksRes = await fetch(`${API_BASE}/api/me/streaks`, {
            headers: { Authorization: 'Bearer ' + token }
          })
          if (streaksRes.ok) setStreaks(await streaksRes.json())
        } catch {}

        try {
          const pointsRes = await fetch(`${API_BASE}/api/me/points`, {
            headers: { Authorization: 'Bearer ' + token }
          })
          if (pointsRes.ok) {
            const pointsData = await pointsRes.json()
            setPoints(pointsData.points || 0)
          }
        } catch {}

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
    backgroundColor: isActive ? ACCENT : 'transparent',
    color: isActive ? '#0a0a0a' : 'rgba(255,255,255,0.62)',
    border: '1px solid ' + (isActive ? 'transparent' : 'transparent'),
    padding: '11px 14px',
    borderRadius: '10px',
    fontSize: '14.5px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color .2s ease, color .2s ease',
    textAlign: 'left',
    width: '100%',
    boxShadow: isActive ? 'var(--accent-glow)' : 'none',
  })

  const navHover = (e, isActive) => {
    if (isActive) return
    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'
    e.currentTarget.style.color = '#fafafa'
  }
  const navLeave = (e, isActive) => {
    if (isActive) return
    e.currentTarget.style.backgroundColor = 'transparent'
    e.currentTarget.style.color = 'rgba(255,255,255,0.62)'
  }

  const NAV_ICONS = {
    home: 'home', coach: 'robot', profile: 'user', browse: 'search', member: 'users', payments: 'card',
    myBookingsNew: 'calendar', diet: 'diet', feed: 'feed', rewards: 'gift', homeWorkout: 'dumbbell',
    'manager-overview': 'grid', 'manager-equipment': 'box', 'manager-members': 'users',
    'manager-feed': 'feed', 'manager-leaderboard': 'trophy',
  }

  const NavBtn = ({ id, children }) => {
    const active = view === id
    return (
      <button
        style={{ ...navButtonStyle(active), display: 'flex', alignItems: 'center', gap: 11 }}
        onClick={() => setView(id)}
        onMouseEnter={(e) => navHover(e, active)}
        onMouseLeave={(e) => navLeave(e, active)}
      >
        <span style={{ display: 'inline-flex', width: 20, justifyContent: 'center', color: active ? '#0a0a0a' : ACCENT }}>
          <Icon name={NAV_ICONS[id]} size={18} />
        </span>
        {children}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Side Navigation Bar (glass) */}
      <div className="glass" style={{
        width: '264px',
        display: 'flex',
        flexDirection: 'column',
        padding: '22px 18px',
        borderRadius: 0,
        borderRight: '1px solid var(--glass-border)',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
        boxSizing: 'border-box',
      }}>
        <div style={{ marginBottom: '32px', paddingLeft: '8px' }}>
          <Logo size={28} withText={true} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, overflowY: 'auto' }}>
          {payload.role !== 'manager' && <NavBtn id="home">Home</NavBtn>}
          {payload.role !== 'manager' && <NavBtn id="coach">AI Coach</NavBtn>}
          <NavBtn id="profile">Profile</NavBtn>
          {payload.role !== 'manager' && <NavBtn id="browse">Browse</NavBtn>}
          {payload.role === 'manager' && (
            <>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, padding: '14px 14px 4px 14px', textTransform: 'uppercase', letterSpacing: 1.2 }}>Manager</div>
              <NavBtn id="manager-overview">Overview</NavBtn>
              <NavBtn id="manager-equipment">Equipment</NavBtn>
              <NavBtn id="manager-members">Members &amp; Payments</NavBtn>
              <NavBtn id="manager-feed">Social Feed</NavBtn>
              <NavBtn id="manager-leaderboard">Gym Leaderboard</NavBtn>
            </>
          )}
          {payload.role === 'member' && <NavBtn id="member">Member</NavBtn>}
          {payload.role === 'member' && <NavBtn id="payments">Payments</NavBtn>}
          {payload.role !== 'manager' && <NavBtn id="myBookingsNew">Bookings</NavBtn>}
          {payload.role !== 'manager' && <NavBtn id="diet">Diet</NavBtn>}
          {payload.role !== 'manager' && <NavBtn id="feed">Feed</NavBtn>}
          {payload.role !== 'manager' && <NavBtn id="rewards">Rewards</NavBtn>}
          {payload.role !== 'manager' && <NavBtn id="homeWorkout">Workout</NavBtn>}

          <div style={{ marginTop: 'auto', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ paddingLeft: '8px' }}>
              <NotificationsBell token={token} />
            </div>
            <button
              style={{ ...navButtonStyle(false), display: 'flex', alignItems: 'center', gap: 11, backgroundColor: 'rgba(239,68,68,0.14)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)' }}
              onClick={onLogout}
            >
              <span style={{ display: 'inline-flex', width: 20, justifyContent: 'center' }}>
                <Icon name="logout" size={18} />
              </span>
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, padding: '36px clamp(20px, 4vw, 44px)', overflowY: 'auto', height: '100vh', boxSizing: 'border-box' }}>
        {error && <p style={{ color: '#fca5a5', padding: '12px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '12px', marginBottom: '24px' }}>{error}</p>}

        {/* Home View */}
        {view === 'home' && (
          <motion.div
            variants={containerVar}
            initial="hidden"
            animate="show"
            style={{ maxWidth: '1200px', margin: '0 auto' }}
          >
            {/* Welcome Header */}
            <motion.div variants={itemVar} style={{ marginBottom: '30px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 9999, background: 'rgba(208,253,62,0.10)', border: '1px solid rgba(208,253,62,0.22)', marginBottom: 16 }}>
                <span style={{ width: 6, height: 6, borderRadius: 9999, background: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }} />
                <span style={{ color: ACCENT, fontSize: 12, fontWeight: 600, letterSpacing: 0.3 }}>Today's session</span>
              </div>
              <h1 className="font-display" style={{ fontSize: 'clamp(30px, 4vw, 44px)', fontWeight: 700, color: '#fafafa', marginBottom: '8px', lineHeight: 1.08 }}>
                Hello, {profile?.name || profile?.email?.split('@')[0] || 'there'}.
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '16px' }}>Ready to crush your fitness goals today?</p>
            </motion.div>

            {/* Progress Card */}
            <motion.div variants={itemVar} className="glass" style={{ borderRadius: '20px', padding: '28px', marginBottom: '22px' }}>
              <div style={{ marginBottom: '24px' }}>
                <h3 className="font-display" style={{ fontSize: '19px', fontWeight: 600, color: '#fafafa', marginBottom: '4px' }}>Your Progress</h3>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13.5px' }}>Streaks and points, updated in real time</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px', justifyItems: 'center' }}>
                <CircularProgress percentage={streaks ? Math.min((streaks.gym_streak / 30) * 100, 100) : 0} label="Gym Streak" value={`${streaks?.gym_streak || 0}d`} />
                <CircularProgress percentage={streaks ? Math.min((streaks.diet_streak / 30) * 100, 100) : 0} label="Diet Streak" value={`${streaks?.diet_streak || 0}d`} />
                <CircularProgress percentage={points > 0 ? Math.min((points / 1000) * 100, 100) : 0} label="Points" value={points} />
              </div>
            </motion.div>

            {/* Recent Bookings */}
            <motion.div variants={itemVar} className="glass" style={{ borderRadius: '20px', padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <h3 className="font-display" style={{ fontSize: '19px', fontWeight: 600, color: '#fafafa' }}>Recent Bookings</h3>
                <button onClick={() => setView('myBookingsNew')} style={{ background: 'transparent', color: ACCENT, border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer', padding: '6px 10px' }}>
                  See all →
                </button>
              </div>
              {recentBookings.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {recentBookings.map((booking, idx) => {
                    const confirmed = booking.status === 'confirmed'
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ...SPRING, delay: 0.2 + idx * 0.06 }}
                        style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <div>
                          <div style={{ color: '#fafafa', fontWeight: 600, marginBottom: '3px' }}>{booking.equipment_name || 'Equipment'}</div>
                          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12.5px' }}>{booking.slot_date} at {booking.slot_time}</div>
                        </div>
                        {/* Status chip: dot + label, tinted border, meaning by colour */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 9999, background: confirmed ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', border: `1px solid ${confirmed ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`, color: confirmed ? '#6ee7b7' : '#fcd34d', fontSize: '12px', fontWeight: 600 }}>
                          <span style={{ width: 6, height: 6, borderRadius: 9999, background: confirmed ? '#34d399' : '#fbbf24' }} />
                          {booking.status || 'pending'}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              ) : (
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>No bookings yet. Book equipment slots to track your workouts!</p>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* Other Views */}
        {view === 'coach' && <Coach token={token} profile={profile} streaks={streaks} points={points} bookings={recentBookings} />}
        {view === 'profile' && <Profile token={token} profile={profile} onUpdate={setProfile} />}
        {view === 'browse' && <BrowseEquipment token={token} />}
        {view.startsWith('manager-') && <ManagerDashboard token={token} activeTabProp={view.replace('manager-', '')} />}
        {view === 'member' && payload.role === 'member' && <MemberHome token={token} defaultGymId={profile?.gym_id} />}
        {view === 'myBookingsNew' && <MyBookingsNew token={token} />}
        {view === 'diet' && <Diet token={token} />}
        {view === 'feed' && <Feed token={token} />}
        {view === 'rewards' && <Rewards token={token} />}
        {view === 'homeWorkout' && <HomeWorkout token={token} />}
        {view === 'payments' && payload.role === 'member' && <MyPayments token={token} />}

        {/* Contact & Help Footer - Shows on all pages */}
        <ContactFooter />
      </div>
    </div>
  )
}
