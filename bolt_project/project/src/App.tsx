import { useState } from 'react';
import { CartProvider } from '@/context/CartContext';
import { ToastProvider } from '@/context/ToastContext';
import { AdminProvider } from '@/context/AdminContext';
import { RouterProvider, useRouter } from '@/context/RouterContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CartDrawer from '@/components/CartDrawer';
import ToastContainer from '@/components/ToastContainer';
import HomePage from '@/pages/HomePage';
import ShopPage from '@/pages/ShopPage';
import ProductDetailPage from '@/pages/ProductDetailPage';
import CartPage from '@/pages/CartPage';
import CheckoutPage from '@/pages/CheckoutPage';
import OrderConfirmationPage from '@/pages/OrderConfirmationPage';
import AdminLoginPage from '@/pages/AdminLoginPage';
import AdminDashboardPage from '@/pages/AdminDashboardPage';
import { Home as HomeIcon } from 'lucide-react';

function NotFoundPage() {
  const { navigate } = useRouter();
  return (
    <div className="pt-[105px] min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-serif font-bold text-amber-700">404</h1>
      <p className="text-gray-600 mt-4 text-lg">Oops! This page took a wrong turn.</p>
      <button
        onClick={() => navigate('/')}
        className="mt-6 px-8 py-3.5 bg-amber-600 text-white rounded-full font-semibold hover:bg-amber-700 transition-colors shadow-md flex items-center gap-2"
      >
        <HomeIcon className="w-4 h-4" />
        Back to Home
      </button>
    </div>
  );
}

function AppRoutes() {
  const { path } = useRouter();
  const [cartOpen, setCartOpen] = useState(false);

  let page;
  const isAdminRoute = path === '/admin' || path === '/admin/dashboard';

  if (path === '/admin') {
    page = <AdminLoginPage />;
  } else if (path === '/admin/dashboard') {
    page = <AdminDashboardPage />;
  } else if (path === '/') {
    page = <HomePage />;
  } else if (path === '/shop') {
    page = <ShopPage />;
  } else if (path === '/cart') {
    page = <CartPage />;
  } else if (path === '/checkout') {
    page = <CheckoutPage />;
  } else if (path.startsWith('/product/')) {
    const slug = path.replace('/product/', '');
    page = <ProductDetailPage slug={slug} />;
  } else if (path.startsWith('/order/')) {
    const orderNumber = path.replace('/order/', '');
    page = <OrderConfirmationPage orderNumber={orderNumber} />;
  } else {
    page = <NotFoundPage />;
  }

  // Admin routes render without the storefront navbar/footer
  if (isAdminRoute) {
    return (
      <div className="min-h-screen bg-white">
        {page}
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar onCartClick={() => setCartOpen(true)} />
      <main className="flex-1">{page}</main>
      <Footer />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <ToastProvider>
        <AdminProvider>
          <CartProvider>
            <AppRoutes />
          </CartProvider>
        </AdminProvider>
      </ToastProvider>
    </RouterProvider>
  );
}
