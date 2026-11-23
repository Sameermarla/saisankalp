import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Package, ShoppingBag, LogOut, Plus, Trash2, Search,
  X, Loader2, Truck, MapPin, Clock, CheckCircle2, Calendar, TrendingUp,
  IndianRupee, AlertCircle, Edit3, ArrowLeft, RefreshCw
} from 'lucide-react';
import { useAdmin } from '@/context/AdminContext';
import { useRouter } from '@/context/RouterContext';
import { useToast } from '@/context/ToastContext';
import { db } from '@/lib/db';
import { formatPrice, getEffectivePrice } from '@/lib/format';
import type { Product, Category, Order } from '@/types';

type Tab = 'overview' | 'products' | 'orders';

export default function AdminDashboardPage() {
  const { session, logout, loading: sessionLoading } = useAdmin();
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');

  useEffect(() => {
    if (!sessionLoading && !session) {
      navigate('/admin');
    }
  }, [session, sessionLoading, navigate]);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [prods, cats, ords] = await Promise.all([
        db.getProducts(),
        db.getCategories(),
        db.getAdminOrders(session?.token),
      ]);
      setProducts(prods);
      setCategories(cats);
      setOrders(ords);
    } catch (err) {
      console.error('[Admin] Failed to load data:', err);
      showToast('Error loading store data', 'error');
    } finally {
      setLoadingData(false);
    }
  }, [session, showToast]);

  useEffect(() => {
    if (session) loadData();
  }, [session, loadData]);

  const handleLogout = () => {
    logout();
    showToast('Logged out successfully', 'info');
    navigate('/admin');
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!session) return;
    if (!window.confirm(`Are you sure you want to remove "${productName}" from the store catalog?`)) return;
    try {
      await db.deleteProduct(productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
      showToast(`"${productName}" was successfully removed`, 'success');
    } catch {
      showToast('Failed to remove product. Please try again.', 'error');
    }
  };

  const handleUpdateDelivery = async (orderId: string, deliveryDate: string, deliveryStatus: string) => {
    if (!session) return;
    try {
      const ok = await db.updateOrderDelivery(orderId, deliveryDate, deliveryStatus);
      if (ok) {
        setOrders(prev =>
          prev.map(o =>
            o.id === orderId
              ? { ...o, delivery_date: deliveryDate || null, delivery_status: deliveryStatus }
              : o
          )
        );
        showToast('Order delivery updated successfully!', 'success');
      } else {
        showToast('Failed to update order', 'error');
      }
    } catch {
      showToast('Failed to update delivery', 'error');
    }
  };

  const handleDeleteOrder = async (orderId: string, orderNumber: string) => {
    if (!session) return;
    if (!window.confirm(`Are you sure you want to delete order #${orderNumber}?`)) return;
    try {
      await db.deleteOrder(orderId);
      setOrders(prev => prev.filter(o => o.id !== orderId));
      showToast(`Order #${orderNumber} was deleted successfully`, 'success');
    } catch {
      showToast('Failed to delete order. Please try again.', 'error');
    }
  };

  if (sessionLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  // Stats for overview
  const totalRevenue = orders
    .filter(o => o.payment_status === 'paid' || o.delivery_status === 'delivered')
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.delivery_status === 'pending' || o.delivery_status === 'confirmed').length;
  const deliveredOrders = orders.filter(o => o.delivery_status === 'delivered').length;
  const outOfStockCount = products.filter(p => p.stock <= 0).length;

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOrders = orders.filter(o => {
    const matchesSearch =
      o.order_number.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
      o.email.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
      o.phone.toLowerCase().includes(orderSearchQuery.toLowerCase());
    const matchesStatus = orderStatusFilter === 'all' || o.delivery_status === orderStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    confirmed: 'bg-indigo-100 text-indigo-700',
    shipped: 'bg-blue-100 text-blue-700',
    out_for_delivery: 'bg-purple-100 text-purple-700',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  const paymentColors: Record<string, string> = {
    paid: 'bg-green-100 text-green-700',
    cod: 'bg-amber-100 text-amber-700',
    pending: 'bg-yellow-100 text-yellow-700',
    failed: 'bg-red-100 text-red-700',
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="lg:w-64 bg-gray-900 text-gray-300 flex-shrink-0 lg:min-h-screen shadow-xl">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-sm">SS</span>
            </div>
            <div>
              <div className="font-serif text-base font-bold text-white tracking-wide">Sai Sankalp</div>
              <div className="text-[10px] text-amber-400 font-semibold tracking-widest uppercase">Admin Dashboard</div>
            </div>
          </div>

          <div className="mb-6 px-3 py-2 bg-gray-800/80 rounded-lg border border-gray-700/50 flex items-center justify-between text-xs">
            <span className="text-gray-400">Signed in as:</span>
            <span className="font-semibold text-amber-400">{session.username}</span>
          </div>

          <nav className="space-y-1.5">
            <button
              onClick={() => setTab('overview')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                tab === 'overview' ? 'bg-amber-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              Overview
            </button>
            <button
              onClick={() => setTab('products')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                tab === 'products' ? 'bg-amber-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Package className="w-5 h-5" />
              Products ({products.length})
            </button>
            <button
              onClick={() => setTab('orders')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                tab === 'orders' ? 'bg-amber-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <ShoppingBag className="w-5 h-5" />
              Orders ({orders.length})
            </button>
          </nav>

          <div className="mt-8 pt-6 border-t border-gray-800 space-y-2">
            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Visit Storefront
            </button>
            <button
              onClick={loadData}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Data
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 lg:p-8 max-w-7xl">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-serif font-bold text-gray-900 capitalize">
              {tab === 'overview' && 'Store Performance Overview'}
              {tab === 'products' && 'Product Catalog Management'}
              {tab === 'orders' && 'Order Processing & Tracking'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Connected to Firebase Cloud Firestore / Local Store with live synchronization.
            </p>
          </div>

          {tab === 'products' && (
            <button
              onClick={() => setShowAddProduct(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
            >
              <Plus className="w-4 h-4" />
              Add New Product
            </button>
          )}
        </header>

        {/* Tab 1: Overview */}
        {tab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <StatCard icon={TrendingUp} label="Total Store Revenue" value={formatPrice(totalRevenue)} color="green" />
              <StatCard icon={ShoppingBag} label="Total Orders" value={totalOrders.toString()} color="blue" />
              <StatCard icon={Clock} label="Pending Delivery" value={pendingOrders.toString()} color="amber" />
              <StatCard icon={Package} label="Active Products" value={products.length.toString()} color="orange" />
            </div>

            {outOfStockCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-800 font-medium">
                    {outOfStockCount} product{outOfStockCount > 1 ? 's are' : ' is'} currently out of stock.
                  </p>
                </div>
                <button
                  onClick={() => setTab('products')}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg"
                >
                  View Inventory
                </button>
              </div>
            )}

            {/* Recent Orders table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-serif text-lg font-bold text-gray-900">Recent Customer Orders</h2>
                <button
                  onClick={() => setTab('orders')}
                  className="text-xs text-amber-600 font-semibold hover:underline"
                >
                  View All ({orders.length}) →
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50/75 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Order #</th>
                      <th className="px-6 py-3.5">Customer</th>
                      <th className="px-6 py-3.5">Amount</th>
                      <th className="px-6 py-3.5">Payment</th>
                      <th className="px-6 py-3.5">Delivery Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders.slice(0, 5).map(o => (
                      <tr key={o.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4 font-mono text-sm font-semibold text-gray-900">{o.order_number}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{o.customer_name}</td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">{formatPrice(Number(o.total))}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${paymentColors[o.payment_status] || paymentColors.pending}`}>
                            {o.payment_status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[o.delivery_status] || statusColors.pending}`}>
                            {o.delivery_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Products */}
        {tab === 'products' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search products by title or description..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 shadow-sm"
                />
              </div>
              <span className="text-xs text-gray-500 font-medium">
                Showing {filteredProducts.length} of {products.length} products
              </span>
            </div>

            {loadingData ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No products match your search</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3.5">Product</th>
                        <th className="px-6 py-3.5">Category</th>
                        <th className="px-6 py-3.5">Price</th>
                        <th className="px-6 py-3.5">Stock</th>
                        <th className="px-6 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredProducts.map(p => {
                        const cat = categories.find(c => c.id === p.category_id);
                        return (
                          <tr key={p.id} className="hover:bg-gray-50/50">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                                  <img src={p.image_url || ''} alt={p.name} className="w-full h-full object-cover" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                                  <p className="text-xs text-gray-400 truncate max-w-xs">{p.description}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {cat?.name || 'Handmade Craft'}
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                              {formatPrice(p.sale_price ?? p.price)}
                              {p.sale_price && (
                                <span className="text-xs text-gray-400 line-through ml-1.5">{formatPrice(p.price)}</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${p.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setEditingProduct(p)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(p.id, p.name)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Orders */}
        {tab === 'orders' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={orderSearchQuery}
                  onChange={e => setOrderSearchQuery(e.target.value)}
                  placeholder="Search by order #, customer name, email, or phone..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 shadow-sm"
                />
              </div>

              {/* Status filter tabs */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs overflow-x-auto">
                {['all', 'confirmed', 'shipped', 'delivered', 'cancelled'].map(st => (
                  <button
                    key={st}
                    onClick={() => setOrderStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-all ${
                      orderStatusFilter === st ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {loadingData ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
                <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No customer orders found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    statusColors={statusColors}
                    paymentColors={paymentColors}
                    onUpdateDelivery={handleUpdateDelivery}
                    onDeleteOrder={handleDeleteOrder}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add Product Modal */}
      {showAddProduct && (
        <ProductModal
          title="Add New Product"
          categories={categories}
          onClose={() => setShowAddProduct(false)}
          onSave={async (data) => {
            await db.addProduct(data);
            showToast('New product added to Firestore!', 'success');
            loadData();
            setShowAddProduct(false);
          }}
        />
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <ProductModal
          title="Edit Product"
          initialProduct={editingProduct}
          categories={categories}
          onClose={() => setEditingProduct(null)}
          onDelete={handleDeleteProduct}
          onSave={async (data) => {
            await db.updateProduct(editingProduct.id, data);
            showToast('Product updated successfully!', 'success');
            loadData();
            setEditingProduct(null);
          }}
        />
      )}
    </div>
  );
}

// Sub-components
function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-50 text-green-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    orange: 'bg-orange-50 text-orange-700',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colorMap[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function OrderCard({
  order,
  statusColors,
  paymentColors,
  onUpdateDelivery,
  onDeleteOrder,
}: {
  order: Order;
  statusColors: Record<string, string>;
  paymentColors: Record<string, string>;
  onUpdateDelivery: (orderId: string, deliveryDate: string, deliveryStatus: string) => void;
  onDeleteOrder: (orderId: string, orderNumber: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState(order.delivery_date || '');
  const [deliveryStatus, setDeliveryStatus] = useState(order.delivery_status);
  const items = order.items_json || [];
  const orderDate = new Date(order.created_at);
  const formattedDate = orderDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
      <div className="p-5 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-gray-900">{order.order_number}</span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${paymentColors[order.payment_status] || paymentColors.pending}`}>
                {order.payment_status.toUpperCase()}
              </span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusColors[order.delivery_status] || statusColors.pending}`}>
                {order.delivery_status.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{order.customer_name}</span> · {order.email} · {order.phone}
            </p>
            <p className="text-xs text-gray-400">Placed on {formattedDate}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-gray-900">{formatPrice(Number(order.total))}</p>
            <p className="text-xs text-amber-600 font-semibold">{expanded ? 'Click to collapse ▲' : 'Click to view details ▼'}</p>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-6 bg-gray-50/50 space-y-5">
          {/* Items */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Order Items ({items.length})</h4>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm bg-white p-2.5 rounded-xl border border-gray-100">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    <img src={item.image_url || ''} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <span className="flex-1 font-medium text-gray-800">{item.name}</span>
                  <span className="text-gray-500">Qty: {item.quantity}</span>
                  <span className="font-semibold text-gray-900">{formatPrice(getEffectivePrice(item.price, item.sale_price) * item.quantity)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping Address */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-amber-600" />
              Delivery Address
            </h4>
            <div className="text-sm text-gray-700 bg-white rounded-xl p-3.5 border border-gray-100">
              <p className="font-medium text-gray-900">{order.customer_name}</p>
              <p>{order.address}</p>
              <p>{order.city}, {order.state} - {order.pincode}</p>
              <p className="text-xs text-gray-500 mt-1">Phone: {order.phone}</p>
            </div>
          </div>

          {/* Update Delivery status */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Truck className="w-3.5 h-3.5 text-amber-600" />
              Manage Delivery & Fulfillment
            </h4>
            <div className="flex flex-wrap items-end gap-3 bg-white rounded-xl p-4 border border-gray-100">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Estimated Delivery Date</label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={e => setDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Fulfillment Status</label>
                <select
                  value={deliveryStatus}
                  onChange={e => setDeliveryStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-amber-500"
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="shipped">Shipped</option>
                  <option value="out_for_delivery">Out for Delivery</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <button
                onClick={() => onUpdateDelivery(order.id, deliveryDate, deliveryStatus)}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 shadow"
              >
                <CheckCircle2 className="w-4 h-4" />
                Update Order
              </button>
              <button
                type="button"
                onClick={() => onDeleteOrder(order.id, order.order_number)}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ml-auto"
                title="Delete this order"
              >
                <Trash2 className="w-4 h-4" />
                Delete Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Modal for both Add and Edit Product
function ProductModal({
  title,
  initialProduct,
  categories,
  onClose,
  onSave,
  onDelete,
}: {
  title: string;
  initialProduct?: Product;
  categories: Category[];
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  onDelete?: (productId: string, productName: string) => void;
}) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: initialProduct?.name || '',
    slug: initialProduct?.slug || '',
    description: initialProduct?.description || '',
    price: initialProduct?.price?.toString() || '',
    sale_price: initialProduct?.sale_price?.toString() || '',
    category_id: initialProduct?.category_id || categories[0]?.id || '',
    image_url: initialProduct?.image_url || '',
    images: initialProduct?.images?.join(', ') || '',
    stock: initialProduct?.stock?.toString() || '10',
    rating: initialProduct?.rating?.toString() || '5.0',
    review_count: initialProduct?.review_count?.toString() || '0',
    featured: initialProduct?.featured ?? true,
  });

  const slugify = (text: string) =>
    text.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price.trim() || !form.category_id) {
      showToast('Please provide Product Name, Price, and Category', 'error');
      return;
    }
    setSaving(true);
    try {
      const imagesArr = form.images
        ? form.images.split(',').map(s => s.trim()).filter(Boolean)
        : form.image_url ? [form.image_url] : [];

      await onSave({
        name: form.name.trim(),
        slug: form.slug.trim() || slugify(form.name),
        description: form.description.trim() || null,
        price: parseFloat(form.price),
        sale_price: form.sale_price ? parseFloat(form.sale_price) : null,
        category_id: form.category_id,
        image_url: form.image_url.trim() || (imagesArr[0] || 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80'),
        images: imagesArr.length > 0 ? imagesArr : [form.image_url || 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80'],
        stock: parseInt(form.stock) || 0,
        rating: parseFloat(form.rating) || 5.0,
        review_count: parseInt(form.review_count) || 0,
        featured: form.featured,
      });
    } catch (err) {
      console.error(err);
      showToast('Failed to save product', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="font-serif text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Product Title *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value, slug: slugify(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                placeholder="e.g. Handmade Terracotta Vase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Slug URL</label>
              <input
                type="text"
                value={form.slug}
                onChange={e => setForm({ ...form, slug: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              placeholder="Tell customers about the craftsmanship, materials, and artisan history..."
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Regular Price (₹) *</label>
              <input
                type="number"
                required
                min="1"
                value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Sale Price (₹)</label>
              <input
                type="number"
                min="0"
                value={form.sale_price}
                onChange={e => setForm({ ...form, sale_price: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Stock Quantity</label>
              <input
                type="number"
                min="0"
                value={form.stock}
                onChange={e => setForm({ ...form, stock: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Category *</label>
            <select
              value={form.category_id}
              onChange={e => setForm({ ...form, category_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-amber-500"
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Primary Image URL</label>
            <input
              type="url"
              value={form.image_url}
              onChange={e => setForm({ ...form, image_url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
              placeholder="https://..."
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={e => setForm({ ...form, featured: e.target.checked })}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm font-medium text-gray-700">Display as Featured on Homepage</span>
          </label>

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-100">
            {initialProduct && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete(initialProduct.id, initialProduct.name);
                  onClose();
                }}
                className="py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Delete Product
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-w-[100px] py-2.5 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 min-w-[120px] py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
