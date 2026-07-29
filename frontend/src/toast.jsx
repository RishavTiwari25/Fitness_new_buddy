import React, { useEffect, useState } from 'react'
import Icon from './components/Icon'

// Tiny global toast system: call toast(msg, type) from anywhere, render <Toaster/> once.
// A module-level listener set avoids threading context/props through the whole tree.
const listeners = new Set()
let counter = 0

export function toast(message, type = 'info') {
  const item = { id: ++counter, message: String(message), type }
  listeners.forEach(fn => fn(item))
  return item.id
}
export const toastSuccess = (m) => toast(m, 'success')
export const toastError = (m) => toast(m, 'error')

const PALETTE = {
  success: { bg: 'rgba(217,119,87,0.14)', border: 'rgba(217,119,87,0.45)', color: '#F0B79C', icon: 'check' },
  error:   { bg: 'rgba(239,68,68,0.14)',  border: 'rgba(239,68,68,0.40)',  color: '#fca5a5', icon: 'close' },
  info:    { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.14)', color: '#F5F4EE', icon: 'sparkle' },
}

export function Toaster() {
  const [items, setItems] = useState([])

  useEffect(() => {
    const add = (item) => {
      setItems(prev => [...prev, item])
      setTimeout(() => setItems(prev => prev.filter(t => t.id !== item.id)), 3400)
    }
    listeners.add(add)
    return () => { listeners.delete(add) }
  }, [])

  const dismiss = (id) => setItems(prev => prev.filter(t => t.id !== id))

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
      display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 380,
      pointerEvents: 'none'
    }}>
      {items.map(t => {
        const p = PALETTE[t.type] || PALETTE.info
        return (
          <div
            key={t.id}
            role="status"
            onClick={() => dismiss(t.id)}
            style={{
              pointerEvents: 'auto',
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--panel)',
              border: `1px solid ${p.border}`,
              borderLeft: `3px solid ${p.border}`,
              color: p.color,
              padding: '14px 16px', borderRadius: 14,
              boxShadow: 'var(--card-shadow-lg)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              animation: 'toastIn .22s ease-out'
            }}
          >
            <span style={{
              display: 'inline-flex', width: 26, height: 26, borderRadius: 8,
              alignItems: 'center', justifyContent: 'center',
              background: p.bg, flex: '0 0 auto'
            }}>
              <Icon name={p.icon} size={15} color={p.color} />
            </span>
            <span style={{ lineHeight: 1.4 }}>{t.message}</span>
          </div>
        )
      })}
    </div>
  )
}
