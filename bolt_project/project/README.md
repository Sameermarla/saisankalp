# Sai Sankalp — Handicrafts of India

A production-ready e-commerce web application showcasing authentic handcrafted treasures from artisans across India.

## Features

- **Dynamic Landing Page** — Auto-rotating hero carousel, featured product grid, category showcase, and promotional banners
- **Product Catalog** — Full listing page with filtering by category, price range, and availability; sorting by price, rating, and newest
- **Product Detail** — Image gallery with thumbnails, quantity selector, stock status, related products
- **Shopping Cart** — Persistent cart (saved to localStorage), slide-out drawer, full cart page with quantity management
- **Checkout** — Form validation, coupon code application with dynamic discounts, order summary
- **Razorpay Payment** — Secure checkout with error handling and order status updates
- **Order Confirmation** — Detailed order receipt with shipping information and order tracking
- **Toast Notifications** — Success, error, and info toasts for user actions
- **Skeleton Loaders** — Smooth loading states for all data-fetching views
- **Responsive Design** — Mobile-first, works seamlessly across all viewport sizes
- **Accessibility** — ARIA labels, keyboard navigation, focus-visible states

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Icons**: Lucide React
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Payments**: Razorpay

## Database Schema

| Table | Purpose |
|-------|---------|
| `categories` | Product categories (Pottery, Textiles, Brassware, Jewelry, Wood Craft) |
| `products` | Catalog items with pricing, images, stock, ratings |
| `banners` | Homepage hero carousel assets |
| `coupons` | Discount codes (percentage/fixed, min order, max discount, usage limits) |
| `orders` | Customer orders with payment status |

## Available Coupons

| Code | Discount | Min Order |
|------|----------|-----------|
| WELCOME10 | 10% off (max ₹200) | None |
| FESTIVE25 | 25% off (max ₹500) | ₹1,500 |
| FLAT100 | ₹100 off | ₹500 |
| CRAFT15 | 15% off (max ₹300) | ₹800 |

## Project Structure

```
src/
├── components/         # Reusable UI components
│   ├── CartDrawer.tsx
│   ├── Footer.tsx
│   ├── Navbar.tsx
│   ├── ProductCard.tsx
│   ├── SkeletonCard.tsx
│   ├── StarRating.tsx
│   └── ToastContainer.tsx
├── context/            # React contexts (Cart, Toast, Router)
├── lib/                # Utilities (Supabase client, formatters)
├── pages/              # Page components
│   ├── HomePage.tsx
│   ├── ShopPage.tsx
│   ├── ProductDetailPage.tsx
│   ├── CartPage.tsx
│   ├── CheckoutPage.tsx
│   └── OrderConfirmationPage.tsx
├── types/              # TypeScript type definitions
└── App.tsx             # Root component with routing
```

## Razorpay Configuration

The app reads the Razorpay key from `VITE_RAZORPAY_KEY_ID` environment variable. If the key is not set, checkout runs in demo mode (order is created and marked as paid for testing).

To enable live payments:
1. Set `VITE_RAZORPAY_KEY_ID` in your environment
2. The Razorpay checkout script is loaded in `index.html`

## Development

```bash
npm install      # Install dependencies
npm run dev      # Start dev server
npm run build    # Production build
npm run typecheck # Type checking
```
