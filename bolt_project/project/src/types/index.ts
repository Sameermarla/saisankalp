export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  sale_price: number | null;
  category_id: string | null;
  image_url: string | null;
  images: string[];
  stock: number;
  rating: number;
  review_count: number;
  featured: boolean;
  created_at: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  link: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  min_order: number;
  max_discount: number | null;
  active: boolean;
  expires_at: string | null;
  usage_limit: number | null;
  used_count: number;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  items_json: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  coupon_code: string | null;
  payment_status: string;
  payment_id: string | null;
  razorpay_order_id: string | null;
  delivery_date: string | null;
  delivery_status: string;
  created_at: string;
  updated_at: string;
}

export interface AdminSession {
  token: string;
  username: string;
}

export interface CartItem {
  id: string;
  name: string;
  slug: string;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  quantity: number;
  stock: number;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
