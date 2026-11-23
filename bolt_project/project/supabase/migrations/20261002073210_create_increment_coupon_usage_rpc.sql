/*
# Create increment_coupon_usage RPC function

1. New Functions
- `increment_coupon_usage(coupon_code text)` — atomically increments the used_count for a coupon by its code. Returns void. SECURITY INVOKER so RLS applies.

2. Security
- Uses SECURITY INVOKER (default), so the caller's RLS policies apply.
- Only increments existing, active coupons.
*/

CREATE OR REPLACE FUNCTION increment_coupon_usage(coupon_code text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE coupons
  SET used_count = used_count + 1
  WHERE code = upper(coupon_code) AND active = true;
END;
$$;
