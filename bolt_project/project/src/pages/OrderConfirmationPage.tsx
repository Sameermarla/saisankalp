import { useState, useEffect } from 'react';
import { CheckCircle2, Package, MapPin, Mail, Phone, ArrowRight, Copy, Truck, Clock } from 'lucide-react';
import type { Order } from '@/types';
import { db } from '@/lib/db';
import { useRouter } from '@/context/RouterContext';
import { useToast } from '@/context/ToastContext';
import { formatPrice, getEffectivePrice } from '@/lib/format';

export default function OrderConfirmationPage({ orderNumber }: { orderNumber: string }) {
  const { navigate, params } = useRouter();
  const { showToast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const isSuccess = params.get('status') === 'success';

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const found = await db.getOrder(orderNumber);
        setOrder(found);
      } catch (err) {
        console.error('Failed to load order receipt:', err);
        setOrder(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [orderNumber]);

  const handleCopyOrderNumber = () => {
    navigator.clipboard.writeText(orderNumber);
    showToast('Order reference copied to clipboard!', 'success');
  };

  if (loading) {
    return (
      <div className="pt-[105px] min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="pt-[105px] min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <h2 className="text-2xl font-serif font-bold text-gray-900 mb-2">Order Not Found</h2>
        <p className="text-gray-500 mb-6 max-w-md">
          Could not find an order matching reference #{orderNumber}. If you just placed it, please give it a moment or check your confirmation email.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-amber-600 text-white rounded-full font-semibold hover:bg-amber-700 transition-colors shadow"
        >
          Return to Home
        </button>
      </div>
    );
  }

  const items = order.items_json || [];

  return (
    <div className="pt-[105px] min-h-screen bg-gray-50/50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Success Banner */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900">
            {isSuccess ? 'Thank You for Your Order!' : 'Order Receipt & Status'}
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            We have received your order and our artisan partners are preparing your handcrafted treasures.
          </p>

          <div className="mt-6 inline-flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-full border border-gray-200">
            <span className="text-xs text-gray-500">Order Number:</span>
            <span className="font-mono text-sm font-bold text-gray-900">{order.order_number}</span>
            <button
              onClick={handleCopyOrderNumber}
              aria-label="Copy order number"
              className="text-gray-400 hover:text-amber-600 ml-1 transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Order Details Card */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-6 mb-8">
          <div className="flex items-center justify-between pb-6 border-b border-gray-100">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Delivery Status</p>
              <p className="text-base font-bold text-gray-900 capitalize mt-0.5">
                {order.delivery_status.replace(/_/g, ' ')}
              </p>
            </div>
            {order.delivery_date && (
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Estimated Delivery</p>
                <p className="text-sm font-bold text-amber-700 mt-0.5">{order.delivery_date}</p>
              </div>
            )}
          </div>

          {/* Items */}
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Items in Your Order</h2>
            <div className="space-y-3">
              {items.map((item, idx) => {
                const effectivePrice = getEffectivePrice(item.price, item.sale_price);
                return (
                  <div key={idx} className="flex items-center gap-4 py-2 border-b border-gray-50 last:border-none">
                    <div className="w-14 h-14 rounded-xl bg-gray-50 overflow-hidden flex-shrink-0 border border-gray-100">
                      <img src={item.image_url || ''} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <span className="font-bold text-gray-900 text-sm">
                      {formatPrice(effectivePrice * item.quantity)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals */}
          <div className="pt-4 border-t border-gray-100 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span className="font-semibold text-gray-900">{formatPrice(Number(order.subtotal))}</span>
            </div>
            {Number(order.discount) > 0 && (
              <div className="flex justify-between text-green-600 font-semibold">
                <span>Coupon Discount ({order.coupon_code})</span>
                <span>-{formatPrice(Number(order.discount))}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-900 pt-3 border-t border-gray-100">
              <span>Total Paid / Payable</span>
              <span className="text-xl text-amber-700">{formatPrice(Number(order.total))}</span>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="pt-4 border-t border-gray-100">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-amber-600" />
              Delivery Destination
            </h2>
            <div className="text-sm text-gray-700 bg-gray-50 rounded-2xl p-4">
              <p className="font-bold text-gray-900">{order.customer_name}</p>
              <p className="mt-0.5">{order.address}</p>
              <p>{order.city}, {order.state} - {order.pincode}</p>
              <p className="text-xs text-gray-500 mt-2">Email: {order.email} · Phone: {order.phone}</p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="text-center">
          <button
            onClick={() => navigate('/')}
            className="px-8 py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-full font-bold transition-all shadow-md hover:shadow-lg inline-flex items-center gap-2"
          >
            Continue Shopping
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
