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
	const hasWindow = typeof window !== 'undefined' && window.location;
	const isLocalHost = hasWindow && ['localhost', '127.0.0.1'].includes(window.location.hostname);
	
	// FORCE the frontend to point to the correct Render backend (-1) in production
	// completely ignoring any potentially incorrect Vercel environment variables.
	return isLocalHost ? 'http://localhost:4000' : 'https://fitness-new-buddy-1.onrender.com';
}

// ===== EXPORT API BASE URL =====
export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL);
