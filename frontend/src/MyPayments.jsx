import React, { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { API_BASE } from './api'
import Icon from './components/Icon'

export default function MyPayments({ token }) {
  const [billing, setBilling] = useState(null)
  const [payments, setPayments] = useState([])
  const [amount, setAmount] = useState('')
  const [msg, setMsg] = useState('')

  async function load() {
    try { const r = await fetch(`${API_BASE}/api/me/membership`, { headers: { Authorization: 'Bearer ' + token } }); const j = await r.json(); if (r.billing || j.billing || j.monthly_fee) { setBilling(j.billing || j); setPayments(j.payments || []) } else { setBilling(j); } } catch {}
  }
  useEffect(() => { load() }, [token])

  // Handle the return from Stripe Checkout (?payment=success|cancelled)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('payment')
    if (p === 'success') { setMsg('Payment successful! Your membership is updated.'); load() }
    else if (p === 'cancelled') { setMsg('Payment was cancelled.') }
    if (p) window.history.replaceState({}, '', window.location.pathname)
  }, [])

  // Redirect to Stripe Checkout for the membership fee.
  async function payStripe() {
    setMsg('')
    const amt = Number(amount || (billing?.monthly_fee || 0))
    if (!amt) { setMsg('Enter an amount'); return }
    try {
      const r = await fetch(`${API_BASE}/api/payments/stripe/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ amount: amt }),
      })
      const j = await r.json()
      if (!r.ok || !j.url) { setMsg(j.error || 'Could not start checkout'); return }
      window.location.href = j.url // hosted Stripe Checkout
    } catch (e) {
      setMsg('Could not start checkout')
    }
  }

  return (
    <motion.div className="card" style={{ marginTop: 16 }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 18, mass: 0.9 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span className="neu-badge" style={{ width: 44, height: 44 }}><Icon name="card" size={22} color="#D97757" /></span>
        <h3 className="font-display" style={{ fontSize: 20 }}>My Membership & Payments</h3>
      </div>

      {billing ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 16
        }}>
          <div className="neu-tile" style={{ padding: 16 }}>
            <div className="text-secondary" style={{ fontSize: 12, marginBottom: 6 }}>Gym</div>
            <div style={{ fontWeight: 700 }}>#{billing.gym_id}</div>
          </div>
          <div className="neu-tile" style={{ padding: 16 }}>
            <div className="text-secondary" style={{ fontSize: 12, marginBottom: 6 }}>Monthly fee</div>
            <div style={{ fontWeight: 700 }}>₹{billing.monthly_fee ?? '-'}</div>
          </div>
          <div className="neu-tile" style={{ padding: 16 }}>
            <div className="text-secondary" style={{ fontSize: 12, marginBottom: 6 }}>Next due date</div>
            <div style={{ fontWeight: 700 }}>{billing.next_due_date ?? '-'}</div>
          </div>
        </div>
      ) : (
        <div className="text-secondary" style={{ marginBottom: 16 }}>No membership plan assigned yet.</div>
      )}

      <div className="neu-tile" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label className="text-secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Pay amount</label>
            <input
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={String(billing?.monthly_fee || '')}
              style={{ width: '100%' }}
              inputMode="numeric"
            />
          </div>
          <button className="btn-primary rounded-full" onClick={payStripe} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Icon name="card" size={16} /> Pay with Stripe
          </button>
        </div>
        {msg && (
          <div style={{
            marginTop: 12,
            background: 'rgba(217, 119, 87, 0.12)',
            color: '#F0B79C',
            border: '1px solid rgba(217, 119, 87, 0.3)',
            padding: '9px 13px',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 500,
            width: 'fit-content',
          }}>
            {msg}
          </div>
        )}
      </div>

      <div>
        <h4 style={{ marginBottom: 10 }}>Past Payments</h4>
        {payments.length === 0 && (
          <div className="text-secondary">No payments.</div>
        )}

        {payments.length > 0 && (
          <div className="neu-tile" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr',
              padding: '12px 16px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#A6A29A',
              borderBottom: '1px solid var(--hairline)',
            }}>
              <div>Date</div>
              <div>Amount</div>
              <div>Method</div>
            </div>
            {payments.map((p, i) => (
              <div
                key={p.id ?? i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr',
                  alignItems: 'center',
                  padding: '14px 16px',
                  fontSize: 14,
                  borderBottom: i < payments.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}
              >
                <div style={{ color: '#A6A29A' }}>{p.created_at}</div>
                <div className="font-display" style={{ fontSize: 15 }}>₹{p.amount}</div>
                <div>
                  <span style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--hairline)',
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: 12,
                    color: '#CFCCC4',
                    textTransform: 'capitalize',
                  }}>{p.method || '—'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
