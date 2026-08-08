const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth.middleware');
const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

router.use(protect, adminOnly);

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const [products, orders, customers, revenue] = await Promise.all([
      query('SELECT COUNT(*) FROM products WHERE is_active = true'),
      query('SELECT COUNT(*) FROM orders'),
      query('SELECT COUNT(*) FROM users WHERE role = $1', ['customer']),
      query('SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE payment_status = $1', ['paid']),
    ]);
    let recentLogins = { rows: [] };
    try {
      recentLogins = await query(
        `SELECT u.first_name, u.last_name, u.email, u.last_login, u.login_count, us.ip_address, us.device
         FROM user_sessions us JOIN users u ON us.user_id = u.id
         ORDER BY us.logged_in_at DESC LIMIT 10`
      );
    } catch(e) { console.log('user_sessions not ready'); }
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

// GET /api/admin/users
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

// PATCH /api/admin/users/:id/approve
router.patch('/users/:id/approve', async (req, res, next) => {
  try {
    const { is_approved } = req.body;
    await query('UPDATE users SET is_approved = $1 WHERE id = $2', [is_approved, req.params.id]);
    res.json({ success: true, message: is_approved ? 'User approved.' : 'User blocked.' });
  } catch (err) { next(err); }
});

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', async (req, res, next) => {
  try {
    const { role } = req.body;
    await query('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.id]);

    // Send email when role is changed to employee
    if (role === 'employee') {
      try {
        const userResult = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          const { sendEmail } = require('../services/email.service');
          await sendEmail({
            to: user.email,
            template: 'employeeAccessGranted',
            data: {
              firstName: user.first_name,
              loginUrl: `${process.env.CLIENT_URL}/auth/login`
            }
          });
        }
      } catch(e) { console.log('Employee access email failed:', e.message); }
    }

    res.json({ success: true, message: `User role updated to ${role}.` });
  } catch (err) { next(err); }
});

// POST /api/admin/users/:id/force-logout
router.post('/users/:id/force-logout', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userResult = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    try {
      await query('DELETE FROM user_sessions WHERE user_id = $1', [id]);
    } catch(e) { console.log('Session delete error:', e.message); }
    await query('UPDATE users SET force_logout = true, updated_at = NOW() WHERE id = $1', [id]);
    res.json({ success: true, message: 'User has been logged out successfully.' });
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
    let result = { rows: [] };
    try {
      result = await query(
        `SELECT us.*, u.first_name, u.last_name, u.email, u.role
         FROM user_sessions us JOIN users u ON us.user_id = u.id
         ORDER BY us.logged_in_at DESC LIMIT 50`
      );
    } catch(e) { console.log('user_sessions not ready'); }
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

// GET /api/admin/pending-employees
router.get('/pending-employees', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, first_name, last_name, email, role, is_approved,
       is_email_verified, created_at, login_count, phone, whatsapp,
       nationality, country_of_residence, state, city, address,
       gender, dob, doc_type, doc_number, id_front_url, id_back_url,
       passport_photo_url, job_position, department, employment_type,
       work_location, supervisor, emergency_name, emergency_relationship,
       emergency_phone, employee_profile_completed
       FROM users WHERE role = 'employee' AND (is_approved = false OR is_approved IS NULL)
       ORDER BY created_at DESC`
    );
    res.json({ success: true, employees: result.rows });
  } catch (err) { next(err); }
});

// POST /api/admin/approve-employee/:id
router.post('/approve-employee/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { approved, reason } = req.body;
    const userResult = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (!userResult.rows.length) return res.status(404).json({ success: false, message: 'User not found.' });
    const user = userResult.rows[0];
    await query('UPDATE users SET is_approved = $1, updated_at = NOW() WHERE id = $2', [approved, id]);
    try {
      const { sendEmail } = require('../services/email.service');
      await sendEmail({
        to: user.email,
        template: approved ? 'employeeApproved' : 'employeeRejected',
        data: {
          firstName: user.first_name,
          reason: reason || '',
          loginUrl: `${process.env.CLIENT_URL}/auth/login`
        }
      });
    } catch(e) { console.log('Email failed:', e.message); }
    res.json({ success: true, message: approved ? 'Employee approved!' : 'Employee rejected.' });
  } catch (err) { next(err); }
});

module.exports = router;