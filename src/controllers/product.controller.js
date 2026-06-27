// ============================================
// STAGE 3: PRODUCT CONTROLLER
// CRUD for products, filtering, search
// ============================================
const { query } = require('../config/database');
const { uploadToCloudinary, deleteFromCloudinary } = require('../services/cloudinary.service');
const slugify = require('../utils/slugify');

// GET /api/products — with filters
const getProducts = async (req, res, next) => {
  try {
    const {
      department, category, badge, minPrice, maxPrice,
      sort = 'created_at', order = 'DESC',
      page = 1, limit = 20, featured, search
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = ['p.is_active = true'];
    const params = [];
    let paramCount = 1;

    if (department) { conditions.push(`p.department = $${paramCount++}`); params.push(department); }
    if (category) { conditions.push(`c.slug = $${paramCount++}`); params.push(category); }
    if (badge) { conditions.push(`p.badge = $${paramCount++}`); params.push(badge); }
    if (minPrice) { conditions.push(`p.price >= $${paramCount++}`); params.push(minPrice); }
    if (maxPrice) { conditions.push(`p.price <= $${paramCount++}`); params.push(maxPrice); }
    if (featured === 'true') { conditions.push(`p.is_featured = true`); }
    if (search) {
      conditions.push(`(p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount})`);
      params.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const allowedSorts = ['price', 'created_at', 'average_rating', 'review_count', 'name'];
    const sortColumn = allowedSorts.includes(sort) ? `p.${sort}` : 'p.created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countResult = await query(
      `SELECT COUNT(*) FROM products p LEFT JOIN categories c ON p.category_id = c.id ${whereClause}`,
      params
    );

    const result = await query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug,
        (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = true LIMIT 1) as primary_image
       FROM products p LEFT JOIN categories c ON p.category_id = c.id
       ${whereClause}
       ORDER BY ${sortColumn} ${sortOrder}
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...params, parseInt(limit), offset]
    );

    const total = parseInt(countResult.rows[0].count);
    res.json({
      success: true,
      count: result.rows.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      products: result.rows
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/products/:slug
const getProduct = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const result = await query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM products p LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.slug = $1 AND p.is_active = true`,
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const product = result.rows[0];

    // Get images
    const images = await query('SELECT * FROM product_images WHERE product_id = $1 ORDER BY sort_order', [product.id]);
    // Get variants
    const variants = await query('SELECT * FROM product_variants WHERE product_id = $1', [product.id]);
    // Get reviews
    const reviews = await query(
      `SELECT r.*, u.first_name, u.last_name, u.avatar FROM reviews r
       JOIN users u ON r.user_id = u.id WHERE r.product_id = $1 AND r.is_approved = true
       ORDER BY r.created_at DESC LIMIT 10`,
      [product.id]
    );

    res.json({ success: true, product: { ...product, images: images.rows, variants: variants.rows, reviews: reviews.rows } });
  } catch (err) {
    next(err);
  }
};

// POST /api/products — Admin only
const createProduct = async (req, res, next) => {
  try {
    const { name, description, price, comparePrice, categoryId, department, badge, tags, isFeatured } = req.body;
    const slug = slugify(name);

    const result = await query(
      `INSERT INTO products (name, slug, description, price, compare_price, category_id, department, badge, tags, is_featured)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [name, slug, description, price, comparePrice, categoryId, department, badge, tags, isFeatured || false]
    );

    res.status(201).json({ success: true, product: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// PUT /api/products/:id — Admin only
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, price, comparePrice, categoryId, department, badge, tags, isFeatured, isActive } = req.body;

    const result = await query(
      `UPDATE products SET
        name = COALESCE($1, name), description = COALESCE($2, description),
        price = COALESCE($3, price), compare_price = COALESCE($4, compare_price),
        category_id = COALESCE($5, category_id), department = COALESCE($6, department),
        badge = COALESCE($7, badge), tags = COALESCE($8, tags),
        is_featured = COALESCE($9, is_featured), is_active = COALESCE($10, is_active),
        updated_at = NOW()
       WHERE id = $11 RETURNING *`,
      [name, description, price, comparePrice, categoryId, department, badge, tags, isFeatured, isActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/products/:id — Admin only
const deleteProduct = async (req, res, next) => {
  try {
    await query('UPDATE products SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Product deactivated.' });
  } catch (err) {
    next(err);
  }
};

// POST /api/products/:id/images
const uploadProductImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No images provided.' });
    }

    const imagePromises = req.files.map(async (file, index) => {
      const result = await uploadToCloudinary(file.path, 'laurea/products');
      return query(
        'INSERT INTO product_images (product_id, url, is_primary, sort_order) VALUES ($1, $2, $3, $4) RETURNING *',
        [req.params.id, result.secure_url, index === 0, index]
      );
    });

    const results = await Promise.all(imagePromises);
    res.status(201).json({ success: true, images: results.map(r => r.rows[0]) });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct, uploadProductImages };
