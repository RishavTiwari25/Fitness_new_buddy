import { API_BASE } from './api'

// On-theme inline SVG avatar fallback — a muted silhouette on a warm tile.
// Inlined as a data URI so we never depend on an external placeholder service.
const _svg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'><rect width='160' height='160' fill='#2B2B29'/><circle cx='80' cy='60' r='28' fill='#4C4A46'/><path d='M28 150c0-30 24-48 52-48s52 18 52 48z' fill='#4C4A46'/></svg>`
export const AVATAR_FALLBACK = `data:image/svg+xml,${encodeURIComponent(_svg)}`

// Resolve a stored avatar path to a usable <img src>. Absolute URLs pass through,
// relative /uploads paths get the API base, and empty values get the fallback.
export function avatarSrc(url) {
  if (!url) return AVATAR_FALLBACK
  if (/^https?:\/\//i.test(url)) return url
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`
}
