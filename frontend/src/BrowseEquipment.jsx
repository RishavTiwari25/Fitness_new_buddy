import React, { useState, useEffect } from 'react'
import { API_BASE } from './api'
import EquipmentDetails from './EquipmentDetails'

export default function BrowseEquipment({ token }) {
  const [equipment, setEquipment] = useState([])
  const [filteredEquipment, setFilteredEquipment] = useState([])
  const [gyms, setGyms] = useState([])
  const [selectedGym, setSelectedGym] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('name') // name, difficulty, time
  const [showFilters, setShowFilters] = useState(false)
  const [showSort, setShowSort] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedEquipment, setSelectedEquipment] = useState(null) // For detail view

  // Parse JWT to get user info
  function parseJwt(tk) {
    try { return JSON.parse(atob(tk.split('.')[1])) } catch { return {} }
  }
  const user = parseJwt(token)

  useEffect(() => {
    loadGyms()
  }, [])

  useEffect(() => {
    if (selectedGym) {
      loadEquipment(selectedGym)
    }
  }, [selectedGym])

  useEffect(() => {
    // Filter and sort equipment based on search and sort options
    let filtered = [...equipment]

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(eq => 
        eq.name.toLowerCase().includes(query) || 
        (eq.notes && eq.notes.toLowerCase().includes(query))
      )
    }

    // Sort
    if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy === 'quantity') {
      filtered.sort((a, b) => (b.quantity || 0) - (a.quantity || 0))
    }

    setFilteredEquipment(filtered)
  }, [equipment, searchQuery, sortBy])

  async function loadGyms() {
    try {
      const res = await fetch(`${API_BASE}/api/gyms`, { 
        headers: { Authorization: 'Bearer ' + token } 
      })
      const data = await res.json()
      if (res.ok && Array.isArray(data)) {
        setGyms(data)
        // Auto-select first gym
        if (data.length > 0) {
          setSelectedGym(data[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to load gyms:', err)
    }
  }

  async function loadEquipment(gymId) {
    if (!gymId) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/gyms/${gymId}/equipment-status`, { 
        headers: { Authorization: 'Bearer ' + token } 
      })
      const data = await res.json()
      if (res.ok && Array.isArray(data)) {
        setEquipment(data)
      }
    } catch (err) {
      console.error('Failed to load equipment:', err)
    } finally {
      setLoading(false)
    }
  }

  // Get mock difficulty and time based on equipment name (you can enhance this with real data later)
  function getEquipmentMeta(eq) {
    const name = eq.name.toLowerCase()
    
    // Difficulty heuristic
    let difficulty = 'Medium'
    if (name.includes('dumbbell') || name.includes('bench')) difficulty = 'Easy'
    else if (name.includes('cable') || name.includes('machine')) difficulty = 'Medium'
    else if (name.includes('barbell') || name.includes('squat')) difficulty = 'Hard'

    // Time estimate
    let time = '30 min'
    if (name.includes('cardio') || name.includes('treadmill')) time = '45 min'
    else if (name.includes('warm') || name.includes('stretch')) time = '15 min'

    // Target muscles
    let muscles = 'Full Body'
    if (name.includes('chest') || name.includes('bench')) muscles = 'Chest'
    else if (name.includes('leg') || name.includes('squat')) muscles = 'Legs'
    else if (name.includes('back') || name.includes('row')) muscles = 'Back'
    else if (name.includes('shoulder') || name.includes('press')) muscles = 'Shoulders'
    else if (name.includes('arm') || name.includes('curl')) muscles = 'Arms'

    return { difficulty, time, muscles }
  }

  // If equipment is selected, show detail view
  if (selectedEquipment) {
    return (
      <EquipmentDetails 
        equipment={selectedEquipment}
        token={token}
        onBack={() => setSelectedEquipment(null)}
        onBooked={() => {
          // Refresh equipment list after booking/releasing
          loadEquipment(selectedGym)
          setSelectedEquipment(null)
        }}
      />
    )
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: '#18181b',
      padding: '24px',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ 
          fontSize: '32px', 
          fontWeight: '800', 
          color: '#fafafa',
          marginBottom: '8px' 
        }}>
          Browse Equipment
        </h2>
        <p style={{ color: '#a1a1aa', fontSize: '16px' }}>
          Discover and book gym equipment at your selected location
        </p>
      </div>

      {/* Gym Selector */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ 
          display: 'block', 
          color: '#D0FD3E', 
          fontWeight: '600',
          marginBottom: '8px',
          fontSize: '14px'
        }}>
          Select Gym
        </label>
        <select 
          value={selectedGym || ''} 
          onChange={e => setSelectedGym(e.target.value ? parseInt(e.target.value) : null)}
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '12px 16px',
            backgroundColor: '#27272a',
            color: '#fafafa',
            border: '2px solid #3f3f46',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: '500',
            cursor: 'pointer',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => e.target.style.borderColor = '#D0FD3E'}
          onBlur={(e) => e.target.style.borderColor = '#3f3f46'}
        >
          <option value="">-- Select a gym --</option>
          {gyms.map(gym => (
            <option key={gym.id} value={gym.id}>
              {gym.name} {gym.location ? `(${gym.location})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Filter/Search Bar */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginBottom: '32px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        {/* Search Input */}
        <div style={{ flex: '1', minWidth: '250px' }}>
          <input
            type="text"
            placeholder="🔍 Search equipment..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: '#27272a',
              color: '#fafafa',
              border: '2px solid #3f3f46',
              borderRadius: '12px',
              fontSize: '15px',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = '#D0FD3E'}
            onBlur={(e) => e.target.style.borderColor = '#3f3f46'}
          />
        </div>

        {/* Filter Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            padding: '12px 24px',
            backgroundColor: showFilters ? '#D0FD3E' : '#3f3f46',
            color: showFilters ? '#18181b' : '#fafafa',
            border: 'none',
            borderRadius: '24px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!showFilters) {
              e.target.style.backgroundColor = '#52525b'
            }
          }}
          onMouseLeave={(e) => {
            if (!showFilters) {
              e.target.style.backgroundColor = '#3f3f46'
            }
          }}
        >
          🎚️ Filters
        </button>

        {/* Sort Button */}
        <button
          onClick={() => setShowSort(!showSort)}
          style={{
            padding: '12px 24px',
            backgroundColor: showSort ? '#D0FD3E' : '#3f3f46',
            color: showSort ? '#18181b' : '#fafafa',
            border: 'none',
            borderRadius: '24px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!showSort) {
              e.target.style.backgroundColor = '#52525b'
            }
          }}
          onMouseLeave={(e) => {
            if (!showSort) {
              e.target.style.backgroundColor = '#3f3f46'
            }
          }}
        >
          ↕️ Sort
        </button>
      </div>

      {/* Filters Dropdown */}
      {showFilters && (
        <div style={{
          backgroundColor: '#27272a',
          padding: '20px',
          borderRadius: '16px',
          marginBottom: '24px',
          border: '1px solid #3f3f46'
        }}>
          <h4 style={{ color: '#D0FD3E', marginBottom: '16px', fontWeight: '600' }}>
            Filter Options
          </h4>
          <p style={{ color: '#a1a1aa', fontSize: '14px' }}>
            More filter options coming soon! (Difficulty, Availability, Type)
          </p>
        </div>
      )}

      {/* Sort Dropdown */}
      {showSort && (
        <div style={{
          backgroundColor: '#27272a',
          padding: '20px',
          borderRadius: '16px',
          marginBottom: '24px',
          border: '1px solid #3f3f46'
        }}>
          <h4 style={{ color: '#D0FD3E', marginBottom: '16px', fontWeight: '600' }}>
            Sort By
          </h4>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setSortBy('name')}
              style={{
                padding: '8px 16px',
                backgroundColor: sortBy === 'name' ? '#D0FD3E' : '#3f3f46',
                color: sortBy === 'name' ? '#18181b' : '#fafafa',
                border: 'none',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Name A-Z
            </button>
            <button
              onClick={() => setSortBy('quantity')}
              style={{
                padding: '8px 16px',
                backgroundColor: sortBy === 'quantity' ? '#D0FD3E' : '#3f3f46',
                color: sortBy === 'quantity' ? '#18181b' : '#fafafa',
                border: 'none',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Quantity
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ color: '#D0FD3E', fontSize: '18px', fontWeight: '600' }}>
            Loading equipment...
          </div>
        </div>
      )}

      {/* No Gym Selected */}
      {!selectedGym && !loading && (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px',
          backgroundColor: '#27272a',
          borderRadius: '16px',
          border: '2px dashed #3f3f46'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏋️</div>
          <h3 style={{ color: '#fafafa', marginBottom: '8px', fontWeight: '700' }}>
            Select a Gym to Browse
          </h3>
          <p style={{ color: '#a1a1aa', fontSize: '15px' }}>
            Choose a gym from the dropdown above to see available equipment
          </p>
        </div>
      )}

      {/* Equipment Grid */}
      {selectedGym && !loading && filteredEquipment.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '24px',
          marginBottom: '40px'
        }}>
          {filteredEquipment.map(eq => {
            const meta = getEquipmentMeta(eq)
            const isBooked = !!eq.booking_id
            const bookedByMe = isBooked && eq.booking_user_id === user.id

            return (
              <div
                key={eq.id}
                onClick={() => setSelectedEquipment(eq)}
                style={{
                  backgroundColor: '#27272a',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  border: '1px solid #3f3f46',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(208, 253, 62, 0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {/* Equipment Image Placeholder */}
                <div style={{
                  width: '100%',
                  height: '180px',
                  backgroundColor: '#3f3f46',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '64px',
                  background: 'linear-gradient(135deg, #3f3f46 0%, #27272a 100%)',
                }}>
                  🏋️‍♂️
                </div>

                {/* Equipment Details */}
                <div style={{ padding: '20px' }}>
                  {/* Equipment Name */}
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#fafafa',
                    marginBottom: '12px',
                    lineHeight: '1.3'
                  }}>
                    {eq.name}
                  </h3>

                  {/* Tags */}
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '8px',
                    marginBottom: '16px'
                  }}>
                    {/* Time Tag */}
                    <span style={{
                      padding: '4px 12px',
                      backgroundColor: '#3f3f46',
                      color: '#fafafa',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      ⏱️ {meta.time}
                    </span>

                    {/* Muscles Tag */}
                    <span style={{
                      padding: '4px 12px',
                      backgroundColor: '#3f3f46',
                      color: '#fafafa',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      💪 {meta.muscles}
                    </span>

                    {/* Difficulty Tag */}
                    <span style={{
                      padding: '4px 12px',
                      backgroundColor: meta.difficulty === 'Hard' ? '#dc2626' : 
                                       meta.difficulty === 'Medium' ? '#f59e0b' : '#22c55e',
                      color: '#18181b',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {meta.difficulty === 'Hard' ? '🔥' : 
                       meta.difficulty === 'Medium' ? '⚡' : '✨'} {meta.difficulty}
                    </span>
                  </div>

                  {/* Quantity & Availability */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px'
                  }}>
                    <div style={{ fontSize: '13px', color: '#a1a1aa' }}>
                      Qty: <span style={{ color: '#fafafa', fontWeight: '600' }}>
                        {eq.quantity || 1}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: isBooked ? '#dc2626' : '#22c55e',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {isBooked ? '🔴 Booked' : '🟢 Available'}
                    </div>
                  </div>

                  {/* Notes */}
                  {eq.notes && (
                    <p style={{
                      fontSize: '13px',
                      color: '#a1a1aa',
                      marginBottom: '16px',
                      lineHeight: '1.5'
                    }}>
                      {eq.notes.length > 60 ? eq.notes.substring(0, 60) + '...' : eq.notes}
                    </p>
                  )}

                  {/* Action Button */}
                  <button
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: isBooked && !bookedByMe ? '#3f3f46' : '#D0FD3E',
                      color: isBooked && !bookedByMe ? '#a1a1aa' : '#18181b',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: '700',
                      cursor: isBooked && !bookedByMe ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                    disabled={isBooked && !bookedByMe}
                    onMouseEnter={(e) => {
                      if (!(isBooked && !bookedByMe)) {
                        e.target.style.backgroundColor = '#c4ed38'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!(isBooked && !bookedByMe)) {
                        e.target.style.backgroundColor = '#D0FD3E'
                      }
                    }}
                  >
                    {bookedByMe ? '✓ Booked by You' : 
                     isBooked ? `Booked by ${eq.booking_user_name || eq.booking_user_email}` : 
                     'View Details & Book'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* No Equipment Found */}
      {selectedGym && !loading && filteredEquipment.length === 0 && equipment.length > 0 && (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px',
          backgroundColor: '#27272a',
          borderRadius: '16px',
          border: '2px dashed #3f3f46'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
          <h3 style={{ color: '#fafafa', marginBottom: '8px', fontWeight: '700' }}>
            No Equipment Found
          </h3>
          <p style={{ color: '#a1a1aa', fontSize: '15px' }}>
            Try adjusting your search query or filters
          </p>
        </div>
      )}

      {/* No Equipment at Gym */}
      {selectedGym && !loading && equipment.length === 0 && (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px',
          backgroundColor: '#27272a',
          borderRadius: '16px',
          border: '2px dashed #3f3f46'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
          <h3 style={{ color: '#fafafa', marginBottom: '8px', fontWeight: '700' }}>
            No Equipment Available
          </h3>
          <p style={{ color: '#a1a1aa', fontSize: '15px' }}>
            This gym doesn't have any equipment listed yet
          </p>
        </div>
      )}
    </div>
  )
}
