function normalizeApiBase(val) {
	let v = (val || '').trim();
	if (!v) return 'http://localhost:4000';
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
