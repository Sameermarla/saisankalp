import { useState, useEffect, useMemo } from 'react';
import { SlidersHorizontal, X, Check, Search } from 'lucide-react';
import type { Product, Category } from '@/types';
import { db } from '@/lib/db';
import { useRouter } from '@/context/RouterContext';
import ProductCard from '@/components/ProductCard';
import SkeletonCard from '@/components/SkeletonCard';

export default function ShopPage() {
  const { params, navigate } = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const selectedCategory = params.get('category') || '';
  const searchQuery = params.get('search') || '';
  const sortBy = params.get('sort') || 'featured';
  const minPrice = params.get('min_price') || '';
  const maxPrice = params.get('max_price') || '';
  const inStockOnly = params.get('in_stock') === 'true';

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [prods, cats] = await Promise.all([
          db.getProducts(),
          db.getCategories(),
        ]);
        setProducts(prods);
        setCategories(cats);
      } catch (err) {
        console.error('Failed to load shop items:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const updateParam = (key: string, val: string | null) => {
    const next = new URLSearchParams(params);
    if (val === null || val === '') {
      next.delete(key);
    } else {
      next.set(key, val);
    }
    navigate(`/shop?${next.toString()}`);
  };

  const filtered = useMemo(() => {
    let result = [...products];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
      );
    }

    if (selectedCategory) {
      const cat = categories.find(c => c.slug === selectedCategory);
      if (cat) result = result.filter(p => p.category_id === cat.id);
    }

    if (inStockOnly) {
      result = result.filter(p => p.stock > 0);
    }

    if (minPrice) {
      result = result.filter(p => {
        const price = p.sale_price ?? p.price;
        return price >= parseFloat(minPrice);
      });
    }

    if (maxPrice) {
      result = result.filter(p => {
        const price = p.sale_price ?? p.price;
        return price <= parseFloat(maxPrice);
      });
    }

    switch (sortBy) {
      case 'price_asc':
        result.sort((a, b) => (a.sale_price ?? a.price) - (b.sale_price ?? b.price));
        break;
      case 'price_desc':
        result.sort((a, b) => (b.sale_price ?? b.price) - (a.sale_price ?? a.price));
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'featured':
      default:
        result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
        break;
    }

    return result;
  }, [products, categories, selectedCategory, searchQuery, inStockOnly, minPrice, maxPrice, sortBy]);

  const activeCategoryObj = categories.find(c => c.slug === selectedCategory);

  return (
    <div className="pt-[105px] min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-gray-900">
            {activeCategoryObj ? activeCategoryObj.name : searchQuery ? `Search: "${searchQuery}"` : 'All Handcrafted Artifacts'}
          </h1>
          <p className="text-gray-500 mt-2 text-sm sm:text-base">
            {activeCategoryObj?.description || 'Discover handmade pottery, embroidered woolens, and brass decor from rural Indian artisans.'}
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4 text-amber-600" />
              Filters
            </button>
            <span className="text-xs sm:text-sm text-gray-500 font-medium">
              Showing {filtered.length} of {products.length} products
            </span>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500 font-medium hidden sm:inline">Sort by:</label>
            <select
              value={sortBy}
              onChange={e => updateParam('sort', e.target.value)}
              className="px-3.5 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-amber-500 font-medium"
            >
              <option value="featured">Featured First</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating">Customer Rating</option>
              <option value="newest">Newest Arrivals</option>
            </select>
          </div>
        </div>

        {/* Content Layout */}
        <div className="flex gap-8 items-start">
          {/* Desktop Filter Sidebar */}
          <aside className="hidden lg:block w-64 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6 flex-shrink-0 sticky top-[120px]">
            {/* Category filter */}
            <div>
              <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3">Categories</h3>
              <div className="space-y-1">
                <button
                  onClick={() => updateParam('category', null)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    !selectedCategory ? 'bg-amber-50 text-amber-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  All Categories
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => updateParam('category', cat.slug)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedCategory === cat.slug ? 'bg-amber-50 text-amber-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* In Stock toggle */}
            <div className="pt-4 border-t border-gray-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={e => updateParam('in_stock', e.target.checked ? 'true' : null)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm font-medium text-gray-700">In Stock Only</span>
              </label>
            </div>

            {/* Reset all filters */}
            {(selectedCategory || inStockOnly || minPrice || maxPrice || searchQuery) && (
              <div className="pt-4 border-t border-gray-100">
                <button
                  onClick={() => navigate('/shop')}
                  className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </aside>

          {/* Product Grid */}
          <div className="flex-1">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-gray-500 text-base mb-4 font-medium">No products match your criteria</p>
                <button
                  onClick={() => navigate('/shop')}
                  className="px-6 py-2.5 bg-amber-600 text-white rounded-full text-sm font-semibold hover:bg-amber-700 transition-colors shadow"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
