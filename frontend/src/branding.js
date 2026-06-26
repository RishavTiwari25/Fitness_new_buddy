/**
 * =============================================
 * BRANDING CONFIGURATION (branding.js)
 * =============================================
 * Central location for app branding settings
 * Can be customized via environment variables
 */

// ===== APP NAME =====
// Display name of the application
// Can be overridden with VITE_APP_NAME environment variable
export const APP_NAME = (import.meta.env.VITE_APP_NAME || 'Fitness Buddy').trim();

// ===== LOGO URL =====
// URL to the application logo/branding image
// Can be customized with VITE_LOGO_URL environment variable
// Defaults to /logo.svg if not specified
export const LOGO_URL = (import.meta.env.VITE_LOGO_URL && import.meta.env.VITE_LOGO_URL.trim()) || '/logo.svg';
