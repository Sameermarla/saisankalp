// Sai Sankalp Shared Global State Manager & Interceptor
window.escapeHTML = function(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};
window.PRODUCTS = [];
window.cart = [];
window.wishlist = [];
window.appliedCoupon = null;
window.currentUserEmail = "";
window.userRole = "customer";
window.isAdmin = false;
window.orderTotals = { subtotal: 0, cgst: 0, sgst: 0, total: 0 };
window.isTestMode = false;
window.previousOrdersCount = 0;
window.currentViewingOrderId = null;
window.compareProducts = [];
window.adminNotifications = [];
window.allOrders = [];

// Global Fetch Interceptor to inject Security and State Headers
const originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
    options.headers = options.headers || {};
    
    // Inject Authorization token
    const token = localStorage.getItem("sai_sankalp_session_token");
    if (token) {
        options.headers["Authorization"] = "Bearer " + token;
    }
    
    // Inject Test Mode
    const testMode = localStorage.getItem("sai_sankalp_test_mode");
    if (testMode === "true") {
        options.headers["X-Test-Mode"] = "true";
    }
    
    // Inject CSRF Token
    const csrfToken = localStorage.getItem("sai_sankalp_csrf_token");
    if (csrfToken) {
        options.headers["X-CSRF-Token"] = csrfToken;
    }
    
    return originalFetch(url, options);
};
