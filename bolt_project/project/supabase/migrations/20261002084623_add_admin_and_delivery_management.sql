/*
# Add Admin Authentication, Product Management, and Order Delivery

1. New Tables
- `admins` — admin users (id, username, password_hash, created_at)
- `admin_sessions` — session tokens for admin login (id, admin_id, token, expires_at, created_at)

2. Modified Tables
- `orders` — add columns: delivery_date (date), delivery_status (text), updated_at (timestamptz)

3. New Functions (SECURITY DEFINER)
- `admin_login(p_username, p_password)` — validates credentials, creates session, returns token
- `admin_verify_session(p_token)` — checks if token is valid and not expired
- `admin_logout(p_token)` — invalidates a session
- `admin_add_product(...)` — inserts a new product (requires valid session)
- `admin_delete_product(p_product_id)` — deletes a product (requires valid session)
- `admin_update_delivery(p_order_id, p_delivery_date, p_delivery_status)` — updates order delivery info (requires valid session)

4. Security
- Admins table: RLS enabled, no SELECT/INSERT/UPDATE/DELETE for anon (only through SECURITY DEFINER functions)
- Admin sessions: RLS enabled, no direct access for anon
- Products: existing SELECT-only policy for anon remains; INSERT/DELETE only through admin_add_product/admin_delete_product
- Orders: existing policies remain; delivery columns updated only through admin_update_delivery
- All SECURITY DEFINER functions validate session token before performing operations
- EXECUTE granted to anon so the frontend can call them
- Passwords hashed with pgcrypto crypt()/gen_salt('bf')

5. Notes
- Initial admin: username 'sameer', password 'saisankalp@2025'
- Session tokens are UUIDs, expire after 24 hours
- delivery_status values: 'pending', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'
*/

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Admins table
CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- No policies on admins — access only through SECURITY DEFINER functions

-- Admin sessions table
CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

-- No policies on admin_sessions — access only through SECURITY DEFINER functions

-- Add delivery columns to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date date;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Insert initial admin (username=sameer, password=saisankalp@2025)
INSERT INTO admins (username, password_hash)
VALUES ('sameer', crypt('saisankalp@2025', gen_salt('bf')))
ON CONFLICT (username) DO NOTHING;

-- Admin login function
CREATE OR REPLACE FUNCTION admin_login(p_username text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_admin RECORD;
  v_token uuid;
BEGIN
  SELECT id, username, password_hash INTO v_admin
  FROM admins
  WHERE username = lower(p_username);

  IF v_admin.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid credentials');
  END IF;

  IF v_admin.password_hash != crypt(p_password, v_admin.password_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid credentials');
  END IF;

  INSERT INTO admin_sessions (admin_id)
  VALUES (v_admin.id)
  RETURNING token INTO v_token;

  RETURN jsonb_build_object(
    'success', true,
    'token', v_token::text,
    'username', v_admin.username
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_login FROM anon;
GRANT EXECUTE ON FUNCTION admin_login TO anon, authenticated;

-- Admin verify session function
CREATE OR REPLACE FUNCTION admin_verify_session(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session RECORD;
BEGIN
  SELECT s.id, s.admin_id, s.expires_at, a.username
  INTO v_session
  FROM admin_sessions s
  JOIN admins a ON a.id = s.admin_id
  WHERE s.token = p_token::uuid
    AND s.expires_at > now();

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'username', v_session.username,
    'admin_id', v_session.admin_id::text
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_verify_session FROM anon;
GRANT EXECUTE ON FUNCTION admin_verify_session TO anon, authenticated;

-- Admin logout function
CREATE OR REPLACE FUNCTION admin_logout(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM admin_sessions WHERE token = p_token::uuid;
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_logout FROM anon;
GRANT EXECUTE ON FUNCTION admin_logout TO anon, authenticated;

-- Admin add product function
CREATE OR REPLACE FUNCTION admin_add_product(
  p_token text,
  p_name text,
  p_slug text,
  p_description text,
  p_price numeric,
  p_sale_price numeric,
  p_category_id uuid,
  p_image_url text,
  p_images jsonb,
  p_stock integer,
  p_rating numeric,
  p_review_count integer,
  p_featured boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_product_id uuid;
BEGIN
  SELECT s.id INTO v_session
  FROM admin_sessions s
  WHERE s.token = p_token::uuid AND s.expires_at > now();

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  INSERT INTO products (name, slug, description, price, sale_price, category_id, image_url, images, stock, rating, review_count, featured)
  VALUES (p_name, p_slug, p_description, p_price, p_sale_price, p_category_id, p_image_url, p_images, p_stock, COALESCE(p_rating, 0), COALESCE(p_review_count, 0), COALESCE(p_featured, false))
  RETURNING id INTO v_product_id;

  RETURN jsonb_build_object('success', true, 'product_id', v_product_id::text);
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_add_product FROM anon;
GRANT EXECUTE ON FUNCTION admin_add_product TO anon, authenticated;

-- Admin delete product function
CREATE OR REPLACE FUNCTION admin_delete_product(p_token text, p_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session RECORD;
BEGIN
  SELECT s.id INTO v_session
  FROM admin_sessions s
  WHERE s.token = p_token::uuid AND s.expires_at > now();

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  DELETE FROM products WHERE id = p_product_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_delete_product FROM anon;
GRANT EXECUTE ON FUNCTION admin_delete_product TO anon, authenticated;

-- Admin update delivery function
CREATE OR REPLACE FUNCTION admin_update_delivery(
  p_token text,
  p_order_id uuid,
  p_delivery_date date,
  p_delivery_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session RECORD;
BEGIN
  SELECT s.id INTO v_session
  FROM admin_sessions s
  WHERE s.token = p_token::uuid AND s.expires_at > now();

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF p_delivery_status NOT IN ('pending', 'shipped', 'out_for_delivery', 'delivered', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid delivery status');
  END IF;

  UPDATE orders
  SET delivery_date = p_delivery_date,
      delivery_status = p_delivery_status,
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_update_delivery FROM anon;
GRANT EXECUTE ON FUNCTION admin_update_delivery TO anon, authenticated;
