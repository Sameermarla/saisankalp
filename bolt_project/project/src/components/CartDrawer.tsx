import { X, ShoppingBag, Plus, Minus, Trash2 } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useRouter } from '@/context/RouterContext';
import { formatPrice, getEffectivePrice } from '@/lib/format';

export default function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, updateQuantity, removeFromCart, subtotal, totalItems } = useCart();
  const { navigate } = useRouter();

  if (!open) return null;

  const handleCheckout = () => {
    onClose();
    navigate('/checkout');
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl animate-slide-in-right flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-700" />
            <h2 className="font-serif text-lg font-bold text-gray-900">
              Cart {totalItems > 0 && `(${totalItems})`}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close cart"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center mb-4">
              <ShoppingBag className="w-10 h-10 text-amber-300" />
            </div>
            <p className="text-gray-500 font-medium">Your cart is empty</p>
            <p className="text-sm text-gray-400 mt-1">Discover beautiful handcrafted treasures</p>
            <button
              onClick={() => {
                onClose();
                navigate('/shop');
              }}
              className="mt-6 px-6 py-2.5 bg-amber-600 text-white rounded-full text-sm font-semibold hover:bg-amber-700 transition-colors"
            >
              Browse Products
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {items.map(item => {
                const price = getEffectivePrice(item.price, item.sale_price);
                return (
                  <div key={item.id} className="flex gap-4 pb-4 border-b border-gray-100 last:border-0">
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-50 flex-shrink-0">
                      <img
                        src={item.image_url || ''}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 line-clamp-2">{item.name}</h4>
                      <p className="text-sm text-amber-700 font-semibold mt-1">{formatPrice(price)}</p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            aria-label="Decrease quantity"
                            className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            disabled={item.quantity >= item.stock}
                            aria-label="Increase quantity"
                            className="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          aria-label="Remove from cart"
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="text-xl font-bold text-gray-900">{formatPrice(subtotal)}</span>
              </div>
              <p className="text-xs text-gray-500">Shipping calculated at checkout</p>
              <button
                onClick={handleCheckout}
                className="w-full py-3.5 bg-amber-600 text-white rounded-full font-semibold hover:bg-amber-700 transition-colors shadow-md"
              >
                Proceed to Checkout
              </button>
              <button
                onClick={() => {
                  onClose();
                  navigate('/cart');
                }}
                className="w-full text-center text-sm text-gray-600 hover:text-amber-700 transition-colors"
              >
                View Full Cart
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
