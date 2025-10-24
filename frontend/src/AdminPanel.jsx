import React, { useEffect, useState } from 'react'
import { API_BASE } from './api'

function EquipmentRow({ eq, onEdit, onDelete }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
      <div>
        <strong>{eq.name}</strong> {eq.quantity ? `x${eq.quantity}` : ''}
        <div style={{ fontSize: 12 }}>{eq.notes}</div>
      </div>
      <div>
        <button onClick={() => onEdit(eq)}>Edit</button>
        <button onClick={() => onDelete(eq.id)} style={{ marginLeft: 8 }}>Delete</button>
      </div>
    </div>
  )
}

export default function AdminPanel({ token }) {
  const [gyms, setGyms] = useState([])
  const [selectedGym, setSelectedGym] = useState(null)
  const [equipment, setEquipment] = useState([])
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [eqName, setEqName] = useState('')
  const [eqNotes, setEqNotes] = useState('')
  const [eqQuantity, setEqQuantity] = useState(1)
  const [editing, setEditing] = useState(null)

  async function loadGyms() {
    const res = await fetch(`${API_BASE}/api/gyms`, { headers: { Authorization: 'Bearer ' + token } })
    const data = await res.json()
    setGyms(data)
  }

  useEffect(() => { loadGyms() }, [])

  async function createGym(e) {
    e.preventDefault()
    const res = await fetch(`${API_BASE}/api/gyms`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ name, location })
    })
    const data = await res.json()
    if (res.ok) {
      // Refresh the gyms list from server and auto-select the newly created gym
      await loadGyms()
      setName(''); setLocation('')
      if (data && data.id) {
        setSelectedGym(data.id)
        await loadEquipment(data.id)
      }
    } else {
      alert(data.error || 'Failed')
    }
  }

  async function loadEquipment(gymId) {
    setEquipment([])
    setSelectedGym(gymId)
    const res = await fetch(`${API_BASE}/api/gyms/${gymId}/equipment`, { headers: { Authorization: 'Bearer ' + token } })
    const data = await res.json()
    setEquipment(data)
  }

  async function addEquipment(e) {
    e.preventDefault()
    if (!selectedGym) return alert('Select a gym first')
    const res = await fetch(`${API_BASE}/api/gyms/${selectedGym}/equipment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ name: eqName, notes: eqNotes, quantity: Number(eqQuantity) })
    })
    const data = await res.json()
    if (res.ok) {
      setEquipment(prev => [...prev, data])
      setEqName(''); setEqNotes(''); setEqQuantity(1)
    } else alert(data.error || 'Failed')
  }

  async function deleteEquipment(id) {
    if (!confirm('Delete equipment?')) return
  const res = await fetch(`${API_BASE}/api/equipment/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
    const data = await res.json()
    if (res.ok) setEquipment(prev => prev.filter(e => e.id !== id))
    else alert(data.error || 'Failed')
  }

  function startEdit(eq) {
    setEditing(eq.id)
    setEqName(eq.name); setEqNotes(eq.notes); setEqQuantity(eq.quantity || 1)
  }

  async function saveEdit(e) {
    e.preventDefault()
    if (!editing) return
    const res = await fetch(`${API_BASE}/api/equipment/${editing}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ name: eqName, notes: eqNotes, quantity: Number(eqQuantity) })
    })
    const data = await res.json()
    if (res.ok) {
      setEquipment(prev => prev.map(p => p.id === data.id ? data : p))
      setEditing(null); setEqName(''); setEqNotes(''); setEqQuantity(1)
    } else alert(data.error || 'Failed')
  }

  return (
    <div>
      <h3>Gym Owner Admin</h3>
      <section style={{ marginBottom: 16 }}>
        <h4>Create a Gym</h4>
        <form onSubmit={createGym}>
          <div><input placeholder="Gym name" value={name} onChange={e => setName(e.target.value)} /></div>
          <div style={{ marginTop: 6 }}><input placeholder="Location" value={location} onChange={e => setLocation(e.target.value)} /></div>
          <div style={{ marginTop: 6 }}><button type="submit">Create Gym</button></div>
        </form>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h4>Your Gyms</h4>
        <div>
          {gyms.map(g => (
            <div key={g.id} style={{ padding: 6 }}>
              <button onClick={() => loadEquipment(g.id)}>{g.name} {g.location ? `(${g.location})` : ''}</button>
            </div>
          ))}
          {gyms.length === 0 && <p>No gyms yet.</p>}
        </div>
      </section>

      {selectedGym && (
        <section>
          <h4>Equipment for gym #{selectedGym}</h4>
          <div>
            {equipment.map(eq => <EquipmentRow key={eq.id} eq={eq} onEdit={startEdit} onDelete={deleteEquipment} />)}
            {equipment.length === 0 && <p>No equipment.</p>}
          </div>

          <form onSubmit={editing ? saveEdit : addEquipment} style={{ marginTop: 12 }}>
            <div><input placeholder="Equipment name" value={eqName} onChange={e => setEqName(e.target.value)} /></div>
            <div style={{ marginTop: 6 }}><input placeholder="Notes" value={eqNotes} onChange={e => setEqNotes(e.target.value)} /></div>
            <div style={{ marginTop: 6 }}><input type="number" min={1} value={eqQuantity} onChange={e => setEqQuantity(e.target.value)} /></div>
            <div style={{ marginTop: 6 }}>
              <button type="submit">{editing ? 'Save' : 'Add Equipment'}</button>
              {editing && <button type="button" onClick={() => { setEditing(null); setEqName(''); setEqNotes(''); setEqQuantity(1) }} style={{ marginLeft: 8 }}>Cancel</button>}
            </div>
          </form>
        </section>
      )}
    </div>
  )
}
