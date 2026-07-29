import React, { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { API_BASE } from './api'
import Icon from './components/Icon'
import Coach from './Coach'
import { APP_NAME } from './branding'
import Profile from './Profile'
import ManagerDashboard from './ManagerDashboard'
import MemberHome from './MemberHome'
import Diet from './Diet'
import Feed from './Feed'
import MyBookingsNew from './MyBookingsNew'
import Rewards from './Rewards'
import HomeWorkout from './HomeWorkout'
import MyPayments from './MyPayments'
import NotificationsBell from './NotificationsBell'
import BrowseEquipment from './BrowseEquipment'
import { Toaster } from './toast'

const ACCENT = '#D97757'
const SPRING = { type: 'spring', stiffness: 120, damping: 18, mass: 0.9 }
const containerVar = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } }
const itemVar = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: SPRING } }

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]))
  } catch (e) {
    return {}
  }
}

// KPI card — mock spec: horizontal, 104px ring (stroke 8) left, copy + chip right
function StatCard({ value, unit, title, subtitle, pct, chip, chipAccent }) {
  const C = 2 * Math.PI * 44
  const dash = Math.max(0, Math.min(1, pct)) * C
  return (
    <div className="card" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ position: 'relative', width: 104, height: 104, flex: '0 0 104px' }}>
        <svg width="104" height="104" viewBox="0 0 104 104" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="52" cy="52" r="44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <motion.circle
            cx="52" cy="52" r="44" fill="none" stroke={ACCENT} strokeWidth="8" strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${C}` }}
            animate={{ strokeDasharray: `${dash} ${C}` }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <div className="font-display" style={{ fontSize: 30, lineHeight: 1, letterSpacing: '-0.02em', color: '#F5F4EE' }}>{value}</div>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#A6A29A' }}>{unit}</div>
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: '#F5F4EE' }}>{title}</div>
        <div style={{ fontSize: 13, lineHeight: 1.55, color: '#A6A29A', marginTop: 5 }}>{subtitle}</div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12, fontWeight: 500,
          color: chipAccent ? ACCENT : '#A6A29A',
          background: chipAccent ? 'rgba(217,119,87,0.12)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${chipAccent ? 'rgba(217,119,87,0.3)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 999, padding: '4px 9px',
        }}>
          {chipAccent && <Icon name="trendUp" size={12} strokeWidth={2} />}
          <span>{chip}</span>
        </div>
      </div>
    </div>
  )
}

// Status pill per mock: confirmed = coral-tinted, else neutral
function StatusPill({ status }) {
  const s = (status || 'pending').toLowerCase()
  const confirmed = s === 'confirmed'
  const done = s === 'completed' || s === 'cancelled'
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 999,
      background: confirmed ? 'rgba(217,119,87,0.12)' : done ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.05)',
      border: `1px solid ${confirmed ? 'rgba(217,119,87,0.3)' : done ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.08)'}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: confirmed ? ACCENT : `rgba(245,244,238,${done ? 0.28 : 0.45})` }} />
      <span style={{ fontSize: 12.5, fontWeight: 500, color: confirmed ? 'var(--coral-tint-text)' : '#A6A29A', textTransform: 'capitalize' }}>{s}</span>
    </div>
  )
}

export default function Dashboard({ token, onLogout }) {
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState(null)
  const payload = parseJwt(token)
  const [view, setView] = useState(payload.role === 'manager' ? 'manager-overview' : 'home')
  const [streaks, setStreaks] = useState(null)
  const [points, setPoints] = useState(0)
  const [recentBookings, setRecentBookings] = useState([])

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/profile`, { headers: { Authorization: 'Bearer ' + token } })
        const data = await res.json()
        if (!res.ok) {
          if (res.status === 401) { onLogout?.(); return }
          throw new Error(data.error || 'Failed to fetch')
        }
        setProfile(data)
        try {
          const r = await fetch(`${API_BASE}/api/me/streaks`, { headers: { Authorization: 'Bearer ' + token } })
          if (r.ok) setStreaks(await r.json())
        } catch {}
        try {
          const r = await fetch(`${API_BASE}/api/me/points`, { headers: { Authorization: 'Bearer ' + token } })
          if (r.ok) { const j = await r.json(); setPoints(j.points || 0) }
        } catch {}
        try {
          const r = await fetch(`${API_BASE}/api/bookings/my`, { headers: { Authorization: 'Bearer ' + token } })
          if (r.ok) { const j = await r.json(); setRecentBookings(j.slice(0, 5) || []) }
        } catch {}
      } catch (err) {
        setError(err.message)
      }
    }
    load()
  }, [token])

  const isManager = payload.role === 'manager'
  const name = profile?.name?.split(' ')[0] || profile?.email?.split('@')[0] || 'there'
  const initials = ((profile?.name || profile?.email || 'FB').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2)).toUpperCase()
  const gymStreak = streaks?.gym_streak || 0
  const dietStreak = streaks?.diet_streak || 0
  const hour = new Date().getHours()
  const dayPart = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  // Sidebar nav item (mock spec)
  const NavBtn = ({ id, icon, children, badge }) => {
    const active = view === id
    return (
      <button
        onClick={() => setView(id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '9px 12px', border: 0,
          borderRadius: 10, fontSize: 14, fontWeight: 500, letterSpacing: '-0.01em', textAlign: 'left', cursor: 'pointer',
          background: active ? ACCENT : 'transparent', color: active ? '#FFFFFF' : '#A6A29A',
          transition: 'background-color .15s ease, color .15s ease',
        }}
        onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#F5F4EE' } }}
        onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#A6A29A' } }}
      >
        <Icon name={icon} size={19} strokeWidth={1.5} />
        <span>{children}</span>
        {badge != null && badge > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 600, color: '#A6A29A', background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '2px 6px' }}>{badge}</span>
        )}
      </button>
    )
  }

  const SectionLabel = ({ children, first }) => (
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.11em', textTransform: 'uppercase', color: 'var(--text-tertiary)', padding: `${first ? 0 : 20}px 12px 8px` }}>{children}</div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Toaster />
      {/* ── Sidebar (mock: 246px, #211F1E, sectioned) ─────────────────── */}
      <aside style={{
        width: 246, flex: '0 0 246px', borderRight: '1px solid var(--hairline)', padding: '26px 16px 22px',
        display: 'flex', flexDirection: 'column', gap: 26, background: '#211F1E',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto', boxSizing: 'border-box', zIndex: 2,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '0 8px' }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 0 rgba(255,255,255,0.22) inset', flexShrink: 0 }}>
            <Icon name="dumbbell" size={17} color="#FFFFFF" strokeWidth={1.7} />
          </div>
          <div className="font-display" style={{ fontSize: 19, fontWeight: 500, letterSpacing: '-0.01em', color: '#F5F4EE' }}>{APP_NAME}</div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          <SectionLabel first>Overview</SectionLabel>
          {!isManager && <NavBtn id="home" icon="home">Home</NavBtn>}
          {!isManager && <NavBtn id="coach" icon="chatPlus">AI Coach</NavBtn>}
          <NavBtn id="profile" icon="user">Profile</NavBtn>

          {isManager ? (
            <>
              <SectionLabel>Manager</SectionLabel>
              <NavBtn id="manager-overview" icon="grid">Overview</NavBtn>
              <NavBtn id="manager-equipment" icon="box">Equipment</NavBtn>
              <NavBtn id="manager-members" icon="users">Members &amp; Payments</NavBtn>
              <NavBtn id="manager-feed" icon="feed">Social Feed</NavBtn>
              <NavBtn id="manager-leaderboard" icon="trophy">Gym Leaderboard</NavBtn>
            </>
          ) : (
            <>
              <SectionLabel>Gym</SectionLabel>
              <NavBtn id="browse" icon="search">Browse</NavBtn>
              {payload.role === 'member' && <NavBtn id="member" icon="users">Member</NavBtn>}
              {payload.role === 'member' && <NavBtn id="payments" icon="card">Payments</NavBtn>}
              <NavBtn id="myBookingsNew" icon="calendar" badge={recentBookings.length}>Bookings</NavBtn>
              <NavBtn id="diet" icon="diet">Diet</NavBtn>

              <SectionLabel>Community</SectionLabel>
              <NavBtn id="feed" icon="feed">Feed</NavBtn>
              <NavBtn id="rewards" icon="gift">Rewards</NavBtn>
              <NavBtn id="homeWorkout" icon="dumbbell">Workout</NavBtn>
            </>
          )}
        </nav>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Membership card (mock) */}
          {!isManager && (
            <div style={{ border: '1px solid var(--hairline)', background: 'var(--panel)', borderRadius: 14, padding: '13px 14px', boxShadow: '0 1px 0 rgba(255,255,255,0.05) inset' }}>
              <div style={{ fontSize: 12.5, color: '#A6A29A', lineHeight: 1.5 }}>Membership</div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginTop: 3 }}>
                <div className="font-display" style={{ fontSize: 17, color: '#F5F4EE' }}>{profile?.gym_id ? 'Active' : 'No gym yet'}</div>
                <a href="#" onClick={e => { e.preventDefault(); setView(payload.role === 'member' ? 'payments' : 'browse') }} style={{ fontSize: 12.5, fontWeight: 500 }}>Manage</a>
              </div>
            </div>
          )}
          {/* User row (mock) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '6px 8px' }}>
            <div className="font-display" style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--tile)', border: '1px solid rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, color: '#F5F4EE', flexShrink: 0 }}>{initials}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500, letterSpacing: '-0.01em', color: '#F5F4EE', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.name || profile?.email || '—'}</div>
              <div style={{ fontSize: 12, color: '#A6A29A', textTransform: 'capitalize' }}>{payload.role || 'member'}</div>
            </div>
            <button
              onClick={onLogout} title="Log out"
              style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 0, background: 'transparent', color: '#A6A29A', borderRadius: 8, cursor: 'pointer', padding: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#F5F4EE' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#A6A29A' }}
            >
              <Icon name="logout" size={17} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, minWidth: 0, height: '100vh', overflowY: 'auto', boxSizing: 'border-box' }}>
        {error && <p style={{ color: '#fca5a5', padding: '12px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, margin: '24px 48px 0' }}>{error}</p>}

        {view === 'home' && (
          <motion.div variants={containerVar} initial="hidden" animate="show" style={{ padding: '40px 48px 56px', display: 'flex', flexDirection: 'column', gap: 36 }}>
            {/* Header (mock) */}
            <motion.header variants={itemVar} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#A6A29A' }}>{today}</div>
                <h1 className="font-display" style={{ margin: '12px 0 0', fontSize: 44, lineHeight: 1.08, letterSpacing: '-0.02em', color: '#F5F4EE' }}>
                  Good {dayPart}, {name}.{' '}
                  {gymStreak > 0
                    ? <><span style={{ fontStyle: 'italic', color: ACCENT }}>{gymStreak} day{gymStreak === 1 ? '' : 's'}</span> in a row.</>
                    : <span style={{ fontStyle: 'italic', color: ACCENT }}>Let’s get moving.</span>}
                </h1>
                <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.6, color: '#A6A29A', maxWidth: 560 }}>
                  {gymStreak > 0
                    ? 'Two more sessions this week keeps your streak alive and unlocks the next points tier.'
                    : 'Book a session or log a meal to start your streak today.'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <NotificationsBell token={token} />
                <button
                  onClick={() => setView('coach')}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 17px', borderRadius: 11, border: 0, background: ACCENT, color: '#FFFFFF', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--coral-btn-shadow)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = ACCENT}
                >
                  <Icon name="plus" size={17} strokeWidth={1.6} />
                  <span>Plan today</span>
                </button>
              </div>
            </motion.header>

            {/* KPI cards (mock: horizontal ring cards) */}
            <motion.section variants={itemVar} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
              <StatCard value={gymStreak} unit="days" title="Gym streak" subtitle={`${gymStreak} of 7 target days`} pct={gymStreak / 7}
                chip={gymStreak >= 5 ? 'Personal best' : 'Book your next session'} chipAccent={gymStreak >= 5} />
              <StatCard value={dietStreak} unit="days" title="Diet streak" subtitle={dietStreak > 0 ? `Logged ${dietStreak} day${dietStreak === 1 ? '' : 's'} running` : 'No meals logged yet'} pct={dietStreak / 7}
                chip="Log lunch by 2 PM" />
              <StatCard value={points} unit="points" title="Reward points" subtitle={`${Math.max(0, 200 - points)} to the next tier`} pct={points / 200}
                chip="Redeem a guest pass" />
            </motion.section>

            {/* Recent bookings (mock: list section) */}
            <motion.section variants={itemVar} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '22px 26px 18px', borderBottom: '1px solid var(--hairline)' }}>
                <div>
                  <h2 className="font-display" style={{ margin: 0, fontSize: 23, letterSpacing: '-0.015em', color: '#F5F4EE' }}>Recent bookings</h2>
                  <div style={{ fontSize: 13, color: '#A6A29A', marginTop: 4 }}>
                    {recentBookings.length > 0 ? `${recentBookings.length} in your log` : 'Nothing booked yet'}
                  </div>
                </div>
                <a href="#" onClick={e => { e.preventDefault(); setView('myBookingsNew') }} style={{ fontSize: 13.5, fontWeight: 500, color: '#A6A29A', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  View all <Icon name="arrowRight" size={15} strokeWidth={1.6} />
                </a>
              </div>
              {recentBookings.length > 0 ? recentBookings.map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '18px 26px', borderBottom: i < recentBookings.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <div className="neu-badge" style={{ width: 42, height: 42, flex: '0 0 42px', color: '#F5F4EE' }}>
                    <Icon name="dumbbell" size={20} strokeWidth={1.5} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em', color: '#F5F4EE' }}>{b.equipment_name || 'Equipment'}</div>
                    <div style={{ fontSize: 13, color: '#A6A29A', marginTop: 4 }}>{b.slot_date}{b.slot_time ? ` · ${b.slot_time}` : ''}</div>
                  </div>
                  <StatusPill status={b.status} />
                </div>
              )) : (
                <div style={{ padding: '22px 26px', fontSize: 14, color: '#A6A29A' }}>Book equipment slots to see them here.</div>
              )}
            </motion.section>
          </motion.div>
        )}

        {/* Other views (unchanged logic) */}
        <div style={{ padding: view === 'home' || view === 'coach' ? 0 : '32px 48px' }}>
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
        </div>

      </main>
    </div>
  )
}
