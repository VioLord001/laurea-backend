const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { query } = require('../config/database');

router.get('/', protect, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT ci.*, p.name, p.price, p.slug,
        (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = true LIMIT 1) as image,
        pv.size, pv.color
       FROM cart_items ci JOIN products p ON ci.product_id = p.id
       LEFT JOIN product_variants pv ON ci.variant_id = pv.id
       WHERE ci.user_id = $1`,
      [req.user.id]
    );
    res.json({ success: true, items: result.rows });
  } catch (err) { next(err); }
});

router.post('/', protect, async (req, res, next) => {
  try {
    const { productId, variantId, quantity = 1 } = req.body;
    await query(
      `INSERT INTO cart_items (user_id, product_id, variant_id, quantity)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, product_id, variant_id)
       DO UPDATE SET quantity = cart_items.quantity + $4`,
      [req.user.id, productId, variantId, quantity]
    );
    res.json({ success: true, message: 'Added to cart.' });
  } catch (err) { next(err); }
});

router.put('/:id', protect, async (req, res, next) => {
  try {
    const { quantity } = req.body;
    if (quantity <= 0) {
      await query('DELETE FROM cart_items WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    } else {
      await query('UPDATE cart_items SET quantity = $1 WHERE id = $2 AND user_id = $3', [quantity, req.params.id, req.user.id]);
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/:id', protect, async (req, res, next) => {
  try {
    await query('DELETE FROM cart_items WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/', protect, async (req, res, next) => {
  try {
    await query('DELETE FROM cart_items WHERE user_id = $1', [req.user.id]);
    res.json({ success: true, message: 'Cart cleared.' });
  } catch (err) { next(err); }
});

module.exports = router;
