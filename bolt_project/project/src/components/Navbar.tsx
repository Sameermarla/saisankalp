import { useEffect, useState } from 'react';
import { ShoppingBag, Menu, X, Search, Heart } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useRouter } from '@/context/RouterContext';

export default function Navbar({ onCartClick }: { onCartClick: () => void }) {
  const { totalItems } = useCart();
  const { navigate, path } = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Shop All', to: '/shop' },
    { label: 'Clay & Pottery', to: '/shop?category=clay-terracotta' },
    { label: 'Handloom & Wool', to: '/shop?category=handloom-woolens' },
    { label: 'Paper Craft', to: '/shop?category=paper-crafts' },
    { label: 'Brass & Metal', to: '/shop?category=brass-metal' },
    { label: 'Wood Decor', to: '/shop?category=wood-decor' },
  ];

  const isActive = (to: string) => {
    if (to === '/') return path === '/';
    const [p] = to.split('?');
    return path === p;
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-md shadow-md'
            : 'bg-white/80 backdrop-blur-sm'
        }`}
      >
        {/* Top bar */}
        <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-orange-600 text-white text-xs py-1.5 text-center font-medium">
          Free shipping on orders above ₹1,500 · Use code WELCOME10 for 10% off
        </div>

        {/* Main nav */}
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 flex-shrink-0"
              aria-label="Sai Sankalp home"
            >
              <img src="/logo.png" alt="Sai Sankalp" className="w-10 h-10 rounded-full object-cover shadow-md" />
              <div className="hidden sm:block text-left">
                <div className="font-serif text-lg font-bold text-gray-900 leading-none">Sai Sankalp</div>
                <div className="text-[10px] text-amber-700 tracking-wider uppercase">Handicrafts of India</div>
              </div>
            </button>

            {/* Desktop nav */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map(link => (
                <button
                  key={link.to}
                  onClick={() => navigate(link.to)}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive(link.to)
                      ? 'text-amber-700 bg-amber-50'
                      : 'text-gray-700 hover:text-amber-700 hover:bg-amber-50/50'
                  }`}
                >
                  {link.label}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => navigate('/shop')}
                aria-label="Search products"
                className="w-9 h-9 flex items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Search className="w-5 h-5" />
              </button>
              <button
                aria-label="Wishlist"
                className="hidden sm:flex w-9 h-9 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Heart className="w-5 h-5" />
              </button>
              <button
                onClick={onCartClick}
                aria-label={`Shopping cart with ${totalItems} items`}
                className="relative w-9 h-9 flex items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <ShoppingBag className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </button>
              <button
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
                className="lg:hidden w-9 h-9 flex items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </nav>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-2xl animate-slide-in-right flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <span className="font-serif text-lg font-bold text-gray-900">Menu</span>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              {navLinks.map(link => (
                <button
                  key={link.to}
                  onClick={() => {
                    navigate(link.to);
                    setMobileOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                    isActive(link.to)
                      ? 'text-amber-700 bg-amber-50'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </button>
              ))}
              <button
                onClick={() => {
                  navigate('/shop?category=wood-craft');
                  setMobileOpen(false);
                }}
                className="w-full text-left px-4 py-3 text-sm font-medium rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Wood Craft
              </button>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
