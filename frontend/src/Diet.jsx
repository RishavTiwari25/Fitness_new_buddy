import React, { useEffect, useState } from 'react'
import { API_BASE } from './api'
import Icon from './components/Icon'

export default function Diet({ token }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [status, setStatus] = useState('')
  const [logs, setLogs] = useState([])
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))

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

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#09090b',
      padding: '32px 24px'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px'
        }}>
          <div>
            <h1 style={{
              fontSize: '32px',
              fontWeight: '800',
              color: '#fafafa',
              marginBottom: '8px'
            }}>
              Nutrition Tracker
            </h1>
            <p style={{
              fontSize: '16px',
              color: '#a1a1aa'
            }}>
              AI-powered meal analysis and calorie tracking
            </p>
          </div>

          {/* Date Picker */}
          <div style={{
            backgroundColor: '#27272a',
            padding: '12px 20px',
            borderRadius: '12px',
            border: '1px solid #3f3f46'
          }}>
            <label style={{
              fontSize: '14px',
              color: '#a1a1aa',
              display: 'block',
              marginBottom: '6px',
              fontWeight: '600'
            }}>
              Date
            </label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)}
              style={{
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#fafafa',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Left Column - Upload & Analysis */}
          <div>
            {/* Upload Card */}
            <div style={{
              backgroundColor: '#27272a',
              borderRadius: '20px',
              padding: '32px',
              border: '1px solid #3f3f46',
              marginBottom: '24px'
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#fafafa',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <Icon name="camera" size={22} color="#D0FD3E" /> Upload Meal Photo
              </h2>

              {/* File Input */}
              <label style={{
                display: 'block',
                width: '100%',
                padding: '48px 24px',
                backgroundColor: '#18181b',
                border: '2px dashed #3f3f46',
                borderRadius: '16px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#D0FD3E'
                e.currentTarget.style.backgroundColor = '#1a1a1d'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#3f3f46'
                e.currentTarget.style.backgroundColor = '#18181b'
              }}>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  style={{ display: 'none' }}
                />
                {!preview ? (
                  <>
                    <div className="neu-badge" style={{ width: 64, height: 64, borderRadius: 18, margin: '0 auto 12px' }}><Icon name="upload" size={30} color="#D0FD3E" /></div>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#fafafa',
                      marginBottom: '6px'
                    }}>
                      Choose File
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#a1a1aa'
                    }}>
                      Click to upload a photo of your meal
                    </div>
                  </>
                ) : (
                  <img 
                    src={preview} 
                    alt="preview" 
                    style={{
                      maxWidth: '100%',
                      maxHeight: '300px',
                      borderRadius: '12px',
                      objectFit: 'cover'
                    }}
                  />
                )}
              </label>

              {/* Analyze Button */}
              <button
                onClick={analyze}
                disabled={!file || analyzing}
                style={{
                  width: '100%',
                  marginTop: '20px',
                  padding: '16px',
                  backgroundColor: !file || analyzing ? '#52525b' : '#D0FD3E',
                  color: !file || analyzing ? '#a1a1aa' : '#18181b',
                  border: 'none',
                  borderRadius: '9999px',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: !file || analyzing ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
                onMouseEnter={(e) => {
                  if (!(!file || analyzing)) {
                    e.target.style.backgroundColor = '#c4ed38'
                    e.target.style.transform = 'translateY(-2px)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(!file || analyzing)) {
                    e.target.style.backgroundColor = '#D0FD3E'
                    e.target.style.transform = 'translateY(0)'
                  }
                }}
              >
                {analyzing ? (
                  <>
                    Analyzing with AI...
                  </>
                ) : (
                  <>
                    Analyze Meal
                  </>
                )}
              </button>

              {/* Status Message */}
              {status && (
                <div style={{
                  marginTop: '16px',
                  padding: '12px 16px',
                  backgroundColor: status === 'Saved!' ? '#065f46' : '#991b1b',
                  color: status === 'Saved!' ? '#d1fae5' : '#fee2e2',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  textAlign: 'center'
                }}>
                  {status}
                </div>
              )}
            </div>

            {/* AI Analysis Result */}
            {analysis && (
              <div style={{
                backgroundColor: '#27272a',
                borderRadius: '20px',
                padding: '32px',
                border: '2px solid #D0FD3E',
                animation: 'slideUp 0.3s ease-out'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '24px'
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    backgroundColor: '#D0FD3E',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px'
                  }}>
                    AI
                  </div>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#fafafa'
                  }}>
                    AI Analysis Complete
                  </h3>
                </div>

                {/* Calorie Badge */}
                <div style={{
                  backgroundColor: '#18181b',
                  padding: '20px',
                  borderRadius: '16px',
                  marginBottom: '20px',
                  textAlign: 'center',
                  border: '1px solid #3f3f46'
                }}>
                  <div style={{
                    fontSize: '14px',
                    color: '#a1a1aa',
                    marginBottom: '8px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Total Calories
                  </div>
                  <div style={{
                    fontSize: '48px',
                    fontWeight: '800',
                    color: '#D0FD3E'
                  }}>
                    {analysis.calories ?? '—'}
                  </div>
                </div>

                {/* Macros */}
                {analysis.macros && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '12px',
                    marginBottom: '20px'
                  }}>
                    <div style={{
                      backgroundColor: '#18181b',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center',
                      border: '1px solid #3f3f46'
                    }}>
                      <div style={{ marginBottom: '6px' }}><Icon name="dumbbell" size={22} color="#D0FD3E" /></div>
                      <div style={{
                        fontSize: '20px',
                        fontWeight: '700',
                        color: '#fafafa',
                        marginBottom: '4px'
                      }}>
                        {analysis.macros.protein ?? '—'}g
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#a1a1aa',
                        fontWeight: '600',
                        textTransform: 'uppercase'
                      }}>
                        Protein
                      </div>
                    </div>

                    <div style={{
                      backgroundColor: '#18181b',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center',
                      border: '1px solid #3f3f46'
                    }}>
                      <div style={{ marginBottom: '6px' }}><Icon name="bolt" size={22} color="#D0FD3E" /></div>
                      <div style={{
                        fontSize: '20px',
                        fontWeight: '700',
                        color: '#fafafa',
                        marginBottom: '4px'
                      }}>
                        {analysis.macros.carbs ?? '—'}g
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#a1a1aa',
                        fontWeight: '600',
                        textTransform: 'uppercase'
                      }}>
                        Carbs
                      </div>
                    </div>

                    <div style={{
                      backgroundColor: '#18181b',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center',
                      border: '1px solid #3f3f46'
                    }}>
                      <div style={{ marginBottom: '6px' }}><Icon name="diet" size={22} color="#D0FD3E" /></div>
                      <div style={{
                        fontSize: '20px',
                        fontWeight: '700',
                        color: '#fafafa',
                        marginBottom: '4px'
                      }}>
                        {analysis.macros.fat ?? '—'}g
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#a1a1aa',
                        fontWeight: '600',
                        textTransform: 'uppercase'
                      }}>
                        Fat
                      </div>
                    </div>
                  </div>
                )}

                {/* Food Items */}
                <div style={{
                  backgroundColor: '#18181b',
                  padding: '20px',
                  borderRadius: '16px',
                  marginBottom: '20px',
                  border: '1px solid #3f3f46'
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#a1a1aa',
                    marginBottom: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Detected Items
                  </div>
                  <ul style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0
                  }}>
                    {analysis.items.map((it, i) => (
                      <li key={i} style={{
                        padding: '10px 0',
                        borderBottom: i < analysis.items.length - 1 ? '1px solid #3f3f46' : 'none',
                        color: '#fafafa',
                        fontSize: '15px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}>
                        <span style={{ color: '#D0FD3E' }}>•</span>
                        {typeof it === 'string' ? it : (it.name || JSON.stringify(it))}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '12px'
                }}>
                  <button
                    onClick={confirm}
                    style={{
                      flex: 1,
                      padding: '14px',
                      backgroundColor: '#D0FD3E',
                      color: '#18181b',
                      border: 'none',
                      borderRadius: '9999px',
                      fontSize: '16px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#c4ed38'
                      e.target.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = '#D0FD3E'
                      e.target.style.transform = 'translateY(0)'
                    }}
                  >
                    ✓ Confirm & Save
                  </button>
                  <button
                    onClick={() => setAnalysis(null)}
                    style={{
                      flex: 1,
                      padding: '14px',
                      backgroundColor: '#3f3f46',
                      color: '#fafafa',
                      border: 'none',
                      borderRadius: '9999px',
                      fontSize: '16px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#52525b'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = '#3f3f46'
                    }}
                  >
                    ✗ Discard
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Today's Log */}
          <div>
            <div style={{
              backgroundColor: '#27272a',
              borderRadius: '20px',
              padding: '32px',
              border: '1px solid #3f3f46'
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#fafafa',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                Daily Log
              </h2>

              {/* Total Calories Card */}
              <div style={{
                backgroundColor: '#18181b',
                padding: '24px',
                borderRadius: '16px',
                marginBottom: '24px',
                textAlign: 'center',
                border: '2px solid #3f3f46'
              }}>
                <div style={{
                  fontSize: '14px',
                  color: '#a1a1aa',
                  marginBottom: '10px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Total Daily Calories
                </div>
                <div style={{
                  fontSize: '56px',
                  fontWeight: '800',
                  color: '#D0FD3E',
                  lineHeight: '1'
                }}>
                  {total}
                </div>
              </div>

              {/* Meal Entries */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {logs.length === 0 ? (
                  <div style={{
                    padding: '48px 24px',
                    textAlign: 'center',
                    backgroundColor: '#18181b',
                    borderRadius: '16px',
                    border: '1px solid #3f3f46'
                  }}>
                    <div className="neu-badge" style={{ width: 60, height: 60, borderRadius: 16, margin: '0 auto 12px' }}><Icon name="utensils" size={28} color="#D0FD3E" /></div>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#fafafa',
                      marginBottom: '6px'
                    }}>
                      No meals logged yet
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#a1a1aa'
                    }}>
                      Upload a meal photo to get started
                    </div>
                  </div>
                ) : (
                  logs.map((l, idx) => (
                    <div key={l.id} style={{
                      backgroundColor: '#18181b',
                      padding: '20px',
                      borderRadius: '16px',
                      border: '1px solid #3f3f46',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#52525b'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#3f3f46'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '12px'
                      }}>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: '700',
                          color: '#fafafa'
                        }}>
                          {l.items_text || `Meal ${idx + 1}`}
                        </div>
                        <div style={{
                          backgroundColor: '#D0FD3E',
                          color: '#18181b',
                          padding: '6px 12px',
                          borderRadius: '9999px',
                          fontSize: '14px',
                          fontWeight: '700'
                        }}>
                          {l.calories ?? '—'} cal
                        </div>
                      </div>

                      {(l.protein || l.carbs || l.fat) && (
                        <div style={{
                          display: 'flex',
                          gap: '16px',
                          fontSize: '13px',
                          color: '#a1a1aa',
                          fontWeight: '600'
                        }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="dumbbell" size={13} color="#D0FD3E" /> P: {l.protein ?? '—'}g</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="bolt" size={13} color="#D0FD3E" /> C: {l.carbs ?? '—'}g</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="diet" size={13} color="#D0FD3E" /> F: {l.fat ?? '—'}g</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
