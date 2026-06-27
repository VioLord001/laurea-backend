// ============================================
// STAGE 4: AUTHENTICATION MIDDLEWARE
// Protects routes — verifies JWT tokens
// ============================================
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Verify JWT token
const protect = async (req, res, next) => {
  try {
    let token;

    // Check Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Or check cookie
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Access denied. Please log in.' });
    }

    // Check if token is blacklisted (logged out)
    const blacklisted = await query(
      'SELECT id FROM token_blacklist WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    if (blacklisted.rows.length > 0) {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const result = await query(
      'SELECT id, first_name, last_name, email, role, is_active FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ success: false, message: 'Account deactivated. Contact support.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please log in again.' });
    }
    next(err);
  }
};

// Admin only
const adminOnly = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
    return res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
  }
  next();
};

// Optional auth — attaches user if token present, doesn't block if not
const optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const result = await query('SELECT id, first_name, last_name, email, role FROM users WHERE id = $1', [decoded.id]);
      if (result.rows.length > 0) req.user = result.rows[0];
    }
  } catch (_) {}
  next();
};

module.exports = { protect, adminOnly, optionalAuth };
