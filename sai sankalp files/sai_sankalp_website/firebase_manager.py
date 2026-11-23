"""
Sai Sankalp — Firebase Manager (Cloud Firestore)
=================================================
Provides a unified database abstraction layer that supports:
  1. Firebase Cloud Firestore (when credentials are configured)
  2. Local SQLite fallback (when Firebase is not configured)

Usage:
    from firebase_manager import db
    
    products = db.get_products()
    db.save_product({...})
    user = db.get_user("email@example.com")
"""

import os
import json
import time
import sqlite3
import hashlib
import uuid
import csv
from datetime import datetime, timedelta

# Import env_loader first to populate os.environ
import env_loader
from env_loader import get_env

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
FIREBASE_CREDENTIALS_PATH = get_env("FIREBASE_CREDENTIALS_PATH", "")
FIREBASE_PROJECT_ID = get_env("FIREBASE_PROJECT_ID", "")
USE_FIREBASE = bool(FIREBASE_CREDENTIALS_PATH and FIREBASE_PROJECT_ID)

# Try to import Firebase Admin SDK dynamically so IDEs without firebase-admin installed won't flag missing import errors
firestore_client = None
if USE_FIREBASE:
    try:
        import importlib
        firebase_admin = importlib.import_module("firebase_admin")
        credentials = importlib.import_module("firebase_admin.credentials")
        firestore = importlib.import_module("firebase_admin.firestore")
        
        if not getattr(firebase_admin, "_apps", None):
            cred = credentials.Certificate(FIREBASE_CREDENTIALS_PATH)
            firebase_admin.initialize_app(cred, {
                'projectId': FIREBASE_PROJECT_ID,
            })
        firestore_client = firestore.client()
        print(f"  [firebase_manager] ✅ Connected to Firebase Firestore (project: {FIREBASE_PROJECT_ID})")
    except (ImportError, ModuleNotFoundError):
        print("  [firebase_manager] ⚠️  firebase-admin package not installed. Using local SQLite fallback.")
        print("  [firebase_manager]    Install with: pip install firebase-admin")
        USE_FIREBASE = False
        firestore_client = None
    except Exception as e:
        print(f"  [firebase_manager] ⚠️  Firebase initialization failed: {e}")
        print(f"  [firebase_manager]    Falling back to local SQLite.")
        USE_FIREBASE = False
        firestore_client = None
else:
    print("  [firebase_manager] ℹ️  Firebase not configured. Using local SQLite database.")
    print("  [firebase_manager]    To enable Firebase, set FIREBASE_CREDENTIALS_PATH and FIREBASE_PROJECT_ID in .env")


# ---------------------------------------------------------------------------
# SQLite Fallback Setup
# ---------------------------------------------------------------------------
SQLITE_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'saisankalp.db')

def _get_sqlite():
    """Get a SQLite connection with Row factory for dict-like access."""
    os.makedirs(os.path.dirname(SQLITE_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(SQLITE_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def _init_sqlite():
    """Create all tables in SQLite if they don't exist."""
    conn = _get_sqlite()
    c = conn.cursor()
    
    c.execute("""CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        passwordHash TEXT,
        verified INTEGER DEFAULT 0,
        role TEXT DEFAULT 'customer',
        createdAt TEXT
    )""")
    
    c.execute("""CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT
    )""")
    
    c.execute("""CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        price REAL,
        category_id TEXT,
        description TEXT,
        image TEXT,
        isDeleted INTEGER DEFAULT 0,
        createdAt TEXT,
        variants TEXT,
        FOREIGN KEY(category_id) REFERENCES categories(id)
    )""")
    
    c.execute("""CREATE TABLE IF NOT EXISTS inventory (
        product_id INTEGER PRIMARY KEY,
        stock INTEGER,
        low_stock_threshold INTEGER DEFAULT 5,
        FOREIGN KEY(product_id) REFERENCES products(id)
    )""")
    
    c.execute("""CREATE TABLE IF NOT EXISTS orders (
        orderId TEXT PRIMARY KEY,
        timestamp TEXT,
        customerName TEXT,
        customerEmail TEXT,
        customerMobile TEXT,
        customerAddress TEXT,
        subtotal REAL,
        cgst REAL,
        sgst REAL,
        totalAmount REAL,
        status TEXT,
        paymentMethod TEXT,
        paymentDetails TEXT,
        transactionId TEXT UNIQUE,
        customerAction TEXT,
        customerActionAt TEXT,
        deliveryDate TEXT,
        isTest INTEGER DEFAULT 0
    )""")
    
    c.execute("""CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orderId TEXT,
        productId INTEGER,
        title TEXT,
        price REAL,
        quantity INTEGER,
        variant TEXT,
        FOREIGN KEY(orderId) REFERENCES orders(orderId),
        FOREIGN KEY(productId) REFERENCES products(id)
    )""")
    
    c.execute("""CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transactionId TEXT UNIQUE,
        amount REAL,
        status TEXT,
        paymentMethod TEXT,
        gatewayResponse TEXT,
        refundStatus TEXT,
        createdAt TEXT
    )""")
    
    c.execute("""CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productId INTEGER,
        author TEXT,
        rating INTEGER,
        comment TEXT,
        date TEXT,
        FOREIGN KEY(productId) REFERENCES products(id)
    )""")
    
    c.execute("""CREATE TABLE IF NOT EXISTS coupons (
        code TEXT PRIMARY KEY,
        type TEXT,
        value REAL,
        label TEXT
    )""")
    
    c.execute("""CREATE TABLE IF NOT EXISTS wishlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userEmail TEXT,
        productId INTEGER,
        UNIQUE(userEmail, productId),
        FOREIGN KEY(productId) REFERENCES products(id)
    )""")
    
    c.execute("""CREATE TABLE IF NOT EXISTS addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userEmail TEXT,
        name TEXT,
        mobile TEXT,
        address TEXT
    )""")
    
    c.execute("""CREATE TABLE IF NOT EXISTS banners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image TEXT,
        title TEXT,
        subtitle TEXT
    )""")
    
    c.execute("""CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        message TEXT,
        type TEXT,
        timestamp TEXT,
        isRead INTEGER DEFAULT 0
    )""")
    
    c.execute("""CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        email TEXT,
        role TEXT,
        expires REAL,
        csrfToken TEXT
    )""")
    
    c.execute("""CREATE TABLE IF NOT EXISTS login_attempts (
        ip TEXT,
        email TEXT,
        attempts INTEGER DEFAULT 0,
        last_attempt REAL,
        PRIMARY KEY(ip, email)
    )""")
    
    c.execute("""CREATE TABLE IF NOT EXISTS razorpay_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id TEXT,
        amount REAL,
        status TEXT,
        payload TEXT,
        createdAt TEXT
    )""")
    
    conn.commit()
    conn.close()
    print("  [firebase_manager] SQLite database initialized.")


def _seed_sqlite_from_json():
    """Seed the SQLite database from legacy JSON/CSV files if tables are empty."""
    conn = _get_sqlite()
    c = conn.cursor()
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
    
    def _hash_pw(pw):
        try:
            import importlib
            bcrypt = importlib.import_module("bcrypt")
            return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        except (ImportError, ModuleNotFoundError):
            salt = "saisankalp_salt_" + os.urandom(8).hex()
            dk = hashlib.pbkdf2_hmac('sha256', pw.encode('utf-8'), salt.encode('utf-8'), 100000).hex()
            return f"pbkdf2:sha256:100000${salt}${dk}"
    
    # --- Users ---
    c.execute("SELECT COUNT(*) FROM users")
    if c.fetchone()[0] == 0:
        users_file = os.path.join(data_dir, 'users.json')
        if os.path.exists(users_file):
            try:
                with open(users_file, 'r', encoding='utf-8') as f:
                    users = json.load(f)
                for u in users:
                    c.execute(
                        "INSERT OR IGNORE INTO users (email, passwordHash, verified, role, createdAt) VALUES (?, ?, ?, ?, ?)",
                        (u['email'], u['passwordHash'], 1 if u.get('verified', True) else 0,
                         u.get('role', 'customer'), datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"))
                    )
                print(f"  [seed] Loaded {len(users)} users from users.json")
            except Exception as e:
                print(f"  [seed] Error seeding users: {e}")
        else:
            # Default users
            c.execute("INSERT INTO users (email, passwordHash, verified, role, createdAt) VALUES (?, ?, ?, ?, ?)",
                      ("saisameermarla@gmail.com", _hash_pw("admin123"), 1, "admin", datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")))
            c.execute("INSERT INTO users (email, passwordHash, verified, role, createdAt) VALUES (?, ?, ?, ?, ?)",
                      ("john@gmail.com", _hash_pw("john123"), 1, "customer", datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")))
            print("  [seed] Created default users.")
    
    # --- Categories ---
    c.execute("SELECT COUNT(*) FROM categories")
    if c.fetchone()[0] == 0:
        cats_file = os.path.join(data_dir, 'categories.json')
        if os.path.exists(cats_file):
            try:
                with open(cats_file, 'r', encoding='utf-8') as f:
                    cats = json.load(f)
                for cat in cats:
                    c.execute("INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)", (cat['id'], cat['name']))
                print(f"  [seed] Loaded {len(cats)} categories.")
            except Exception as e:
                print(f"  [seed] Error seeding categories: {e}")
        else:
            for cid, cname in [("paper", "Paper Craft"), ("kerchief", "Woolen Handkerchief"), ("doll", "Woolen Doll")]:
                c.execute("INSERT INTO categories (id, name) VALUES (?, ?)", (cid, cname))
    
    # --- Products ---
    c.execute("SELECT COUNT(*) FROM products")
    if c.fetchone()[0] == 0:
        products_file = os.path.join(data_dir, 'products.json')
        if os.path.exists(products_file):
            try:
                with open(products_file, 'r', encoding='utf-8') as f:
                    products = json.load(f)
                for p in products:
                    c.execute(
                        "INSERT OR IGNORE INTO products (id, title, price, category_id, description, image, isDeleted, createdAt, variants) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        (p['id'], p['title'], p['price'], p.get('category', 'paper'),
                         p.get('description', ''), p.get('image', ''),
                         1 if p.get('isDeleted', False) else 0,
                         datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                         json.dumps(p.get('variants', [])))
                    )
                    c.execute("INSERT OR IGNORE INTO inventory (product_id, stock, low_stock_threshold) VALUES (?, ?, ?)",
                              (p['id'], p.get('stock', 10), 5))
                print(f"  [seed] Loaded {len(products)} products.")
            except Exception as e:
                print(f"  [seed] Error seeding products: {e}")
    
    # --- Banners ---
    c.execute("SELECT COUNT(*) FROM banners")
    if c.fetchone()[0] == 0:
        banners_file = os.path.join(data_dir, 'banners.json')
        if os.path.exists(banners_file):
            try:
                with open(banners_file, 'r', encoding='utf-8') as f:
                    banners = json.load(f)
                for b in banners:
                    c.execute("INSERT INTO banners (image, title, subtitle) VALUES (?, ?, ?)",
                              (b.get('image', ''), b.get('title', ''), b.get('subtitle', '')))
                print(f"  [seed] Loaded {len(banners)} banners.")
            except Exception as e:
                print(f"  [seed] Error seeding banners: {e}")
    
    # --- Coupons ---
    c.execute("SELECT COUNT(*) FROM coupons")
    if c.fetchone()[0] == 0:
        coupons_file = os.path.join(data_dir, 'coupons.json')
        if os.path.exists(coupons_file):
            try:
                with open(coupons_file, 'r', encoding='utf-8') as f:
                    coupons = json.load(f)
                for code, val in coupons.items():
                    c.execute("INSERT OR IGNORE INTO coupons (code, type, value, label) VALUES (?, ?, ?, ?)",
                              (code, val.get('type', 'percent'), val.get('value', 10), val.get('label', '')))
                print(f"  [seed] Loaded {len(coupons)} coupons.")
            except Exception as e:
                print(f"  [seed] Error seeding coupons: {e}")
    
    # --- Orders ---
    c.execute("SELECT COUNT(*) FROM orders")
    if c.fetchone()[0] == 0:
        for is_test in [False, True]:
            suffix = "test_orders" if is_test else "orders"
            json_file = os.path.join(data_dir, f'{suffix}.json')
            if os.path.exists(json_file):
                try:
                    with open(json_file, 'r', encoding='utf-8') as f:
                        orders = json.load(f)
                    if not isinstance(orders, list):
                        continue
                    for o in orders:
                        det = o.get('details', {})
                        c.execute(
                            "INSERT OR IGNORE INTO orders (orderId, timestamp, customerName, customerEmail, customerMobile, customerAddress, subtotal, cgst, sgst, totalAmount, status, paymentMethod, paymentDetails, transactionId, customerAction, customerActionAt, isTest) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            (o['orderId'], o['timestamp'], det.get('customerName', ''), det.get('customerEmail', ''),
                             det.get('customerMobile', ''), det.get('customerAddress', ''),
                             det.get('subtotal', 0), det.get('cgst', 0), det.get('sgst', 0),
                             det.get('totalAmount', 0), det.get('status', 'Pending'),
                             det.get('paymentMethod', ''), det.get('paymentDetails', ''),
                             det.get('transactionId', ''), det.get('customerAction', ''),
                             det.get('customerActionAt', ''), 1 if is_test else 0)
                        )
                        for it in det.get('items', []):
                            c.execute(
                                "INSERT INTO order_items (orderId, productId, title, price, quantity, variant) VALUES (?, ?, ?, ?, ?, ?)",
                                (o['orderId'], it.get('id'), it.get('title'), it.get('price'),
                                 it.get('quantity'), it.get('variant', ''))
                            )
                    print(f"  [seed] Loaded orders from {suffix}.json")
                except Exception as e:
                    print(f"  [seed] Error seeding orders ({suffix}): {e}")
    
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Firestore Database Class
# ---------------------------------------------------------------------------
class FirestoreDB:
    """Database operations backed by Cloud Firestore."""
    
    def __init__(self, client):
        self._db = client
    
    # --- Products ---
    def get_products(self, include_deleted=False):
        docs = self._db.collection('products').stream()
        products = []
        for doc in docs:
            p = doc.to_dict()
            p['id'] = doc.id
            if not include_deleted and p.get('isDeleted', False):
                continue
            products.append(p)
        return products
    
    def get_product(self, product_id):
        doc = self._db.collection('products').document(str(product_id)).get()
        if doc.exists:
            p = doc.to_dict()
            p['id'] = doc.id
            return p
        return None
    
    def save_product(self, product_data):
        pid = str(product_data.get('id', ''))
        if pid:
            self._db.collection('products').document(pid).set(product_data, merge=True)
        else:
            ref = self._db.collection('products').add(product_data)
            product_data['id'] = ref[1].id
        return product_data
    
    def delete_product(self, product_id):
        self._db.collection('products').document(str(product_id)).update({'isDeleted': True})
    
    # --- Categories ---
    def get_categories(self):
        docs = self._db.collection('categories').stream()
        return [{'id': doc.id, **doc.to_dict()} for doc in docs]
    
    def save_category(self, category_id_or_data, category_data=None):
        if isinstance(category_id_or_data, dict):
            data = dict(category_id_or_data)
            cid = str(data.get('id', ''))
        else:
            cid = str(category_id_or_data)
            data = dict(category_data or {})
            data['id'] = cid
        self._db.collection('categories').document(cid).set(data, merge=True)
        return data
    
    # --- Users ---
    def get_user(self, email):
        if not email:
            return None
        docs = self._db.collection('users').where('email', '==', str(email).strip().lower()).limit(1).stream()
        for doc in docs:
            u = doc.to_dict()
            u['_doc_id'] = doc.id
            return u
        return None
    
    def save_user(self, user_data):
        email = str(user_data.get('email', '')).strip().lower()
        if not email:
            return None
        existing = self.get_user(email)
        if existing:
            self._db.collection('users').document(existing['_doc_id']).set(user_data, merge=True)
        else:
            self._db.collection('users').add(user_data)
        return user_data
    
    def update_user_password(self, email, new_hash):
        user = self.get_user(email)
        if user:
            self._db.collection('users').document(user['_doc_id']).update({'passwordHash': new_hash})
    
    # --- Orders ---
    def get_orders(self, is_test=False):
        query = self._db.collection('orders').where('isTest', '==', is_test).order_by('timestamp', direction='DESCENDING')
        docs = query.stream()
        return [{'orderId': doc.id, **doc.to_dict()} for doc in docs]
    
    def get_order(self, order_id):
        doc = self._db.collection('orders').document(order_id).get()
        if doc.exists:
            return {'orderId': doc.id, **doc.to_dict()}
        return None
    
    def save_order(self, order_data):
        oid = order_data.get('orderId', f"SS-ORD-{uuid.uuid4().hex[:8].upper()}")
        order_data['orderId'] = oid
        self._db.collection('orders').document(oid).set(order_data, merge=True)
        return order_data
    
    def update_order_status(self, order_id, status, extra_fields=None):
        update = {'status': status}
        if extra_fields:
            update.update(extra_fields)
        self._db.collection('orders').document(order_id).update(update)
    
    # --- Inventory ---
    def get_stock(self, product_id):
        doc = self._db.collection('inventory').document(str(product_id)).get()
        if doc.exists:
            return doc.to_dict().get('stock', 0)
        return 0
    
    def update_stock(self, product_id, new_stock):
        self._db.collection('inventory').document(str(product_id)).set(
            {'stock': new_stock, 'product_id': product_id}, merge=True
        )
    
    # --- Reviews ---
    def get_reviews(self, product_id):
        docs = self._db.collection('reviews').where('productId', '==', int(product_id)).stream()
        return [doc.to_dict() for doc in docs]
    
    def save_review(self, product_id_or_data, review_data=None):
        if isinstance(product_id_or_data, dict):
            data = dict(product_id_or_data)
        else:
            data = dict(review_data or {})
            data['productId'] = int(product_id_or_data)
        if 'date' not in data:
            data['date'] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        ref = self._db.collection('reviews').add(data)
        data['id'] = ref[1].id
        return data
    
    # --- Coupons ---
    def get_coupon(self, code):
        doc = self._db.collection('coupons').document(code.upper()).get()
        if doc.exists:
            return doc.to_dict()
        return None
    
    def get_all_coupons(self):
        docs = self._db.collection('coupons').stream()
        return {doc.id: doc.to_dict() for doc in docs}
    
    def save_coupon(self, code_or_data, coupon_data=None):
        if isinstance(code_or_data, dict):
            coupon_data = dict(code_or_data)
            code = coupon_data.get('code', '')
        else:
            code = str(code_or_data)
            coupon_data = dict(coupon_data or {})
        code = str(code).upper()
        coupon_data['code'] = code
        self._db.collection('coupons').document(code).set(coupon_data, merge=True)
        return coupon_data
    
    def delete_coupon(self, code):
        self._db.collection('coupons').document(code.upper()).delete()
    
    # --- Banners ---
    def get_banners(self):
        docs = self._db.collection('banners').stream()
        return [{'id': doc.id, **doc.to_dict()} for doc in docs]
    
    def save_banner(self, banner_id_or_data, banner_data=None):
        if isinstance(banner_id_or_data, dict):
            data = dict(banner_id_or_data)
        else:
            data = dict(banner_data or {})
            data['id'] = banner_id_or_data
        if 'id' in data and data['id']:
            self._db.collection('banners').document(str(data['id'])).set(data, merge=True)
        else:
            ref = self._db.collection('banners').add(data)
            data['id'] = ref[1].id
        return data
    
    # --- Sessions ---
    def get_session(self, token):
        doc = self._db.collection('sessions').document(token).get()
        if doc.exists:
            s = doc.to_dict()
            if time.time() > s.get('expires', 0):
                self.delete_session(token)
                return None
            return s
        return None
    
    def save_session(self, token, email, role, expires, csrf_token):
        self._db.collection('sessions').document(token).set({
            'email': email, 'role': role, 'expires': expires, 'csrfToken': csrf_token
        })
    
    def delete_session(self, token):
        self._db.collection('sessions').document(token).delete()
    
    def delete_sessions_for_email(self, email):
        docs = self._db.collection('sessions').where('email', '==', email).stream()
        for doc in docs:
            doc.reference.delete()
    
    # --- Wishlist ---
    def get_wishlist(self, email):
        docs = self._db.collection('wishlist').where('userEmail', '==', email).stream()
        return [doc.to_dict() for doc in docs]
    
    def add_to_wishlist(self, email, product_id):
        self._db.collection('wishlist').add({'userEmail': email, 'productId': int(product_id)})
    
    def remove_from_wishlist(self, email, product_id):
        docs = self._db.collection('wishlist') \
            .where('userEmail', '==', email) \
            .where('productId', '==', int(product_id)).stream()
        for doc in docs:
            doc.reference.delete()
    
    # --- Addresses ---
    def get_addresses(self, email):
        docs = self._db.collection('addresses').where('userEmail', '==', email).stream()
        return [{'id': doc.id, **doc.to_dict()} for doc in docs]
    
    def save_address(self, user_email_or_data, address_data=None):
        if isinstance(user_email_or_data, dict):
            data = dict(user_email_or_data)
        else:
            data = dict(address_data or {})
            data['userEmail'] = user_email_or_data
        if 'email' in data and 'userEmail' not in data:
            data['userEmail'] = data['email']
        ref = self._db.collection('addresses').add(data)
        data['id'] = ref[1].id
        return data
    
    def delete_address(self, email, address_id):
        self._db.collection('addresses').document(str(address_id)).delete()
    
    # --- Notifications ---
    def get_notifications(self):
        docs = self._db.collection('notifications').order_by('timestamp', direction='DESCENDING').stream()
        return [{'id': doc.id, **doc.to_dict()} for doc in docs]
    
    def save_notification(self, title_or_data, message=None, notif_type="info", timestamp=None):
        if isinstance(title_or_data, dict):
            data = dict(title_or_data)
        else:
            data = {
                'title': str(title_or_data),
                'message': str(message or ''),
                'type': str(notif_type),
                'timestamp': timestamp or datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                'isRead': False
            }
        ref = self._db.collection('notifications').add(data)
        data['id'] = ref[1].id
        return data
    
    def mark_notification_read(self, notification_id):
        self._db.collection('notifications').document(str(notification_id)).update({'isRead': True})
    
    # --- Payments / Razorpay Logs ---
    def save_payment(self, payment_data):
        tid = payment_data.get('transactionId', str(uuid.uuid4()))
        self._db.collection('payments').document(tid).set(payment_data, merge=True)
    
    def save_razorpay_log(self, log_data):
        self._db.collection('razorpay_logs').add(log_data)
    
    # --- Login Attempts ---
    def get_login_attempts(self, ip, email):
        doc_id = f"{ip}_{email}"
        doc = self._db.collection('login_attempts').document(doc_id).get()
        if doc.exists:
            return doc.to_dict()
        return {'attempts': 0, 'last_attempt': 0}
    
    def update_login_attempts(self, ip, email, attempts, last_attempt):
        doc_id = f"{ip}_{email}"
        self._db.collection('login_attempts').document(doc_id).set({
            'ip': ip, 'email': email, 'attempts': attempts, 'last_attempt': last_attempt
        })
    
    def reset_login_attempts(self, ip, email):
        doc_id = f"{ip}_{email}"
        self._db.collection('login_attempts').document(doc_id).delete()


# ---------------------------------------------------------------------------
# SQLite Database Class
# ---------------------------------------------------------------------------
class SQLiteDB:
    """Database operations backed by local SQLite."""
    
    def _conn(self):
        return _get_sqlite()
    
    def _dict_row(self, row):
        """Convert sqlite3.Row to plain dict."""
        if row is None:
            return None
        return dict(row)
    
    def _dict_rows(self, rows):
        return [dict(r) for r in rows]
    
    # --- Products ---
    def get_products(self, include_deleted=False):
        conn = self._conn()
        c = conn.cursor()
        if include_deleted:
            c.execute("""SELECT p.id, p.title, p.price, p.category_id as category, p.description, p.image, p.variants, p.isDeleted, i.stock 
                         FROM products p LEFT JOIN inventory i ON p.id = i.product_id""")
        else:
            c.execute("""SELECT p.id, p.title, p.price, p.category_id as category, p.description, p.image, p.variants, i.stock 
                         FROM products p LEFT JOIN inventory i ON p.id = i.product_id WHERE p.isDeleted = 0""")
        rows = self._dict_rows(c.fetchall())
        conn.close()
        for r in rows:
            if 'variants' in r and isinstance(r['variants'], str):
                try:
                    r['variants'] = json.loads(r['variants'])
                except:
                    r['variants'] = []
        return rows
    
    def get_product(self, product_id):
        conn = self._conn()
        c = conn.cursor()
        c.execute("""SELECT p.id, p.title, p.price, p.category_id as category, p.description, p.image, p.variants, p.isDeleted, i.stock 
                     FROM products p LEFT JOIN inventory i ON p.id = i.product_id WHERE p.id = ?""", (int(product_id),))
        row = c.fetchone()
        conn.close()
        if row:
            r = dict(row)
            if 'variants' in r and isinstance(r['variants'], str):
                try:
                    r['variants'] = json.loads(r['variants'])
                except:
                    r['variants'] = []
            return r
        return None
    
    def save_product(self, product_data):
        conn = self._conn()
        c = conn.cursor()
        pid = product_data.get('id')
        if pid:
            c.execute("""UPDATE products SET title=?, price=?, category_id=?, description=?, image=?, variants=?, isDeleted=? WHERE id=?""",
                      (product_data.get('title', ''), product_data.get('price', 0),
                       product_data.get('category', ''), product_data.get('description', ''),
                       product_data.get('image', ''), json.dumps(product_data.get('variants', [])),
                       1 if product_data.get('isDeleted', False) else 0, pid))
            if 'stock' in product_data:
                c.execute("INSERT OR REPLACE INTO inventory (product_id, stock, low_stock_threshold) VALUES (?, ?, ?)",
                          (pid, product_data['stock'], 5))
        else:
            c.execute("""INSERT INTO products (title, price, category_id, description, image, isDeleted, createdAt, variants) 
                         VALUES (?, ?, ?, ?, ?, 0, ?, ?)""",
                      (product_data.get('title', ''), product_data.get('price', 0),
                       product_data.get('category', ''), product_data.get('description', ''),
                       product_data.get('image', ''),
                       datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                       json.dumps(product_data.get('variants', []))))
            product_data['id'] = c.lastrowid
            stock = product_data.get('stock', 10)
            c.execute("INSERT INTO inventory (product_id, stock, low_stock_threshold) VALUES (?, ?, ?)",
                      (product_data['id'], stock, 5))
        conn.commit()
        conn.close()
        return product_data
    
    def delete_product(self, product_id):
        conn = self._conn()
        c = conn.cursor()
        c.execute("UPDATE products SET isDeleted = 1 WHERE id = ?", (int(product_id),))
        conn.commit()
        conn.close()
    
    # --- Categories ---
    def get_categories(self):
        conn = self._conn()
        c = conn.cursor()
        c.execute("SELECT id, name FROM categories")
        rows = self._dict_rows(c.fetchall())
        conn.close()
        return rows
    
    def save_category(self, category_id_or_data, category_data=None):
        if isinstance(category_id_or_data, dict):
            data = dict(category_id_or_data)
            cid = str(data.get('id', ''))
        else:
            cid = str(category_id_or_data)
            data = dict(category_data or {})
            data['id'] = cid
        name = data.get('name', cid)
        conn = self._conn()
        c = conn.cursor()
        c.execute("INSERT OR REPLACE INTO categories (id, name) VALUES (?, ?)", (cid, name))
        conn.commit()
        conn.close()
        return data
    
    # --- Users ---
    def get_user(self, email):
        if not email:
            return None
        conn = self._conn()
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE email = ?", (str(email).strip().lower(),))
        row = c.fetchone()
        conn.close()
        return self._dict_row(row)
    
    def save_user(self, user_data):
        email = str(user_data.get('email', '')).strip().lower()
        if not email:
            return None
        conn = self._conn()
        c = conn.cursor()
        c.execute("""INSERT INTO users (email, passwordHash, verified, role, createdAt) 
                     VALUES (?, ?, ?, ?, ?)
                     ON CONFLICT(email) DO UPDATE SET
                        passwordHash=excluded.passwordHash,
                        verified=excluded.verified,
                        role=excluded.role""",
                  (email, user_data.get('passwordHash', ''),
                   1 if user_data.get('verified', False) else 0,
                   user_data.get('role', 'customer'),
                   user_data.get('createdAt', datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"))))
        conn.commit()
        conn.close()
        return user_data
    
    def update_user_password(self, email, new_hash):
        conn = self._conn()
        c = conn.cursor()
        c.execute("UPDATE users SET passwordHash = ? WHERE email = ?", (new_hash, email))
        conn.commit()
        conn.close()
    
    # --- Orders ---
    def get_orders(self, is_test=False):
        conn = self._conn()
        c = conn.cursor()
        c.execute("""SELECT * FROM orders WHERE isTest = ? ORDER BY timestamp DESC""", (1 if is_test else 0,))
        rows = self._dict_rows(c.fetchall())
        # Attach items
        for order in rows:
            c.execute("SELECT * FROM order_items WHERE orderId = ?", (order['orderId'],))
            order['items'] = self._dict_rows(c.fetchall())
        conn.close()
        return rows
    
    def get_order(self, order_id):
        conn = self._conn()
        c = conn.cursor()
        c.execute("SELECT * FROM orders WHERE orderId = ?", (order_id,))
        row = c.fetchone()
        if row:
            order = dict(row)
            c.execute("SELECT * FROM order_items WHERE orderId = ?", (order_id,))
            order['items'] = self._dict_rows(c.fetchall())
            conn.close()
            return order
        conn.close()
        return None
    
    def save_order(self, order_data):
        conn = self._conn()
        c = conn.cursor()
        det = order_data.get('details', order_data)
        oid = order_data.get('orderId', f"SS-ORD-{uuid.uuid4().hex[:8].upper()}")
        
        c.execute("""INSERT OR REPLACE INTO orders (orderId, timestamp, customerName, customerEmail, customerMobile, 
                     customerAddress, subtotal, cgst, sgst, totalAmount, status, paymentMethod, paymentDetails, 
                     transactionId, customerAction, customerActionAt, deliveryDate, isTest) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                  (oid, order_data.get('timestamp', datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")),
                   det.get('customerName', ''), det.get('customerEmail', ''),
                   det.get('customerMobile', ''), det.get('customerAddress', ''),
                   det.get('subtotal', 0), det.get('cgst', 0), det.get('sgst', 0),
                   det.get('totalAmount', 0), det.get('status', 'Pending'),
                   det.get('paymentMethod', ''), det.get('paymentDetails', ''),
                   det.get('transactionId', ''), det.get('customerAction', ''),
                   det.get('customerActionAt', ''), det.get('deliveryDate', ''),
                   1 if order_data.get('isTest', False) else 0))
        
        for item in det.get('items', []):
            c.execute("""INSERT INTO order_items (orderId, productId, title, price, quantity, variant) 
                         VALUES (?, ?, ?, ?, ?, ?)""",
                      (oid, item.get('id'), item.get('title'), item.get('price'),
                       item.get('quantity'), item.get('variant', '')))
        
        conn.commit()
        conn.close()
        order_data['orderId'] = oid
        return order_data
    
    def update_order_status(self, order_id, status, extra_fields=None):
        conn = self._conn()
        c = conn.cursor()
        if extra_fields:
            sets = ', '.join([f"{k} = ?" for k in extra_fields.keys()])
            vals = list(extra_fields.values())
            c.execute(f"UPDATE orders SET status = ?, {sets} WHERE orderId = ?", [status] + vals + [order_id])
        else:
            c.execute("UPDATE orders SET status = ? WHERE orderId = ?", (status, order_id))
        conn.commit()
        conn.close()
    
    # --- Inventory ---
    def get_stock(self, product_id):
        conn = self._conn()
        c = conn.cursor()
        c.execute("SELECT stock FROM inventory WHERE product_id = ?", (int(product_id),))
        row = c.fetchone()
        conn.close()
        return row['stock'] if row else 0
    
    def update_stock(self, product_id, new_stock):
        conn = self._conn()
        c = conn.cursor()
        c.execute("INSERT OR REPLACE INTO inventory (product_id, stock, low_stock_threshold) VALUES (?, ?, 5)",
                  (int(product_id), new_stock))
        conn.commit()
        conn.close()
    
    # --- Reviews ---
    def get_reviews(self, product_id):
        conn = self._conn()
        c = conn.cursor()
        c.execute("SELECT * FROM reviews WHERE productId = ?", (int(product_id),))
        rows = self._dict_rows(c.fetchall())
        conn.close()
        return rows
    
    def save_review(self, product_id_or_data, review_data=None):
        if isinstance(product_id_or_data, dict):
            data = dict(product_id_or_data)
        else:
            data = dict(review_data or {})
            data['productId'] = int(product_id_or_data)
        pid = int(data.get('productId', 0))
        author = data.get('author') or data.get('customerName', 'Anonymous')
        rating = int(data.get('rating', 5))
        comment = data.get('comment', '')
        review_date = data.get('date', datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"))
        conn = self._conn()
        c = conn.cursor()
        c.execute("INSERT INTO reviews (productId, author, rating, comment, date) VALUES (?, ?, ?, ?, ?)",
                  (pid, author, rating, comment, review_date))
        conn.commit()
        data['id'] = c.lastrowid
        conn.close()
        return data
    
    # --- Coupons ---
    def get_coupon(self, code):
        conn = self._conn()
        c = conn.cursor()
        c.execute("SELECT * FROM coupons WHERE code = ?", (str(code).upper(),))
        row = c.fetchone()
        conn.close()
        return self._dict_row(row)
    
    def get_all_coupons(self):
        conn = self._conn()
        c = conn.cursor()
        c.execute("SELECT * FROM coupons")
        rows = self._dict_rows(c.fetchall())
        conn.close()
        return {r['code']: r for r in rows}
    
    def save_coupon(self, code_or_data, coupon_data=None):
        if isinstance(code_or_data, dict):
            coupon_data = dict(code_or_data)
            code = coupon_data.get('code', '')
        else:
            code = str(code_or_data)
            coupon_data = dict(coupon_data or {})
        code = str(code).upper()
        coupon_data['code'] = code
        conn = self._conn()
        c = conn.cursor()
        c.execute("INSERT OR REPLACE INTO coupons (code, type, value, label) VALUES (?, ?, ?, ?)",
                  (code, coupon_data.get('type', 'percent'),
                   float(coupon_data.get('value', 10)), coupon_data.get('label', '')))
        conn.commit()
        conn.close()
        return coupon_data
    
    def delete_coupon(self, code):
        conn = self._conn()
        c = conn.cursor()
        c.execute("DELETE FROM coupons WHERE code = ?", (str(code).upper(),))
        conn.commit()
        conn.close()
    
    # --- Banners ---
    def get_banners(self):
        conn = self._conn()
        c = conn.cursor()
        c.execute("SELECT * FROM banners")
        rows = self._dict_rows(c.fetchall())
        conn.close()
        return rows
    
    def save_banner(self, banner_id_or_data, banner_data=None):
        if isinstance(banner_id_or_data, dict):
            data = dict(banner_id_or_data)
        else:
            data = dict(banner_data or {})
            data['id'] = banner_id_or_data
        conn = self._conn()
        c = conn.cursor()
        if 'id' in data and data['id']:
            c.execute("UPDATE banners SET image=?, title=?, subtitle=? WHERE id=?",
                      (data.get('image', ''), data.get('title', ''),
                       data.get('subtitle', ''), data['id']))
        else:
            c.execute("INSERT INTO banners (image, title, subtitle) VALUES (?, ?, ?)",
                      (data.get('image', ''), data.get('title', ''), data.get('subtitle', '')))
            data['id'] = c.lastrowid
        conn.commit()
        conn.close()
        return data
    
    # --- Sessions ---
    def get_session(self, token):
        conn = self._conn()
        c = conn.cursor()
        c.execute("SELECT email, role, expires, csrfToken FROM sessions WHERE token = ?", (token,))
        row = c.fetchone()
        conn.close()
        if not row:
            return None
        s = dict(row)
        if time.time() > s.get('expires', 0):
            self.delete_session(token)
            return None
        return s
    
    def save_session(self, token, email, role, expires, csrf_token):
        conn = self._conn()
        c = conn.cursor()
        c.execute("INSERT OR REPLACE INTO sessions (token, email, role, expires, csrfToken) VALUES (?, ?, ?, ?, ?)",
                  (token, email, role, expires, csrf_token))
        conn.commit()
        conn.close()
    
    def delete_session(self, token):
        conn = self._conn()
        c = conn.cursor()
        c.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
        conn.close()
    
    def delete_sessions_for_email(self, email):
        conn = self._conn()
        c = conn.cursor()
        c.execute("DELETE FROM sessions WHERE email = ?", (email,))
        conn.commit()
        conn.close()
    
    # --- Wishlist ---
    def get_wishlist(self, email):
        conn = self._conn()
        c = conn.cursor()
        c.execute("SELECT * FROM wishlist WHERE userEmail = ?", (email,))
        rows = self._dict_rows(c.fetchall())
        conn.close()
        return rows
    
    def add_to_wishlist(self, email, product_id):
        conn = self._conn()
        c = conn.cursor()
        try:
            c.execute("INSERT OR IGNORE INTO wishlist (userEmail, productId) VALUES (?, ?)", (email, int(product_id)))
            conn.commit()
        except Exception:
            pass
        conn.close()
    
    def remove_from_wishlist(self, email, product_id):
        conn = self._conn()
        c = conn.cursor()
        c.execute("DELETE FROM wishlist WHERE userEmail = ? AND productId = ?", (email, int(product_id)))
        conn.commit()
        conn.close()
    
    # --- Addresses ---
    def get_addresses(self, email):
        conn = self._conn()
        c = conn.cursor()
        c.execute("SELECT * FROM addresses WHERE userEmail = ?", (email,))
        rows = self._dict_rows(c.fetchall())
        conn.close()
        return rows
    
    def save_address(self, user_email_or_data, address_data=None):
        if isinstance(user_email_or_data, dict):
            data = dict(user_email_or_data)
        else:
            data = dict(address_data or {})
            data['userEmail'] = user_email_or_data
        user_email = data.get('userEmail') or data.get('email') or data.get('customerEmail', '')
        name = data.get('name') or data.get('fullName', '')
        mobile = data.get('mobile') or data.get('phone', '')
        addr = data.get('address', '')
        conn = self._conn()
        c = conn.cursor()
        c.execute("INSERT INTO addresses (userEmail, name, mobile, address) VALUES (?, ?, ?, ?)",
                  (user_email, name, mobile, addr))
        conn.commit()
        data['id'] = c.lastrowid
        conn.close()
        return data
    
    def delete_address(self, email, address_id):
        conn = self._conn()
        c = conn.cursor()
        c.execute("DELETE FROM addresses WHERE userEmail = ? AND id = ?", (email, int(address_id)))
        conn.commit()
        conn.close()
    
    # --- Notifications ---
    def get_notifications(self):
        conn = self._conn()
        c = conn.cursor()
        c.execute("SELECT * FROM notifications ORDER BY timestamp DESC")
        rows = self._dict_rows(c.fetchall())
        conn.close()
        return rows
    
    def save_notification(self, title_or_data, message=None, notif_type="info", timestamp=None):
        if isinstance(title_or_data, dict):
            data = dict(title_or_data)
        else:
            data = {
                'title': str(title_or_data),
                'message': str(message or ''),
                'type': str(notif_type),
                'timestamp': timestamp or datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                'isRead': 0
            }
        conn = self._conn()
        c = conn.cursor()
        c.execute("INSERT INTO notifications (title, message, type, timestamp, isRead) VALUES (?, ?, ?, ?, ?)",
                  (data.get('title', ''), data.get('message', ''), data.get('type', 'info'),
                   data.get('timestamp', datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")), 0))
        conn.commit()
        data['id'] = c.lastrowid
        conn.close()
        return data
    
    def mark_notification_read(self, notification_id):
        conn = self._conn()
        c = conn.cursor()
        c.execute("UPDATE notifications SET isRead = 1 WHERE id = ?", (int(notification_id),))
        conn.commit()
        conn.close()
    
    # --- Payments ---
    def save_payment(self, payment_data):
        conn = self._conn()
        c = conn.cursor()
        c.execute("""INSERT OR REPLACE INTO payments (transactionId, amount, status, paymentMethod, gatewayResponse, refundStatus, createdAt) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)""",
                  (payment_data.get('transactionId', ''), payment_data.get('amount', 0),
                   payment_data.get('status', ''), payment_data.get('paymentMethod', ''),
                   payment_data.get('gatewayResponse', ''), payment_data.get('refundStatus', 'none'),
                   payment_data.get('createdAt', datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"))))
        conn.commit()
        conn.close()
    
    def save_razorpay_log(self, log_data):
        conn = self._conn()
        c = conn.cursor()
        c.execute("INSERT INTO razorpay_logs (payment_id, amount, status, payload, createdAt) VALUES (?, ?, ?, ?, ?)",
                  (log_data.get('payment_id', ''), log_data.get('amount', 0),
                   log_data.get('status', ''), log_data.get('payload', ''),
                   log_data.get('createdAt', datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"))))
        conn.commit()
        conn.close()
    
    # --- Login Attempts ---
    def get_login_attempts(self, ip, email):
        conn = self._conn()
        c = conn.cursor()
        c.execute("SELECT attempts, last_attempt FROM login_attempts WHERE ip = ? AND email = ?", (ip, email))
        row = c.fetchone()
        conn.close()
        if row:
            return dict(row)
        return {'attempts': 0, 'last_attempt': 0}
    
    def update_login_attempts(self, ip, email, attempts, last_attempt):
        conn = self._conn()
        c = conn.cursor()
        c.execute("INSERT OR REPLACE INTO login_attempts (ip, email, attempts, last_attempt) VALUES (?, ?, ?, ?)",
                  (ip, email, attempts, last_attempt))
        conn.commit()
        conn.close()
    
    def reset_login_attempts(self, ip, email):
        conn = self._conn()
        c = conn.cursor()
        c.execute("DELETE FROM login_attempts WHERE ip = ? AND email = ?", (ip, email))
        conn.commit()
        conn.close()


# ---------------------------------------------------------------------------
# Initialize & Export
# ---------------------------------------------------------------------------
if USE_FIREBASE and firestore_client:
    db = FirestoreDB(firestore_client)
    print("  [firebase_manager] Using: Cloud Firestore")
else:
    _init_sqlite()
    _seed_sqlite_from_json()
    db = SQLiteDB()
    print("  [firebase_manager] Using: Local SQLite")
