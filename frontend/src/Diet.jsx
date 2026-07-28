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
              color: '#F5F4EE',
              marginBottom: '8px'
            }}>
              Nutrition Tracker
            </h1>
            <p style={{
              fontSize: '16px',
              color: '#A6A29A'
            }}>
              AI-powered meal analysis and calorie tracking
            </p>
          </div>

          {/* Date Picker */}
          <div style={{
            backgroundColor: '#262624',
            padding: '12px 20px',
            borderRadius: '12px',
            border: '1px solid #3A3937'
          }}>
            <label style={{
              fontSize: '14px',
              color: '#A6A29A',
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
                backgroundColor: '#1F1E1D',
                border: '1px solid #3A3937',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#F5F4EE',
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
              backgroundColor: '#262624',
              borderRadius: '20px',
              padding: '32px',
              border: '1px solid #3A3937',
              marginBottom: '24px'
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#F5F4EE',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <Icon name="camera" size={22} color="#D97757" /> Upload Meal Photo
              </h2>

              {/* File Input */}
              <label style={{
                display: 'block',
                width: '100%',
                padding: '48px 24px',
                backgroundColor: '#1F1E1D',
                border: '2px dashed #3A3937',
                borderRadius: '16px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#D97757'
                e.currentTarget.style.backgroundColor = '#232120'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#3A3937'
                e.currentTarget.style.backgroundColor = '#1F1E1D'
              }}>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  style={{ display: 'none' }}
                />
                {!preview ? (
                  <>
                    <div className="neu-badge" style={{ width: 64, height: 64, borderRadius: 18, margin: '0 auto 12px' }}><Icon name="upload" size={30} color="#D97757" /></div>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#F5F4EE',
                      marginBottom: '6px'
                    }}>
                      Choose File
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#A6A29A'
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
                  backgroundColor: !file || analyzing ? '#4C4A46' : '#D97757',
                  color: !file || analyzing ? '#A6A29A' : '#1F1E1D',
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
                    e.target.style.backgroundColor = '#C4664A'
                    e.target.style.transform = 'translateY(-2px)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(!file || analyzing)) {
                    e.target.style.backgroundColor = '#D97757'
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
                backgroundColor: '#262624',
                borderRadius: '20px',
                padding: '32px',
                border: '2px solid #D97757',
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
                    backgroundColor: '#D97757',
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
                    color: '#F5F4EE'
                  }}>
                    AI Analysis Complete
                  </h3>
                </div>

                {/* Calorie Badge */}
                <div style={{
                  backgroundColor: '#1F1E1D',
                  padding: '20px',
                  borderRadius: '16px',
                  marginBottom: '20px',
                  textAlign: 'center',
                  border: '1px solid #3A3937'
                }}>
                  <div style={{
                    fontSize: '14px',
                    color: '#A6A29A',
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
                    color: '#D97757'
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
                      backgroundColor: '#1F1E1D',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center',
                      border: '1px solid #3A3937'
                    }}>
                      <div style={{ marginBottom: '6px' }}><Icon name="dumbbell" size={22} color="#D97757" /></div>
                      <div style={{
                        fontSize: '20px',
                        fontWeight: '700',
                        color: '#F5F4EE',
                        marginBottom: '4px'
                      }}>
                        {analysis.macros.protein ?? '—'}g
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#A6A29A',
                        fontWeight: '600',
                        textTransform: 'uppercase'
                      }}>
                        Protein
                      </div>
                    </div>

                    <div style={{
                      backgroundColor: '#1F1E1D',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center',
                      border: '1px solid #3A3937'
                    }}>
                      <div style={{ marginBottom: '6px' }}><Icon name="bolt" size={22} color="#D97757" /></div>
                      <div style={{
                        fontSize: '20px',
                        fontWeight: '700',
                        color: '#F5F4EE',
                        marginBottom: '4px'
                      }}>
                        {analysis.macros.carbs ?? '—'}g
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#A6A29A',
                        fontWeight: '600',
                        textTransform: 'uppercase'
                      }}>
                        Carbs
                      </div>
                    </div>

                    <div style={{
                      backgroundColor: '#1F1E1D',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center',
                      border: '1px solid #3A3937'
                    }}>
                      <div style={{ marginBottom: '6px' }}><Icon name="diet" size={22} color="#D97757" /></div>
                      <div style={{
                        fontSize: '20px',
                        fontWeight: '700',
                        color: '#F5F4EE',
                        marginBottom: '4px'
                      }}>
                        {analysis.macros.fat ?? '—'}g
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#A6A29A',
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
                  backgroundColor: '#1F1E1D',
                  padding: '20px',
                  borderRadius: '16px',
                  marginBottom: '20px',
                  border: '1px solid #3A3937'
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#A6A29A',
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
                        borderBottom: i < analysis.items.length - 1 ? '1px solid #3A3937' : 'none',
                        color: '#F5F4EE',
                        fontSize: '15px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}>
                        <span style={{ color: '#D97757' }}>•</span>
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
                      backgroundColor: '#D97757',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '9999px',
                      fontSize: '16px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#C4664A'
                      e.target.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = '#D97757'
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
                      backgroundColor: '#3A3937',
                      color: '#F5F4EE',
                      border: 'none',
                      borderRadius: '9999px',
                      fontSize: '16px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#4C4A46'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = '#3A3937'
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
              backgroundColor: '#262624',
              borderRadius: '20px',
              padding: '32px',
              border: '1px solid #3A3937'
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#F5F4EE',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                Daily Log
              </h2>

              {/* Total Calories Card */}
              <div style={{
                backgroundColor: '#1F1E1D',
                padding: '24px',
                borderRadius: '16px',
                marginBottom: '24px',
                textAlign: 'center',
                border: '2px solid #3A3937'
              }}>
                <div style={{
                  fontSize: '14px',
                  color: '#A6A29A',
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
                  color: '#D97757',
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
                    backgroundColor: '#1F1E1D',
                    borderRadius: '16px',
                    border: '1px solid #3A3937'
                  }}>
                    <div className="neu-badge" style={{ width: 60, height: 60, borderRadius: 16, margin: '0 auto 12px' }}><Icon name="utensils" size={28} color="#D97757" /></div>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#F5F4EE',
                      marginBottom: '6px'
                    }}>
                      No meals logged yet
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#A6A29A'
                    }}>
                      Upload a meal photo to get started
                    </div>
                  </div>
                ) : (
                  logs.map((l, idx) => (
                    <div key={l.id} style={{
                      backgroundColor: '#1F1E1D',
                      padding: '20px',
                      borderRadius: '16px',
                      border: '1px solid #3A3937',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#4C4A46'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#3A3937'
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
                          color: '#F5F4EE'
                        }}>
                          {l.items_text || `Meal ${idx + 1}`}
                        </div>
                        <div style={{
                          backgroundColor: '#D97757',
                          color: '#FFFFFF',
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
                          color: '#A6A29A',
                          fontWeight: '600'
                        }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="dumbbell" size={13} color="#D97757" /> P: {l.protein ?? '—'}g</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="bolt" size={13} color="#D97757" /> C: {l.carbs ?? '—'}g</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="diet" size={13} color="#D97757" /> F: {l.fat ?? '—'}g</span>
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
