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

  // Mock's "Alerts" header button: panel bg, hairline border, icon + label
  const buttonStyle = {
    position: 'relative',
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 14px', borderRadius: 11,
    border: '1px solid rgba(255,255,255,0.08)',
    background: '#262624', color: '#A6A29A',
    fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
    boxShadow: '0 1px 0 rgba(255,255,255,0.05) inset',
  }

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      <button
        onClick={async () => { setOpen(!open); if (!open) await loadList() }}
        style={buttonStyle}
        title="Notifications"
        onMouseEnter={e => e.currentTarget.style.color = '#F5F4EE'}
        onMouseLeave={e => e.currentTarget.style.color = '#A6A29A'}
      >
        <Icon name="bell" size={17} strokeWidth={1.5} />
        <span>Alerts</span>
        {unread > 0 && (
          <span style={{ fontSize: 11.5, fontWeight: 600, color: '#F0B79C', background: 'rgba(217,119,87,0.14)', border: '1px solid rgba(217,119,87,0.32)', borderRadius: 999, padding: '1px 7px' }}>
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', right: 0, marginTop: 8, width: 360, background: '#262624', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 22px 44px -20px rgba(0,0,0,0.9)', overflow: 'hidden', zIndex: 1000 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #3A3937' }}>
            <div style={{ color: '#F5F4EE', fontWeight: 700 }}>Notifications</div>
            <button onClick={markAll} style={{ background: 'transparent', border: 'none', color: '#D97757', fontWeight: 700, cursor: 'pointer' }}>Mark all read</button>
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {list.length === 0 && (
              <div style={{ padding: 16, color: '#A6A29A' }}>No notifications yet.</div>
            )}
            {list.map(n => (
              <div key={n.id} style={{ padding: 12, display: 'flex', gap: 10, alignItems: 'flex-start', background: n.read ? 'transparent' : '#1f2937' }}>
                <div style={{ display: 'flex', paddingTop: 2 }}><Icon name="megaphone" size={18} color="#D97757" /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#F5F4EE', fontSize: 14 }}>{n.message || n.type}</div>
                  <div style={{ color: '#A6A29A', fontSize: 12, marginTop: 2 }}>{fmtTime(n.created_at)}</div>
                </div>
                {n.read ? (
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>Read</span>
                ) : (
                  <button onClick={() => markRead(n.id)} style={{ background: '#D97757', color: '#FFFFFF', border: 'none', borderRadius: 9999, padding: '6px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Mark read</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
