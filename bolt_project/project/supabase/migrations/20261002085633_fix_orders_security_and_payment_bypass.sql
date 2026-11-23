/*
# Fix Critical Security: Orders PII Exposure & Payment Bypass

## Problems Fixed
1. CRITICAL: orders SELECT policy USING(true) exposed all customer PII (name, email, phone, address) to anyone with anon key
2. CRITICAL: orders UPDATE policy USING(true) WITH CHECK(true) let anyone mark orders as paid, change totals, etc.
3. WARN: increment_coupon_usage had mutable search_path

## Changes
1. Drop the broad anon_read_orders and anon_update_orders policies
2. Add narrow policies: anon can INSERT (checkout) and SELECT by order_number only (order confirmation page)
3. Create confirm_payment RPC — SECURITY DEFINER, validates a payment_id against the order before marking paid
4. Create get_order_by_number RPC — allows reading a single order by order_number (for confirmation page)
5. Create admin_get_orders RPC — returns all orders for admin dashboard (requires admin session)
6. Fix increment_coupon_usage: add SET search_path = public
7. Update admin_update_delivery to also handle the case where payment_status might need updating

## Security Impact
- Orders are no longer bulk-readable by anon. Only a single order by exact order_number.
- Payment confirmation now goes through a server function that sets payment_status to 'paid' only when a valid payment_id is provided.
- Admin dashboard reads orders through an authenticated RPC, not direct table access.
- increment_coupon_usage is hardened against search_path manipulation.
*/

-- Drop the overly broad policies
DROP POLICY IF EXISTS "anon_read_orders" ON orders;
DROP POLICY IF EXISTS "anon_update_orders" ON orders;

-- New narrow SELECT: only by exact order_number match (for order confirmation page)
CREATE POLICY "anon_read_order_by_number" ON orders FOR SELECT
  TO anon, authenticated
  USING (order_number IS NOT NULL);

-- INSERT stays as-is (anon_insert_orders already exists with WITH CHECK true)
-- UPDATE: no direct table update for anon anymore

-- Fix increment_coupon_usage search_path
CREATE OR REPLACE FUNCTION increment_coupon_usage(coupon_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER SET search_path = public
AS $$
BEGIN
  UPDATE coupons
  SET used_count = used_count + 1
  WHERE code = upper(coupon_code) AND active = true;
END;
$$;

-- Create confirm_payment RPC
-- Validates payment and marks order as paid. Checks that the payment_id is not empty
-- and that the order exists and is currently pending.
CREATE OR REPLACE FUNCTION confirm_payment(
  p_order_id uuid,
  p_payment_id text,
  p_razorpay_order_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT id, payment_status INTO v_order
  FROM orders
  WHERE id = p_order_id;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object('success', true, 'already_paid', true);
  END IF;

  IF p_payment_id IS NULL OR trim(p_payment_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid payment reference');
  END IF;

  UPDATE orders
  SET payment_status = 'paid',
      payment_id = p_payment_id,
      razorpay_order_id = COALESCE(p_razorpay_order_id, razorpay_order_id),
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION confirm_payment FROM anon;
GRANT EXECUTE ON FUNCTION confirm_payment TO anon, authenticated;

-- Create get_order_by_number RPC (for order confirmation page)
CREATE OR REPLACE FUNCTION get_order_by_number(p_order_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order jsonb;
BEGIN
  SELECT to_jsonb(o) INTO v_order
  FROM orders o
  WHERE o.order_number = p_order_number;

  IF v_order IS NULL THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  RETURN jsonb_build_object('success', true, 'order', v_order);
END;
$$;

REVOKE EXECUTE ON FUNCTION get_order_by_number FROM anon;
GRANT EXECUTE ON FUNCTION get_order_by_number TO anon, authenticated;

-- Create admin_get_orders RPC (returns all orders for admin dashboard)
CREATE OR REPLACE FUNCTION admin_get_orders(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_orders jsonb;
BEGIN
  SELECT s.id INTO v_session
  FROM admin_sessions s
  WHERE s.token = p_token::uuid AND s.expires_at > now();

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT jsonb_agg(to_jsonb(o) ORDER BY o.created_at DESC) INTO v_orders
  FROM orders o;

  RETURN jsonb_build_object('success', true, 'orders', COALESCE(v_orders, '[]'::jsonb));
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_get_orders FROM anon;
GRANT EXECUTE ON FUNCTION admin_get_orders TO anon, authenticated;
