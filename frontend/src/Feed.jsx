import React, { useEffect, useState } from 'react'
import { API_BASE } from './api'
import Icon from './components/Icon'

export default function Feed({ token }) {
  const [members, setMembers] = useState([])
  const [feed, setFeed] = useState([])
  const [text, setText] = useState('')
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [msg, setMsg] = useState('')

  async function loadMembers() {
    try {
      const r = await fetch(`${API_BASE}/api/gym/members`, { headers: { Authorization: 'Bearer ' + token } })
      const j = await r.json()
      if (r.ok) setMembers(j)
    } catch {}
  }
  
  async function loadFeed() {
    try {
      const r = await fetch(`${API_BASE}/api/feed`, { headers: { Authorization: 'Bearer ' + token } })
      const j = await r.json()
      if (r.ok) setFeed(j)
    } catch {}
  }

  useEffect(() => { loadMembers(); loadFeed(); }, [token])

  async function toggleFollow(u) {
    const url = `${API_BASE}/api/${u.is_following ? 'unfollow' : 'follow'}/${u.id}`
    const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token } })
    if (r.ok) loadMembers()
  }

  function handleImageSelect(e) {
    const file = e.target.files?.[0]
    if (file) {
      setImage(file)
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  async function submitPost(e) {
    e.preventDefault()
    if (!text.trim() && !image) {
      setMsg('Please add text or an image')
      return
    }
    
    const fd = new FormData()
    fd.append('text', text)
    if (image) fd.append('image', image)
    const r = await fetch(`${API_BASE}/api/posts`, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd })
    const j = await r.json()
    if (r.ok) {
      setText('')
      setImage(null)
      setImagePreview(null)
      setMsg('Posted successfully! ✓')
      setTimeout(() => setMsg(''), 3000)
      loadFeed()
    } else {
      setMsg(j.error || 'Post failed')
    }
  }

  async function like(postId, liked) {
    const url = `${API_BASE}/api/posts/${postId}/${liked ? 'unlike' : 'like'}`
    const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token } })
    if (r.ok) loadFeed()
  }

  return (
    <div style={{ padding: '0' }}>
      <h2 className="font-display" style={{
        fontSize: '32px',
        fontWeight: '700',
        color: '#fafafa',
        marginBottom: '32px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px'
      }}>
        <span className="neu-badge" style={{ width: 48, height: 48 }}><Icon name="feed" size={24} color="#D0FD3E" /></span>
        Community Feed
      </h2>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        {/* Sidebar - Gym Members */}
        <div style={{ 
          width: '280px',
          position: 'sticky',
          top: '24px'
        }}>
          <div style={{
            backgroundColor: '#27272a',
            borderRadius: '20px',
            padding: '24px',
            border: '1px solid #3f3f46'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#D0FD3E',
              marginBottom: '20px'
            }}>
              Gym Members
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {members.map(m => (
                <div 
                  key={m.id} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px',
                    padding: '12px',
                    backgroundColor: '#18181b',
                    borderRadius: '12px',
                    border: '1px solid #3f3f46',
                    transition: 'border-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#52525b'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#3f3f46'}
                >
                  <img 
                    src={m.avatar_url ? (m.avatar_url.startsWith('http') ? m.avatar_url : `${API_BASE}${m.avatar_url.startsWith('/') ? '' : '/'}${m.avatar_url}`) : 'https://via.placeholder.com/40'} 
                    alt="" 
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid #3f3f46'
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#fafafa',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {m.name || `User #${m.id}`}
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleFollow(m)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: m.is_following ? '#3f3f46' : '#D0FD3E',
                      color: m.is_following ? '#fafafa' : '#18181b',
                      border: 'none',
                      borderRadius: '9999px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                    onMouseLeave={(e) => e.target.style.opacity = '1'}
                  >
                    {m.is_following ? 'Unfollow' : 'Follow'}
                  </button>
                </div>
              ))}
              
              {members.length === 0 && (
                <div style={{ 
                  color: '#a1a1aa', 
                  fontSize: '14px',
                  textAlign: 'center',
                  padding: '20px'
                }}>
                  Join a gym in your Profile to see members.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center - Feed Posts */}
        <div style={{ flex: 1, maxWidth: '700px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {feed.map(p => (
              <div 
                key={p.id} 
                style={{
                  backgroundColor: '#27272a',
                  borderRadius: '20px',
                  overflow: 'hidden',
                  border: '1px solid #3f3f46'
                }}
              >
                {/* Post Header */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  padding: '20px 24px'
                }}>
                  <img 
                    src={p.author_avatar ? (p.author_avatar.startsWith('http') ? p.author_avatar : `${API_BASE}${p.author_avatar.startsWith('/') ? '' : '/'}${p.author_avatar}`) : 'https://via.placeholder.com/48'} 
                    alt="" 
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid #D0FD3E'
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      color: '#fafafa'
                    }}>
                      {p.author_name || `User #${p.user_id}`}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: '#a1a1aa'
                    }}>
                      {new Date(p.created_at).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>

                {/* Post Text */}
                {p.text && (
                  <div style={{ 
                    padding: '0 24px 16px 24px',
                    fontSize: '15px',
                    lineHeight: '1.6',
                    color: '#d4d4d8'
                  }}>
                    {p.text}
                  </div>
                )}

                {/* Post Image */}
                {p.image_path && (
                  <div style={{ marginBottom: '16px' }}>
                    <img 
                      src={p.image_path.startsWith('http') ? p.image_path : `${API_BASE}${p.image_path.startsWith('/') ? '' : '/'}${p.image_path}`}
                      alt="post" 
                      style={{ 
                        width: '100%',
                        maxHeight: '500px',
                        objectFit: 'cover'
                      }} 
                    />
                  </div>
                )}

                {/* Post Actions */}
                <div style={{
                  padding: '16px 24px',
                  borderTop: '1px solid #3f3f46',
                  display: 'flex',
                  gap: '12px'
                }}>
                  {/* Like Button */}
                  <button
                    onClick={() => like(p.id, p.liked_by_me)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: p.liked_by_me ? '#D0FD3E' : '#3f3f46',
                      color: p.liked_by_me ? '#18181b' : '#fafafa',
                      border: 'none',
                      borderRadius: '9999px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.opacity = '0.8'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.opacity = '1'
                    }}
                  >
                    {p.liked_by_me ? 'Liked' : 'Like'} · {p.like_count || 0}
                  </button>
                </div>
              </div>
            ))}

            {feed.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                backgroundColor: '#27272a',
                borderRadius: '20px',
                border: '2px dashed #3f3f46'
              }}>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#fafafa',
                  marginBottom: '8px'
                }}>
                  No Posts Yet
                </h3>
                <p style={{
                  fontSize: '15px',
                  color: '#a1a1aa'
                }}>
                  Follow gym members to see their posts in your feed
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Create Post */}
        <div style={{ width: '360px', position: 'sticky', top: '24px' }}>
          <form 
            onSubmit={submitPost} 
            style={{
              backgroundColor: '#27272a',
              borderRadius: '20px',
              padding: '24px',
              border: '1px solid #3f3f46'
            }}
          >
            <h3 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#fafafa',
              marginBottom: '16px'
            }}>
              Create Post
            </h3>

            <textarea 
              rows={4} 
              placeholder="Share your progress, achievements, or fitness journey..." 
              value={text} 
              onChange={e => setText(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: '#18181b',
                color: '#fafafa',
                border: '2px solid #3f3f46',
                borderRadius: '12px',
                fontSize: '15px',
                outline: 'none',
                transition: 'border-color 0.2s',
                resize: 'vertical',
                fontFamily: 'inherit',
                lineHeight: '1.5',
                marginBottom: '12px'
              }}
              onFocus={(e) => e.target.style.borderColor = '#D0FD3E'}
              onBlur={(e) => e.target.style.borderColor = '#3f3f46'}
            />

            {imagePreview && (
              <div style={{
                position: 'relative',
                marginBottom: '12px',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '2px solid #3f3f46'
              }}>
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  style={{ 
                    width: '100%', 
                    maxHeight: '220px',
                    objectFit: 'cover'
                  }} 
                />
                <button
                  type="button"
                  onClick={() => {
                    setImage(null)
                    setImagePreview(null)
                  }}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    border: 'none',
                    color: '#fafafa',
                    fontSize: '18px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ×
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <label style={{
                padding: '10px 16px',
                backgroundColor: '#3f3f46',
                color: '#fafafa',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#52525b'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3f3f46'}
              >
                <Icon name="camera" size={16} /> Add Photo
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageSelect}
                  style={{ display: 'none' }} 
                />
              </label>

              <button
                type="submit"
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  backgroundColor: '#D0FD3E',
                  color: '#18181b',
                  border: 'none',
                  borderRadius: '9999px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#c4ed38'
                  e.target.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#D0FD3E'
                  e.target.style.transform = 'translateY(0)'
                }}
                title="Post"
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="send" size={15} /> Post</span>
              </button>
            </div>

            {msg && (
              <div style={{
                marginTop: '12px',
                padding: '10px 14px',
                backgroundColor: msg.includes('✓') ? '#d1fae5' : '#fee2e2',
                color: msg.includes('✓') ? '#065f46' : '#991b1b',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                textAlign: 'center'
              }}>
                {msg}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
