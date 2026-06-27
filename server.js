// ============================================
// LAUREA FASHION HOUSE — MAIN SERVER
// Stage 3: Backend & Stage 4: Security
// ============================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// ── Stage 4: Security Middleware ──────────────────────
// Helmet sets secure HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS — only allow our frontend
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting — prevent brute force / spam
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Stricter limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts, please try again in 15 minutes.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Core Middleware ───────────────────────────────────
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Stripe webhook needs raw body — mount BEFORE json parser
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// ── Stage 7: Health Check ─────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Laurea Fashion House API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// ── Stage 3: API Routes ───────────────────────────────
app.use('/api/auth',       require('./src/routes/auth.routes'));
app.use('/api/users',      require('./src/routes/user.routes'));
app.use('/api/products',   require('./src/routes/product.routes'));
app.use('/api/categories', require('./src/routes/category.routes'));
app.use('/api/orders',     require('./src/routes/order.routes'));
app.use('/api/cart',       require('./src/routes/cart.routes'));
app.use('/api/wishlist',   require('./src/routes/wishlist.routes'));
app.use('/api/reviews',    require('./src/routes/review.routes'));
app.use('/api/payments',   require('./src/routes/payment.routes'));
app.use('/api/admin',      require('./src/routes/admin.routes'));
app.use('/api/search',     require('./src/routes/search.routes'));
app.use('/api/promo',      require('./src/routes/promo.routes'));

// ── 404 Handler ───────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ── Global Error Handler ──────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ── Start Server ──────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║   LAUREA FASHION HOUSE — API Server   ║
  ║   Port: ${PORT}  |  ENV: ${process.env.NODE_ENV || 'development'}        ║
  ╚═══════════════════════════════════════╝
  `);
});

module.exports = app;
