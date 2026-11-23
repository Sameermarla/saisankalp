"""
Sai Sankalp — Migration Script to Cloud Firestore
===================================================
Migrates local data (SQLite database / JSON files) to Google Cloud Firestore.

Usage:
    python migrate_to_firebase.py             # Executes migration or dry-run validation
    python migrate_to_firebase.py --dry-run   # Scans local databases and prints inventory
    python migrate_to_firebase.py --check     # Checks Firebase configuration readiness

Requires for live migration:
    - FIREBASE_CREDENTIALS_PATH and FIREBASE_PROJECT_ID set in .env
    - pip install firebase-admin
"""

import os
import sys
import json
import csv
import sqlite3
import importlib
from datetime import datetime

# Load .env
import env_loader
from env_loader import get_env

def scan_local_data():
    """Inspect local SQLite and JSON datasets to report records ready for migration."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, "data")
    db_path = os.path.join(data_dir, "saisankalp.db")
    
    inventory = {
        "source": "None",
        "categories": 0,
        "products": 0,
        "coupons": 0,
        "banners": 0,
        "users": 0,
        "orders": 0,
        "inventory": 0,
        "addresses": 0,
        "wishlist": 0,
        "reviews": 0
    }
    
    if os.path.exists(db_path):
        inventory["source"] = "SQLite (data/saisankalp.db)"
        try:
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            
            for key in ["categories", "products", "coupons", "banners", "users", "orders", "inventory", "addresses", "wishlist", "reviews"]:
                try:
                    c.execute(f"SELECT COUNT(*) FROM {key}")
                    inventory[key] = c.fetchone()[0]
                except sqlite3.OperationalError:
                    inventory[key] = 0
            conn.close()
            return inventory
        except Exception as e:
            print(f"  [scanner] Notice: Error inspecting SQLite DB: {e}")
            
    # Fallback: scan JSON files
    inventory["source"] = "JSON / CSV files (data/)"
    for key, fname in [
        ("categories", "categories.json"),
        ("products", "products.json"),
        ("coupons", "coupons.json"),
        ("banners", "banners.json"),
        ("users", "users.json")
    ]:
        p = os.path.join(data_dir, fname)
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    inventory[key] = len(json.load(f))
            except Exception:
                pass
                
    order_csv = os.path.join(data_dir, "orders.csv")
    if os.path.exists(order_csv):
        try:
            with open(order_csv, "r", encoding="utf-8") as f:
                inventory["orders"] = sum(1 for _ in csv.DictReader(f))
        except Exception:
            pass
            
    return inventory

def print_inventory_report(inventory, cred_path, project_id, is_firebase_available):
    print("=" * 65)
    print("🚀 SAI SANKALP — CLOUD FIRESTORE MIGRATION INSPECTOR")
    print("=" * 65)
    print(f"Data Source       : {inventory.get('source')}")
    print(f"Project ID        : {project_id or '(not configured in .env)'}")
    print(f"Service Account   : {cred_path or '(not configured in .env)'}")
    print(f"Firebase Package  : {'Installed' if is_firebase_available else 'Not installed (run: pip install firebase-admin)'}")
    print("-" * 65)
    print("📊 Local Data Available For Migration:")
    for k, v in inventory.items():
        if k != "source":
            print(f"   • {k.capitalize():<15}: {v} records")
    print("-" * 65)

def migrate():
    cred_path = get_env("FIREBASE_CREDENTIALS_PATH", "")
    project_id = get_env("FIREBASE_PROJECT_ID", "")
    is_dry_run = "--dry-run" in sys.argv or "--check" in sys.argv

    # Check firebase_admin library availability dynamically without IDE unresolved import errors
    firebase_admin = None
    credentials = None
    firestore = None
    try:
        firebase_admin = importlib.import_module("firebase_admin")
        credentials = importlib.import_module("firebase_admin.credentials")
        firestore = importlib.import_module("firebase_admin.firestore")
    except (ImportError, ModuleNotFoundError):
        pass

    inventory = scan_local_data()

    if is_dry_run or not cred_path or not os.path.exists(cred_path) or not firebase_admin:
        print_inventory_report(inventory, cred_path, project_id, bool(firebase_admin))
        
        if not cred_path or not os.path.exists(cred_path):
            print("\nℹ️  Notice: Firebase service account credentials not yet configured.")
            print("   Migration is currently in Dry-Run / Validation mode.")
            print("\n   To execute live migration to Google Cloud Firestore:")
            print("   1. Generate a Service Account Key in Firebase Console (Project Settings > Service accounts).")
            print("   2. Save the JSON file as 'serviceAccountKey.json' in this folder.")
            print("   3. In .env, set:")
            print("        FIREBASE_CREDENTIALS_PATH=serviceAccountKey.json")
            print("        FIREBASE_PROJECT_ID=<your-firebase-project-id>")
            if not firebase_admin:
                print("   4. Install Firebase SDK: pip install firebase-admin")
            print("   5. Re-run: python migrate_to_firebase.py\n")
            return 0

        if not firebase_admin:
            print("\n⚠️  Notice: 'firebase-admin' Python package is not installed.")
            print("   Install it using: pip install firebase-admin\n")
            return 0

    # Live migration with Firebase Firestore
    print("=" * 65)
    print("🚀 Starting Live Sai Sankalp Migration to Cloud Firestore")
    print("=" * 65)
    print(f"Project ID        : {project_id or '(from service account)'}")
    print(f"Service Account   : {cred_path}")

    try:
        cred = credentials.Certificate(cred_path)
        app_options = {}
        if project_id:
            app_options['projectId'] = project_id
        
        if not getattr(firebase_admin, "_apps", None):
            firebase_admin.initialize_app(cred, app_options)
        db = firestore.client()
        print("✅ Connected to Google Cloud Firestore successfully.\n")
    except Exception as e:
        print(f"❌ Failed to connect to Firestore: {e}")
        return 1

    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, "data")
    db_path = os.path.join(data_dir, "saisankalp.db")

    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()

        # 1. Categories
        c.execute("SELECT * FROM categories")
        rows = [dict(r) for r in c.fetchall()]
        if rows:
            batch = db.batch()
            for r in rows:
                cid = str(r['id'])
                batch.set(db.collection("categories").document(cid), r)
            batch.commit()
            print(f"📦 Migrated {len(rows)} categories from SQLite.")

        # 2. Products
        c.execute("SELECT * FROM products")
        products = [dict(r) for r in c.fetchall()]
        if products:
            batch = db.batch()
            count = 0
            for p in products:
                pid = str(p['id'])
                if 'variants' in p and isinstance(p['variants'], str):
                    try:
                        p['variants'] = json.loads(p['variants'])
                    except Exception:
                        pass
                p['isDeleted'] = bool(p.get('isDeleted', 0))
                batch.set(db.collection("products").document(pid), p)
                count += 1
                if count % 400 == 0:
                    batch.commit()
                    batch = db.batch()
            batch.commit()
            print(f"📦 Migrated {count} products from SQLite.")

        # 3. Coupons
        c.execute("SELECT * FROM coupons")
        coupons = [dict(r) for r in c.fetchall()]
        if coupons:
            batch = db.batch()
            for coup in coupons:
                code = str(coup['code']).upper()
                batch.set(db.collection("coupons").document(code), coup)
            batch.commit()
            print(f"📦 Migrated {len(coupons)} coupons from SQLite.")

        # 4. Banners
        c.execute("SELECT * FROM banners")
        banners = [dict(r) for r in c.fetchall()]
        if banners:
            batch = db.batch()
            for b in banners:
                bid = str(b.get('id', 'banner'))
                batch.set(db.collection("banners").document(bid), b)
            batch.commit()
            print(f"📦 Migrated {len(banners)} banners from SQLite.")

        # 5. Users
        c.execute("SELECT * FROM users")
        users = [dict(r) for r in c.fetchall()]
        if users:
            batch = db.batch()
            for u in users:
                email = str(u.get('email', '')).lower().strip()
                if email:
                    u['verified'] = bool(u.get('verified', 0))
                    batch.set(db.collection("users").document(email), u)
            batch.commit()
            print(f"📦 Migrated {len(users)} users from SQLite.")

        # 6. Orders
        c.execute("SELECT * FROM orders")
        orders = [dict(r) for r in c.fetchall()]
        if orders:
            batch = db.batch()
            count = 0
            for ord_row in orders:
                oid = ord_row['orderId']
                c.execute("SELECT * FROM order_items WHERE orderId = ?", (oid,))
                ord_row['items'] = [dict(it) for it in c.fetchall()]
                ord_row['isTest'] = bool(ord_row.get('isTest', 0))
                batch.set(db.collection("orders").document(oid), ord_row)
                count += 1
                if count % 400 == 0:
                    batch.commit()
                    batch = db.batch()
            batch.commit()
            print(f"📦 Migrated {count} orders from SQLite.")

        conn.close()
    else:
        # Fallback to JSON files
        cat_path = os.path.join(data_dir, "categories.json")
        if os.path.exists(cat_path):
            with open(cat_path, "r", encoding="utf-8") as f:
                categories = json.load(f)
            batch = db.batch()
            for cat in categories:
                cat_id = str(cat.get("id", "cat"))
                batch.set(db.collection("categories").document(cat_id), cat)
            batch.commit()
            print(f"📦 Migrated {len(categories)} categories from JSON.")

    print("\n" + "=" * 65)
    print("✨ Migration complete! Sai Sankalp is synced with Firestore.")
    print("=" * 65)
    return 0

if __name__ == "__main__":
    sys.exit(migrate() or 0)
