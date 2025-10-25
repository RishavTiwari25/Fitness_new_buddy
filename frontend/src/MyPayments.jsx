import React, { useEffect, useState } from 'react'
import { API_BASE } from './api'

export default function MyPayments({ token }) {
  const [billing, setBilling] = useState(null)
  const [payments, setPayments] = useState([])
  const [amount, setAmount] = useState('')
  const [msg, setMsg] = useState('')

  async function load() {
    try { const r = await fetch(`${API_BASE}/api/me/membership`, { headers: { Authorization: 'Bearer ' + token } }); const j = await r.json(); if (r.billing || j.billing || j.monthly_fee) { setBilling(j.billing || j); setPayments(j.payments || []) } else { setBilling(j); } } catch {}
  }
  useEffect(() => { load() }, [token])

  async function payMock() {
    setMsg('')
    const amt = Number(amount || (billing?.monthly_fee || 0))
    if (!amt) { setMsg('Enter amount'); return }
    const order = await fetch(`${API_BASE}/api/payments/mock/create-order`, { method:'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ amount: amt }) })
    const o = await order.json(); if (!order.ok) { setMsg(o.error || 'Failed to create order'); return }
    const conf = await fetch(`${API_BASE}/api/payments/mock/confirm`, { method:'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ order_id: o.order_id, amount: amt }) })
    const c = await conf.json(); if (conf.ok) { setMsg('Payment successful'); load() } else { setMsg(c.error || 'Payment failed') }
  }

  return (
    <div>
      <h3>My Membership & Payments</h3>
      {billing ? (
        <div style={{ marginBottom: 12 }}>
          <div><strong>Gym:</strong> #{billing.gym_id}</div>
          <div><strong>Monthly fee:</strong> {billing.monthly_fee ?? '-'}</div>
          <div><strong>Next due date:</strong> {billing.next_due_date ?? '-'}</div>
        </div>
      ) : (
        <div style={{ color:'#666' }}>No membership plan assigned yet.</div>
      )}

      <div style={{ marginBottom: 8 }}>
        <label>Pay amount</label><br />
        <input value={amount} onChange={e => setAmount(e.target.value)} placeholder={String(billing?.monthly_fee || '')} />
        <button onClick={payMock} style={{ marginLeft: 6 }}>Pay (Mock)</button>
      </div>
      {msg && <div style={{ marginBottom: 8 }}>{msg}</div>}

      <h4>Past Payments</h4>
      {payments.length === 0 && <div style={{ color:'#666' }}>No payments.</div>}
      <ul>
        {payments.map(p => (
          <li key={p.id}>₹{p.amount} — {p.method || '—'} on {p.created_at}</li>
        ))}
      </ul>
    </div>
  )
}
