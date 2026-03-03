function normalizeApiBase(val) {
	let v = (val || '').trim();
	const hasWindow = typeof window !== 'undefined' && window.location;
	const isLocalHost = hasWindow && ['localhost', '127.0.0.1'].includes(window.location.hostname);
	if (!v) {
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
	if (!isLocalHost && /https:\/\/fitness-new-buddy-1\.onrender\.com\/?$/i.test(v)) {
		v = 'https://fitness-new-buddy.onrender.com';
		try {
			console.warn('[API] Corrected VITE_API_URL from fitness-new-buddy-1.onrender.com to fitness-new-buddy.onrender.com. Update Vercel env var to the canonical backend URL.');
		} catch (_) {}
	}
	// Remove trailing slash
	v = v.replace(/\/$/, '');
	return v;
}

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL);
