const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// POST /api/staff/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await query('SELECT * FROM staff WHERE email = $1 AND is_active = true', [email]);
    if (result.rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    const staff = result.rows[0];
    const match = await bcrypt.compare(password, staff.password);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    const token = jwt.sign({ id: staff.id, role: staff.role, type: 'staff' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const { password: _, ...staffData } = staff;
    res.json({ success: true, token, staff: staffData });
  } catch (err) { next(err); }
});

module.exports = router;