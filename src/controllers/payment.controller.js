// ============================================
// STAGE 3+4: PAYMENT CONTROLLER
// Stripe payment intents + webhooks
// ============================================
const stripe = process.env.STRIPE_SECRET_KEY && 
  process.env.STRIPE_SECRET_KEY !== 'skip' && 
  !process.env.STRIPE_SECRET_KEY.includes('your_stripe')
  ? require('stripe')(process.env.STRIPE_SECRET_KEY)
  : null;

const { query } = require('../config/database');

// POST /api/payments/create-intent
const createPaymentIntent = async (req, res, next) => {
  try {
    if (!stripe) {
      return res.status(503).json({ success: false, message: 'Payments not configured yet.' });
    }
    const { orderId } = req.body;
    const orderRes = await query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [orderId, req.user.id]
    );
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    const order = orderRes.rows[0];
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(parseFloat(order.total_amount) * 100),
      currency: order.currency?.toLowerCase() || 'usd',
      metadata: { orderId: order.id, orderNumber: order.order_number, userId: req.user.id },
      automatic_payment_methods: { enabled: true }
    });
    await query(
      'UPDATE orders SET stripe_payment_intent_id = $1 WHERE id = $2',
      [paymentIntent.id, orderId]
    );
    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/payments/webhook — Stripe sends events here
const handleWebhook = async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ message: 'Payments not configured yet.' });
  }
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ message: `Webhook signature failed: ${err.message}` });
  }
  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        await query(
          `UPDATE orders SET payment_status = 'paid', status = 'confirmed',
           stripe_charge_id = $1, updated_at = NOW()
           WHERE stripe_payment_intent_id = $2`,
          [pi.latest_charge, pi.id]
        );
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        await query(
          `UPDATE orders SET payment_status = 'failed', status = 'cancelled', updated_at = NOW()
           WHERE stripe_payment_intent_id = $1`,
          [pi.id]
        );
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object;
        await query(
          `UPDATE orders SET payment_status = 'refunded', status = 'refunded', updated_at = NOW()
           WHERE stripe_charge_id = $1`,
          [charge.id]
        );
        break;
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ message: 'Webhook processing failed.' });
  }
};

module.exports = { createPaymentIntent, handleWebhook };