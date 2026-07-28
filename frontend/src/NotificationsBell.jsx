import React, { useEffect, useRef, useState } from 'react'
import { API_BASE } from './api'
import Icon from './components/Icon'

export default function NotificationsBell({ token }) {
  const [open, setOpen] = useState(false)
  const [list, setList] = useState([])
  const [unread, setUnread] = useState(0)
  const panelRef = useRef(null)

  function fmtTime(iso) {
    try {
      const d = new Date(iso)
      return d.toLocaleString()
    } catch { return iso }
  }

  async function loadCount() {
    try {
      const r = await fetch(`${API_BASE}/api/me/notifications/unread-count`, {
        headers: { Authorization: 'Bearer ' + token }
      })
      const j = await r.json()
      if (r.ok) setUnread(j.unread || 0)
    } catch {}
  }

  async function loadList() {
    try {
      const r = await fetch(`${API_BASE}/api/me/notifications?limit=30`, {
        headers: { Authorization: 'Bearer ' + token }
      })
      const j = await r.json()
      if (Array.isArray(j)) setList(j)
    } catch {}
  }

  async function markRead(id) {
    try {
      const r = await fetch(`${API_BASE}/api/me/notifications/${id}/read`, {
        method: 'POST', headers: { Authorization: 'Bearer ' + token }
      })
      if (r.ok) {
        setList(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n))
        loadCount()
      }
    } catch {}
  }

  async function markAll() {
    try {
      const r = await fetch(`${API_BASE}/api/me/notifications/read-all`, {
        method: 'POST', headers: { Authorization: 'Bearer ' + token }
      })
      if (r.ok) {
        setList(prev => prev.map(n => ({ ...n, read: 1 })))
        setUnread(0)
      }
    } catch {}
  }

  useEffect(() => {
    loadCount()
    const t = setInterval(loadCount, 30000)
    return () => clearInterval(t)
  }, [token])

  useEffect(() => {
    function onDocClick(e) {
      if (open && panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const buttonStyle = {
    position: 'relative',
    backgroundColor: '#27272a',
    color: '#fafafa',
    border: '1px solid #3f3f46',
    borderRadius: '12px',
    padding: '8px 12px',
    cursor: 'pointer',
    fontWeight: 700
  }

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      <button
        onClick={async () => { setOpen(!open); if (!open) await loadList() }}
        style={buttonStyle}
        title="Notifications"
      >
        <Icon name="bell" size={20} />
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, background: '#D0FD3E', color: '#18181b', borderRadius: 9999, padding: '2px 6px', fontSize: 12, fontWeight: 800 }}>
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', right: 0, marginTop: 8, width: 360, background: '#27272a', border: '1px solid #3f3f46', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.3)', overflow: 'hidden', zIndex: 1000 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #3f3f46' }}>
            <div style={{ color: '#fafafa', fontWeight: 700 }}>Notifications</div>
            <button onClick={markAll} style={{ background: 'transparent', border: 'none', color: '#D0FD3E', fontWeight: 700, cursor: 'pointer' }}>Mark all read</button>
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {list.length === 0 && (
              <div style={{ padding: 16, color: '#a1a1aa' }}>No notifications yet.</div>
            )}
            {list.map(n => (
              <div key={n.id} style={{ padding: 12, display: 'flex', gap: 10, alignItems: 'flex-start', background: n.read ? 'transparent' : '#1f2937' }}>
                <div style={{ display: 'flex', paddingTop: 2 }}><Icon name="megaphone" size={18} color="#D0FD3E" /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fafafa', fontSize: 14 }}>{n.message || n.type}</div>
                  <div style={{ color: '#a1a1aa', fontSize: 12, marginTop: 2 }}>{fmtTime(n.created_at)}</div>
                </div>
                {n.read ? (
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>Read</span>
                ) : (
                  <button onClick={() => markRead(n.id)} style={{ background: '#D0FD3E', color: '#18181b', border: 'none', borderRadius: 9999, padding: '6px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Mark read</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
