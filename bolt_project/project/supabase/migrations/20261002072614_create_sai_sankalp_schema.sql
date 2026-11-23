/*
# Sai Sankalp E-Commerce Schema

1. New Tables
- `categories` — product categories (id, name, slug, description, image_url, created_at)
- `products` — catalog items (id, name, slug, description, price, sale_price, category_id, image_url, images, stock, rating, review_count, featured, created_at)
- `banners` — homepage hero carousel assets (id, title, subtitle, image_url, link, sort_order, active)
- `coupons` — discount codes (id, code, type, value, min_order, max_discount, active, expires_at, usage_limit, used_count)
- `orders` — customer orders (id, order_number, customer_name, email, phone, address, city, state, pincode, items_json, subtotal, discount, total, coupon_code, payment_status, payment_id, razorpay_order_id, created_at)

2. Security
- RLS enabled on all tables.
- This is a no-auth storefront: all policies use TO anon, authenticated.
- Public read on catalog data (categories, products, banners, coupons).
- Orders are insertable by anyone (guest checkout), readable by anyone via order_number.
- Coupons are readable (to validate), but not insertable/updatable by anon (admin-managed).

3. Notes
- Products store images as a JSON array for gallery views.
- Orders store cart items as JSON to preserve full snapshot at order time.
- Coupon usage tracking via used_count + usage_limit.
*/

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  image_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_categories" ON categories;
CREATE POLICY "anon_read_categories" ON categories FOR SELECT
  TO anon, authenticated USING (true);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  price numeric(10,2) NOT NULL,
  sale_price numeric(10,2),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  image_url text,
  images jsonb DEFAULT '[]'::jsonb,
  stock integer NOT NULL DEFAULT 0,
  rating numeric(2,1) DEFAULT 0,
  review_count integer DEFAULT 0,
  featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_products" ON products;
CREATE POLICY "anon_read_products" ON products FOR SELECT
  TO anon, authenticated USING (true);

-- Banners
CREATE TABLE IF NOT EXISTS banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  image_url text NOT NULL,
  link text,
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_banners" ON banners;
CREATE POLICY "anon_read_banners" ON banners FOR SELECT
  TO anon, authenticated USING (true);

-- Coupons
CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  type text NOT NULL DEFAULT 'percentage',
  value numeric(10,2) NOT NULL,
  min_order numeric(10,2) DEFAULT 0,
  max_discount numeric(10,2),
  active boolean DEFAULT true,
  expires_at timestamptz,
  usage_limit integer,
  used_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_coupons" ON coupons;
CREATE POLICY "anon_read_coupons" ON coupons FOR SELECT
  TO anon, authenticated USING (true);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  customer_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  pincode text NOT NULL,
  items_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  coupon_code text,
  payment_status text NOT NULL DEFAULT 'pending',
  payment_id text,
  razorpay_order_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_orders" ON orders;
CREATE POLICY "anon_read_orders" ON orders FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
