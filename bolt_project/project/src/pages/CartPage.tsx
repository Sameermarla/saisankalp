import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useRouter } from '@/context/RouterContext';
import { formatPrice, getEffectivePrice } from '@/lib/format';

export default function CartPage() {
  const { items, updateQuantity, removeFromCart, subtotal, totalItems, clearCart } = useCart();
  const { navigate } = useRouter();

  const shipping = subtotal >= 1500 || subtotal === 0 ? 0 : 99;
  const total = subtotal + shipping;

  if (items.length === 0) {
    return (
      <div className="pt-[105px] min-h-[60vh] flex flex-col items-center justify-center px-4">
        <div className="w-24 h-24 rounded-full bg-amber-50 flex items-center justify-center mb-6">
          <ShoppingBag className="w-12 h-12 text-amber-300" />
        </div>
        <h1 className="text-2xl font-serif font-bold text-gray-900 mb-2">Your Cart is Empty</h1>
        <p className="text-gray-500 mb-6">Discover beautiful handcrafted treasures from India</p>
        <button
          onClick={() => navigate('/shop')}
          className="px-8 py-3.5 bg-amber-600 text-white rounded-full font-semibold hover:bg-amber-700 transition-colors shadow-md"
        >
          Start Shopping
        </button>
      </div>
    );
  }

  return (
    <div className="pt-[105px] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-serif font-bold text-gray-900 mb-2">Shopping Cart</h1>
        <p className="text-gray-500 mb-8">{totalItems} item{totalItems !== 1 && 's'} in your cart</p>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map(item => {
              const price = getEffectivePrice(item.price, item.sale_price);
              return (
                <div
                  key={item.id}
                  className="flex gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
                >
                  <button
                    onClick={() => navigate(`/product/${item.slug}`)}
                    className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden bg-gray-50 flex-shrink-0"
                  >
                    <img src={item.image_url || ''} alt={item.name} className="w-full h-full object-cover" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => navigate(`/product/${item.slug}`)}
                      className="text-left font-medium text-gray-900 hover:text-amber-700 transition-colors line-clamp-2"
                    >
                      {item.name}
                    </button>
                    <p className="text-amber-700 font-bold text-lg mt-1">{formatPrice(price)}</p>
                    {item.sale_price && (
                      <p className="text-sm text-gray-400 line-through">{formatPrice(item.price)}</p>
                    )}

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          aria-label="Decrease quantity"
                          className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center font-semibold">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={item.quantity >= item.stock}
                          aria-label="Increase quantity"
                          className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-gray-900">{formatPrice(price * item.quantity)}</span>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          aria-label="Remove item"
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="flex justify-between items-center pt-4">
              <button
                onClick={() => navigate('/shop')}
                className="text-sm font-medium text-amber-700 hover:text-amber-900 transition-colors"
              >
                Continue Shopping
              </button>
              <button
                onClick={clearCart}
                className="text-sm text-gray-500 hover:text-red-500 transition-colors"
              >
                Clear Cart
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sticky top-[120px] space-y-4">
              <h2 className="font-serif text-lg font-bold text-gray-900">Order Summary</h2>
              <div className="space-y-3 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium text-gray-900">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium text-gray-900">
                    {shipping === 0 ? <span className="text-green-600">FREE</span> : formatPrice(shipping)}
                  </span>
                </div>
                {shipping > 0 && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    Add {formatPrice(1500 - subtotal)} more for free shipping!
                  </p>
                )}
              </div>
              <div className="border-t border-gray-100 pt-4">
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-gray-900">{formatPrice(total)}</span>
                </div>
              </div>
              <button
                onClick={() => navigate('/checkout')}
                className="w-full py-3.5 bg-amber-600 text-white rounded-full font-semibold hover:bg-amber-700 transition-colors shadow-md flex items-center justify-center gap-2"
              >
                Proceed to Checkout
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-xs text-center text-gray-500">Secure payment via Razorpay</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
