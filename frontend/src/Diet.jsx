import React, { useEffect, useState } from 'react'
import { API_BASE } from './api'

export default function Diet({ token }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [status, setStatus] = useState('')
  const [logs, setLogs] = useState([])
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  // Optional: direct Gemini test (paste API key locally; dev-only)
  const [directKey, setDirectKey] = useState('')
  const [directBusy, setDirectBusy] = useState(false)
  const [directText, setDirectText] = useState('')

  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  async function loadLogs(d) {
    try {
      const res = await fetch(`${API_BASE}/api/diet/logs?date=${encodeURIComponent(d || date)}`, {
        headers: { Authorization: 'Bearer ' + token }
      })
      const data = await res.json()
      if (Array.isArray(data)) setLogs(data)
    } catch (_) {}
  }
  useEffect(() => { loadLogs(date) }, [date])

  async function analyze() {
    if (!file) return setStatus('Choose an image first')
    setAnalyzing(true); setStatus('')
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch(`${API_BASE}/api/diet/analyze`, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analyze failed')
      setAnalysis({ ...data, items: Array.isArray(data.items) ? data.items : (data.items ? [data.items] : []) })
    } catch (e) {
      setStatus(e.message)
    } finally { setAnalyzing(false) }
  }

  async function confirm() {
    if (!analysis) return
    try {
      const body = {
        date,
        items: analysis.items,
        calories: analysis.calories,
        macros: analysis.macros || null,
        image_path: analysis.image_path || null
      }
      const res = await fetch(`${API_BASE}/api/diet/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setStatus('Saved!')
      setAnalysis(null)
      setFile(null)
      loadLogs(date)
    } catch (e) { setStatus(e.message) }
  }

  const total = logs.reduce((acc, l) => acc + (l.calories || 0), 0)

  // Helpers for optional direct test
  function fileToBase64(f) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(f)
      reader.onload = () => resolve(reader.result)
      reader.onerror = (err) => reject(err)
    })
  }

  async function analyzeDirect() {
    if (!file) { setStatus('Choose an image first'); return }
    if (!directKey) { setStatus('Enter your Gemini API key below'); return }
    setDirectBusy(true); setDirectText(''); setStatus('')
    try {
      const base64Url = await fileToBase64(file)
      const pure = base64Url.split(',')[1]
      const model = 'gemini-2.5-flash-preview-09-2025'
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(directKey)}`
      const AI_PROMPT = `You are a world-class nutritional analyst.\nAnalyze the attached image of a meal.\nRespond with ONLY the following:\n1. A list of all food items you can identify.\n2. An estimated calorie count for each item.\n3. The total estimated calories for the entire meal.\nFormat your response clearly. Do not add any conversational text.`
      const payload = {
        contents: [{ role: 'user', parts: [ { text: AI_PROMPT }, { inlineData: { mimeType: file.type || 'image/jpeg', data: pure } } ] }]
      }
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error?.message || ('HTTP ' + resp.status))
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      setDirectText(text || '(no text)')
    } catch (e) {
      setDirectText('Error: ' + (e.message || String(e)))
    } finally {
      setDirectBusy(false)
    }
  }

  return (
    <div>
      <h3>My Diet</h3>
      <div style={{ marginBottom: 8 }}>
        <label>
          Date: <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div>
          <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
          {preview && <div style={{ marginTop: 8 }}><img src={preview} alt="preview" style={{ maxWidth: 240, border: '1px solid #ddd' }} /></div>}
          <div style={{ marginTop: 8 }}>
            <button onClick={analyze} disabled={!file || analyzing}>{analyzing ? 'Analyzing…' : 'Analyze Meal'}</button>
          </div>
          {status && <div style={{ color: status === 'Saved!' ? 'green' : 'red', marginTop: 6 }}>{status}</div>}
        </div>

        <div style={{ flex: 1 }}>
          {analysis && (
            <div style={{ padding: 10, border: '1px solid #eee' }}>
              <h4>AI Analysis</h4>
              <div>
                <strong>Items:</strong>
                <ul>
                  {analysis.items.map((it, i) => <li key={i}>{typeof it === 'string' ? it : (it.name || JSON.stringify(it))}</li>)}
                </ul>
              </div>
              <div><strong>Estimated Calories:</strong> {analysis.calories ?? '—'}</div>
              {analysis.macros && (
                <div style={{ marginTop: 6 }}>
                  <strong>Macros:</strong> P {analysis.macros.protein ?? '—'}g · C {analysis.macros.carbs ?? '—'}g · F {analysis.macros.fat ?? '—'}g
                </div>
              )}
              <div style={{ marginTop: 10 }}>
                <button onClick={confirm}>Confirm & Save</button>
                <button style={{ marginLeft: 8 }} onClick={() => setAnalysis(null)}>Discard</button>
              </div>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <h4>Today\'s Log</h4>
            <div><strong>Total Calories:</strong> {total}</div>
            {logs.length === 0 && <div style={{ color: '#666' }}>No entries yet.</div>}
            {logs.map(l => (
              <div key={l.id} style={{ borderBottom: '1px solid #eee', padding: '6px 0' }}>
                <div><strong>{l.items_text || 'Meal'}</strong></div>
                <div>Calories: {l.calories ?? '—'}</div>
                {(l.protein || l.carbs || l.fat) && (
                  <div style={{ fontSize: 12, color: '#666' }}>P {l.protein ?? '—'}g · C {l.carbs ?? '—'}g · F {l.fat ?? '—'}g</div>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24, padding: 10, border: '1px dashed #ccc', background: '#fafafa' }}>
            <h4>Direct Gemini Test (optional)</h4>
            <div style={{ color: '#666', fontSize: 12, marginBottom: 6 }}>Paste your API key locally to call Google directly from the browser for debugging. Don\'t use this in production.</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="password" value={directKey} onChange={e => setDirectKey(e.target.value)} placeholder="Gemini API Key" style={{ width: 260 }} />
              <button onClick={analyzeDirect} disabled={directBusy || !file}>{directBusy ? 'Calling…' : 'Analyze (Direct)'}</button>
            </div>
            {directText && (
              <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, background: '#fff', padding: 8, border: '1px solid #eee' }}>{directText}</pre>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
