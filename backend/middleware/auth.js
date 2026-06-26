/**
 * =============================================
 * AUTHENTICATION MIDDLEWARE (auth.js)
 * =============================================
 * Handles JWT token verification and role-based
 * access control for protected routes
 */

// Import JWT library for token verification
const jwt = require('jsonwebtoken');

// ===== JWT SECRET CONFIGURATION =====
// Use environment variable or generate default for development
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production'
  ? (() => { throw new Error('JWT_SECRET is required in production'); })()
  : 'dev_insecure_secret_change_me');

// ===== TOKEN VERIFICATION MIDDLEWARE =====
// This middleware checks if the request includes a valid JWT token
// If valid, it extracts user data and attaches it to req.user
// If invalid, it returns a 401 Unauthorized response
function verifyToken(req, res, next) {
  // Look for Authorization header (format: "Bearer <token>")
  const auth = req.headers.authorization;
  
  // Check if Authorization header is present
  if (!auth) return res.status(401).json({ error: 'Missing Authorization header' });
  
  // Split header into parts: ["Bearer", "<token>"]
  const parts = auth.split(' ');
  
  // Verify header format: must have 2 parts and first part must be "Bearer"
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Malformed Authorization header' });
  }

  // Extract the token (second part)
  const token = parts[1];
  
  // Verify token signature and expiration using the JWT_SECRET
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    
    // Token is valid - attach user data to request for use in route handlers
    req.user = payload;
    
    // Continue to next middleware or route handler
    next();
  });
}

// ===== ROLE-BASED ACCESS CONTROL MIDDLEWARE =====
// This middleware checks if the authenticated user has the required role
// Returns 403 Forbidden if user doesn't have the required role
// Usage: app.post('/admin', requireRole('owner'), (req, res) => {...})
function requireRole(role) {
  return function (req, res, next) {
    // Check if user is authenticated (verifyToken must be called first)
    if (!req.user) return res.status(401).json({ error: 'Missing user payload' });
    
    // Check if user's role matches the required role
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    
    // User has required role, continue to next handler
    next();
  }
}

// ===== EXPORTS =====
// Export middleware functions for use in route files
module.exports = { verifyToken, requireRole };
