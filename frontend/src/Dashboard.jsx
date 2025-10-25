import React, { useEffect, useState } from 'react'
import { API_BASE } from './api'
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

function parseJwt(token) {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload))
  } catch (e) {
    return {}
  }
}

export default function Dashboard({ token, onLogout }) {
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState(null)
  const [view, setView] = useState('profile')
  const [selectedEquipment, setSelectedEquipment] = useState(null)
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
      } catch (err) {
        setError(err.message)
      }
    }
    load()
  }, [token])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h2>Dashboard</h2>
        <div>
          <button onClick={() => setView('profile')}>Profile</button>
          {payload.role === 'owner' && <button onClick={() => setView('admin')} style={{ marginLeft: 8 }}>Admin</button>}
          {payload.role === 'member' && <button onClick={() => setView('member')} style={{ marginLeft: 8 }}>Member</button>}
          {payload.role === 'member' && <button onClick={() => setView('payments')} style={{ marginLeft: 8 }}>Payments</button>}
          {payload.role === 'trainer' && <button onClick={() => setView('trainer')} style={{ marginLeft: 8 }}>Trainer</button>}
          <button onClick={() => setView('myBookingsNew')} style={{ marginLeft: 8 }}>My Bookings</button>
          <button onClick={() => setView('diet')} style={{ marginLeft: 8 }}>My Diet</button>
          <button onClick={() => setView('feed')} style={{ marginLeft: 8 }}>Feed</button>
          <button onClick={() => setView('rewards')} style={{ marginLeft: 8 }}>Rewards</button>
          <button onClick={() => setView('homeWorkout')} style={{ marginLeft: 8 }}>Home Workout</button>
          <button onClick={onLogout} style={{ marginLeft: 8 }}>Logout</button>
        </div>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

  {view === 'profile' && <Profile token={token} profile={profile} onUpdate={setProfile} />}
  {view === 'admin' && payload.role === 'owner' && <AdminPanel token={token} />}
  {view === 'member' && payload.role === 'member' && <MemberHome token={token} defaultGymId={profile?.gym_id} />}
  {view === 'myBookingsNew' && <MyBookingsNew token={token} />}
  {view === 'diet' && <Diet token={token} />}
  {view === 'feed' && <Feed token={token} />}
  {view === 'rewards' && <Rewards token={token} />}
  {view === 'homeWorkout' && <HomeWorkout token={token} />}
  {view === 'trainer' && payload.role === 'trainer' && <TrainerDashboard token={token} />}
  {view === 'payments' && payload.role === 'member' && <MyPayments token={token} />}

      <hr />
  <p>Use the Profile page to set your username. Gym Owners can register gyms and manage equipment in the Admin section. Members can scan the gym QR to check-in/out, see live occupancy, and book equipment by time slots (My Bookings). Try "My Diet" to analyze a meal photo and log calories.</p>
    </div>
  )
}
