# 🛍️ Sai Sankalp — Handicrafts of India

> *Inspired Knits Crafted With Love*

An e-commerce platform showcasing authentic Indian handicrafts — handmade paper crafts, embroidered woolen items, clay pottery, brass sculptures, and wood carvings.

![Sai Sankalp](bolt_project/project/public/logo.png)

## 🌟 Features

- **Product Catalog** — Browse 50+ handcrafted products across 6 categories
- **Shopping Cart** — Add, update quantities, apply coupons
- **Checkout Flow** — Address, payment method selection, order placement
- **Admin Dashboard** — Manage products, orders, customers, and analytics
- **Search & Filter** — Full-text search with category/price/rating filters
- **Responsive Design** — Mobile-first, works on all devices
- **Wishlist** — Save favorites for later

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend (React)** | React 18, TypeScript, Vite 5, Tailwind CSS |
| **Frontend (Vanilla)** | HTML5, CSS3, JavaScript ES6+ |
| **Backend** | Python (Flask-style mock server), Java |
| **Database** | SQLite |
| **Deployment** | Firebase Hosting |

## 🚀 Quick Start

### React App (Primary)
```bash
cd bolt_project/project
npm install
npm run dev
# Opens at http://localhost:5173
```

### Vanilla Site + Backend
```bash
cd "sai sankalp files/sai_sankalp_website"
python mock_server.py
# Opens at http://localhost:8000
```

## 📁 Project Structure

```
├── bolt_project/project/      # React + TypeScript frontend
│   ├── src/
│   │   ├── components/        # Navbar, Footer, ProductCard, CartDrawer
│   │   ├── pages/             # Home, Shop, Product, Cart, Checkout, Admin
│   │   ├── context/           # Cart, Router context providers
│   │   └── data/              # Product catalog data
│   └── public/                # Static assets
├── sai sankalp files/
│   └── sai_sankalp_website/   # Vanilla HTML/CSS/JS site
│       ├── index.html
│       ├── mock_server.py     # Python API server
│       ├── Server.java        # Java API server
│       └── js/                # Modular JS (auth, cart, admin, etc.)
└── firebase.json              # Firebase Hosting config
```

## 👤 Demo Credentials

| Role | Email / Username | Password |
|------|-----------------|----------|
| Admin (React) | `admin` | `admin123` |
| Admin (Vanilla) | `saisameermarla@gmail.com` | `Admin@1234` |

## 📄 License

© 2026 Sai Sankalp. All rights reserved.
