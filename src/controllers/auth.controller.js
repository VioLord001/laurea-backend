// ============================================
// STAGE 4: AUTH CONTROLLER
// Register, Login, Logout, Password Reset
// ============================================
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../config/database');
const { sendEmail } = require('../services/email.service');

// Generate JWT
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Send token in cookie + response
const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user.id);
  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };
  res.status(statusCode).cookie('token', token, cookieOptions).json({
    success: true,
    token,
    user: {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      role: user.role,
      avatar: user.avatar
    }
  });
};

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Check if user exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    // Hash password — Stage 4 Security: bcrypt with 12 salt rounds
    const hashedPassword = await bcrypt.hash(password, 12);
    const verifyToken = crypto.randomBytes(32).toString('hex');

    // Create user
    const result = await query(
      `INSERT INTO users (first_name, last_name, email, password, email_verify_token)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [firstName, lastName, email.toLowerCase(), hashedPassword, verifyToken]
    );

    const user = result.rows[0];

    // Send welcome email
    await sendEmail({
      to: user.email,
      subject: 'Welcome to Laurea Fashion House!',
      template: 'welcome',
      data: { firstName: user.first_name, verifyToken }
    });

    sendTokenResponse(user, 201, res);
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user with password
    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    // Check password
    if (!user.password) {
      return res.status(401).json({ success: false, message: 'Please login with your social account.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/logout
const logout = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
    if (token) {
      // Blacklist the token
      const decoded = jwt.decode(token);
      if (decoded?.exp) {
        await query(
          'INSERT INTO token_blacklist (token, expires_at) VALUES ($1, to_timestamp($2))',
          [token, decoded.exp]
        );
      }
    }
    res.cookie('token', '', { expires: new Date(0), httpOnly: true });
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);

    // Always return same message for security (don't reveal if email exists)
    const message = 'If that email exists, a reset link has been sent.';

    if (result.rows.length === 0) {
      return res.json({ success: true, message });
    }

    const user = result.rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await query(
      'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
      [hashedToken, expires, user.id]
    );

    await sendEmail({
      to: user.email,
      subject: 'Reset your Laurea password',
      template: 'passwordReset',
      data: { firstName: user.first_name, resetToken, resetUrl: `${process.env.CLIENT_URL}/auth/reset-password?token=${resetToken}` }
    });

    res.json({ success: true, message });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/auth/reset-password/:token
const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const result = await query(
      'SELECT * FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()',
      [hashedToken]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Reset token is invalid or has expired.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await query(
      'UPDATE users SET password = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $2',
      [hashedPassword, result.rows[0].id]
    );

    res.json({ success: true, message: 'Password reset successfully. Please log in.' });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

module.exports = { register, login, logout, forgotPassword, resetPassword, getMe };
