import { useState, useEffect } from 'react';
import { ShoppingBag, Minus, Plus, ChevronRight, Truck, RotateCcw, Check, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import type { Product } from '@/types';
import { db } from '@/lib/db';
import { useRouter } from '@/context/RouterContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { formatPrice, getEffectivePrice } from '@/lib/format';
import StarRating from '@/components/StarRating';
import ProductCard from '@/components/ProductCard';

export default function ProductDetailPage({ slug }: { slug: string }) {
  const { navigate } = useRouter();
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const prod = await db.getProductBySlug(slug);
        if (prod) {
          setProduct(prod);
          const allProds = await db.getProducts();
          const relatedItems = allProds
            .filter(p => p.category_id === prod.category_id && p.id !== prod.id)
            .slice(0, 4);
          setRelated(relatedItems);
        } else {
          setProduct(null);
        }
      } catch (err) {
        console.error('Failed to load product details:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="pt-[105px] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="aspect-square bg-gray-200 rounded-2xl animate-pulse" />
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
            <div className="h-6 bg-gray-200 rounded animate-pulse w-1/3" />
            <div className="h-24 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="pt-[105px] min-h-[60vh] flex flex-col items-center justify-center px-4">
        <h2 className="text-2xl font-serif font-bold text-gray-900 mb-2">Product Not Found</h2>
        <p className="text-gray-500 mb-6">The requested craft artifact could not be located in our catalog.</p>
        <button
          onClick={() => navigate('/shop')}
          className="px-6 py-3 bg-amber-600 text-white rounded-full font-semibold hover:bg-amber-700 transition-colors shadow"
        >
          Return to Shop
        </button>
      </div>
    );
  }

  const effectivePrice = getEffectivePrice(product.price, product.sale_price);
  const discountPercent = product.sale_price
    ? Math.round(((product.price - product.sale_price) / product.price) * 100)
    : 0;

  const gallery = product.images && product.images.length > 0 ? product.images : [product.image_url || ''];

  const handleAddToCart = () => {
    addToCart(product, quantity);
    showToast(`Added ${quantity} × ${product.name} to cart`, 'success');
  };

  const handleBuyNow = () => {
    addToCart(product, quantity);
    navigate('/checkout');
  };

  return (
    <div className="pt-[105px] min-h-screen bg-white">
      {/* Breadcrumb */}
      <div className="bg-gray-50 border-b border-gray-100 py-3.5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
            <button onClick={() => navigate('/')} className="hover:text-amber-600">Home</button>
            <ChevronRight className="w-3 h-3 text-gray-400" />
            <button onClick={() => navigate('/shop')} className="hover:text-amber-600">Shop</button>
            <ChevronRight className="w-3 h-3 text-gray-400" />
            <span className="text-gray-900 truncate max-w-xs">{product.name}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Gallery */}
          <div className="space-y-4">
            <div className="aspect-square rounded-3xl overflow-hidden bg-gray-50 border border-gray-100 shadow-sm relative">
              <img
                src={gallery[activeImage] || product.image_url || ''}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {discountPercent > 0 && (
                <span className="absolute top-4 left-4 px-3 py-1 bg-amber-600 text-white rounded-full text-xs font-bold shadow-md">
                  {discountPercent}% OFF
                </span>
              )}
            </div>

            {gallery.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {gallery.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                      activeImage === idx ? 'border-amber-600 ring-2 ring-amber-600/20' : 'border-gray-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`View ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <StarRating rating={product.rating} reviewCount={product.review_count} />
                <span className="text-xs text-gray-400">·</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${product.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-serif font-bold text-gray-900 leading-tight">
                {product.name}
              </h1>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-gray-900">{formatPrice(effectivePrice)}</span>
              {product.sale_price && (
                <span className="text-lg text-gray-400 line-through">{formatPrice(product.price)}</span>
              )}
              {discountPercent > 0 && (
                <span className="text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                  Save {formatPrice(product.price - product.sale_price!)}
                </span>
              )}
            </div>

            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
              {product.description || 'Authentic handcrafted heritage artifact hand-curated by master artisans.'}
            </p>

            {/* Quantity and Actions */}
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-700">Quantity:</span>
                <div className="flex items-center border border-gray-200 rounded-xl bg-gray-50/50">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 disabled:opacity-30 transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center text-sm font-bold text-gray-900">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    disabled={quantity >= product.stock}
                    className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 disabled:opacity-30 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={handleAddToCart}
                  disabled={product.stock <= 0}
                  className="flex-1 py-3.5 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-full font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-5 h-5" />
                  Add to Cart
                </button>
                <button
                  onClick={handleBuyNow}
                  disabled={product.stock <= 0}
                  className="flex-1 py-3.5 bg-gray-900 hover:bg-black disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-full font-semibold transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                  Buy Now
                </button>
              </div>
            </div>

            {/* Trust Points */}
            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-100 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-amber-600" />
                <span>Express Pan-India Delivery</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>100% Genuine Handcrafted</span>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {related.length > 0 && (
          <section className="mt-20 pt-12 border-t border-gray-100">
            <h2 className="text-2xl font-serif font-bold text-gray-900 mb-8">Related Artisanal Works</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {related.map(item => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
