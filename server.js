const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

const allowedOrigins = [
  'https://laureafashionhouse.com',
  'https://www.laureafashionhouse.com',
  'http://localhost:3000'
];

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts, please try again in 15 minutes.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Laurea Fashion House API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

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

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

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