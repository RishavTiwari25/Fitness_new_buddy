import React, { useEffect, useState } from 'react'
import { API_BASE } from './api'

export default function Feed({ token }) {
  const [members, setMembers] = useState([])
  const [feed, setFeed] = useState([])
  const [text, setText] = useState('')
  const [image, setImage] = useState(null)
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

  async function submitPost(e) {
    e.preventDefault()
    const fd = new FormData()
    fd.append('text', text)
    if (image) fd.append('image', image)
    const r = await fetch(`${API_BASE}/api/posts`, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd })
    const j = await r.json()
    if (r.ok) {
      setText(''); setImage(null); setMsg('Posted');
      // Optimistically prepend the new post to the feed
      setFeed(prev => [{ id: j.id, user_id: j.user_id, image_path: j.image_path, text: j.text, created_at: new Date().toISOString(), author_name: 'You', author_avatar: null, like_count: 0, liked_by_me: false }, ...(prev || [])])
      // Also refresh from server
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
    <div>
      <h3>Community Feed</h3>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ width: 240 }}>
          <h4>Gym Members</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {members.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src={m.avatar_url || 'https://via.placeholder.com/32'} alt="" width={32} height={32} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                <div style={{ flex: 1 }}>{m.name || `User #${m.id}`}</div>
                <button onClick={() => toggleFollow(m)}>{m.is_following ? 'Unfollow' : 'Follow'}</button>
              </div>
            ))}
            {members.length === 0 && <div style={{ color: '#666' }}>No members found (join a gym in your Profile).</div>}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <form onSubmit={submitPost} style={{ border: '1px solid #eee', padding: 12, marginBottom: 12 }}>
            <h4>Create Post</h4>
            <textarea rows={3} placeholder="Share your progress..." value={text} onChange={e => setText(e.target.value)} style={{ width: '100%' }} />
            <div style={{ marginTop: 8 }}>
              <input type="file" accept="image/*" onChange={e => setImage(e.target.files?.[0] || null)} />
            </div>
            <div style={{ marginTop: 8 }}>
              <button type="submit">Post</button>
            </div>
            {msg && <div style={{ color: '#555', marginTop: 6 }}>{msg}</div>}
          </form>

          {feed.map(p => (
            <div key={p.id} style={{ border: '1px solid #eee', padding: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src={p.author_avatar || 'https://via.placeholder.com/32'} alt="" width={32} height={32} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                <strong>{p.author_name || `User #${p.user_id}`}</strong>
                <span style={{ color: '#888', marginLeft: 6 }}>{new Date(p.created_at).toLocaleString()}</span>
              </div>
              {p.text && <div style={{ marginTop: 8 }}>{p.text}</div>}
              {p.image_path && <img src={p.image_path} alt="post" style={{ marginTop: 8, maxWidth: '100%', borderRadius: 4 }} />}
              <div style={{ marginTop: 8 }}>
                <button onClick={() => like(p.id, p.liked_by_me)}>{p.liked_by_me ? 'Unlike' : 'Like'} ({p.like_count || 0})</button>
              </div>
            </div>
          ))}
          {feed.length === 0 && <div style={{ color: '#666' }}>Follow gym members to see their posts.</div>}
        </div>
      </div>
    </div>
  )
}
