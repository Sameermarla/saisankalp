"""
Sai Sankalp — Comprehensive Security Hardening & Functional Verification
========================================================================
Runs full test suite verifying that all vulnerabilities identified in the audit
are successfully remediated and all APIs function correctly.
Zero third-party dependencies (uses urllib.request).
"""

import urllib.request
import urllib.error
import json
import time

BASE_URL = "http://localhost:8000"

passed = 0
failed = 0
results = []

def test(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  ✅ [PASS] {name}")
        results.append((name, True, detail))
    else:
        failed += 1
        print(f"  ❌ [FAIL] {name} — {detail}")
        results.append((name, False, detail))

def http_req(path, method="GET", data=None, headers=None):
    url = f"{BASE_URL}{path}"
    hdrs = headers or {}
    encoded_data = None
    if data is not None:
        if isinstance(data, dict):
            encoded_data = json.dumps(data).encode("utf-8")
            if "Content-Type" not in hdrs:
                hdrs["Content-Type"] = "application/json"
        elif isinstance(data, str):
            encoded_data = data.encode("utf-8")
        elif isinstance(data, bytes):
            encoded_data = data
            
    req = urllib.request.Request(url, data=encoded_data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = resp.read().decode("utf-8", errors="ignore")
            resp_headers = dict(resp.headers)
            return resp.status, body, resp_headers
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        resp_headers = dict(e.headers)
        return e.code, body, resp_headers
    except Exception as e:
        return 0, str(e), {}

print("=" * 65)
print("🛡️  RUNNING SAI SANKALP SECURITY & REMEDIATION VERIFICATION SUITE")
print("=" * 65)

# ---------------------------------------------------------------------------
# Section 1: Static File Disclosure Protection (Audit Item C2)
# ---------------------------------------------------------------------------
print("\n--- 1. STATIC FILE DISCLOSURE & PATH TRAVERSAL DEFENSE ---")
status, body, _ = http_req("/.env")
test("Access to .env is blocked (403)", status == 403, f"Status: {status}")

status, body, _ = http_req("/config.properties")
test("Access to config.properties is blocked (403)", status == 403, f"Status: {status}")

status, body, _ = http_req("/mock_server.py")
test("Access to Python source files is blocked (403)", status == 403, f"Status: {status}")

status, body, _ = http_req("/Server.java")
test("Access to Java source files is blocked (403)", status == 403, f"Status: {status}")

status, body, _ = http_req("/data/users.json")
test("Access to data/ directory files is blocked (403)", status == 403, f"Status: {status}")

status, body, _ = http_req("/")
test("Homepage index.html loads successfully (200)", status == 200, f"Status: {status}")

status, body, _ = http_req("/styles.css")
test("Stylesheet styles.css loads successfully (200)", status == 200, f"Status: {status}")

status, body, _ = http_req("/app.js")
test("Frontend app.js loads successfully (200)", status == 200, f"Status: {status}")

# ---------------------------------------------------------------------------
# Section 2: CORS & Header Security (Audit Item C1, B1)
# ---------------------------------------------------------------------------
print("\n--- 2. CORS & HEADER HARDENING ---")
status, _, hdrs = http_req("/api/products", headers={"Origin": "http://localhost:8000"})
allow_origin = hdrs.get("Access-Control-Allow-Origin", hdrs.get("access-control-allow-origin", ""))
allow_headers = hdrs.get("Access-Control-Allow-Headers", hdrs.get("access-control-allow-headers", ""))

test("CORS does not use wildcard * for localhost requests", allow_origin == "http://localhost:8000", f"Origin returned: {allow_origin}")
test("X-Admin-Email header is completely removed from CORS allowed headers", "X-Admin-Email" not in allow_headers, f"Headers: {allow_headers}")

# ---------------------------------------------------------------------------
# Section 3: Admin Authorization & Header Spoofing (Audit Item B1)
# ---------------------------------------------------------------------------
print("\n--- 3. ADMIN AUTHORIZATION & HEADER SPOOFING DEFENSE ---")
# Attempt 1: Access admin orders with NO token
status, body, _ = http_req("/api/orders")
test("Accessing /api/orders without authentication is rejected (403)", status in [401, 403], f"Status: {status}")

# Attempt 2: Access admin orders with SPOOFED X-Admin-Email header and NO token
status, body, _ = http_req("/api/orders", headers={"X-Admin-Email": "saisameermarla@gmail.com"})
test("Spoofing X-Admin-Email is REJECTED without valid session token (403)", status in [401, 403], f"Status: {status}")

# ---------------------------------------------------------------------------
# Section 4: Public APIs & Database Querying (Phase 2)
# ---------------------------------------------------------------------------
print("\n--- 4. PUBLIC REST APIS & DATA RETRIEVAL ---")
status, body, _ = http_req("/api/products")
test("GET /api/products returns 200", status == 200, f"Status: {status}")
try:
    prods = json.loads(body)
    test("Products list contains items", isinstance(prods, list) and len(prods) > 0, f"Count: {len(prods) if isinstance(prods, list) else 0}")
except Exception as e:
    test("Products JSON is valid", False, str(e))

status, body, _ = http_req("/api/categories")
test("GET /api/categories returns 200", status == 200, f"Status: {status}")

status, body, _ = http_req("/api/coupons")
test("GET /api/coupons returns 200", status == 200, f"Status: {status}")

status, body, _ = http_req("/api/banners")
test("GET /api/banners returns 200", status == 200, f"Status: {status}")

# ---------------------------------------------------------------------------
# Section 5: Authentication & Session Token Lifecycle (Audit Item B2, B3)
# ---------------------------------------------------------------------------
print("\n--- 5. AUTHENTICATION & SESSION MANAGEMENT ---")
admin_token = None
admin_csrf = None

# Login as admin
status, body, _ = http_req("/api/auth/login", method="POST", data={"email": "saisameermarla@gmail.com", "password": "admin123"})
test("Admin login succeeds (200)", status == 200, f"Status: {status}")
if status == 200:
    try:
        login_data = json.loads(body)
        admin_token = login_data.get("token")
        admin_csrf = login_data.get("csrfToken")
        test("Login returned session token", bool(admin_token), f"Token: {admin_token}")
        test("Login returned role == 'admin'", login_data.get("role") == "admin", f"Role: {login_data.get('role')}")
    except Exception as e:
        test("Login JSON parseable", False, str(e))

# Access admin orders WITH Bearer token
if admin_token:
    status, body, _ = http_req("/api/orders", headers={"Authorization": f"Bearer {admin_token}"})
    test("Admin can access /api/orders with Bearer token (200)", status == 200, f"Status: {status}")

# ---------------------------------------------------------------------------
# Section 6: Payment Gateway Hardening (Audit Item A1, D3)
# ---------------------------------------------------------------------------
print("\n--- 6. PAYMENT SECURITY & RAZORPAY INTEGRATION ---")
# 1. Create Order
status, body, _ = http_req("/api/razorpay/create-order", method="POST", data={"amount": 499.00, "currency": "INR"})
test("POST /api/razorpay/create-order returns 200", status == 200, f"Status: {status}")
rzp_order_id = ""
if status == 200:
    try:
        rzp_data = json.loads(body)
        rzp_order_id = rzp_data.get("id")
        test("Razorpay order ID generated", bool(rzp_order_id), f"ID: {rzp_order_id}")
        test("Razorpay key returned from environment", bool(rzp_data.get("key")), f"Key: {rzp_data.get('key')}")
    except Exception as e:
        test("Razorpay JSON parseable", False, str(e))

# 2. Verify Payment (simulated valid signature)
status, body, _ = http_req("/api/razorpay/verify-payment", method="POST", data={
    "razorpay_payment_id": f"pay_test_{int(time.time())}",
    "razorpay_order_id": rzp_order_id or "order_test_12345",
    "razorpay_signature": "simulated_valid_signature",
    "amount": 499.00
})
test("Razorpay payment verification succeeds with valid signature (200)", status == 200, f"Status: {status}")

# 3. Verify Payment with forged/invalid signature -> MUST fail
status, body, _ = http_req("/api/razorpay/verify-payment", method="POST", data={
    "razorpay_payment_id": f"pay_fake_{int(time.time())}",
    "razorpay_order_id": "order_test_12345",
    "razorpay_signature": "forged_malicious_signature_1234567890",
    "amount": 499.00
})
test("Razorpay forged signature is REJECTED (400)", status == 400, f"Status: {status}")

# ---------------------------------------------------------------------------
# Section 7: Logout
# ---------------------------------------------------------------------------
print("\n--- 7. LOGOUT & SESSION INVALIDATION ---")
if admin_token:
    status, body, _ = http_req("/api/auth/logout", method="POST", headers={"Authorization": f"Bearer {admin_token}"})
    test("Logout succeeds (200)", status == 200, f"Status: {status}")
    
    # Verify session is invalidated
    status, body, _ = http_req("/api/orders", headers={"Authorization": f"Bearer {admin_token}"})
    test("Session is successfully invalidated after logout (401/403)", status in [401, 403], f"Status: {status}")

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
print("\n" + "=" * 65)
print("📊  VERIFICATION SUITE SUMMARY")
print("=" * 65)
print(f"  Total Tests: {passed + failed}")
print(f"  Passed:      {passed}")
print(f"  Failed:      {failed}")
rate = (passed / (passed + failed) * 100) if (passed + failed) > 0 else 0
print(f"  Pass Rate:   {rate:.1f}%")
print("=" * 65)

if failed == 0:
    print("✨ ALL SECURITY & REPAIR OBJECTIVES HAVE PASSED SUCCESSFULLY! ✨\n")
else:
    print(f"⚠️  {failed} tests failed. Please review the details above.\n")
