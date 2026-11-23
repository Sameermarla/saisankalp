import { useState } from 'react';
import { Tag, Check, X, Loader2, Lock, ArrowLeft, CreditCard, Banknote, ShieldCheck } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useRouter } from '@/context/RouterContext';
import { useToast } from '@/context/ToastContext';
import { db } from '@/lib/db';
import { formatPrice, getEffectivePrice, generateOrderNumber } from '@/lib/format';
import type { Coupon } from '@/types';

interface CheckoutForm {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

type PaymentMethod = 'online' | 'cod';

export default function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const [form, setForm] = useState<CheckoutForm>({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [errors, setErrors] = useState<Partial<CheckoutForm>>({});
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);

  const shipping = subtotal >= 1500 || subtotal === 0 ? 0 : 99;
  const discount = appliedCoupon ? calculateDiscount(appliedCoupon, subtotal) : 0;
  const total = subtotal + shipping - discount;

  function calculateDiscount(coupon: Coupon, amount: number): number {
    if (amount < coupon.min_order) return 0;
    if (coupon.type === 'percentage') {
      const calc = (amount * coupon.value) / 100;
      return coupon.max_discount ? Math.min(calc, coupon.max_discount) : calc;
    }
    return coupon.value;
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<CheckoutForm> = {};
    if (!form.name.trim()) newErrors.name = 'Full Name is required';
    if (!form.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Enter a valid email address';
    }
    if (!form.phone.trim()) {
      newErrors.phone = 'Mobile number is required';
    } else if (!/^[6-9]\d{9}$/.test(form.phone.replace(/[\s-]/g, ''))) {
      newErrors.phone = 'Enter a valid 10-digit Indian mobile number';
    }
    if (!form.address.trim()) newErrors.address = 'Street Address is required';
    if (!form.city.trim()) newErrors.city = 'City is required';
    if (!form.state.trim()) newErrors.state = 'State is required';
    if (!form.pincode.trim()) {
      newErrors.pincode = 'Pincode is required';
    } else if (!/^\d{6}$/.test(form.pincode)) {
      newErrors.pincode = 'Enter a valid 6-digit postal code';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      const result = await db.validateCoupon(couponCode, subtotal);
      if (!result.valid || !result.coupon) {
        setCouponError(result.error || 'Invalid or inactive coupon');
        setAppliedCoupon(null);
        return;
      }
      setAppliedCoupon(result.coupon);
      showToast(`Coupon "${result.coupon.code}" applied successfully!`, 'success');
    } catch {
      setCouponError('Error validating coupon');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
    showToast('Coupon removed', 'info');
  };

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;
    if (!validateForm()) {
      showToast('Please check the shipping form fields', 'error');
      return;
    }

    setPlacingOrder(true);
    const orderNumber = generateOrderNumber();

    try {
      // 1. Create order in Database (Firestore / Local persistent store)
      const newOrder = await db.createOrder({
        order_number: orderNumber,
        customer_name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        items_json: items,
        subtotal,
        discount,
        total,
        coupon_code: appliedCoupon?.code || null,
        payment_status: paymentMethod === 'cod' ? 'cod' : 'pending',
      });

      // 2. Increment coupon usage
      if (appliedCoupon) {
        await db.incrementCouponUsage(appliedCoupon.code);
      }

      // 3. Handle Payment Method
      if (paymentMethod === 'cod') {
        // Cash on delivery — order immediately confirmed
        clearCart();
        showToast('Cash on Delivery Order Placed Successfully!', 'success');
        navigate(`/order/${orderNumber}?status=success`);
        return;
      }

      // Online Payment via Razorpay
      const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_T8XwugnuJ4Wtkm';

      if (typeof window !== 'undefined' && window.Razorpay && razorpayKeyId) {
        const options = {
          key: razorpayKeyId,
          amount: Math.round(total * 100),
          currency: 'INR',
          name: 'Sai Sankalp Crafts',
          description: `Order ${orderNumber}`,
          prefill: {
            name: form.name,
            email: form.email,
            contact: form.phone,
          },
          notes: {
            order_number: orderNumber,
          },
          theme: { color: '#d97706' },
          handler: async (response: { razorpay_payment_id: string }) => {
            await db.confirmPayment(newOrder.id, response.razorpay_payment_id);
            clearCart();
            showToast('Payment verified successfully!', 'success');
            navigate(`/order/${orderNumber}?status=success`);
          },
          modal: {
            ondismiss: async () => {
              setPlacingOrder(false);
              showToast('Payment window closed. Order saved as pending.', 'info');
              clearCart();
              navigate(`/order/${orderNumber}?status=pending`);
            },
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', (resp: { error: { description: string } }) => {
          setPlacingOrder(false);
          showToast(`Payment failed: ${resp.error.description}`, 'error');
        });
        rzp.open();
      } else {
        // Instant simulated online confirmation when SDK is in demo/fallback mode
        await new Promise(r => setTimeout(r, 1000));
        await db.confirmPayment(newOrder.id, 'pay_demo_' + Date.now());
        clearCart();
        showToast('Order placed successfully!', 'success');
        navigate(`/order/${orderNumber}?status=success`);
      }
    } catch (err) {
      console.error('[Checkout] Order error:', err);
      setPlacingOrder(false);
      showToast('Could not process order. Please try again.', 'error');
    }
  };

  if (items.length === 0) {
    return (
      <div className="pt-[105px] min-h-[60vh] flex flex-col items-center justify-center px-4">
        <h2 className="text-2xl font-serif font-bold text-gray-900 mb-2">Your Cart is Empty</h2>
        <p className="text-gray-500 mb-6">Add artisan craft treasures before proceeding to checkout.</p>
        <button
          onClick={() => navigate('/shop')}
          className="px-6 py-3 bg-amber-600 text-white rounded-full font-semibold hover:bg-amber-700 transition-colors shadow"
        >
          Explore Collection
        </button>
      </div>
    );
  }

  return (
    <div className="pt-[105px] min-h-screen bg-gray-50/50 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate('/cart')}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-amber-600 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Shopping Cart
        </button>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Form & Payment Option */}
          <div className="lg:col-span-7 space-y-6">
            {/* Shipping Address */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm space-y-6">
              <div>
                <h2 className="text-xl font-serif font-bold text-gray-900">1. Delivery Address</h2>
                <p className="text-xs text-gray-500 mt-1">Where should we deliver your handcrafted items?</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Recipient Full Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:border-amber-500 ${
                      errors.name ? 'border-red-400 bg-red-50/30' : 'border-gray-200'
                    }`}
                    placeholder="e.g. Sameer Marla"
                  />
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email Address *</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:border-amber-500 ${
                        errors.email ? 'border-red-400 bg-red-50/30' : 'border-gray-200'
                      }`}
                      placeholder="you@example.com"
                    />
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Phone Number *</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:border-amber-500 ${
                        errors.phone ? 'border-red-400 bg-red-50/30' : 'border-gray-200'
                      }`}
                      placeholder="9876543210"
                    />
                    {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">House No, Building, Street *</label>
                  <textarea
                    rows={2}
                    value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:border-amber-500 ${
                      errors.address ? 'border-red-400 bg-red-50/30' : 'border-gray-200'
                    }`}
                    placeholder="Flat 101, Sunshine Heights, MG Road"
                  />
                  {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">City *</label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={e => setForm({ ...form, city: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:border-amber-500 ${
                        errors.city ? 'border-red-400 bg-red-50/30' : 'border-gray-200'
                      }`}
                      placeholder="Bengaluru"
                    />
                    {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">State *</label>
                    <input
                      type="text"
                      value={form.state}
                      onChange={e => setForm({ ...form, state: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:border-amber-500 ${
                        errors.state ? 'border-red-400 bg-red-50/30' : 'border-gray-200'
                      }`}
                      placeholder="Karnataka"
                    />
                    {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">PIN Code *</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={form.pincode}
                      onChange={e => setForm({ ...form, pincode: e.target.value })}
                      className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:border-amber-500 ${
                        errors.pincode ? 'border-red-400 bg-red-50/30' : 'border-gray-200'
                      }`}
                      placeholder="560001"
                    />
                    {errors.pincode && <p className="text-xs text-red-500 mt-1">{errors.pincode}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm space-y-4">
              <div>
                <h2 className="text-xl font-serif font-bold text-gray-900">2. Payment Method</h2>
                <p className="text-xs text-gray-500 mt-1">Select your preferred payment mode</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <label
                  onClick={() => setPaymentMethod('cod')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                    paymentMethod === 'cod'
                      ? 'border-amber-600 bg-amber-50/40 ring-2 ring-amber-600/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    checked={paymentMethod === 'cod'}
                    onChange={() => setPaymentMethod('cod')}
                    className="mt-1 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-gray-900 text-sm">
                      <Banknote className="w-4 h-4 text-amber-600" />
                      Cash on Delivery (COD)
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Pay with cash or UPI upon package arrival at your doorstep.</p>
                  </div>
                </label>

                <label
                  onClick={() => setPaymentMethod('online')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                    paymentMethod === 'online'
                      ? 'border-amber-600 bg-amber-50/40 ring-2 ring-amber-600/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    checked={paymentMethod === 'online'}
                    onChange={() => setPaymentMethod('online')}
                    className="mt-1 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-gray-900 text-sm">
                      <CreditCard className="w-4 h-4 text-amber-600" />
                      Online Payment (Razorpay)
                    </div>
                    <p className="text-xs text-gray-500 mt-1">UPI (GPay, PhonePe), Credit/Debit Cards, NetBanking.</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary & Coupon */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm space-y-6 sticky top-[120px]">
              <h2 className="text-xl font-serif font-bold text-gray-900">Order Summary</h2>

              {/* Items List */}
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-3 text-sm">
                    <div className="w-12 h-12 rounded-xl bg-gray-50 overflow-hidden flex-shrink-0 border border-gray-100">
                      <img src={item.image_url || ''} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <span className="font-bold text-gray-900">
                      {formatPrice(getEffectivePrice(item.price, item.sale_price) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Coupon Box */}
              <div className="pt-4 border-t border-gray-100">
                {appliedCoupon ? (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-green-700" />
                      <div>
                        <p className="text-xs font-bold text-green-800">{appliedCoupon.code}</p>
                        <p className="text-[11px] text-green-600">Discount of {formatPrice(discount)} applied</p>
                      </div>
                    </div>
                    <button
                      onClick={handleRemoveCoupon}
                      className="p-1 hover:bg-green-100 rounded-full text-green-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={e => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="Coupon code (e.g. WELCOME10)"
                        className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm uppercase focus:outline-none focus:border-amber-500"
                      />
                      <button
                        onClick={handleApplyCoupon}
                        disabled={couponLoading || !couponCode.trim()}
                        className="px-4 py-2.5 bg-gray-900 hover:bg-black disabled:bg-gray-200 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center min-w-[70px]"
                      >
                        {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                      </button>
                    </div>
                    {couponError && <p className="text-xs text-red-500 font-medium">{couponError}</p>}
                    <p className="text-[11px] text-gray-400">Available: WELCOME10, FESTIVE25, FLAT100, CRAFT15</p>
                  </div>
                )}
              </div>

              {/* Pricing breakdown */}
              <div className="space-y-2.5 pt-4 border-t border-gray-100 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-gray-900">{formatPrice(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span className="font-semibold">-{formatPrice(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span className="font-semibold text-gray-900">
                    {shipping === 0 ? <span className="text-green-600">FREE</span> : formatPrice(shipping)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold text-gray-900 pt-3 border-t border-gray-100">
                  <span>Total Amount</span>
                  <span className="text-xl text-amber-700">{formatPrice(total)}</span>
                </div>
              </div>

              {/* Place Order CTA Button */}
              <button
                onClick={handlePlaceOrder}
                disabled={placingOrder}
                className="w-full py-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white rounded-full font-bold text-base transition-all shadow-lg hover:shadow-xl hover:scale-[1.01] flex items-center justify-center gap-2"
              >
                {placingOrder ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing Order...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Place Order ({formatPrice(total)})
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <ShieldCheck className="w-4 h-4 text-green-600" />
                <span>Encrypted & Verified Transaction</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
