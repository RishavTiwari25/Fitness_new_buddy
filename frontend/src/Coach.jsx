import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { API_BASE } from './api'
import Icon from './components/Icon'

const ACCENT = '#D97757'
const SUGGESTIONS = [
  { icon: 'calendar', label: 'Plan my week' },
  { icon: 'trendUp', label: 'Why am I plateauing?' },
  { icon: 'clock', label: 'Best time to train today' },
  { icon: 'diet', label: 'Review my protein intake' },
]

// Composer — mock: radius 16 panel, "Uses your log" hint, 38px coral send
function Composer({ input, setInput, busy, onSend, hint }) {
  return (
    <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px 12px 18px', borderRadius: 16, background: 'var(--panel)', border: '1px solid rgba(255,255,255,0.10)', boxShadow: 'var(--card-shadow-lg)', boxSizing: 'border-box' }}>
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }}
        placeholder="Message your coach…"
        disabled={busy}
        style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', color: '#F5F4EE', fontSize: 15, padding: 0, boxShadow: 'none' }}
      />
      {hint && <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>Uses your log</span>}
      <button
        onClick={() => onSend()}
        disabled={busy}
        style={{ width: 38, height: 38, flex: '0 0 38px', borderRadius: 11, border: 0, background: busy ? '#4C4A46' : ACCENT, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: busy ? 'wait' : 'pointer', boxShadow: '0 1px 0 rgba(255,255,255,0.24) inset', padding: 0 }}
        onMouseEnter={e => { if (!busy) e.currentTarget.style.background = 'var(--accent-hover)' }}
        onMouseLeave={e => { if (!busy) e.currentTarget.style.background = ACCENT }}
      >
        <Icon name="arrowUp" size={18} strokeWidth={1.8} />
      </button>
    </div>
  )
}

export default function Coach({ token, profile, streaks, points, bookings }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [insights, setInsights] = useState(null)
  const [insightsBusy, setInsightsBusy] = useState(false)
  const scrollRef = useRef(null)

  const context = {
    profile: profile || undefined,
    streaks: streaks || undefined,
    points: typeof points === 'number' ? points : undefined,
    bookings: Array.isArray(bookings) ? bookings : undefined,
  }

  async function genInsights() {
    if (insightsBusy) return
    setInsightsBusy(true); setError(null)
    try {
      const resp = await fetch(`${API_BASE}/api/coach/insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ context }),
      })
      const j = await resp.json()
      if (!resp.ok) throw new Error(j.error || `Request failed (${resp.status})`)
      setInsights(j.report)
    } catch (e) {
      setError(e.message || 'Could not generate insights.')
    } finally {
      setInsightsBusy(false)
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy, insights])

  async function send(text) {
    const content = (text ?? input).trim()
    if (!content || busy) return
    setError(null)
    setInput('')
    const convo = [...messages, { role: 'user', content }]
    setMessages([...convo, { role: 'assistant', content: '' }])
    setBusy(true)
    try {
      const resp = await fetch(`${API_BASE}/api/coach/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ messages: convo, context }),
      })
      if (!resp.ok || !resp.body) {
        const j = await resp.json().catch(() => ({}))
        throw new Error(j.error || `Request failed (${resp.status})`)
      }
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let nl
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim()
          buffer = buffer.slice(nl + 1)
          if (!line.startsWith('data:')) continue
          const s = line.slice(5).trim()
          if (!s) continue
          let obj
          try { obj = JSON.parse(s) } catch { continue }
          if (obj.error) throw new Error(obj.error)
          if (obj.text) {
            full += obj.text
            setMessages(prev => {
              const next = prev.slice()
              next[next.length - 1] = { role: 'assistant', content: full }
              return next
            })
          }
        }
      }
      if (!full) {
        setMessages(prev => {
          const next = prev.slice()
          next[next.length - 1] = { role: 'assistant', content: 'Sorry — I didn’t catch that. Try asking again.' }
          return next
        })
      }
    } catch (e) {
      setError(e.message || 'The coach is unavailable right now.')
      setMessages(prev => (prev[prev.length - 1]?.content === '' ? prev.slice(0, -1) : prev))
    } finally {
      setBusy(false)
    }
  }

  const empty = messages.length === 0

  const headerBtn = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', borderRadius: 10,
    border: '1px solid var(--hairline)', background: 'var(--panel)', color: '#A6A29A',
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header (mock) */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: '22px 48px', borderBottom: '1px solid var(--hairline)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 className="font-display" style={{ margin: 0, fontSize: 24, letterSpacing: '-0.015em', color: '#F5F4EE' }}>AI Coach</h1>
          <span style={{ fontSize: 12.5, color: '#A6A29A', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--hairline)', borderRadius: 999, padding: '4px 10px' }}>Knows your recent sessions</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button style={headerBtn} onClick={genInsights} disabled={insightsBusy}
            onMouseEnter={e => e.currentTarget.style.color = '#F5F4EE'} onMouseLeave={e => e.currentTarget.style.color = '#A6A29A'}>
            <Icon name="sparkle" size={16} strokeWidth={1.5} color={ACCENT} />
            <span>{insightsBusy ? 'Analyzing…' : 'Weekly insights'}</span>
          </button>
          <button style={headerBtn} onClick={() => { setMessages([]); setInsights(null); setError(null) }}
            onMouseEnter={e => e.currentTarget.style.color = '#F5F4EE'} onMouseLeave={e => e.currentTarget.style.color = '#A6A29A'}>
            <Icon name="plus" size={16} strokeWidth={1.6} />
            <span>New chat</span>
          </button>
        </div>
      </header>

      {empty && !insights ? (
        /* Empty state (mock) */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30, padding: '0 48px 80px' }}>
          <div style={{ width: 52, height: 52, borderRadius: 15, background: 'var(--panel)', border: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT, boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset' }}>
            <Icon name="sparkles" size={24} strokeWidth={1.5} />
          </div>
          <div style={{ textAlign: 'center', maxWidth: 620 }}>
            <h2 className="font-display" style={{ margin: 0, fontSize: 46, lineHeight: 1.1, letterSpacing: '-0.025em', color: '#F5F4EE' }}>
              Ask your coach <span style={{ fontStyle: 'italic', color: ACCENT }}>anything</span>
            </h2>
            <p style={{ margin: '14px 0 0', fontSize: 15.5, lineHeight: 1.65, color: '#A6A29A' }}>
              Training plans, form checks, recovery, macros. It reads your bookings and diet log before it answers.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, maxWidth: 700 }}>
            {SUGGESTIONS.map(s => (
              <button key={s.label} onClick={() => send(s.label)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 15px', borderRadius: 999, border: '1px solid var(--hairline)', background: 'var(--panel)', color: 'var(--text-body)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--tile)'; e.currentTarget.style.color = '#F5F4EE' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--panel)'; e.currentTarget.style.color = 'var(--text-body)' }}>
                <Icon name={s.icon} size={15} strokeWidth={1.6} color={ACCENT} />
                <span>{s.label}</span>
              </button>
            ))}
          </div>
          <div style={{ width: '100%', maxWidth: 760 }}>
            <Composer input={input} setInput={setInput} busy={busy} onSend={send} />
          </div>
          {error && <div style={{ color: '#fca5a5', fontSize: 13 }}>{error}</div>}
        </div>
      ) : (
        /* Conversation (mock) */
        <>
          <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '32px 48px 24px' }}>
            <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 26 }}>

              {insights && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  style={{ background: 'var(--panel)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 20, padding: '24px 26px 26px', boxShadow: 'var(--card-shadow-lg)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <Icon name="sparkle" size={15} strokeWidth={1.7} color={ACCENT} />
                      <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.11em', textTransform: 'uppercase', color: '#A6A29A' }}>Weekly insights</span>
                    </div>
                    <button onClick={() => setInsights(null)} aria-label="Dismiss"
                      style={{ width: 28, height: 28, borderRadius: 8, border: 0, background: 'transparent', color: '#A6A29A', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#F5F4EE' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#A6A29A' }}>
                      <Icon name="close" size={15} strokeWidth={1.7} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 28, marginTop: 14, flexWrap: 'wrap' }}>
                    <h3 className="font-display" style={{ margin: 0, fontSize: 30, lineHeight: 1.2, letterSpacing: '-0.02em', maxWidth: 480, color: '#F5F4EE' }}>{insights.headline}</h3>
                    {typeof insights.score === 'number' && (
                      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'baseline', gap: 3, padding: '10px 16px', borderRadius: 14, background: 'rgba(217,119,87,0.12)', border: '1px solid rgba(217,119,87,0.32)' }}>
                        <span className="font-display" style={{ fontSize: 34, lineHeight: 1, color: 'var(--coral-tint-text)', letterSpacing: '-0.02em' }}>{Math.round(insights.score)}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#C98D6D' }}>/100</span>
                      </div>
                    )}
                  </div>
                  {insights.summary && <p style={{ margin: '14px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--text-body)' }}>{insights.summary}</p>}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginTop: 24, paddingTop: 22, borderTop: '1px solid var(--hairline)' }}>
                    {Array.isArray(insights.wins) && insights.wins.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.11em', textTransform: 'uppercase', color: '#A6A29A', marginBottom: 13 }}>Wins</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                          {insights.wins.map((w, i) => (
                            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                              <span style={{ flexShrink: 0, marginTop: 2 }}><Icon name="check" size={17} strokeWidth={1.8} color={ACCENT} /></span>
                              <div style={{ fontSize: 14, lineHeight: 1.55, color: '#E9E7E0' }}>{w}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {Array.isArray(insights.focus) && insights.focus.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.11em', textTransform: 'uppercase', color: '#A6A29A', marginBottom: 13 }}>Focus next week</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                          {insights.focus.map((f, i) => (
                            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                              <span style={{ flexShrink: 0, marginTop: 2 }}><Icon name="bolt" size={17} strokeWidth={1.6} color="#A6A29A" /></span>
                              <div style={{ fontSize: 14, lineHeight: 1.55, color: '#E9E7E0' }}>{f}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {messages.map((m, i) => {
                const isUser = m.role === 'user'
                const streaming = busy && i === messages.length - 1 && !isUser
                if (isUser) {
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{ maxWidth: 520, background: ACCENT, color: '#FFFFFF', padding: '13px 17px', borderRadius: '16px 16px 5px 16px', fontSize: 14.5, lineHeight: 1.6, boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</div>
                    </div>
                  )
                }
                return (
                  <div key={i} style={{ display: 'flex', gap: 13 }}>
                    <div style={{ width: 30, height: 30, flex: '0 0 30px', borderRadius: 9, background: 'var(--panel)', border: '1px solid rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
                      <Icon name="sparkle" size={16} strokeWidth={1.6} />
                    </div>
                    <div style={{ maxWidth: 620, background: 'var(--panel)', border: '1px solid var(--hairline)', padding: '16px 19px', borderRadius: '5px 16px 16px 16px', boxShadow: '0 1px 0 rgba(255,255,255,0.05) inset' }}>
                      <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: '#EDEBE4', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {m.content}
                        {streaming && <span style={{ display: 'inline-block', width: 7, height: 14, background: ACCENT, marginLeft: 3, verticalAlign: '-2px', borderRadius: 1, animation: 'coachBlink 1s steps(2) infinite' }} />}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {error && (
            <div style={{ padding: '8px 48px', maxWidth: 800, margin: '0 auto', width: '100%', boxSizing: 'border-box', color: '#fca5a5', fontSize: 13 }}>{error}</div>
          )}

          {/* Composer + follow-up chips (mock) */}
          <div style={{ padding: '0 48px 30px' }}>
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
              {!busy && messages.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  {['What should I eat after?', 'Plan the rest of the week'].map(s => (
                    <button key={s} onClick={() => send(s)}
                      style={{ padding: '8px 13px', borderRadius: 999, border: '1px solid var(--hairline)', background: 'var(--panel)', color: '#A6A29A', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--tile)'; e.currentTarget.style.color = '#F5F4EE' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--panel)'; e.currentTarget.style.color = '#A6A29A' }}>{s}</button>
                  ))}
                </div>
              )}
              <Composer input={input} setInput={setInput} busy={busy} onSend={send} hint />
            </div>
          </div>
        </>
      )}
      <style>{`@keyframes coachBlink { 0%,50%{opacity:1} 50.01%,100%{opacity:0} }`}</style>
    </div>
  )
}
