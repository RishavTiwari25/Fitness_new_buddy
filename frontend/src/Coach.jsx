import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { API_BASE } from './api'
import Icon from './components/Icon'

const ACCENT = '#D97757'
const SUGGESTIONS = [
  'How am I doing this week?',
  'Plan a 30-min home workout',
  'What should I eat post-workout?',
  'How do I keep my gym streak going?',
]

export default function Coach({ token, profile, streaks, points, bookings }) {
  const [messages, setMessages] = useState([]) // {role:'user'|'assistant', content}
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
  }, [messages, busy])

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
      // drop the empty assistant bubble on failure
      setMessages(prev => (prev[prev.length - 1]?.content === '' ? prev.slice(0, -1) : prev))
    } finally {
      setBusy(false)
    }
  }

  const empty = messages.length === 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 120, damping: 18, mass: 0.9 }}
      style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 72px)' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="neu-badge" style={{ width: 48, height: 48 }}><Icon name="robot" size={24} color={ACCENT} /></span>
          <div>
            <h1 className="font-display" style={{ fontSize: 26, fontWeight: 700, color: '#F5F4EE', lineHeight: 1.1 }}>AI Coach</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13.5 }}>Personal guidance from your streaks, meals &amp; bookings</p>
          </div>
        </div>
        <button
          onClick={genInsights}
          disabled={insightsBusy}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 9999, border: '1px solid rgba(217,119,87,0.3)', background: 'rgba(217,119,87,0.1)', color: ACCENT, fontSize: 13.5, fontWeight: 600, cursor: insightsBusy ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}
        >
          <Icon name="activity" size={16} /> {insightsBusy ? 'Analyzing…' : 'Weekly insights'}
        </button>
      </div>

      {/* Conversation */}
      <div className="glass" style={{ flex: 1, borderRadius: 20, padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {insights && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass" style={{ borderRadius: 16, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: ACCENT, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Weekly insights</div>
                  <h3 className="font-display" style={{ color: '#F5F4EE', fontSize: 18, lineHeight: 1.2 }}>{insights.headline}</h3>
                </div>
                {typeof insights.score === 'number' && (
                  <div className="neu-badge" style={{ width: 54, height: 54, borderRadius: 14, flexDirection: 'column' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: ACCENT, lineHeight: 1 }}>{Math.round(insights.score)}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>/100</div>
                  </div>
                )}
                <button onClick={() => setInsights(null)} aria-label="Dismiss" style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 2 }}>
                  <Icon name="close" size={16} />
                </button>
              </div>
              {insights.summary && <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.55, marginBottom: 14 }}>{insights.summary}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                {Array.isArray(insights.wins) && insights.wins.length > 0 && (
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Wins</div>
                    {insights.wins.map((w, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: '#EDEAE3', fontSize: 13.5, marginBottom: 5 }}>
                        <span style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }}><Icon name="check" size={14} /></span>{w}
                      </div>
                    ))}
                  </div>
                )}
                {Array.isArray(insights.focus) && insights.focus.length > 0 && (
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Focus next week</div>
                    {insights.focus.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: '#EDEAE3', fontSize: 13.5, marginBottom: 5 }}>
                        <span style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }}><Icon name="bolt" size={14} /></span>{f}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {empty && !insights && (
            <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 460 }}>
              <span className="neu-badge" style={{ width: 60, height: 60, borderRadius: 18, marginBottom: 16 }}><Icon name="robot" size={30} color={ACCENT} /></span>
              <h3 className="font-display" style={{ color: '#F5F4EE', fontSize: 18, marginBottom: 6 }}>Ask your coach anything</h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 20 }}>Grounded in your own fitness data — workouts, diet, streaks and points.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)} style={{ padding: '9px 14px', borderRadius: 9999, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            const isUser = m.role === 'user'
            const streaming = busy && i === messages.length - 1 && !isUser
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}
              >
                <div style={{
                  maxWidth: '80%',
                  padding: '12px 16px',
                  borderRadius: 16,
                  borderTopRightRadius: isUser ? 4 : 16,
                  borderTopLeftRadius: isUser ? 16 : 4,
                  background: isUser ? ACCENT : 'var(--neu-base)',
                  color: isUser ? '#FFFFFF' : '#EDEAE3',
                  boxShadow: isUser ? 'none' : 'var(--neu-raised-sm)',
                  fontSize: 14.5,
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {m.content || (streaming ? '' : '')}
                  {streaming && <span style={{ display: 'inline-block', width: 8, height: 15, background: ACCENT, marginLeft: 2, verticalAlign: '-2px', borderRadius: 1, animation: 'coachBlink 1s steps(2) infinite' }} />}
                </div>
              </motion.div>
            )
          })}
        </div>

        {error && (
          <div style={{ padding: '10px 16px', color: '#fca5a5', fontSize: 13, borderTop: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)' }}>
            {error}
          </div>
        )}

        {/* Composer */}
        <div style={{ display: 'flex', gap: 10, padding: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask your coach…"
            disabled={busy}
            style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9999, padding: '12px 18px', color: '#F5F4EE', fontSize: 14.5, outline: 'none' }}
          />
          <button
            onClick={() => send()}
            disabled={busy || !input.trim()}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minWidth: 48, padding: '0 18px', borderRadius: 9999, border: 'none', background: busy || !input.trim() ? '#4C4A46' : ACCENT, color: '#FFFFFF', fontWeight: 700, fontSize: 14, cursor: busy || !input.trim() ? 'not-allowed' : 'pointer' }}
          >
            <Icon name="send" size={16} />
          </button>
        </div>
      </div>

      <style>{`@keyframes coachBlink { 0%,50%{opacity:1} 50.01%,100%{opacity:0} }`}</style>
    </motion.div>
  )
}
