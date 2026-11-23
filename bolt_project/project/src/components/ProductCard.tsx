import { ShoppingBag } from 'lucide-react';
import type { Product } from '@/types';
import { formatPrice, getEffectivePrice } from '@/lib/format';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { useRouter } from '@/context/RouterContext';
import StarRating from './StarRating';

export default function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const { navigate } = useRouter();

  const effectivePrice = getEffectivePrice(product.price, product.sale_price);
  const hasSale = product.sale_price !== null && product.sale_price < product.price;
  const outOfStock = product.stock === 0;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (outOfStock) return;
    addToCart(product);
    showToast(`${product.name} added to cart`, 'success');
  };

  return (
    <article
      onClick={() => navigate(`/product/${product.slug}`)}
      className="group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl hover:border-amber-200 transition-all duration-300 cursor-pointer flex flex-col"
    >
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        <img
          src={product.image_url || ''}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {hasSale && (
          <span className="absolute top-3 left-3 bg-rose-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-md">
            Sale
          </span>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white font-semibold text-sm bg-black/50 px-4 py-2 rounded-lg">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-medium text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-amber-700 transition-colors">
          {product.name}
        </h3>
        <div className="mt-1.5">
          <StarRating rating={product.rating} reviewCount={product.review_count} />
        </div>
        <div className="mt-auto pt-3 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-gray-900">{formatPrice(effectivePrice)}</span>
            {hasSale && (
              <span className="text-sm text-gray-400 line-through">{formatPrice(product.price)}</span>
            )}
          </div>
          <button
            onClick={handleAdd}
            disabled={outOfStock}
            aria-label={`Add ${product.name} to cart`}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:scale-110"
          >
            <ShoppingBag className="w-4 h-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
