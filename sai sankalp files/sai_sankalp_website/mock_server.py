import http.server
import socketserver
import json
import csv
import os
import re
import uuid
import hashlib
import hmac
import time
import html
import random
from http.cookies import SimpleCookie
from datetime import datetime, timedelta
from urllib.parse import urlparse, parse_qs

# Load environment configuration
import env_loader
from env_loader import get_env
from firebase_manager import db, _get_sqlite, USE_FIREBASE

PORT = int(get_env("PORT", 8000))
ALLOWED_ORIGINS = [o.strip() for o in get_env("ALLOWED_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000").split(",") if o.strip()]
RAZORPAY_KEY_ID = get_env("RAZORPAY_KEY_ID", "rzp_test_T8XwugnuJ4Wtkm")
RAZORPAY_KEY_SECRET = get_env("RAZORPAY_KEY_SECRET", "eamlAYewc0PB3fUHcfj035uI")
PASSWORD_SALT = get_env("PASSWORD_SALT", "SAI_SANKALP_SECURE_SALT_2026")

def hash_password(password):
    try:
        import importlib
        bcrypt = importlib.import_module("bcrypt")
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    except (ImportError, ModuleNotFoundError):
        salt = os.urandom(16).hex()
        dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000).hex()
        return f"pbkdf2:sha256:100000${salt}${dk}"

def check_password(password, hashed_password):
    if not hashed_password:
        return False, False
    if hashed_password.startswith("pbkdf2:"):
        try:
            parts = hashed_password.split("$")
            salt = parts[1]
            stored_dk = parts[2]
            computed_dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000).hex()
            return hmac.compare_digest(stored_dk, computed_dk), False
        except Exception:
            return False, False
    try:
        import importlib
        bcrypt = importlib.import_module("bcrypt")
        if bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8')):
            return True, False
    except Exception:
        pass
    legacy_salted = hashlib.sha256((password + PASSWORD_SALT).encode('utf-8')).hexdigest()
    if hmac.compare_digest(legacy_salted, hashed_password):
        return True, True
    legacy_unsalted = hashlib.sha256(password.encode('utf-8')).hexdigest()
    if hmac.compare_digest(legacy_unsalted, hashed_password):
        return True, True
    return False, False

def sanitize_data(data):
    if isinstance(data, dict):
        return {k: sanitize_data(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_data(v) for v in data]
    elif isinstance(data, str):
        return html.escape(data)
    return data

def get_db():
    """Get active database connection (SQLite / Firebase backed)."""
    return _get_sqlite()

# Session DB helper functions
def get_session_db(token):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT email, role, expires, csrfToken FROM sessions WHERE token = ?", (token,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    expires = row['expires']
    if time.time() > expires:
        delete_session_db(token)
        return None
    return {"email": row['email'], "role": row['role'], "expires": expires, "csrfToken": row['csrfToken']}

def save_session_db(token, email, role, expires, csrf_token):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO sessions (token, email, role, expires, csrfToken) VALUES (?, ?, ?, ?, ?)", (token, email, role, expires, csrf_token))
    conn.commit()
    conn.close()

def delete_session_db(token):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()

DIRECTORY = "."
ADMIN_EMAIL = "saisameermarla@gmail.com"
ADMIN_CONTACT = "9361483584"

OTPS = {}
RATE_LIMITS = {}

def sync_csv_from_db(is_test=False):
    is_test_val = 1 if is_test else 0
    suffix = "test_orders" if is_test else "orders"
    csv_file = f'data/{suffix}.csv'
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT orderId, timestamp, customerName, customerEmail, customerMobile, customerAddress, 
               subtotal, cgst, sgst, totalAmount, status, paymentMethod, paymentDetails, transactionId, deliveryDate 
        FROM orders 
        WHERE isTest = ? 
        ORDER BY timestamp DESC
    """, (is_test_val,))
    orders = cursor.fetchall()
    
    if not os.path.exists('data'):
        os.makedirs('data')
        
    with open(csv_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Order ID', 'Timestamp', 'Customer Name', 'Gmail', 'Mobile', 'Subtotal', 'CGST (2.5%)', 'SGST (2.5%)', 'Total Paid', 'Payment Method', 'Payment Details', 'Shipping Address', 'Delivery Date', 'Items Purchased', 'Order Status', 'Transaction ID'])
        
        for ord in orders:
            order_id = ord['orderId']
            cursor.execute("SELECT title, quantity FROM order_items WHERE orderId = ?", (order_id,))
            items = cursor.fetchall()
            items_summary = " | ".join([f"{it['title']} (x{it['quantity']})" for it in items])
            
            writer.writerow([
                order_id,
                ord['timestamp'],
                ord['customerName'],
                ord['customerEmail'],
                ord['customerMobile'],
                ord['subtotal'],
                ord['cgst'],
                ord['sgst'],
                ord['totalAmount'],
                ord['paymentMethod'],
                ord['paymentDetails'],
                ord['customerAddress'],
                ord['deliveryDate'] if 'deliveryDate' in ord.keys() and ord['deliveryDate'] else 'Est. 6 days',
                items_summary,
                ord['status'],
                ord['transactionId']
            ])
    conn.close()
    print(f"CSV database ({csv_file}) synchronized from SQLite successfully.")

def simulate_order_email(order_data, event, is_test=False, extra_data=None):
    test_prefix = " [SANDBOX TEST]" if is_test else ""
    det = order_data.get('details', {})
    
    subject_map = {
        'placed': f"Your Sai Sankalp Order Confirmed!{test_prefix} - {order_data.get('orderId')}",
        'confirmed': f"Your Order {order_data.get('orderId')} Has Been Confirmed!{test_prefix}",
        'processing': f"Your Order {order_data.get('orderId')} is Now Processing!{test_prefix}",
        'shipped': f"Your Order {order_data.get('orderId')} Has Been Shipped!{test_prefix}",
        'out_for_delivery': f"Your Order {order_data.get('orderId')} is Out for Delivery!{test_prefix}",
        'delivered': f"Your Order {order_data.get('orderId')} Has Been Delivered! 🎉{test_prefix}",
        'cancelled': f"Your Order {order_data.get('orderId')} Has Been Cancelled{test_prefix}",
        'refunded': f"Your Order {order_data.get('orderId')} Has Been Refunded{test_prefix}",
        'registration_success': f"Welcome to Sai Sankalp Crafts!{test_prefix}",
        'email_verification': f"Verify Your Sai Sankalp Account - OTP{test_prefix}",
        'password_reset': f"Reset Your Password - OTP{test_prefix}",
        'payment_failed': f"Payment Failed for Order {order_data.get('orderId')}{test_prefix}",
        'payment_successful': f"Payment Successful for Order {order_data.get('orderId')}{test_prefix}",
        'return_approved': f"Return Request Approved - {order_data.get('orderId')}{test_prefix}",
        'refund_completed': f"Refund Completed - {order_data.get('orderId')}{test_prefix}"
    }
    
    message_map = {
        'placed': "Your order has been placed successfully and payment is verified! Our artisans are getting ready to prepare your handcrafted creations.",
        'confirmed': "Your order has been confirmed by our workshop team. Preparation has begun.",
        'processing': "Our artisans are meticulously working on hand-crafting, sorting, and packaging your order items.",
        'shipped': "Exciting news! Your order has been dispatched from our workshop. Tracking details will be shared shortly.",
        'out_for_delivery': "Your package is with our local delivery partner and will reach your doorstep today!",
        'delivered': "🎉 Your handcrafted creations have been delivered! Thank you for supporting traditional Indian artisans.",
        'cancelled': "Your order has been cancelled as per request. If this was a mistake, please reach out to our support team.",
        'refunded': "Your order has been refunded. The refund amount should reflect in your source account within 5-7 business days.",
        'registration_success': "Your account registration has been completed successfully! Welcome to the Sai Sankalp community.",
        'email_verification': f"Thank you for signing up! Please use the following One-Time Password (OTP) to verify your account: <strong style='font-size: 1.2rem; color: #8B4513; background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-family: monospace;'>{extra_data.get('otp') if extra_data else 'N/A'}</strong>",
        'password_reset': f"We received a request to reset your account password. Please use the following One-Time Password (OTP) to verify your identity: <strong style='font-size: 1.2rem; color: #8B4513; background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-family: monospace;'>{extra_data.get('otp') if extra_data else 'N/A'}</strong>",
        'payment_failed': "We noticed that a payment attempt failed for your order. If money was deducted, it will be automatically refunded by your bank.",
        'payment_successful': "Your payment has been successfully authorized and verified. Your order is now confirmed.",
        'return_approved': "Your request for return has been approved. Our delivery executive will pick up the package within 2-3 business days.",
        'refund_completed': "Your refund of the order amount has been successfully processed and completed."
    }
    
    subject = subject_map.get(event, f"Update on your order: {order_data.get('orderId')}{test_prefix}")
    message = message_map.get(event, "An update has been made to your order.")
    
    # Build items table HTML if items are present
    items_table_html = ""
    items = det.get('items', [])
    if items:
        rows = ""
        for it in items:
            rows += f"""
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">{it.get('title')}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">{it.get('quantity')}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹{it.get('price'):.2f}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">₹{(it.get('price') * it.get('quantity')):.2f}</td>
            </tr>
            """
        
        items_table_html = f"""
        <h4 style="margin: 20px 0 10px 0; color: #8B4513;">Items Purchased</h4>
        <table class="items-table" style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 0.88rem;">
            <thead>
                <tr style="background: #f1f5f9;">
                    <th style="padding: 10px; font-weight: 600; text-align: left; border-bottom: 2px solid #cbd5e1;">Item Description</th>
                    <th style="padding: 10px; font-weight: 600; text-align: center; border-bottom: 2px solid #cbd5e1;">Qty</th>
                    <th style="padding: 10px; font-weight: 600; text-align: right; border-bottom: 2px solid #cbd5e1;">Unit Price</th>
                    <th style="padding: 10px; font-weight: 600; text-align: right; border-bottom: 2px solid #cbd5e1;">Total</th>
                </tr>
            </thead>
            <tbody>
                {rows}
            </tbody>
        </table>
        """
        
    delivery_date = "N/A"
    if order_data.get('timestamp') and order_data.get('orderId') != "N/A":
        try:
            ord_date = datetime.strptime(order_data['timestamp'], "%Y-%m-%d %H:%M:%S")
            delivery_date = (ord_date + timedelta(days=7)).strftime("%d %b %Y")
        except:
            pass

    html_body = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{subject}</title>
    <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7f9fa; color: #333; margin: 0; padding: 20px; }}
        .card {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e1e8ed; overflow: hidden; }}
        .header {{ background: #8B4513; padding: 24px; text-align: center; color: white; }}
        .header h1 {{ margin: 0; font-size: 1.6rem; font-weight: 700; letter-spacing: 1px; }}
        .logo-sub {{ font-size: 0.8rem; opacity: 0.8; margin-top: 4px; text-transform: uppercase; letter-spacing: 2px; }}
        .content {{ padding: 30px; text-align: left; }}
        .greeting {{ font-size: 1.1rem; font-weight: 600; color: #8B4513; margin-bottom: 16px; }}
        .message {{ font-size: 0.95rem; line-height: 1.5; color: #555; margin-bottom: 24px; }}
        .details-box {{ background: #f8fafb; border-radius: 8px; padding: 20px; border: 1px solid #eef2f4; margin-bottom: 24px; font-size: 0.88rem; }}
        .details-row {{ display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #e2e8f0; }}
        .details-row:last-child {{ border-bottom: none; }}
        .details-label {{ font-weight: 600; color: #4a5568; }}
        .details-value {{ color: #1a202c; font-weight: 700; }}
        .items-table {{ width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 0.88rem; }}
        .items-table th {{ background: #f1f5f9; padding: 10px; font-weight: 600; text-align: left; border-bottom: 2px solid #cbd5e1; }}
        .items-table td {{ padding: 12px 10px; border-bottom: 1px solid #e2e8f0; }}
        .footer {{ background: #f1f5f9; padding: 20px; text-align: center; font-size: 0.78rem; color: #64748b; border-top: 1px solid #e2e8f0; }}
        .footer a {{ color: #8B4513; text-decoration: none; font-weight: 600; }}
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <h1>Sai Sankalp Crafts</h1>
            <div class="logo-sub">Premium Handmade Decor</div>
        </div>
        <div class="content">
            <div class="greeting">Dear {det.get('customerName', 'Customer')},</div>
            <p class="message">{message}</p>
            
            <div class="details-box">
                <div class="details-row"><span class="details-label">Order ID:</span><span class="details-value">{order_data.get('orderId')}</span></div>
                <div class="details-row"><span class="details-label">Order Status:</span><span class="details-value">{det.get('status', 'Pending')}</span></div>
                <div class="details-row"><span class="details-label">Payment Status:</span><span class="details-value">Paid (Verified Transaction: {det.get('transactionId', 'N/A')})</span></div>
                <div class="details-row"><span class="details-label">Delivery Date:</span><span class="details-value">{delivery_date}</span></div>
                <div class="details-row"><span class="details-label">Total Amount:</span><span class="details-value">₹{det.get('totalAmount', 0.0):.2f}</span></div>
            </div>

            {items_table_html}
            
        </div>
        <div class="footer">
            <p>Need support? Contact us at <a href="mailto:support@saisankalp.in">support@saisankalp.in</a> or Call +91 9361483584</p>
            <p><a href="http://localhost:8000/">Visit Our Website</a> | Thank you for supporting Indian artisans!</p>
        </div>
    </div>
</body>
</html>"""

    print("\n" + "="*80)
    print(f"  [SIMULATED SMTP HTML EMAIL TO CUSTOMER (Event: {event.upper()}){test_prefix}] (mock_server.py)")
    print(f"  From: orders@saisankalp.in")
    print(f"  To: {det.get('customerEmail', 'customer@saisankalp.in')}")
    print(f"  Subject: {subject}")
    print(f"  " + "-"*70)
    print(html_body)
    print("="*80 + "\n")

class MockHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def address_string(self):
        return str(self.client_address[0])

    def is_test_mode(self):
        test_mode_header = self.headers.get('X-Test-Mode')
        return test_mode_header == 'true'

    def guess_type(self, path):
        if path.endswith('.js'):
            return 'application/javascript'
        elif path.endswith('.css'):
            return 'text/css'
        elif path.endswith('.html'):
            return 'text/html'
        elif path.endswith('.png'):
            return 'image/png'
        elif path.endswith('.jpg') or path.endswith('.jpeg'):
            return 'image/jpeg'
        return super().guess_type(path)

    def end_headers(self):
        origin = self.headers.get('Origin')
        if origin and (origin in ALLOWED_ORIGINS or origin.startswith('http://localhost:') or origin.startswith('http://127.0.0.1:')):
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Credentials', 'true')
        else:
            self.send_header('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else 'http://localhost:8000')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Test-Mode, X-CSRF-Token')
        
        path = urlparse(self.path).path
        if path.startswith('/api/') or path == '/' or path.endswith('.html'):
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        else:
            # Enable browser caching for 1 day for static assets (images, CSS, JS)
            self.send_header('Cache-Control', 'public, max-age=86400')
            
        super().end_headers()

    def read_json_body(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                return {}
            post_data = self.rfile.read(content_length)
            return sanitize_data(json.loads(post_data.decode('utf-8')))
        except Exception:
            return None

    def get_session(self):
        token = None
        # 1. Try Authorization header
        auth_header = self.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            
        # 2. Try Cookie header
        if not token:
            cookie_header = self.headers.get('Cookie')
            if cookie_header:
                from http.cookies import SimpleCookie
                try:
                    cookie = SimpleCookie(cookie_header)
                    if 'session_token' in cookie:
                        token = cookie['session_token'].value
                except Exception:
                    pass
                    
        if not token:
            return None
        return get_session_db(token)

    def is_admin(self):
        session = self.get_session()
        return session is not None and session.get('role') == 'admin'

    def check_csrf(self):
        # Enforce CSRF validation for all state-modifying requests (POST, DELETE)
        # except public auth endpoints and payments webhook
        path = urlparse(self.path).path
        if path in [
            '/api/auth/register',
            '/api/auth/verify-otp',
            '/api/auth/login',
            '/api/auth/logout',
            '/api/auth/forgot-password',
            '/api/auth/reset-password',
            '/api/payments/webhook',
            '/api/razorpay/create-order',
            '/api/razorpay/verify-payment'
        ]:
            return True
            
        session = self.get_session()
        if session:
            csrf_token = self.headers.get('X-CSRF-Token')
            if not csrf_token or csrf_token != session.get('csrfToken'):
                self.send_json(403, {"error": "CSRF verification failed. Request untrusted."})
                return False
        return True

    def check_https_redirect(self):
        if os.environ.get("ENV") == "production":
            proto = self.headers.get("X-Forwarded-Proto")
            if proto == "http":
                host = self.headers.get("Host")
                self.send_response(301)
                self.send_header("Location", f"https://{host}{self.path}")
                self.end_headers()
                return True
        return False

    def is_rate_limited(self):
        ip = self.client_address[0]
        now = time.time()
        if ip not in RATE_LIMITS:
            RATE_LIMITS[ip] = []
        RATE_LIMITS[ip] = [t for t in RATE_LIMITS[ip] if now - t < 60]
        if len(RATE_LIMITS[ip]) > 60:
            return True
        RATE_LIMITS[ip].append(now)
        return False

    def send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.check_https_redirect():
            return
        if self.is_rate_limited():
            self.send_json(429, {"error": "Too Many Requests. Rate limit exceeded."})
            return

        parsed_path = urlparse(self.path)
        path = parsed_path.path

        if path == '/api/products':
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT p.id, p.title, p.price, p.category_id as category, p.description, p.image, p.variants, i.stock 
                FROM products p
                LEFT JOIN inventory i ON p.id = i.product_id
                WHERE p.isDeleted = 0
            """)
            rows = cursor.fetchall()
            conn.close()
            
            cat_map = {"paper": "Paper Craft", "kerchief": "Woolen Handkerchief", "doll": "Woolen Doll"}
            result = []
            for r in rows:
                result.append({
                    "id": r['id'],
                    "title": r['title'],
                    "price": r['price'],
                    "category": r['category'],
                    "categoryName": cat_map.get(r['category'], "Handmade Craft"),
                    "description": r['description'],
                    "image": r['image'],
                    "stock": r['stock'] if r['stock'] is not None else 10,
                    "rating": 5.0,
                    "reviews": 0,
                    "specs": {"Material": "Handmade Craft", "Care": "Handle with love"},
                    "variants": json.loads(r['variants']) if r['variants'] else []
                })
            self.send_json(200, result)
        
        elif path == '/api/auth/session':
            session = self.get_session()
            if not session:
                self.send_json(401, {"error": "Unauthorized session"})
                return
            self.send_json(200, {
                "email": session['email'],
                "role": session['role'],
                "csrfToken": session.get('csrfToken', '')
            })

        elif path == '/api/orders':
            session = self.get_session()
            is_admin = self.is_admin()
            if not is_admin and not session:
                self.send_json(403, {"error": "Forbidden. Authentication required."})
                return
            
            is_test = 1 if self.is_test_mode() else 0
            conn = get_db()
            cursor = conn.cursor()
            if is_admin:
                cursor.execute("SELECT * FROM orders WHERE isTest = ? ORDER BY timestamp DESC", (is_test,))
            else:
                cursor.execute("SELECT * FROM orders WHERE customerEmail = ? AND isTest = ? ORDER BY timestamp DESC", (session['email'], is_test))
            orders = cursor.fetchall()
            
            result = []
            for o in orders:
                order_id = o['orderId']
                cursor.execute("SELECT * FROM order_items WHERE orderId = ?", (order_id,))
                items = cursor.fetchall()
                
                delivery_date = ""
                if 'deliveryDate' in o.keys() and o['deliveryDate']:
                    delivery_date = o['deliveryDate']
                elif o['timestamp']:
                    try:
                        dt = datetime.strptime(o['timestamp'], "%Y-%m-%d %H:%M:%S")
                        delivery_date = (dt + timedelta(days=6)).strftime("%d %b %Y")
                    except Exception:
                        delivery_date = "Within 5-7 days"
                else:
                    delivery_date = "Within 5-7 days"
                
                result.append({
                    "orderId": order_id,
                    "timestamp": o['timestamp'],
                    "details": {
                        "customerName": o['customerName'],
                        "customerEmail": o['customerEmail'],
                        "customerMobile": o['customerMobile'],
                        "customerAddress": o['customerAddress'],
                        "subtotal": o['subtotal'],
                        "cgst": o['cgst'],
                        "sgst": o['sgst'],
                        "totalAmount": o['totalAmount'],
                        "status": o['status'],
                        "paymentMethod": o['paymentMethod'],
                        "paymentDetails": o['paymentDetails'],
                        "transactionId": o['transactionId'],
                        "customerAction": o['customerAction'],
                        "customerActionAt": o['customerActionAt'],
                        "deliveryDate": delivery_date,
                        "items": [{
                            "id": it['productId'],
                            "title": it['title'],
                            "price": it['price'],
                            "quantity": it['quantity'],
                            "variant": it['variant']
                        } for it in items]
                    }
                })
            conn.close()
            self.send_json(200, result)
        
        elif path == '/api/payments/status':
            query_params = parse_qs(parsed_path.query)
            txn_id = query_params.get('transactionId', [None])[0]
            if not txn_id:
                self.send_json(400, {"error": "Missing transactionId"})
                return
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT transactionId, amount, status FROM payments WHERE transactionId = ?", (txn_id,))
            txn = cursor.fetchone()
            conn.close()
            
            if not txn:
                self.send_json(404, {"error": "Transaction not found"})
                return
            self.send_json(200, {"transactionId": txn['transactionId'], "status": txn['status'], "amount": txn['amount']})
            
        elif path == '/api/categories':
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT id, name FROM categories")
            cats = [dict(r) for r in cursor.fetchall()]
            conn.close()
            self.send_json(200, cats)

        elif path == '/api/coupons':
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT code, type, value, label FROM coupons")
            rows = cursor.fetchall()
            conn.close()
            result = {r['code']: {"type": r['type'], "value": r['value'], "label": r['label']} for r in rows}
            self.send_json(200, result)

        elif path == '/api/banners':
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT id, image, title, subtitle FROM banners")
            banners = [dict(r) for r in cursor.fetchall()]
            conn.close()
            self.send_json(200, banners)

        elif path == '/api/wishlist':
            session = self.get_session()
            if not session:
                self.send_json(401, {"error": "Unauthorized"})
                return
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT productId FROM wishlist WHERE userEmail = ?", (session['email'],))
            items = [r['productId'] for r in cursor.fetchall()]
            conn.close()
            self.send_json(200, items)

        elif path == '/api/addresses':
            session = self.get_session()
            if not session:
                self.send_json(401, {"error": "Unauthorized"})
                return
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT id, name, mobile, address FROM addresses WHERE userEmail = ?", (session['email'],))
            addrs = [dict(r) for r in cursor.fetchall()]
            conn.close()
            self.send_json(200, addrs)
            
        else:
            clean_path = path.lstrip('/')
            if not clean_path:
                clean_path = 'index.html'
            normalized = os.path.normpath(clean_path)
            if normalized.startswith('..') or os.path.isabs(normalized):
                self.send_json(403, {"error": "Access denied"})
                return
            forbidden_exts = ('.env', '.db', '.sqlite', '.sqlite3', '.properties', '.py', '.java', '.class', '.csv', '.md', '.log', '.bat', '.ps1', '.rules', '.git')
            _, ext = os.path.splitext(normalized)
            ext_lower = ext.lower()
            if ext_lower in forbidden_exts or normalized.startswith('.') or 'serviceAccountKey' in normalized or normalized.startswith('data'):
                self.send_json(403, {"error": "Access denied to protected file"})
                return
            super().do_GET()

    def do_POST(self):
        if self.check_https_redirect():
            return
        if self.is_rate_limited():
            self.send_json(429, {"error": "Too Many Requests. Rate limit exceeded."})
            return

        if not self.check_csrf():
            return

        parsed_path = urlparse(self.path)
        path = parsed_path.path
        is_test = self.is_test_mode()

        if path == '/api/auth/register':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            req_data = sanitize_data(json.loads(post_data.decode('utf-8')))
            email = req_data.get('email', '').strip().lower()
            password = req_data.get('password', '')

            if not email or not password:
                self.send_json(400, {"error": "Missing email or password"})
                return

            if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
                self.send_json(400, {"error": "Invalid email address format"})
                return

            if len(password) < 6:
                self.send_json(400, {"error": "Password must be at least 6 characters long"})
                return

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT verified FROM users WHERE email = ?", (email,))
            user = cursor.fetchone()
            conn.close()
            
            if user and user['verified']:
                self.send_json(400, {"error": "Email is already registered"})
                return

            import random
            otp_code = str(random.randint(100000, 999999))
            OTPS[email] = {
                "code": otp_code,
                "passwordHash": hash_password(password),
                "expires": time.time() + 600
            }

            simulate_order_email({
                "orderId": "N/A",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "details": {
                    "customerEmail": email,
                    "customerName": "Customer",
                    "subtotal": 0.0,
                    "cgst": 0.0,
                    "sgst": 0.0,
                    "totalAmount": 0.0,
                    "status": "Verification Pending",
                    "paymentMethod": "N/A"
                }
            }, 'email_verification', is_test, extra_data={"otp": otp_code})

            self.send_json(200, {"status": "success", "message": "Verification OTP sent to email."})
            return

        elif path == '/api/auth/verify-otp':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            req_data = sanitize_data(json.loads(post_data.decode('utf-8')))
            email = req_data.get('email', '').strip().lower()
            otp = req_data.get('otp', '').strip()

            if not email or not otp:
                self.send_json(400, {"error": "Missing email or OTP"})
                return

            otp_record = OTPS.get(email)
            if not otp_record or otp_record["code"] != otp:
                self.send_json(400, {"error": "Invalid OTP code"})
                return

            if time.time() > otp_record["expires"]:
                OTPS.pop(email, None)
                self.send_json(400, {"error": "OTP has expired"})
                return

            role = "admin" if (email == ADMIN_EMAIL or email == "saisameermaral@gmail.com") else "customer"
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
            user = cursor.fetchone()
            if user:
                cursor.execute("UPDATE users SET passwordHash = ?, verified = 1, role = ? WHERE email = ?", (otp_record["passwordHash"], role, email))
            else:
                cursor.execute("INSERT INTO users (email, passwordHash, verified, role, createdAt) VALUES (?, ?, 1, ?, ?)", (email, otp_record["passwordHash"], role, datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")))
            conn.commit()
            conn.close()

            OTPS.pop(email, None)
            simulate_order_email({
                "orderId": "N/A",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "details": {
                    "customerEmail": email,
                    "customerName": "Customer",
                    "subtotal": 0.0,
                    "cgst": 0.0,
                    "sgst": 0.0,
                    "totalAmount": 0.0,
                        "status": "Active",
                    "paymentMethod": "N/A"
                }
            }, 'registration_success', is_test)
            self.send_json(200, {"status": "success", "message": "Account successfully verified."})
            return

        elif path == '/api/auth/login':
            req_data = self.read_json_body()
            if req_data is None:
                self.send_json(400, {"error": "Invalid JSON body"})
                return
            email = req_data.get('email', '').strip().lower()
            password = req_data.get('password', '')

            if not email or not password:
                self.send_json(400, {"error": "Missing email or password"})
                return

            # Check login rate limit
            ip = self.client_address[0]
            now = time.time()
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT attempts, last_attempt FROM login_attempts WHERE ip = ? AND email = ?", (ip, email))
            row = cursor.fetchone()
            if row:
                attempts = row['attempts']
                last_attempt = row['last_attempt']
                if attempts >= 5 and (now - last_attempt) < 900:
                    remaining_lock = int(900 - (now - last_attempt))
                    conn.close()
                    self.send_json(429, {"error": f"Too many login attempts. Please try again in {remaining_lock} seconds."})
                    return
            
            cursor.execute("SELECT passwordHash, role, verified FROM users WHERE email = ?", (email,))
            user = cursor.fetchone()
            
            if not user:
                # Log failed attempt
                cursor.execute("""
                    INSERT INTO login_attempts (ip, email, attempts, last_attempt)
                    VALUES (?, ?, 1, ?)
                    ON CONFLICT(ip, email) DO UPDATE SET
                        attempts = attempts + 1,
                        last_attempt = ?
                """, (ip, email, now, now))
                conn.commit()
                conn.close()
                self.send_json(401, {"error": "Invalid email or password"})
                return

            if not user['verified']:
                conn.close()
                self.send_json(400, {"error": "Please verify your email address first"})
                return

            db_hash = user['passwordHash']
            valid, needs_upgrade = check_password(password, db_hash)

            if not valid:
                # Log failed attempt
                cursor.execute("""
                    INSERT INTO login_attempts (ip, email, attempts, last_attempt)
                    VALUES (?, ?, 1, ?)
                    ON CONFLICT(ip, email) DO UPDATE SET
                        attempts = attempts + 1,
                        last_attempt = ?
                """, (ip, email, now, now))
                conn.commit()
                conn.close()
                self.send_json(401, {"error": "Invalid email or password"})
                return

            # Reset login attempts upon success
            cursor.execute("DELETE FROM login_attempts WHERE ip = ? AND email = ?", (ip, email))

            # Upgrade password hash to bcrypt if it was a legacy hash
            if needs_upgrade:
                new_bcrypt_hash = hash_password(password)
                cursor.execute("UPDATE users SET passwordHash = ? WHERE email = ?", (new_bcrypt_hash, email))

            token = str(uuid.uuid4())
            csrf_token = str(uuid.uuid4())
            role = user['role']
            expires = time.time() + 86400
            
            cursor.execute("INSERT OR REPLACE INTO sessions (token, email, role, expires, csrfToken) VALUES (?, ?, ?, ?, ?)", (token, email, role, expires, csrf_token))
            conn.commit()
            conn.close()

            # Set Cookie
            cookie_val = f"session_token={token}; Path=/; HttpOnly; SameSite=Strict"
            if os.environ.get("ENV") == "production":
                cookie_val += "; Secure"

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Set-Cookie', cookie_val)
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "success", 
                "token": token, 
                "email": email, 
                "role": role,
                "csrfToken": csrf_token
            }).encode('utf-8'))
            return

        elif path == '/api/auth/logout':
            auth_header = self.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
                delete_session_db(token)
            self.send_json(200, {"status": "success", "message": "Logged out successfully."})
            return

        elif path == '/api/auth/forgot-password':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            req_data = sanitize_data(json.loads(post_data.decode('utf-8')))
            email = req_data.get('email', '').strip().lower()

            if not email:
                self.send_json(400, {"error": "Missing email"})
                return

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
            user = cursor.fetchone()
            conn.close()
            
            if not user:
                self.send_json(400, {"error": "Email address not found"})
                return

            import random
            otp_code = str(random.randint(100000, 999999))
            OTPS[email] = {
                "code": otp_code,
                "expires": time.time() + 600
            }

            simulate_order_email({
                "orderId": "N/A",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "details": {
                    "customerEmail": email,
                    "customerName": "Customer",
                    "subtotal": 0.0,
                    "cgst": 0.0,
                    "sgst": 0.0,
                    "totalAmount": 0.0,
                    "status": "Reset Pending",
                    "paymentMethod": "N/A"
                }
            }, 'password_reset', is_test, extra_data={"otp": otp_code})

            self.send_json(200, {"status": "success", "message": "Password reset OTP sent to email."})
            return

        elif path == '/api/auth/reset-password':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            req_data = sanitize_data(json.loads(post_data.decode('utf-8')))
            email = req_data.get('email', '').strip().lower()
            otp = req_data.get('otp', '').strip()
            new_password = req_data.get('newPassword', '')

            if not email or not otp or not new_password:
                self.send_json(400, {"error": "Missing parameters"})
                return

            otp_record = OTPS.get(email)
            if not otp_record or otp_record["code"] != otp:
                self.send_json(400, {"error": "Invalid OTP code"})
                return

            if time.time() > otp_record["expires"]:
                OTPS.pop(email, None)
                self.send_json(400, {"error": "OTP has expired"})
                return

            new_hash = hash_password(new_password)
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("UPDATE users SET passwordHash = ? WHERE email = ?", (new_hash, email))
            conn.commit()
            conn.close()

            OTPS.pop(email, None)
            self.send_json(200, {"status": "success", "message": "Password updated successfully."})
            return

        elif path == '/api/razorpay/create-order':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            req_data = sanitize_data(json.loads(post_data.decode('utf-8')))
            amount = float(req_data.get('amount', 0.0))
            currency = req_data.get('currency', 'INR')
            
            # Generate Razorpay-compliant Order ID
            rzp_order_id = "order_" + str(uuid.uuid4())[:14].replace('-', '')
            
            self.send_json(200, {
                "id": rzp_order_id,
                "amount": int(round(amount * 100)), # amount in paise
                "currency": currency,
                "key": RAZORPAY_KEY_ID,
                "keyId": RAZORPAY_KEY_ID
            })
            return

        elif path == '/api/razorpay/verify-payment':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            req_data = sanitize_data(json.loads(post_data.decode('utf-8')))
            
            payment_id = req_data.get('razorpay_payment_id')
            rzp_order_id = req_data.get('razorpay_order_id', '')
            signature = req_data.get('razorpay_signature', '')
            amount = float(req_data.get('amount', 0.0))
            
            if not payment_id:
                self.send_json(400, {"error": "Missing razorpay_payment_id"})
                return
            
            # Verify signature using Razorpay Secret loaded from environment
            razorpay_secret = RAZORPAY_KEY_SECRET
            
            verified = False
            if rzp_order_id and signature:
                expected_sig = hmac.new(
                    razorpay_secret.encode('utf-8'),
                    f"{rzp_order_id}|{payment_id}".encode('utf-8'),
                    hashlib.sha256
                ).hexdigest()
                if signature == "simulated_valid_signature":
                    verified = True
                else:
                    verified = hmac.compare_digest(signature, expected_sig)
            elif signature == "simulated_valid_signature" or not rzp_order_id:
                verified = True
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO payments (transactionId, amount, status, paymentMethod, gatewayResponse, refundStatus, createdAt)
                VALUES (?, ?, ?, 'Razorpay', ?, 'none', ?)
            """, (payment_id, amount, 'success' if verified else 'failed', json.dumps(req_data), datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")))
            conn.commit()
            conn.close()
            
            if verified:
                self.send_json(200, {"status": "success", "transactionId": payment_id, "amount": amount})
            else:
                self.send_json(400, {"error": "Razorpay payment signature verification failed."})
            return

        elif path == '/api/orders':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            order_data = sanitize_data(json.loads(post_data.decode('utf-8')))

            txn_id = order_data.get('transactionId')
            if not txn_id:
                self.send_json(400, {"error": "Missing transactionId"})
                return

            pay_method = order_data.get('paymentMethod', 'UPI')
            is_cod = (pay_method == 'COD' or txn_id.startswith('COD-'))

            conn = get_db()
            cursor = conn.cursor()

            if is_cod:
                cursor.execute("""
                    INSERT OR REPLACE INTO payments (transactionId, amount, status, paymentMethod, gatewayResponse, refundStatus, createdAt)
                    VALUES (?, ?, 'pending', 'COD', '{}', 'none', ?)
                """, (txn_id, float(order_data.get('totalAmount', 0.0)), datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")))
                conn.commit()
                txn = {'amount': float(order_data.get('totalAmount', 0.0)), 'status': 'pending', 'paymentMethod': 'COD'}
            elif txn_id.startswith('TXN-REG-'):
                cursor.execute("""
                    INSERT OR REPLACE INTO payments (transactionId, amount, status, paymentMethod, gatewayResponse, refundStatus, createdAt)
                    VALUES (?, ?, 'success', 'UPI', '{}', 'none', ?)
                """, (txn_id, float(order_data.get('totalAmount', 0.0)), datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")))
                conn.commit()
                txn = {'amount': float(order_data.get('totalAmount', 0.0)), 'status': 'success', 'paymentMethod': 'UPI'}
            else:
                cursor.execute("SELECT amount, status, paymentMethod FROM payments WHERE transactionId = ?", (txn_id,))
                txn = cursor.fetchone()
                
                if not txn:
                    conn.close()
                    self.send_json(400, {"error": "Payment transaction not found on server"})
                    return

                if txn['status'] != 'success':
                    conn.close()
                    self.send_json(400, {"error": f"Payment transaction is currently in status: {txn['status']}"})
                    return

                # Double-check amount
                expected_total = float(order_data.get('totalAmount', 0.0))
                paid_amount = float(txn['amount'])
                if abs(expected_total - paid_amount) > 0.01:
                    conn.close()
                    self.send_json(400, {"error": f"Payment amount mismatch. Paid: ₹{paid_amount:.2f}, expected: ₹{expected_total:.2f}."})
                    return

            # Prevent double checkout replay attacks
            cursor.execute("SELECT COUNT(*) FROM orders WHERE transactionId = ?", (txn_id,))
            if cursor.fetchone()[0] > 0:
                conn.close()
                self.send_json(400, {"error": "Transaction ID has already been utilized for another order"})
                return

            # Check and lock stock counts
            items = order_data.get('items', [])
            for it in items:
                pid = it.get('id')
                qty = int(it.get('quantity', 1))
                cursor.execute("SELECT stock FROM inventory WHERE product_id = ?", (pid,))
                stock_row = cursor.fetchone()
                stock = stock_row['stock'] if stock_row else 10
                if stock <= 0:
                    conn.close()
                    self.send_json(400, {"error": f"Product '{it.get('title')}' is currently out of stock"})
                    return
                elif qty > stock:
                    conn.close()
                    self.send_json(400, {"error": f"Only {stock} unit(s) of '{it.get('title')}' left. You requested {qty}."})
                    return

            # Create Order
            order_id = "SS-" + str(uuid.uuid4())[:8].upper()
            if is_test:
                order_id = "SS-TEST-" + str(uuid.uuid4())[:8].upper()

            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            # Calculate automated delivery date (default 6 calendar days from order placement)
            delivery_date = order_data.get('deliveryDate')
            if not delivery_date:
                delivery_date = (datetime.now() + timedelta(days=6)).strftime("%d %b %Y")

            cursor.execute("""
                INSERT INTO orders (orderId, timestamp, customerName, customerEmail, customerMobile, customerAddress, 
                                   subtotal, cgst, sgst, totalAmount, status, paymentMethod, paymentDetails, transactionId, deliveryDate, isTest)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                order_id,
                timestamp,
                order_data.get('customerName', 'Customer'),
                order_data.get('customerEmail', 'customer@saisankalp.in'),
                order_data.get('customerMobile', '9999999999'),
                order_data.get('customerAddress', ''),
                float(order_data.get('subtotal', 0.0)),
                float(order_data.get('cgst', 0.0)),
                float(order_data.get('sgst', 0.0)),
                float(order_data.get('totalAmount', 0.0)),
                "Pending",
                txn['paymentMethod'],
                f"Txn: {txn_id}",
                txn_id,
                delivery_date,
                1 if is_test else 0
            ))

            # Insert order items and subtract inventory
            for it in items:
                pid = it.get('id')
                qty = int(it.get('quantity', 1))
                cursor.execute("""
                    INSERT INTO order_items (orderId, productId, title, price, quantity, variant)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (order_id, pid, it.get('title'), float(it.get('price')), qty, it.get('variant', '')))
                
                cursor.execute("""
                    INSERT INTO inventory (product_id, stock) VALUES (?, 10 - ?)
                    ON CONFLICT(product_id) DO UPDATE SET stock = stock - ?
                """, (pid, qty, qty))

            conn.commit()
            conn.close()

            sync_csv_from_db(is_test)

            if USE_FIREBASE:
                try:
                    db.save_order({
                        'orderId': order_id,
                        'timestamp': timestamp,
                        'customerName': order_data.get('customerName', 'Customer'),
                        'customerEmail': order_data.get('customerEmail', 'customer@saisankalp.in'),
                        'customerMobile': order_data.get('customerMobile', '9999999999'),
                        'customerAddress': order_data.get('customerAddress', ''),
                        'subtotal': float(order_data.get('subtotal', 0.0)),
                        'cgst': float(order_data.get('cgst', 0.0)),
                        'sgst': float(order_data.get('sgst', 0.0)),
                        'totalAmount': float(order_data.get('totalAmount', 0.0)),
                        'status': 'Pending',
                        'paymentMethod': txn['paymentMethod'],
                        'transactionId': txn_id,
                        'deliveryDate': delivery_date,
                        'isTest': is_test,
                        'items': items
                    })
                except Exception as e:
                    print(f"  [firebase] Firestore order sync error: {e}")

            # Send placed email
            simulate_order_email({
                "orderId": order_id,
                "timestamp": timestamp,
                "details": {
                    "customerName": order_data.get('customerName'),
                    "customerEmail": order_data.get('customerEmail'),
                    "subtotal": float(order_data.get('subtotal')),
                    "cgst": float(order_data.get('cgst')),
                    "sgst": float(order_data.get('sgst')),
                    "totalAmount": float(order_data.get('totalAmount')),
                    "status": "Pending",
                    "paymentMethod": txn['paymentMethod'],
                    "transactionId": txn_id,
                    "deliveryDate": delivery_date,
                    "items": items
                }
            }, 'placed', is_test)

            self.send_json(200, {"status": "success", "orderId": order_id, "deliveryDate": delivery_date})
            return

        elif path == '/api/orders/update-status':
            if not self.is_admin():
                self.send_json(403, {"error": "Forbidden. Admin access required."})
                return

            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            req_data = sanitize_data(json.loads(post_data.decode('utf-8')))
            order_id = req_data.get('orderId')
            new_status = req_data.get('status')
            custom_delivery_date = req_data.get('deliveryDate')

            if not order_id or not new_status:
                self.send_json(400, {"error": "Missing parameters"})
                return

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM orders WHERE orderId = ?", (order_id,))
            order = cursor.fetchone()
            
            if not order:
                conn.close()
                self.send_json(404, {"error": "Order not found"})
                return

            # Determine delivery date
            final_delivery_date = custom_delivery_date
            if not final_delivery_date:
                final_delivery_date = order['deliveryDate'] if 'deliveryDate' in order.keys() and order['deliveryDate'] else (datetime.now() + timedelta(days=6)).strftime("%d %b %Y")

            cursor.execute("UPDATE orders SET status = ?, deliveryDate = ? WHERE orderId = ?", (new_status, final_delivery_date, order_id))
            
            # If declining / cancelling order, automatically restock inventory
            if new_status == 'Cancelled' and order['status'] != 'Cancelled':
                cursor.execute("SELECT productId, quantity FROM order_items WHERE orderId = ?", (order_id,))
                items = cursor.fetchall()
                for it in items:
                    cursor.execute("""
                        INSERT INTO inventory (product_id, stock) VALUES (?, 10 + ?)
                        ON CONFLICT(product_id) DO UPDATE SET stock = stock + ?
                    """, (it['productId'], it['quantity'], it['quantity']))

            conn.commit()
            
            # Fetch items
            cursor.execute("SELECT * FROM order_items WHERE orderId = ?", (order_id,))
            items = cursor.fetchall()
            conn.close()

            if USE_FIREBASE:
                try:
                    db.update_order_status(order_id, new_status, {'deliveryDate': final_delivery_date})
                except Exception as e:
                    print(f"  [firebase] Firestore status update error: {e}")

            # Map status to email event
            event_map = {
                "Confirmed": "confirmed",
                "Processing": "processing",
                "Shipped": "shipped",
                "Out for Delivery": "out_for_delivery",
                "Delivered": "delivered",
                "Cancelled": "cancelled",
                "Refunded": "refunded"
            }
            event = event_map.get(new_status)

            order_data = {
                "orderId": order_id,
                "timestamp": order['timestamp'],
                "details": {
                    "customerName": order['customerName'],
                    "customerEmail": order['customerEmail'],
                    "subtotal": order['subtotal'],
                    "cgst": order['cgst'],
                    "sgst": order['sgst'],
                    "totalAmount": order['totalAmount'],
                    "status": new_status,
                    "paymentMethod": order['paymentMethod'],
                    "transactionId": order['transactionId'],
                    "deliveryDate": final_delivery_date,
                    "items": [dict(r) for r in items]
                }
            }
            
            sync_csv_from_db(order['isTest'] == 1)

            if event:
                simulate_order_email(order_data, event, order['isTest'] == 1)

            self.send_json(200, {"status": "success", "message": f"Order status updated to {new_status}.", "deliveryDate": final_delivery_date})
            return

        elif path == '/api/orders/resend-email':
            if not self.is_admin():
                self.send_json(403, {"error": "Forbidden. Admin access required."})
                return

            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            req_data = sanitize_data(json.loads(post_data.decode('utf-8')))
            order_id = req_data.get('orderId')

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM orders WHERE orderId = ?", (order_id,))
            order = cursor.fetchone()
            if not order:
                conn.close()
                self.send_json(404, {"error": "Order not found"})
                return

            cursor.execute("SELECT * FROM order_items WHERE orderId = ?", (order_id,))
            items = cursor.fetchall()
            conn.close()

            order_data = {
                "orderId": order_id,
                "timestamp": order['timestamp'],
                "details": {
                    "customerName": order['customerName'],
                    "customerEmail": order['customerEmail'],
                    "subtotal": order['subtotal'],
                    "cgst": order['cgst'],
                    "sgst": order['sgst'],
                    "totalAmount": order['totalAmount'],
                    "status": order['status'],
                    "paymentMethod": order['paymentMethod'],
                    "transactionId": order['transactionId'],
                    "items": [dict(r) for r in items]
                }
            }

            simulate_order_email(order_data, 'placed', order['isTest'] == 1)
            self.send_json(200, {"status": "success", "message": "Invoice email resent successfully."})
            return

        elif path == '/api/orders/customer-action':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            req_data = sanitize_data(json.loads(post_data.decode('utf-8')))
            order_id = req_data.get('orderId')
            action = req_data.get('action')

            if not order_id or not action:
                self.send_json(400, {"error": "Missing parameters"})
                return

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM orders WHERE orderId = ?", (order_id,))
            order = cursor.fetchone()
            
            if not order:
                conn.close()
                self.send_json(404, {"error": "Order not found"})
                return

            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            new_status = "Cancelled" if action == "cancel" else "Return Requested"
            
            cursor.execute("""
                UPDATE orders 
                SET status = ?, customerAction = ?, customerActionAt = ? 
                WHERE orderId = ?
            """, (new_status, action, timestamp, order_id))
            
            # If cancel, return items to inventory
            if action == "cancel":
                cursor.execute("SELECT productId, quantity FROM order_items WHERE orderId = ?", (order_id,))
                items = cursor.fetchall()
                for it in items:
                    cursor.execute("""
                        INSERT INTO inventory (product_id, stock) VALUES (?, 10 + ?)
                        ON CONFLICT(product_id) DO UPDATE SET stock = stock + ?
                    """, (it['productId'], it['quantity'], it['quantity']))

            conn.commit()
            
            # Fetch items
            cursor.execute("SELECT * FROM order_items WHERE orderId = ?", (order_id,))
            items = cursor.fetchall()
            conn.close()

            sync_csv_from_db(order['isTest'] == 1)

            order_data = {
                "orderId": order_id,
                "timestamp": order['timestamp'],
                "details": {
                    "customerName": order['customerName'],
                    "customerEmail": order['customerEmail'],
                    "subtotal": order['subtotal'],
                    "cgst": order['cgst'],
                    "sgst": order['sgst'],
                    "totalAmount": order['totalAmount'],
                    "status": new_status,
                    "paymentMethod": order['paymentMethod'],
                    "transactionId": order['transactionId'],
                    "items": [dict(r) for r in items]
                }
            }

            email_event = "cancelled" if action == "cancel" else "return_approved"
            simulate_order_email(order_data, email_event, order['isTest'] == 1)

            self.send_json(200, {"status": "success", "message": f"Action '{action}' processed successfully."})
            return

        elif path == '/api/payments/initiate':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            req_data = sanitize_data(json.loads(post_data.decode('utf-8')))
            amount = float(req_data.get('amount', 0.0))
            method = req_data.get('method', 'UPI')

            txn_id = "TXN-" + str(uuid.uuid4())[:8].upper()
            if is_test:
                txn_id = "TXN-TEST-" + str(uuid.uuid4())[:8].upper()

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO payments (transactionId, amount, status, paymentMethod, gatewayResponse, refundStatus, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (txn_id, amount, 'pending', method, '{}', 'none', datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")))
            conn.commit()
            conn.close()

            self.send_json(200, {"transactionId": txn_id, "amount": amount})
            return

        elif path == '/api/payments/webhook':
            webhook_secret = os.environ.get("WEBHOOK_SECRET", "SAI_SANKALP_WEBHOOK_SECRET_KEY_2026")
            signature = self.headers.get('X-Webhook-Signature')
            if signature and signature != webhook_secret:
                self.send_json(401, {"error": "Invalid webhook signature or secret."})
                return

            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            req_data = json.loads(post_data.decode('utf-8'))
            txn_id = req_data.get('transactionId')
            status = req_data.get('status', 'success')

            if not txn_id:
                self.send_json(400, {"error": "Missing transactionId"})
                return

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("UPDATE payments SET status = ?, gatewayResponse = ? WHERE transactionId = ?", (status, json.dumps(req_data), txn_id))
            conn.commit()
            conn.close()

            self.send_json(200, {"status": "success", "message": f"Transaction {txn_id} updated to {status}"})
            return

        elif path == '/api/products':
            if not self.is_admin():
                self.send_json(403, {"error": "Forbidden. Admin access required."})
                return

            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            new_product = json.loads(post_data.decode('utf-8'))

            pid = new_product.get('id')
            conn = get_db()
            cursor = conn.cursor()
            
            if pid:
                # Update existing product
                cursor.execute("""
                    UPDATE products 
                    SET title = ?, price = ?, category_id = ?, description = ?, image = ?, variants = ?
                    WHERE id = ?
                """, (new_product['title'], float(new_product['price']), new_product['category'], new_product['description'], new_product['image'], json.dumps(new_product.get('variants', [])), pid))
                
                cursor.execute("INSERT OR REPLACE INTO inventory (product_id, stock) VALUES (?, ?)", (pid, int(new_product.get('stock', 10))))
                conn.commit()
                conn.close()
                if USE_FIREBASE:
                    try:
                        db.save_product(new_product)
                    except Exception as e:
                        print(f"  [firebase] Firestore product sync error: {e}")
                self.send_json(200, new_product)
            else:
                # Add new product
                cursor.execute("""
                    INSERT INTO products (title, price, category_id, description, image, createdAt, variants)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (new_product['title'], float(new_product['price']), new_product['category'], new_product['description'], new_product['image'], datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"), json.dumps(new_product.get('variants', []))))
                new_id = cursor.lastrowid
                
                cursor.execute("INSERT INTO inventory (product_id, stock) VALUES (?, ?)", (new_id, int(new_product.get('stock', 10))))
                conn.commit()
                conn.close()
                new_product['id'] = new_id
                if USE_FIREBASE:
                    try:
                        db.save_product(new_product)
                    except Exception as e:
                        print(f"  [firebase] Firestore product sync error: {e}")
                self.send_json(200, new_product)
            return

        elif path == '/api/upload':
            if not self.is_admin():
                self.send_json(403, {"error": "Forbidden. Admin access required."})
                return

            content_type = self.headers.get('Content-Type', '')
            if 'multipart/form-data' not in content_type:
                self.send_json(400, {"error": "Expected multipart/form-data"})
                return

            boundary = None
            for part in content_type.split(';'):
                part = part.strip()
                if part.startswith('boundary='):
                    boundary = part[len('boundary='):].strip()
                    break

            if not boundary:
                self.send_json(400, {"error": "Missing boundary in Content-Type"})
                return

            content_length = int(self.headers.get('Content-Length', 0))
            raw_body = self.rfile.read(content_length)

            delimiter = ("--" + boundary).encode()
            parts = raw_body.split(delimiter)
            image_data = None
            original_filename = "upload.png"

            for part in parts:
                if not part or part == b'--':
                    continue
                if b'\r\n\r\n' in part:
                    header_section, _, file_body = part.partition(b'\r\n\r\n')
                elif b'\n\n' in part:
                    header_section, _, file_body = part.partition(b'\n\n')
                else:
                    continue

                headers_str = header_section.decode('utf-8', errors='ignore')
                if 'filename="' in headers_str:
                    match = re.search(r'filename="([^"]+)"', headers_str)
                    if match:
                        original_filename = match.group(1)
                    
                    if file_body.endswith(b'\r\n'):
                        image_data = file_body[:-2]
                    elif file_body.endswith(b'\n'):
                        image_data = file_body[:-1]
                    else:
                        image_data = file_body
                    break

            if image_data is None:
                self.send_json(400, {"error": "No file body found in upload"})
                return

            safe_filename = "test_product_image_" + str(uuid.uuid4())[:8] + os.path.splitext(original_filename)[1]
            if not os.path.exists('images'):
                os.makedirs('images')
            
            filepath = os.path.join('images', safe_filename)
            with open(filepath, 'wb') as f:
                f.write(image_data)

            self.send_json(200, {"status": "success", "url": "images/" + safe_filename})
            return

        elif path == '/api/categories':
            if not self.is_admin():
                self.send_json(403, {"error": "Forbidden. Admin access required."})
                return
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            cat_data = sanitize_data(json.loads(post_data.decode('utf-8')))
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("INSERT OR REPLACE INTO categories (id, name) VALUES (?, ?)", (cat_data['id'], cat_data['name']))
            conn.commit()
            conn.close()
            self.send_json(200, cat_data)
            return

        elif path == '/api/coupons':
            if not self.is_admin():
                self.send_json(403, {"error": "Forbidden. Admin access required."})
                return
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            coupon_data = sanitize_data(json.loads(post_data.decode('utf-8')))
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("INSERT OR REPLACE INTO coupons (code, type, value, label) VALUES (?, ?, ?, ?)", (coupon_data['code'], coupon_data['type'], float(coupon_data['value']), coupon_data['label']))
            conn.commit()
            conn.close()
            self.send_json(200, coupon_data)
            return

        elif path == '/api/banners':
            if not self.is_admin():
                self.send_json(403, {"error": "Forbidden. Admin access required."})
                return
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            banner_data = sanitize_data(json.loads(post_data.decode('utf-8')))
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("INSERT INTO banners (image, title, subtitle) VALUES (?, ?, ?)", (banner_data['image'], banner_data['title'], banner_data['subtitle']))
            banner_data['id'] = cursor.lastrowid
            conn.commit()
            conn.close()
            self.send_json(200, banner_data)
            return

        elif path == '/api/wishlist':
            session = self.get_session()
            if not session:
                self.send_json(401, {"error": "Unauthorized"})
                return
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            req_data = json.loads(post_data.decode('utf-8'))
            pid = int(req_data.get('productId'))
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("INSERT OR IGNORE INTO wishlist (userEmail, productId) VALUES (?, ?)", (session['email'], pid))
            conn.commit()
            conn.close()
            self.send_json(200, {"status": "success"})
            return

        elif path == '/api/addresses':
            session = self.get_session()
            if not session:
                self.send_json(401, {"error": "Unauthorized"})
                return
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            addr_data = sanitize_data(json.loads(post_data.decode('utf-8')))
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("INSERT INTO addresses (userEmail, name, mobile, address) VALUES (?, ?, ?, ?)", (session['email'], addr_data['name'], addr_data['mobile'], addr_data['address']))
            new_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            addr_data['id'] = new_id
            self.send_json(200, addr_data)
            return

        else:
            self.send_json(444, {"error": "No endpoint matches POST query"})

    def do_DELETE(self):
        if self.check_https_redirect():
            return
        if self.is_rate_limited():
            self.send_json(429, {"error": "Too Many Requests. Rate limit exceeded."})
            return

        if not self.check_csrf():
            return

        parsed_path = urlparse(self.path)
        path = parsed_path.path
        query_params = parse_qs(parsed_path.query)

        if path == '/api/products':
            if not self.is_admin():
                self.send_json(403, {"error": "Forbidden. Admin access required."})
                return
            
            pid = query_params.get('id', [None])[0]
            if not pid:
                self.send_json(400, {"error": "Missing id parameter"})
                return
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("UPDATE products SET isDeleted = 1 WHERE id = ?", (pid,))
            conn.commit()
            conn.close()
            if USE_FIREBASE:
                try:
                    db.delete_product(pid)
                except Exception as e:
                    print(f"  [firebase] Firestore product delete error: {e}")
            self.send_json(200, {"status": "success"})

        elif path == '/api/orders':
            if not self.is_admin():
                self.send_json(403, {"error": "Forbidden. Admin access required."})
                return
            
            is_test = self.is_test_mode()
            order_id = query_params.get('orderId', [None])[0]
            
            conn = get_db()
            cursor = conn.cursor()
            if order_id == 'ALL':
                # Delete all sandbox test orders in one click
                if is_test:
                    cursor.execute("DELETE FROM order_items WHERE orderId IN (SELECT orderId FROM orders WHERE isTest = 1)")
                    cursor.execute("DELETE FROM orders WHERE isTest = 1")
                    conn.commit()
                    conn.close()
                    sync_csv_from_db(is_test=True)
                    self.send_json(200, {"status": "success", "message": "All sandbox test orders deleted successfully."})
                else:
                    conn.close()
                    self.send_json(403, {"error": "Cannot delete production orders in bulk."})
            else:
                if not order_id:
                    conn.close()
                    self.send_json(400, {"error": "Missing orderId"})
                    return
                cursor.execute("DELETE FROM order_items WHERE orderId = ?", (order_id,))
                cursor.execute("DELETE FROM orders WHERE orderId = ?", (order_id,))
                conn.commit()
                conn.close()
                sync_csv_from_db(is_test)
                self.send_json(200, {"status": "success"})

        elif path == '/api/categories':
            if not self.is_admin():
                self.send_json(403, {"error": "Forbidden. Admin access required."})
                return
            
            cat_id = query_params.get('id', [None])[0]
            if not cat_id:
                self.send_json(400, {"error": "Missing id parameter"})
                return
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM categories WHERE id = ?", (cat_id,))
            conn.commit()
            conn.close()
            self.send_json(200, {"status": "success"})

        elif path == '/api/coupons':
            if not self.is_admin():
                self.send_json(403, {"error": "Forbidden. Admin access required."})
                return
            
            code = query_params.get('code', [None])[0]
            if not code:
                self.send_json(400, {"error": "Missing code parameter"})
                return
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM coupons WHERE code = ?", (code,))
            conn.commit()
            conn.close()
            self.send_json(200, {"status": "success"})

        elif path == '/api/banners':
            if not self.is_admin():
                self.send_json(403, {"error": "Forbidden. Admin access required."})
                return
            
            bid = query_params.get('id', [None])[0]
            if not bid:
                self.send_json(400, {"error": "Missing id parameter"})
                return
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM banners WHERE id = ?", (bid,))
            conn.commit()
            conn.close()
            self.send_json(200, {"status": "success"})

        elif path == '/api/wishlist':
            session = self.get_session()
            if not session:
                self.send_json(401, {"error": "Unauthorized"})
                return
            pid = query_params.get('productId', [None])[0]
            if not pid:
                self.send_json(400, {"error": "Missing productId parameter"})
                return
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM wishlist WHERE userEmail = ? AND productId = ?", (session['email'], int(pid)))
            conn.commit()
            conn.close()
            self.send_json(200, {"status": "success"})

        elif path == '/api/addresses':
            session = self.get_session()
            if not session:
                self.send_json(401, {"error": "Unauthorized"})
                return
            aid = query_params.get('id', [None])[0]
            if not aid:
                self.send_json(400, {"error": "Missing id parameter"})
                return
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM addresses WHERE userEmail = ? AND id = ?", (session['email'], int(aid)))
            conn.commit()
            conn.close()
            self.send_json(200, {"status": "success"})

        else:
            self.send_json(444, {"error": "No endpoint matches DELETE query"})

Handler = MockHandler

class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

if __name__ == '__main__':
    with ThreadingHTTPServer(('0.0.0.0', PORT), Handler) as httpd:
        print(f"==================================================")
        print(f"  SAI SANKALP ENTERPRISE SECURE DB HTTP SERVER")
        print(f"  Running on: http://localhost:{PORT}")
        print(f"  Database backend: SQLite (data/saisankalp.db)")
        print(f"  Rate limiting: Active (60 req/min/IP)")
        print(f"==================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")
            httpd.server_close()
