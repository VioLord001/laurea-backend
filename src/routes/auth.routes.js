const express = require('express');
const router = express.Router();
const { register, login, logout, forgotPassword, resetPassword, getMe } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { body } = require('express-validator');
const validate = require('../middleware/validate.middleware');

router.post('/register', [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase and number'),
  validate
], register);

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate
], login);

router.post('/logout', protect, logout);
router.post('/forgot-password', [body('email').isEmail().normalizeEmail(), validate], forgotPassword);
router.patch('/reset-password/:token', [body('password').isLength({ min: 8 }), validate], resetPassword);
router.get('/me', protect, getMe);

module.exports = router;
