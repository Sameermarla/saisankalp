import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight, Truck, ShieldCheck, Sparkles, Award } from 'lucide-react';
import type { Banner, Product, Category } from '@/types';
import { db } from '@/lib/db';
import { useRouter } from '@/context/RouterContext';
import ProductCard from '@/components/ProductCard';
import SkeletonCard from '@/components/SkeletonCard';

export default function HomePage() {
  const { navigate } = useRouter();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [bannersData, productsData, categoriesData] = await Promise.all([
          db.getBanners(),
          db.getProducts(),
          db.getCategories(),
        ]);
        setBanners(bannersData);
        setFeatured(productsData.filter(p => p.featured).slice(0, 8));
        setCategories(categoriesData);
      } catch (err) {
        console.error('Failed to load homepage data:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentSlide(prev => (prev + 1) % (banners.length || 1));
  }, [banners.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlide(prev => (prev - 1 + banners.length) % (banners.length || 1));
  }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(nextSlide, 5000);
    return () => clearInterval(timer);
  }, [banners.length, nextSlide]);

  return (
    <div className="pt-[105px]">
      {/* Hero Carousel */}
      <section className="relative h-[480px] sm:h-[560px] overflow-hidden">
        {loading ? (
          <div className="w-full h-full bg-gradient-to-br from-amber-100 to-orange-100 animate-pulse" />
        ) : (
          banners.map((banner, idx) => (
            <div
              key={banner.id}
              className={`absolute inset-0 transition-opacity duration-700 ${
                idx === currentSlide ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              aria-hidden={idx !== currentSlide}
            >
              <div className="relative w-full h-full">
                <img
                  src={banner.image_url}
                  alt={banner.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-transparent" />
                <div className="absolute inset-0 flex items-center">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                    <div className="max-w-xl">
                      <p className="text-amber-400 text-sm font-semibold uppercase tracking-widest mb-3 animate-fade-in-up">
                        Sai Sankalp Presents
                      </p>
                      <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white leading-tight mb-4 animate-fade-in-up">
                        {banner.title}
                      </h1>
                      {banner.subtitle && (
                        <p className="text-lg text-gray-200 mb-6 animate-fade-in-up">
                          {banner.subtitle}
                        </p>
                      )}
                      <button
                        onClick={() => navigate(banner.link || '/shop')}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-full font-semibold transition-all shadow-lg hover:shadow-xl hover:scale-105"
                      >
                        Shop Now
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Carousel controls */}
        {banners.length > 1 && !loading && (
          <>
            <button
              onClick={prevSlide}
              aria-label="Previous slide"
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={nextSlide}
              aria-label="Next slide"
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
              {banners.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                  className={`h-2 rounded-full transition-all ${
                    idx === currentSlide ? 'w-8 bg-white' : 'w-2 bg-white/50'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Trust badges */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Truck, title: 'Free Shipping', desc: 'On orders above ₹1,500' },
              { icon: ShieldCheck, title: 'Secure Checkout', desc: 'COD & Online payments' },
              { icon: Award, title: 'Authentic Crafts', desc: 'Directly from artisans' },
              { icon: Sparkles, title: 'Quality Assured', desc: 'Handpicked products' },
            ].map((badge, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <badge.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-semibold text-gray-900">{badge.title}</h3>
                  <p className="text-[11px] sm:text-xs text-gray-500">{badge.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-amber-600 font-semibold text-xs tracking-widest uppercase mb-2">Curated Collections</p>
            <h2 className="text-3xl font-serif font-bold text-gray-900">Explore by Craft Category</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="aspect-square bg-gray-200 rounded-2xl animate-pulse" />
              ))
            ) : (
              categories.map(cat => (
                <div
                  key={cat.id}
                  onClick={() => navigate(`/shop?category=${cat.slug}`)}
                  className="group relative aspect-square rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all"
                >
                  <img
                    src={cat.image_url || 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80'}
                    alt={cat.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <h3 className="font-serif font-bold text-sm sm:text-base leading-tight group-hover:text-amber-300 transition-colors">
                      {cat.name}
                    </h3>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-amber-600 font-semibold text-xs tracking-widest uppercase mb-1">Handmade Treasures</p>
              <h2 className="text-3xl font-serif font-bold text-gray-900">Featured Artifacts</h2>
            </div>
            <button
              onClick={() => navigate('/shop')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600 hover:text-amber-700"
            >
              View All Products
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              featured.map(product => (
                <ProductCard key={product.id} product={product} />
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
