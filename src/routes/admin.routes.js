const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth.middleware');
const { query } = require('../config/database');

// All admin routes are protected
router.use(protect, adminOnly);

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const [products, orders, customers, revenue, recentLogins] = await Promise.all([
      query('SELECT COUNT(*) FROM products WHERE is_active = true'),
      query('SELECT COUNT(*) FROM orders'),
      query('SELECT COUNT(*) FROM users WHERE role = $1', ['customer']),
      query('SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE payment_status = $1', ['paid']),
      query(`SELECT u.first_name, u.last_name, u.email, u.last_login, u.login_count, us.ip_address, us.device
             FROM user_sessions us JOIN users u ON us.user_id = u.id
             ORDER BY us.logged_in_at DESC LIMIT 10`),
    ]);
    res.json({
      success: true,
      stats: {
        products: parseInt(products.rows[0].count),
        orders: parseInt(orders.rows[0].count),
        customers: parseInt(customers.rows[0].count),
        revenue: parseFloat(revenue.rows[0].total),
      },
      recentLogins: recentLogins.rows,
    });
  } catch (err) { next(err); }
});

// GET /api/admin/users — all users with login info
router.get('/users', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, first_name, last_name, email, role, is_active, is_approved,
       last_login, login_count, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json({ success: true, users: result.rows });
  } catch (err) { next(err); }
});

// PATCH /api/admin/users/:id/approve — approve or block user
router.patch('/users/:id/approve', async (req, res, next) => {
  try {
    const { is_approved } = req.body;
    await query('UPDATE users SET is_approved = $1 WHERE id = $2', [is_approved, req.params.id]);
    res.json({ success: true, message: is_approved ? 'User approved.' : 'User blocked.' });
  } catch (err) { next(err); }
});

// PATCH /api/admin/users/:id/role — change user role
router.patch('/users/:id/role', async (req, res, next) => {
  try {
    const { role } = req.body;
    await query('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.id]);
    res.json({ success: true, message: `User role updated to ${role}.` });
  } catch (err) { next(err); }
});

// GET /api/admin/orders
router.get('/orders', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT o.*, u.first_name, u.last_name, u.email
       FROM orders o LEFT JOIN users u ON o.user_id = u.id
       ORDER BY o.created_at DESC`
    );
    res.json({ success: true, orders: result.rows });
  } catch (err) { next(err); }
});

// PATCH /api/admin/orders/:id/status
router.patch('/orders/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    await query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [status, req.params.id]);
    res.json({ success: true, message: 'Order status updated.' });
  } catch (err) { next(err); }
});

// GET /api/admin/customers
router.get('/customers', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.*, COUNT(o.id) as order_count
       FROM users u LEFT JOIN orders o ON u.id = o.user_id
       WHERE u.role = 'customer'
       GROUP BY u.id ORDER BY u.created_at DESC`
    );
    res.json({ success: true, customers: result.rows });
  } catch (err) { next(err); }
});

// GET /api/admin/login-activity
router.get('/login-activity', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT us.*, u.first_name, u.last_name, u.email, u.role
       FROM user_sessions us JOIN users u ON us.user_id = u.id
       ORDER BY us.logged_in_at DESC LIMIT 50`
    );
    res.json({ success: true, sessions: result.rows });
  } catch (err) { next(err); }
});

// GET /api/admin/payment-settings
router.get('/payment-settings', async (req, res, next) => {
  res.json({
    success: true,
    settings: {
      stripeEnabled: !!process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'skip',
      currency: 'USD',
      paymentMethods: ['card', 'apple_pay', 'google_pay'],
    }
  });
});

module.exports = router;