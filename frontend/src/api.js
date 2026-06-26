/**
 * =============================================
 * API CONFIGURATION (api.js)
 * =============================================
 * Handles API base URL configuration
 * Supports both local and production environments
 */

/**
 * Normalize and validate API base URL
 * - Handles bare ports (":4000" -> "http://localhost:4000")
 * - Adds missing protocol (http:// or https://)
 * - Defaults to localhost for development, Render for production
 * - Corrects deprecated backend URLs
 */
function normalizeApiBase(val) {
	// Trim whitespace
	let v = (val || '').trim();
	
	// Check if running in browser and determine if it's localhost
	const hasWindow = typeof window !== 'undefined' && window.location;
	const isLocalHost = hasWindow && ['localhost', '127.0.0.1'].includes(window.location.hostname);
	
	// If no value provided, use defaults
	if (!v) {
		// Log helpful message for production environments
		try {
			if (!isLocalHost) {
				console.warn('[API] VITE_API_URL is not set; defaulting to production backend https://fitness-new-buddy.onrender.com. Set VITE_API_URL explicitly in Vercel for reliability.');
			}
		} catch (_) {}
		// Return localhost for development, production URL for production
		return isLocalHost ? 'http://localhost:4000' : 'https://fitness-new-buddy.onrender.com';
	}
	
	// Handle bare port (":4000" or "4000") - convert to full localhost URL
	if (/^:?\d{2,5}$/.test(v)) {
		v = v.replace(/^:/, ''); // Remove leading colon if present
		return `http://localhost:${v}`;
	}
	
	// If missing protocol (http:// or https://), assume http
	if (!/^https?:\/\//i.test(v)) {
		v = 'http://' + v;
	}
	
	// Correct deprecated backend URL
	if (!isLocalHost && /https:\/\/fitness-new-buddy-1\.onrender\.com\/?$/i.test(v)) {
		v = 'https://fitness-new-buddy.onrender.com';
		try {
			console.warn('[API] Corrected VITE_API_URL from fitness-new-buddy-1.onrender.com to fitness-new-buddy.onrender.com. Update Vercel env var to the canonical backend URL.');
		} catch (_) {}
	}
	
	// Remove trailing slash for consistency
	v = v.replace(/\/$/, '');
	
	return v;
}

// ===== EXPORT API BASE URL =====
// Main export: the normalized and validated API base URL
// Used by all API calls throughout the frontend
export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL);
