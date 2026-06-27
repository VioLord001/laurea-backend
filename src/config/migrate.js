// ============================================
// DATABASE MIGRATION — Creates all tables
// Run: npm run migrate
// ============================================
require('dotenv').config();
const { pool } = require('./database');

const createTables = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🔄 Running migrations...\n');

    // ── Users ───────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255),
        phone VARCHAR(20),
        role VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('customer','admin','superadmin')),
        avatar TEXT,
        is_active BOOLEAN DEFAULT true,
        is_email_verified BOOLEAN DEFAULT false,
        email_verify_token TEXT,
        password_reset_token TEXT,
        password_reset_expires TIMESTAMPTZ,
        provider VARCHAR(50) DEFAULT 'local',
        provider_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ users table');

    // ── Addresses ───────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS addresses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        label VARCHAR(50) DEFAULT 'Home',
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        address_line1 VARCHAR(255) NOT NULL,
        address_line2 VARCHAR(255),
        city VARCHAR(100) NOT NULL,
        state VARCHAR(100),
        postal_code VARCHAR(20) NOT NULL,
        country VARCHAR(100) NOT NULL DEFAULT 'Nigeria',
        phone VARCHAR(20),
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ addresses table');

    // ── Categories ──────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
        department VARCHAR(50) CHECK (department IN ('women','men','kids','bags','jewelry','shoes','beauty','home')),
        image_url TEXT,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ categories table');

    // ── Products ────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        compare_price DECIMAL(10,2),
        cost_price DECIMAL(10,2),
        category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
        department VARCHAR(50),
        sku VARCHAR(100) UNIQUE,
        barcode VARCHAR(100),
        weight DECIMAL(8,2),
        badge VARCHAR(20) CHECK (badge IN ('new','sale','hot','exclusive',NULL)),
        is_active BOOLEAN DEFAULT true,
        is_featured BOOLEAN DEFAULT false,
        tags TEXT[],
        meta_title VARCHAR(255),
        meta_description TEXT,
        average_rating DECIMAL(3,2) DEFAULT 0,
        review_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ products table');

    // ── Product Images ──────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_images (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        alt_text VARCHAR(255),
        is_primary BOOLEAN DEFAULT false,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ product_images table');

    // ── Product Variants ────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        size VARCHAR(20),
        color VARCHAR(50),
        color_hex VARCHAR(7),
        quantity INTEGER DEFAULT 0,
        price_modifier DECIMAL(10,2) DEFAULT 0,
        sku VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ product_variants table');

    // ── Orders ──────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_number VARCHAR(20) UNIQUE NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(30) DEFAULT 'pending'
          CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled','refunded')),
        subtotal DECIMAL(10,2) NOT NULL,
        shipping_cost DECIMAL(10,2) DEFAULT 0,
        discount_amount DECIMAL(10,2) DEFAULT 0,
        tax_amount DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        promo_code VARCHAR(50),
        payment_method VARCHAR(50),
        payment_status VARCHAR(20) DEFAULT 'pending'
          CHECK (payment_status IN ('pending','paid','failed','refunded')),
        stripe_payment_intent_id TEXT,
        stripe_charge_id TEXT,
        shipping_address JSONB,
        billing_address JSONB,
        notes TEXT,
        tracking_number VARCHAR(100),
        shipped_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ orders table');

    // ── Order Items ─────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE SET NULL,
        variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
        product_name VARCHAR(255) NOT NULL,
        product_image TEXT,
        size VARCHAR(20),
        color VARCHAR(50),
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ order_items table');

    // ── Cart ────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, product_id, variant_id)
      );
    `);
    console.log('✅ cart_items table');

    // ── Wishlist ─────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS wishlist_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, product_id)
      );
    `);
    console.log('✅ wishlist_items table');

    // ── Reviews ──────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID REFERENCES products(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        title VARCHAR(255),
        body TEXT,
        is_verified_purchase BOOLEAN DEFAULT false,
        is_approved BOOLEAN DEFAULT true,
        helpful_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ reviews table');

    // ── Promo Codes ──────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS promo_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(50) UNIQUE NOT NULL,
        type VARCHAR(20) DEFAULT 'percentage' CHECK (type IN ('percentage','fixed','free_shipping')),
        value DECIMAL(10,2) NOT NULL,
        min_order_amount DECIMAL(10,2) DEFAULT 0,
        max_uses INTEGER,
        current_uses INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        starts_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ promo_codes table');

    // ── Sessions (for token blacklisting) ────
    await client.query(`
      CREATE TABLE IF NOT EXISTS token_blacklist (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✅ token_blacklist table');

    // ── Indexes for performance ───────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_department ON products(department);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
      CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
      CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
      CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
    `);
    console.log('✅ Indexes created');

    // ── Insert default promo code ─────────────
    await client.query(`
      INSERT INTO promo_codes (code, type, value, max_uses)
      VALUES ('LAUREA20', 'percentage', 20, 1000)
      ON CONFLICT (code) DO NOTHING;
    `);
    console.log('✅ Default promo code inserted (LAUREA20 — 20% off)');

    await client.query('COMMIT');
    console.log('\n✅ All migrations completed successfully!\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
};

createTables().catch(console.error);
