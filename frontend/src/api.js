function normalizeApiBase(val) {
	let v = (val || '').trim();
	if (!v) {
		const isLocalHost = typeof window !== 'undefined' && window.location && ['localhost', '127.0.0.1'].includes(window.location.hostname);
		// Helpful hint in production if env var isn't set
		try {
			if (!isLocalHost) {
				console.warn('[API] VITE_API_URL is not set; defaulting to production backend https://fitness-new-buddy.onrender.com. Set VITE_API_URL explicitly in Vercel for reliability.');
			}
		} catch (_) {}
		return isLocalHost ? 'http://localhost:4000' : 'https://fitness-new-buddy.onrender.com';
	}
	// Handle bare port or ":4000"
	if (/^:?\d{2,5}$/.test(v)) {
		v = v.replace(/^:/, '');
		return `http://localhost:${v}`;
	}
	// If missing protocol, assume http
	if (!/^https?:\/\//i.test(v)) {
		v = 'http://' + v;
	}
	// Remove trailing slash
	v = v.replace(/\/$/, '');
	return v;
}

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL);
