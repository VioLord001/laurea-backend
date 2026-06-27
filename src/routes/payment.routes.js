const express = require('express');
const router = express.Router();
const { createPaymentIntent, handleWebhook } = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/create-intent', protect, createPaymentIntent);
router.post('/webhook', handleWebhook);

module.exports = router;
