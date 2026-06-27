// ============================================
// STAGE 3: ORDER CONTROLLER
// Create, track, update orders
// ============================================
const { query } = require('../config/database');
const { sendEmail } = require('../services/email.service');

const generateOrderNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LFH-${timestamp}-${random}`;
};

// POST /api/orders
const createOrder = async (req, res, next) => {
  const client = require('../config/database').pool;
  const dbClient = await client.connect();
  try {
    await dbClient.query('BEGIN');
    const { items, shippingAddress, billingAddress, promoCode, paymentMethod } = req.body;
    const userId = req.user.id;

    // Validate & calculate items
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const productRes = await dbClient.query(
        'SELECT p.*, pv.quantity as stock FROM products p LEFT JOIN product_variants pv ON pv.id = $2 WHERE p.id = $1 AND p.is_active = true',
        [item.productId, item.variantId || null]
      );
      if (productRes.rows.length === 0) throw new Error(`Product ${item.productId} not found.`);
      const product = productRes.rows[0];
      if (product.stock !== null && product.stock < item.quantity) throw new Error(`Insufficient stock for ${product.name}.`);

      const price = parseFloat(product.price);
      subtotal += price * item.quantity;
      orderItems.push({ ...item, unitPrice: price, productName: product.name });
    }

    // Apply promo code
    let discountAmount = 0;
    if (promoCode) {
      const promo = await dbClient.query(
        `SELECT * FROM promo_codes WHERE code = $1 AND is_active = true
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (max_uses IS NULL OR current_uses < max_uses)`,
        [promoCode.toUpperCase()]
      );
      if (promo.rows.length > 0) {
        const p = promo.rows[0];
        if (subtotal >= parseFloat(p.min_order_amount)) {
          discountAmount = p.type === 'percentage' ? subtotal * (parseFloat(p.value) / 100) : parseFloat(p.value);
          await dbClient.query('UPDATE promo_codes SET current_uses = current_uses + 1 WHERE id = $1', [p.id]);
        }
      }
    }

    const shippingCost = subtotal >= 30 ? 0 : 4.99;
    const total = subtotal + shippingCost - discountAmount;

    // Create order
    const orderRes = await dbClient.query(
      `INSERT INTO orders (order_number, user_id, subtotal, shipping_cost, discount_amount, total_amount, promo_code, payment_method, shipping_address, billing_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [generateOrderNumber(), userId, subtotal, shippingCost, discountAmount, total, promoCode, paymentMethod, JSON.stringify(shippingAddress), JSON.stringify(billingAddress)]
    );
    const order = orderRes.rows[0];

    // Insert order items
    for (const item of orderItems) {
      await dbClient.query(
        `INSERT INTO order_items (order_id, product_id, variant_id, product_name, quantity, unit_price, total_price, size, color)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [order.id, item.productId, item.variantId, item.productName, item.quantity, item.unitPrice, item.unitPrice * item.quantity, item.size, item.color]
      );
    }

    // Clear cart
    await dbClient.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);

    await dbClient.query('COMMIT');

    // Send order confirmation email
    const user = await query('SELECT * FROM users WHERE id = $1', [userId]);
    await sendEmail({
      to: user.rows[0].email,
      subject: `Order confirmed — ${order.order_number}`,
      template: 'orderConfirmation',
      data: { firstName: user.rows[0].first_name, order, items: orderItems }
    });

    res.status(201).json({ success: true, order });
  } catch (err) {
    await dbClient.query('ROLLBACK');
    next(err);
  } finally {
    dbClient.release();
  }
};

// GET /api/orders — user's orders
const getMyOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const result = await query(
      `SELECT o.*, COALESCE(json_agg(oi.*) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
       FROM orders o LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.user_id = $1 GROUP BY o.id ORDER BY o.created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.id, parseInt(limit), offset]
    );
    res.json({ success: true, orders: result.rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/orders/:id
const getOrder = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT o.*, COALESCE(json_agg(oi.*) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
       FROM orders o LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.id = $1 AND o.user_id = $2 GROUP BY o.id`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Order not found.' });
    res.json({ success: true, order: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = { createOrder, getMyOrders, getOrder };
