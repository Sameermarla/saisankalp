"""
Sai Sankalp Website - Comprehensive Regression Test Suite
Tests all major flows: auth, products, cart, checkout, orders, admin, payments
"""

import requests
import json
import time
import hashlib
import sys

BASE_URL = "http://localhost:8000"
PASSWORD_SALT = "SAI_SANKALP_SECURE_SALT_2026"

# Track results
passed = 0
failed = 0
errors = []

def test(name, condition, detail=""):
    global passed, failed, errors
    if condition:
        passed += 1
        print(f"  ✅ {name}")
    else:
        failed += 1
        errors.append(f"{name}: {detail}")
        print(f"  ❌ {name} — {detail}")

def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

# ═══════════════════════════════════════════════
# 1. STATIC FILES & PAGE LOADING
# ═══════════════════════════════════════════════
section("1. STATIC FILES & PAGE LOADING")

r = requests.get(f"{BASE_URL}/")
test("Homepage loads (200)", r.status_code == 200)
test("Homepage contains <title>", "Sai Sankalp" in r.text)
test("Homepage has Open Graph tags", 'og:title' in r.text)
test("Homepage has back-to-top button", 'backToTopBtn' in r.text)
test("Homepage has toast container", 'toastContainer' in r.text)
test("Homepage has data-reveal attributes", 'data-reveal' in r.text)

r = requests.get(f"{BASE_URL}/styles.css")
test("styles.css loads (200)", r.status_code == 200)
test("CSS has dark mode", "prefers-color-scheme" in r.text)
test("CSS has toast styles", ".toast-container" in r.text)
test("CSS has scroll-reveal styles", "[data-reveal]" in r.text)

r = requests.get(f"{BASE_URL}/app.js")
test("app.js loads (200)", r.status_code == 200)
test("app.js has showToast function", "function showToast" in r.text)
test("app.js has switchPaymentMethod", "function switchPaymentMethod" in r.text)

for js_file in ["js/state.js", "js/auth.js", "js/cart.js", "js/storefront.js", "js/admin.js"]:
    r = requests.get(f"{BASE_URL}/{js_file}")
    test(f"{js_file} loads (200)", r.status_code == 200)

r = requests.get(f"{BASE_URL}/payment_gateway.html")
test("Payment gateway page loads (200)", r.status_code == 200)

# ═══════════════════════════════════════════════
# 2. PRODUCTS API
# ═══════════════════════════════════════════════
section("2. PRODUCTS API")

r = requests.get(f"{BASE_URL}/api/products")
test("GET /api/products returns 200", r.status_code == 200)
products = r.json()
test("Products is a list", isinstance(products, list))
test("Products has items", len(products) > 0, f"Got {len(products)} products")

if len(products) > 0:
    p = products[0]
    test("Product has 'id' field", "id" in p)
    test("Product has 'title' field", "title" in p)
    test("Product has 'price' field", "price" in p)
    test("Product has 'category' field", "category" in p)
    test("Product has 'categoryName' field", "categoryName" in p)
    test("Product has 'stock' field", "stock" in p)
    test("Product has 'image' field", "image" in p)
    test("Product price is positive", p["price"] > 0, f"Price: {p['price']}")
    
    # No deleted products should appear
    deleted = [p for p in products if p.get("isDeleted", False)]
    test("No deleted products in response", len(deleted) == 0, f"Found {len(deleted)} deleted")

# ═══════════════════════════════════════════════
# 3. CATEGORIES API
# ═══════════════════════════════════════════════
section("3. CATEGORIES API")

r = requests.get(f"{BASE_URL}/api/categories")
test("GET /api/categories returns 200", r.status_code == 200)
categories = r.json()
test("Categories is a list", isinstance(categories, list))
test("Has categories", len(categories) > 0, f"Got {len(categories)}")

# ═══════════════════════════════════════════════
# 4. COUPONS API
# ═══════════════════════════════════════════════
section("4. COUPONS API")

r = requests.get(f"{BASE_URL}/api/coupons")
test("GET /api/coupons returns 200", r.status_code == 200)
coupons = r.json()
test("Coupons response is valid", isinstance(coupons, (list, dict)))

# ═══════════════════════════════════════════════
# 5. AUTHENTICATION FLOW
# ═══════════════════════════════════════════════
section("5. AUTHENTICATION FLOW")

# 5a. Register a new test user
test_email = f"regtest_{int(time.time())}@test.com"
test_password = "TestPass123!"

r = requests.post(f"{BASE_URL}/api/auth/register", json={
    "email": test_email,
    "password": test_password
})
test("POST /api/auth/register returns 200", r.status_code == 200, f"Status: {r.status_code}, Body: {r.text[:200]}")

# 5b. Login with admin credentials
r = requests.post(f"{BASE_URL}/api/auth/login", json={
    "email": "saisameermarla@gmail.com",
    "password": "admin123"
})
test("Admin login returns 200", r.status_code == 200, f"Status: {r.status_code}, Body: {r.text[:200]}")

admin_token = ""
admin_csrf = ""
if r.status_code == 200:
    login_data = r.json()
    admin_token = login_data.get("token", "")
    admin_csrf = login_data.get("csrfToken", "")
    test("Login returns token", len(admin_token) > 0)
    test("Login returns role", login_data.get("role") == "admin", f"Role: {login_data.get('role')}")
    test("Login returns CSRF token", len(admin_csrf) > 0)

# 5c. Login with customer credentials
r = requests.post(f"{BASE_URL}/api/auth/login", json={
    "email": "john@gmail.com",
    "password": "john123"
})
test("Customer login returns 200", r.status_code == 200, f"Status: {r.status_code}, Body: {r.text[:200]}")

customer_token = ""
customer_csrf = ""
if r.status_code == 200:
    cust_data = r.json()
    customer_token = cust_data.get("token", "")
    customer_csrf = cust_data.get("csrfToken", "")
    test("Customer login returns token", len(customer_token) > 0)
    test("Customer role is 'customer'", cust_data.get("role") == "customer")

# 5d. Login with wrong password
r = requests.post(f"{BASE_URL}/api/auth/login", json={
    "email": "saisameermarla@gmail.com",
    "password": "wrongpassword"
})
test("Wrong password returns 401", r.status_code == 401, f"Status: {r.status_code}")

# 5e. Session validation
if admin_token:
    r = requests.get(f"{BASE_URL}/api/auth/session", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    test("Session validation returns 200", r.status_code == 200, f"Status: {r.status_code}")

# ═══════════════════════════════════════════════
# 6. ADMIN ORDER MANAGEMENT
# ═══════════════════════════════════════════════
section("6. ADMIN ORDER MANAGEMENT")

if admin_token:
    # 6a. Fetch orders as admin
    r = requests.get(f"{BASE_URL}/api/orders", headers={
        "Authorization": f"Bearer {admin_token}",
        "X-Admin-Email": "saisameermarla@gmail.com"
    })
    test("Admin can fetch orders (200)", r.status_code == 200, f"Status: {r.status_code}")
    orders = r.json() if r.status_code == 200 else []
    test("Orders is a list", isinstance(orders, list))
    print(f"     → Found {len(orders)} orders in database")

# 6b. Unauthorized user cannot fetch orders
r = requests.get(f"{BASE_URL}/api/orders")
test("Unauthorized orders access returns 403", r.status_code == 403, f"Status: {r.status_code}")

# ═══════════════════════════════════════════════
# 7. PAYMENT FLOW
# ═══════════════════════════════════════════════
section("7. PAYMENT FLOW")

# 7a. Initiate a UPI payment
r = requests.post(f"{BASE_URL}/api/payments/initiate", json={
    "amount": 999.50,
    "method": "UPI"
})
test("POST /api/payments/initiate returns 200", r.status_code == 200, f"Status: {r.status_code}, Body: {r.text[:200]}")

txn_id = ""
if r.status_code == 200:
    pay_data = r.json()
    txn_id = pay_data.get("transactionId", "")
    test("Payment initiation returns transactionId", len(txn_id) > 0)

# 7b. Check payment status
if txn_id:
    r = requests.get(f"{BASE_URL}/api/payments/status?transactionId={txn_id}")
    test("GET /api/payments/status returns 200", r.status_code == 200, f"Status: {r.status_code}")
    if r.status_code == 200:
        status_data = r.json()
        test("Payment status is 'pending'", status_data.get("status") == "pending", f"Status: {status_data.get('status')}")

# 7c. Simulate payment webhook (success)
if txn_id:
    r = requests.post(f"{BASE_URL}/api/payments/webhook", json={
        "transactionId": txn_id,
        "status": "success"
    })
    test("Payment webhook returns 200", r.status_code == 200, f"Status: {r.status_code}")

    # Verify status changed
    r = requests.get(f"{BASE_URL}/api/payments/status?transactionId={txn_id}")
    if r.status_code == 200:
        status_data = r.json()
        test("Payment status now 'success'", status_data.get("status") == "success", f"Status: {status_data.get('status')}")

# ═══════════════════════════════════════════════
# 8. ORDER PLACEMENT (Full Checkout Flow)
# ═══════════════════════════════════════════════
section("8. ORDER PLACEMENT (Full Checkout Flow)")

order_data = {
    "customerName": "Regression Test User",
    "customerEmail": "regtest@test.com",
    "customerMobile": "9876543210",
    "customerAddress": "123 Test Street, Test City, India 500001",
    "subtotal": 950.00,
    "cgst": 23.75,
    "sgst": 23.75,
    "totalAmount": 997.50,
    "transactionId": f"TXN-REG-{int(time.time())}",
    "paymentMethod": "UPI",
    "items": [
        {"id": 6, "title": "Crochet Woodland Fawn Doll", "price": 950.00, "quantity": 1}
    ]
}

r = requests.post(f"{BASE_URL}/api/orders", json=order_data)
test("POST /api/orders returns 200/201", r.status_code in [200, 201], f"Status: {r.status_code}, Body: {r.text[:300]}")

new_order_id = ""
if r.status_code in [200, 201]:
    order_response = r.json()
    new_order_id = order_response.get("orderId", "")
    test("Order response has orderId", len(new_order_id) > 0, f"OrderId: {new_order_id}")
    print(f"     → Created order: {new_order_id}")

# 8b. COD order
cod_order_data = {
    "customerName": "COD Test User",
    "customerEmail": "codtest@test.com",
    "customerMobile": "9876543211",
    "customerAddress": "456 COD Lane, Test City, India 500002",
    "subtotal": 650.00,
    "cgst": 16.25,
    "sgst": 16.25,
    "totalAmount": 707.50,
    "transactionId": f"COD-REG-{int(time.time())}",
    "paymentMethod": "COD",
    "items": [
        {"id": 7, "title": "Pressed Flower Journal", "price": 650.00, "quantity": 1}
    ]
}

r = requests.post(f"{BASE_URL}/api/orders", json=cod_order_data)
test("COD order placement returns 200/201", r.status_code in [200, 201], f"Status: {r.status_code}")

# ═══════════════════════════════════════════════
# 9. ORDER STATUS UPDATE (Admin)
# ═══════════════════════════════════════════════
section("9. ORDER STATUS UPDATE (Admin)")

if admin_token and new_order_id:
    r = requests.post(f"{BASE_URL}/api/orders/update-status", 
        json={"orderId": new_order_id, "status": "Confirmed"},
        headers={
            "Authorization": f"Bearer {admin_token}",
            "X-CSRF-Token": admin_csrf
        })
    test("Admin can update order status", r.status_code == 200, f"Status: {r.status_code}, Body: {r.text[:200]}")

    # Verify the status was updated
    r = requests.get(f"{BASE_URL}/api/orders", headers={
        "Authorization": f"Bearer {admin_token}",
        "X-Admin-Email": "saisameermarla@gmail.com"
    })
    if r.status_code == 200:
        updated_orders = r.json()
        matched = [o for o in updated_orders if o.get("orderId") == new_order_id]
        if matched:
            test("Order status updated to 'Confirmed'", 
                 matched[0]["details"]["status"] == "Confirmed",
                 f"Actual: {matched[0]['details']['status']}")

# ═══════════════════════════════════════════════
# 10. CUSTOMER ACTIONS
# ═══════════════════════════════════════════════
section("10. CUSTOMER ACTIONS")

if customer_token and new_order_id:
    # Cancel order
    r = requests.post(f"{BASE_URL}/api/orders/customer-action",
        json={"orderId": new_order_id, "action": "cancel"},
        headers={
            "Authorization": f"Bearer {customer_token}",
            "X-CSRF-Token": customer_csrf
        })
    test("Customer can cancel order", r.status_code == 200, f"Status: {r.status_code}, Body: {r.text[:200]}")

# ═══════════════════════════════════════════════
# 11. ADDRESSES API
# ═══════════════════════════════════════════════
section("11. ADDRESSES API")

if customer_token:
    # Save a new address
    r = requests.post(f"{BASE_URL}/api/addresses",
        json={"name": "Test User", "mobile": "9876543210", "address": "Test Address, City 500001"},
        headers={
            "Authorization": f"Bearer {customer_token}",
            "X-CSRF-Token": customer_csrf
        })
    test("POST /api/addresses returns 200", r.status_code == 200, f"Status: {r.status_code}")

    # Fetch addresses
    r = requests.get(f"{BASE_URL}/api/addresses", headers={
        "Authorization": f"Bearer {customer_token}"
    })
    test("GET /api/addresses returns 200", r.status_code == 200, f"Status: {r.status_code}")
    if r.status_code == 200:
        addrs = r.json()
        test("Addresses is a list", isinstance(addrs, list))
        test("Has saved addresses", len(addrs) > 0, f"Count: {len(addrs)}")

# ═══════════════════════════════════════════════
# 12. WISHLIST API
# ═══════════════════════════════════════════════
section("12. WISHLIST API")

if customer_token:
    # Add to wishlist
    r = requests.post(f"{BASE_URL}/api/wishlist",
        json={"productId": 6},
        headers={
            "Authorization": f"Bearer {customer_token}",
            "X-CSRF-Token": customer_csrf
        })
    test("Add to wishlist returns 200", r.status_code == 200, f"Status: {r.status_code}")

    # Fetch wishlist
    r = requests.get(f"{BASE_URL}/api/wishlist", headers={
        "Authorization": f"Bearer {customer_token}"
    })
    test("GET /api/wishlist returns 200", r.status_code == 200, f"Status: {r.status_code}")

# ═══════════════════════════════════════════════
# 13. BANNERS API
# ═══════════════════════════════════════════════
section("13. BANNERS API")

r = requests.get(f"{BASE_URL}/api/banners")
test("GET /api/banners returns 200", r.status_code == 200, f"Status: {r.status_code}")

# ═══════════════════════════════════════════════
# 14. ADMIN PRODUCT MANAGEMENT
# ═══════════════════════════════════════════════
section("14. ADMIN PRODUCT MANAGEMENT")

if admin_token:
    # Add a test product
    r = requests.post(f"{BASE_URL}/api/products",
        json={
            "title": "Regression Test Product",
            "price": 100.00,
            "category": "paper",
            "description": "Auto-generated test product for regression testing",
            "image": "images/hero_crafts.png",
            "stock": 5
        },
        headers={
            "Authorization": f"Bearer {admin_token}",
            "X-CSRF-Token": admin_csrf
        })
    test("Admin can add product", r.status_code in [200, 201], f"Status: {r.status_code}, Body: {r.text[:200]}")
    
    test_product_id = None
    if r.status_code in [200, 201]:
        prod_resp = r.json()
        test_product_id = prod_resp.get("id") or prod_resp.get("productId")
        print(f"     → Created test product ID: {test_product_id}")

        # Verify product editing works
        r = requests.post(f"{BASE_URL}/api/products",
            json={
                "id": test_product_id,
                "title": "Regression Test Product (Edited)",
                "price": 149.99,
                "category": "paper",
                "description": "Edited description",
                "image": "images/hero_crafts.png",
                "stock": 12
            },
            headers={
                "Authorization": f"Bearer {admin_token}",
                "X-CSRF-Token": admin_csrf
            })
        test("Admin can edit/update product", r.status_code == 200, f"Status: {r.status_code}")

        # Soft-delete the test product
        r = requests.delete(f"{BASE_URL}/api/products?id={test_product_id}",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "X-CSRF-Token": admin_csrf
            })
        test("Admin can delete product", r.status_code == 200, f"Status: {r.status_code}")

        # Verify deleted product doesn't appear in catalog
        r = requests.get(f"{BASE_URL}/api/products")
        if r.status_code == 200:
            active_products = r.json()
            found_deleted = [p for p in active_products if p.get("id") == test_product_id]
            test("Deleted product not in catalog", len(found_deleted) == 0)

# ═══════════════════════════════════════════════
# 14B. RAZORPAY GATEWAY & COD & DELIVERY DATE & RESTOCK
# ═══════════════════════════════════════════════
section("14B. RAZORPAY GATEWAY & COD & DELIVERY DATE & RESTOCK")

import hmac

# Test Razorpay order creation
r = requests.post(f"{BASE_URL}/api/razorpay/create-order", json={"amount": 499.00, "currency": "INR"})
test("Razorpay create-order returns 200", r.status_code == 200, f"Status: {r.status_code}")
rzp_order = r.json()
test("Razorpay order has ID", "id" in rzp_order and rzp_order["id"].startswith("order_"))
test("Razorpay order has paise amount", rzp_order.get("amount") == 49900)
test("Razorpay order has test Key ID", rzp_order.get("key") == "rzp_test_T8XwugnuJ4Wtkm")

# Test Razorpay verify signature with HMAC SHA-256
rzp_order_id = rzp_order.get("id", "order_test123")
rzp_payment_id = "pay_test999888"
rzp_secret = "eamlAYewc0PB3fUHcfj035uI"
valid_sig = hmac.new(rzp_secret.encode('utf-8'), f"{rzp_order_id}|{rzp_payment_id}".encode('utf-8'), hashlib.sha256).hexdigest()

r = requests.post(f"{BASE_URL}/api/razorpay/verify-payment", json={
    "razorpay_order_id": rzp_order_id,
    "razorpay_payment_id": rzp_payment_id,
    "razorpay_signature": valid_sig,
    "amount": 499.00
})
test("Razorpay verify-payment succeeds with valid HMAC", r.status_code == 200, f"Status: {r.status_code}")

# Test Razorpay invalid signature rejection
r = requests.post(f"{BASE_URL}/api/razorpay/verify-payment", json={
    "razorpay_order_id": rzp_order_id,
    "razorpay_payment_id": rzp_payment_id,
    "razorpay_signature": "invalid_fraudulent_signature",
    "amount": 499.00
})
test("Razorpay verify-payment rejects invalid HMAC (400)", r.status_code == 400, f"Status: {r.status_code}")

# Test COD direct order placement with active product
r_avail = requests.get(f"{BASE_URL}/api/products")
active_prods = r_avail.json() if r_avail.status_code == 200 else []
target_prod = active_prods[0] if active_prods else {"id": 1, "title": "Artisanal Weavings", "price": 500.0}
target_id = target_prod.get("id")

cod_payload = {
    "customerName": "Ramesh Kumar",
    "customerEmail": "ramesh@example.com",
    "customerMobile": "9876543210",
    "customerAddress": "Flat 4B, Lotus Enclave, Hyderabad",
    "subtotal": 500.0,
    "cgst": 25.0,
    "sgst": 25.0,
    "totalAmount": 575.0,
    "transactionId": f"COD-DIRECT-{int(time.time()*1000)}",
    "paymentMethod": "COD",
    "items": [{"id": target_id, "title": target_prod.get("title", "Artisanal Weavings"), "price": 500.0, "quantity": 1}]
}
r = requests.post(f"{BASE_URL}/api/orders", json=cod_payload)
test("COD order placed directly without pre-transaction", r.status_code == 200, f"Status: {r.status_code}, Body: {r.text[:200]}")
cod_order_id = r.json().get("orderId") if r.status_code == 200 else None
test("COD order has automated delivery date", "deliveryDate" in r.json() if r.status_code == 200 else False)

# Test Admin updating delivery date
if admin_token and cod_order_id:
    custom_date = "2026-09-20 (Express Delivery)"
    r = requests.post(f"{BASE_URL}/api/orders/update-status",
        json={"orderId": cod_order_id, "status": "Confirmed", "deliveryDate": custom_date},
        headers={"Authorization": f"Bearer {admin_token}", "X-CSRF-Token": admin_csrf})
    test("Admin can update delivery date & accept order", r.status_code == 200, f"Status: {r.status_code}")

    # Check inventory before decline
    r = requests.get(f"{BASE_URL}/api/products")
    prod_target = next((p for p in r.json() if p.get("id") == target_id), None)
    stock_before = prod_target.get("stock") if prod_target else 0

    # Decline/cancel order and verify restocking
    r = requests.post(f"{BASE_URL}/api/orders/update-status",
        json={"orderId": cod_order_id, "status": "Cancelled"},
        headers={"Authorization": f"Bearer {admin_token}", "X-CSRF-Token": admin_csrf})
    test("Admin can decline/cancel order", r.status_code == 200, f"Status: {r.status_code}")

    r = requests.get(f"{BASE_URL}/api/products")
    prod_target_after = next((p for p in r.json() if p.get("id") == target_id), None)
    stock_after = prod_target_after.get("stock") if prod_target_after else 0
    test("Inventory restocked after order decline (+1)", stock_after == stock_before + 1, f"Before: {stock_before}, After: {stock_after}")


# ═══════════════════════════════════════════════
# 15. EDGE CASES & ERROR HANDLING
# ═══════════════════════════════════════════════
section("15. EDGE CASES & ERROR HANDLING")

# Invalid JSON body
r = requests.post(f"{BASE_URL}/api/auth/login", data="not json", headers={"Content-Type": "application/json"})
test("Invalid JSON returns error", r.status_code >= 400, f"Status: {r.status_code}")

# Missing required fields for registration
r = requests.post(f"{BASE_URL}/api/auth/register", json={"email": ""})
test("Empty email registration fails", r.status_code >= 400, f"Status: {r.status_code}")

# Invalid product ID
r = requests.get(f"{BASE_URL}/api/products?id=999999")
test("Non-existent product handled gracefully", r.status_code in [200, 404])

# 404 for unknown API route
r = requests.get(f"{BASE_URL}/api/nonexistent")
test("Unknown API returns 404", r.status_code == 404, f"Status: {r.status_code}")

# ═══════════════════════════════════════════════
# 16. STATIC ASSETS
# ═══════════════════════════════════════════════
section("16. STATIC ASSETS")

for img in ["images/hero_crafts.png", "images/wool_doll.png", "images/wool_kerchief.png", "images/paper_journal.png"]:
    r = requests.get(f"{BASE_URL}/{img}")
    test(f"{img} loads", r.status_code == 200, f"Status: {r.status_code}")

# ═══════════════════════════════════════════════
# 17. LOGOUT
# ═══════════════════════════════════════════════
section("17. LOGOUT")

if admin_token:
    r = requests.post(f"{BASE_URL}/api/auth/logout", headers={
        "Authorization": f"Bearer {admin_token}",
        "X-CSRF-Token": admin_csrf
    })
    test("Admin logout returns 200", r.status_code == 200, f"Status: {r.status_code}")

    # Verify session is invalidated
    r = requests.get(f"{BASE_URL}/api/orders", headers={
        "Authorization": f"Bearer {admin_token}"
    })
    test("Session invalidated after logout", r.status_code == 403, f"Status: {r.status_code}")

# ═══════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════
print(f"\n{'='*60}")
print(f"  REGRESSION TEST RESULTS")
print(f"{'='*60}")
print(f"  ✅ Passed: {passed}")
print(f"  ❌ Failed: {failed}")
print(f"  📊 Total:  {passed + failed}")
print(f"  📈 Rate:   {(passed/(passed+failed)*100):.1f}%" if (passed+failed) > 0 else "  📈 Rate:   N/A")

if errors:
    print(f"\n  FAILURES:")
    for e in errors:
        print(f"    ⚠️  {e}")

print(f"{'='*60}\n")
sys.exit(0 if failed == 0 else 1)
