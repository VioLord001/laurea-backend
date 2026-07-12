const { query } = require('../config/database');
const slugify = require('../utils/slugify');

const getProducts = async (req, res, next) => {
  try {
    const { department, category, badge, minPrice, maxPrice, sort = 'created_at', order = 'DESC', page = 1, limit = 20, featured, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = ['p.is_active = true'];
    const params = [];
    let paramCount = 1;
    if (department) { conditions.push(`p.department = $${paramCount++}`); params.push(department); }
    if (badge) { conditions.push(`p.badge = $${paramCount++}`); params.push(badge); }
    if (minPrice) { conditions.push(`p.price >= $${paramCount++}`); params.push(minPrice); }
    if (maxPrice) { conditions.push(`p.price <= $${paramCount++}`); params.push(maxPrice); }
    if (featured === 'true') { conditions.push(`p.is_featured = true`); }
    if (search) { conditions.push(`(p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount})`); params.push(`%${search}%`); paramCount++; }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const allowedSorts = ['price', 'created_at', 'average_rating', 'name'];
    const sortColumn = allowedSorts.includes(sort) ? `p.${sort}` : 'p.created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const countResult = await query(`SELECT COUNT(*) FROM products p ${whereClause}`, params);
    const result = await query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug,
        (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = true LIMIT 1) as primary_image
       FROM products p LEFT JOIN categories c ON p.category_id = c.id
       ${whereClause} ORDER BY ${sortColumn} ${sortOrder}
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...params, parseInt(limit), offset]
    );
    const total = parseInt(countResult.rows[0].count);
    res.json({ success: true, count: result.rows.length, total, totalPages: Math.ceil(total / parseInt(limit)), currentPage: parseInt(page), products: result.rows });
  } catch (err) { next(err); }
};

const getProduct = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const result = await query(
      `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.slug = $1 AND p.is_active = true`,
      [slug]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Product not found.' });
    const product = result.rows[0];
    const images = await query('SELECT * FROM product_images WHERE product_id = $1 ORDER BY sort_order', [product.id]);
    const variants = await query('SELECT * FROM product_variants WHERE product_id = $1', [product.id]);
    res.json({ success: true, product: { ...product, images: images.rows, variants: variants.rows } });
  } catch (err) { next(err); }
};

const createProduct = async (req, res, next) => {
  try {
    const { name, description, price, comparePrice, compare_price, categoryId, department, badge, tags, isFeatured, category, sizes, colors, stock } = req.body;
    const slug = slugify(name) + '-' + Date.now();
    const finalComparePrice = comparePrice || compare_price || null;
    const finalTags = tags || sizes || [];
    const result = await query(
      `INSERT INTO products (name, slug, description, price, compare_price, department, badge, tags, is_featured, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true) RETURNING *`,
      [name, slug, description || '', parseFloat(price), finalComparePrice ? parseFloat(finalComparePrice) : null, department, badge || null, finalTags, isFeatured || false]
    );
    res.status(201).json({ success: true, product: result.rows[0] });
  } catch (err) { next(err); }
};

const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, price, comparePrice, compare_price, department, badge, tags, isFeatured, isActive, sizes, colors } = req.body;
    const finalTags = tags || sizes || null;
    const result = await query(
      `UPDATE products SET
        name = COALESCE($1, name), description = COALESCE($2, description),
        price = COALESCE($3, price), compare_price = COALESCE($4, compare_price),
        department = COALESCE($5, department), badge = COALESCE($6, badge),
        tags = COALESCE($7, tags), is_featured = COALESCE($8, is_featured),
        is_active = COALESCE($9, is_active), updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [name, description, price ? parseFloat(price) : null, comparePrice || compare_price ? parseFloat(comparePrice || compare_price) : null, department, badge, finalTags, isFeatured, isActive, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Product not found.' });
    res.json({ success: true, product: result.rows[0] });
  } catch (err) { next(err); }
};

const deleteProduct = async (req, res, next) => {
  try {
    await query('UPDATE products SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Product deleted.' });
  } catch (err) { next(err); }
};

const uploadProductImages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const results = [];

    if (req.body && req.body.url) {
      const existingImages = await query('SELECT COUNT(*) FROM product_images WHERE product_id = $1', [id]);
      const count = parseInt(existingImages.rows[0].count);
      const result = await query(
        'INSERT INTO product_images (product_id, url, is_primary, sort_order) VALUES ($1, $2, $3, $4) RETURNING *',
        [id, req.body.url, count === 0, count]
      );
      results.push(result.rows[0]);
      return res.status(201).json({ success: true, images: results });
    }

    if (req.files && req.files.length > 0) {
      const existingCount = await query('SELECT COUNT(*) FROM product_images WHERE product_id = $1', [id]);
      let startIndex = parseInt(existingCount.rows[0].count);

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        let imageUrl = null;

        try {
          const cloudinary = require('cloudinary').v2;
          cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
          });
          const uploadResult = await cloudinary.uploader.upload(file.path, {
            folder: 'laurea/products',
            resource_type: 'image',
          });
          imageUrl = uploadResult.secure_url;
        } catch (cloudErr) {
          console.error('Cloudinary upload error:', cloudErr.message);
          continue;
        }

        if (imageUrl) {
          const isPrimary = startIndex === 0 && i === 0;
          const result = await query(
            'INSERT INTO product_images (product_id, url, is_primary, sort_order) VALUES ($1, $2, $3, $4) RETURNING *',
            [id, imageUrl, isPrimary, startIndex + i]
          );
          results.push(result.rows[0]);
        }
      }
    }

    if (results.length === 0) {
      return res.status(400).json({ success: false, message: 'No images were uploaded. Please check your Cloudinary settings.' });
    }

    res.status(201).json({ success: true, images: results });
  } catch (err) { next(err); }
};

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct, uploadProductImages };