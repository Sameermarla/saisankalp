// Dynamic Product Catalog Data
let PRODUCTS = [];

// Application State & User Roles
let cart = [];
let savedForLater = JSON.parse(localStorage.getItem('sai_sankalp_saved_for_later') || '[]');
let currentUserEmail = "";
let userRole = "";
let isAdmin = false;
let allOrders = []; // Cached orders for filtering/search
let isTestMode = false;

// Advanced Storefront State
let wishlist = JSON.parse(localStorage.getItem('sai_sankalp_wishlist') || '[]');
let recentlyViewed = JSON.parse(localStorage.getItem('sai_sankalp_recently_viewed') || '[]');
let compareList = [];
let REVIEWS_DB = JSON.parse(localStorage.getItem('sai_sankalp_reviews_db') || '{}');
if (Object.keys(REVIEWS_DB).length === 0) {
    REVIEWS_DB = {
        2: [
            { author: "Anjali Sharma", rating: 5, comment: "Absolutely beautiful work! The embroidery yarn has a brilliant sheen.", date: "2026-06-15" },
            { author: "Vikram Nair", rating: 4, comment: "Very soft fabric, perfect size. Packaging was elegant.", date: "2026-06-20" }
        ],
        3: [
            { author: "Sarah Jones", rating: 5, comment: "Oliver is the most adorable teddy bear. Beautiful organic wool.", date: "2026-06-18" }
        ],
        4: [
            { author: "Kunal Gupta", rating: 5, comment: "Stunning paper frame. Looks amazing in my living room.", date: "2026-06-22" }
        ]
    };
    localStorage.setItem('sai_sankalp_reviews_db', JSON.stringify(REVIEWS_DB));
}

// Coupon/Gift Code Registry
const COUPON_CODES = {
    'CRAFT10':   { type: 'percent', value: 10,  label: '10% off your order' },
    'GIFT20':    { type: 'percent', value: 20,  label: '20% gift discount' },
    'WELCOME15': { type: 'percent', value: 15,  label: '15% welcome discount' },
    'ARTISAN25': { type: 'percent', value: 25,  label: '25% artisan special' },
    'FLAT100':   { type: 'flat',    value: 100, label: '₹100 flat off' },
    'FLAT200':   { type: 'flat',    value: 200, label: '₹200 gift coupon' },
};
let appliedCoupon = null;

// Global fetch interceptor to inject X-Test-Mode and Authorization headers
const originalFetch = window.fetch;
window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
    if (url.includes('/api/')) {
        init = init || {};
        init.headers = init.headers || {};
        
        let token = localStorage.getItem("sai_sankalp_session_token") || "";
        
        if (init.headers instanceof Headers) {
            init.headers.set('X-Test-Mode', isTestMode ? 'true' : 'false');
            if (token) {
                init.headers.set('Authorization', 'Bearer ' + token);
            }
        } else if (Array.isArray(init.headers)) {
            const existsTest = init.headers.some(h => h[0].toLowerCase() === 'x-test-mode');
            if (!existsTest) {
                init.headers.push(['X-Test-Mode', isTestMode ? 'true' : 'false']);
            }
            if (token) {
                const existsAuth = init.headers.some(h => h[0].toLowerCase() === 'authorization');
                if (!existsAuth) {
                    init.headers.push(['Authorization', 'Bearer ' + token]);
                }
            }
        } else {
            init.headers['X-Test-Mode'] = isTestMode ? 'true' : 'false';
            if (token) {
                init.headers['Authorization'] = 'Bearer ' + token;
            }
        }
    }
    return originalFetch.call(this, input, init);
};

function getOrdersStorageKey() {
    return isTestMode ? "sai_sankalp_test_orders" : "sai_sankalp_orders";
}

// DOM Elements
const productsGrid = document.getElementById("productsGrid");
const filterButtons = document.querySelectorAll(".filter-btn");
const navbar = document.getElementById("navbar");

// Login DOM Elements
const loginModal = document.getElementById("loginModal");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const btnContinueGuest = document.getElementById("btnContinueGuest");
const btnAdminPanel = document.getElementById("btnAdminPanel");
const btnSignOut = document.getElementById("btnSignOut");
const btnCustomerDashboard = document.getElementById("btnCustomerDashboard");
const customerDashboard = document.getElementById("customerDashboard");
const btnCustomerClose = document.getElementById("btnCustomerClose");
const orderDetailsModal = document.getElementById("orderDetailsModal");
const orderDetailsCloseBtn = document.getElementById("orderDetailsCloseBtn");
const btnInvoicePrint = document.getElementById("btnInvoicePrint");

// Admin Dashboard DOM Elements
const adminDashboard = document.getElementById("adminDashboard");
const btnAdminClose = document.getElementById("btnAdminClose");
const tabAdminOrders = document.getElementById("tabAdminOrders");
const tabAdminProducts = document.getElementById("tabAdminProducts");
const panelAdminOrders = document.getElementById("panelAdminOrders");
const panelAdminProducts = document.getElementById("panelAdminProducts");
const adminOrdersTableBody = document.getElementById("adminOrdersTableBody");
const adminProductsList = document.getElementById("adminProductsList");
const adminAddProductForm = document.getElementById("adminAddProductForm");
const adminOrderSearch = document.getElementById("adminOrderSearch");

// Cart DOM Elements
const cartSidebar = document.getElementById("cartSidebar");
const cartOverlay = document.getElementById("cartOverlay");
const cartToggleBtn = document.getElementById("cartToggleBtn");
const cartCloseBtn = document.getElementById("cartCloseBtn");
const cartCount = document.getElementById("cartCount");
const cartCountTitle = document.getElementById("cartCountTitle");
const cartItemsContainer = document.getElementById("cartItemsContainer");
const cartSubtotal = document.getElementById("cartSubtotal");
const cartFooter = document.getElementById("cartFooter");

// Modal DOM Elements
const productModal = document.getElementById("productModal");
const modalOverlay = document.getElementById("modalOverlay");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalProductDetails = document.getElementById("modalProductDetails");

// Checkout DOM Elements
const checkoutModal = document.getElementById("checkoutModal");
const checkoutOverlay = document.getElementById("checkoutOverlay");
const checkoutCloseBtn = document.getElementById("checkoutCloseBtn");
const checkoutForm = document.getElementById("checkoutForm");
const checkoutSummaryItems = document.getElementById("checkoutSummaryItems");
const checkoutSummaryTotal = document.getElementById("checkoutSummaryTotal");
const placeOrderBtn = document.getElementById("placeOrderBtn");
const placeOrderText = document.getElementById("placeOrderText");
const checkoutSpinner = document.getElementById("checkoutSpinner");

// Forms
const inquiryForm = document.getElementById("inquiryForm");
const newsletterForm = document.getElementById("newsletterForm");
const toastContainer = document.getElementById("toastContainer");

// Initialize Website
document.addEventListener("DOMContentLoaded", () => {
    const toggleTestMode = document.getElementById("toggleTestMode");
    const testModeBanner = document.getElementById("testModeBanner");

    if (toggleTestMode) {
        isTestMode = localStorage.getItem("sai_sankalp_test_mode") === "true";
        toggleTestMode.checked = isTestMode;
        if (isTestMode) {
            if (testModeBanner) testModeBanner.style.display = "block";
        }
        
        toggleTestMode.addEventListener("change", () => {
            isTestMode = toggleTestMode.checked;
            localStorage.setItem("sai_sankalp_test_mode", isTestMode);
            if (isTestMode) {
                if (testModeBanner) testModeBanner.style.display = "block";
            } else {
                if (testModeBanner) testModeBanner.style.display = "none";
            }
            
            // Reload datasets
            if (isAdmin && typeof loadAdminOrders === "function") {
                loadAdminOrders();
            }
            if (currentUserEmail && typeof loadCustomerOrders === "function") {
                loadCustomerOrders();
            }
        });
    }

    checkLoginState();
    fetchProducts();
    renderAdminCategoryList();
    loadCartFromLocalStorage();
    setupEventListeners();
});

// Scroll Effects
window.addEventListener("scroll", () => {
    if (window.scrollY > 50) {
        navbar.classList.add("scrolled");
    } else {
        navbar.classList.remove("scrolled");
    }
});

// Render Product Catalog
function renderProducts(customList = null) {
    productsGrid.innerHTML = "";
    
    const listToRender = customList || PRODUCTS;
        
    if (listToRender.length === 0) {
        productsGrid.innerHTML = `<p class="no-products">No crafts found matching your criteria.</p>`;
        return;
    }

    listToRender.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card";
        card.setAttribute("data-id", product.id);

        const stock = product.stock !== undefined ? product.stock : 99;
        const outOfStock = stock <= 0;
        const lowStock = stock > 0 && stock <= 5;

        const stockBadgeHtml = outOfStock
            ? '' // handled by overlay
            : lowStock
                ? `<div class="stock-alert-badge" style="position:absolute; bottom:10px; left:10px; z-index:6; margin:0;">
                       <i class="fa-solid fa-fire"></i> Only ${stock} left!
                   </div>`
                : '';

        const outOfStockOverlay = outOfStock
            ? `<div class="out-of-stock-overlay"><span>Out of Stock</span></div>` : '';

        const addBtnDisabled = outOfStock ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : '';
        const inWish = wishlist.includes(product.id);
        const inCompare = compareList.includes(product.id);

        card.innerHTML = `
            <div class="product-img-wrapper" style="position:relative;">
                <span class="product-tag">${product.categoryName}</span>
                
                <!-- Wishlist Toggle Heart Button -->
                <button type="button" class="wishlist-heart-btn ${inWish ? 'active' : ''}" 
                    onclick="toggleWishlist(${product.id}, event)" title="${inWish ? 'Remove from Wishlist' : 'Add to Wishlist'}">
                    <i class="fa-solid fa-heart"></i>
                </button>

                <img src="${product.image}" alt="${product.title}" class="product-img">
                ${outOfStockOverlay}
                ${stockBadgeHtml}
                <div class="product-actions">
                    <button class="action-btn quick-view-btn" title="Quick View" onclick="openProductModal(${product.id})">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="action-btn compare-btn ${inCompare ? 'active' : ''}" style="${inCompare ? 'color: var(--accent-color);' : ''}" 
                        title="Compare Product" onclick="toggleCompareProduct(${product.id}, event)">
                        <i class="fa-solid fa-code-compare"></i>
                    </button>
                    <button class="action-btn add-to-cart-btn" title="Add to Bag" onclick="addToCart(${product.id})" ${addBtnDisabled}>
                        <i class="fa-solid fa-bag-shopping"></i>
                    </button>
                </div>
            </div>
            <div class="product-info">
                <span class="product-category">${product.categoryName}</span>
                <h3 class="product-title" onclick="openProductModal(${product.id})">${product.title}</h3>
                ${outOfStock ? '<p style="color:#e74c3c;font-size:0.78rem;font-weight:700;margin:2px 0;">Currently Unavailable</p>' : ''}
                <div class="product-meta">
                    <span class="product-price">₹${product.price.toFixed(2)}</span>
                    <div class="product-rating">
                        <i class="fa-solid fa-star"></i>
                        <span>${product.rating} (${product.reviews})</span>
                    </div>
                </div>
            </div>
        `;
        productsGrid.appendChild(card);
    });
}

// Event Listeners Setup
function setupEventListeners() {
    // Left Sidebar Filters Wiring
    wireSidebarFilters();

    // Storefront Search Recommendations Autocomplete
    const searchInput = document.getElementById("storefrontSearchInput");
    const searchSuggestionsPanel = document.getElementById("searchSuggestionsPanel");
    if (searchInput && searchSuggestionsPanel) {
        searchInput.addEventListener("input", (e) => {
            const query = e.target.value.trim().toLowerCase();
            if (!query) {
                searchSuggestionsPanel.style.display = 'none';
                filterAndSortProducts();
                return;
            }
            
            const matches = PRODUCTS.filter(p => 
                p.title.toLowerCase().includes(query) || 
                p.categoryName.toLowerCase().includes(query)
            ).slice(0, 5);
            
            if (matches.length === 0) {
                searchSuggestionsPanel.innerHTML = `<div style="padding: 10px; font-size: 0.8rem; color: var(--text-secondary); text-align: center;">No matches found</div>`;
            } else {
                searchSuggestionsPanel.innerHTML = matches.map(p => `
                    <div class="search-suggestion-item" onclick="openProductModal(${p.id}); document.getElementById('searchSuggestionsPanel').style.display='none';">
                        <img src="${p.image}" alt="${p.title}">
                        <div class="search-suggestion-info">
                            <span class="search-suggestion-title">${p.title}</span>
                            <span class="search-suggestion-price">₹${p.price.toFixed(2)}</span>
                        </div>
                    </div>
                `).join('');
            }
            searchSuggestionsPanel.style.display = 'block';
            filterAndSortProducts();
        });

        // Close search suggestions on clicking outside
        document.addEventListener("click", () => {
            searchSuggestionsPanel.style.display = 'none';
        });
        searchSuggestionsPanel.addEventListener("click", (e) => e.stopPropagation());
        searchInput.addEventListener("click", (e) => {
            e.stopPropagation();
            if (searchInput.value.trim()) {
                searchSuggestionsPanel.style.display = 'block';
            }
        });
    }

    // Wishlist Toggle Dropdown Panel
    const btnWishlistToggle = document.getElementById("btnWishlistToggle");
    const wishlistPanel = document.getElementById("wishlistPanel");
    if (btnWishlistToggle && wishlistPanel) {
        btnWishlistToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            wishlistPanel.style.display = wishlistPanel.style.display === 'block' ? 'none' : 'block';
            if (searchSuggestionsPanel) searchSuggestionsPanel.style.display = 'none';
        });

        // Close wishlist panel on clicking outside
        document.addEventListener("click", () => {
            wishlistPanel.style.display = 'none';
        });
        wishlistPanel.addEventListener("click", (e) => e.stopPropagation());
    }

    // Category Filter Buttons (Sync with Sidebar)
    filterButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            filterButtons.forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            
            const categoryValue = e.target.getAttribute("data-category");
            
            // Check correct sidebar category and uncheck others
            const catAll = document.getElementById("catCheckAll");
            const catChecks = document.querySelectorAll(".category-filter-check");
            
            if (categoryValue === "all") {
                if (catAll) catAll.checked = true;
                catChecks.forEach(c => { if (c.id !== "catCheckAll") c.checked = false; });
            } else {
                if (catAll) catAll.checked = false;
                catChecks.forEach(c => {
                    c.checked = c.value === categoryValue;
                });
            }
            
            filterAndSortProducts();
        });
    });

    // Cart Sidebar Toggles
    cartToggleBtn.addEventListener("click", toggleCart);
    cartCloseBtn.addEventListener("click", toggleCart);
    cartOverlay.addEventListener("click", toggleCart);
    
    // Modal Close
    modalCloseBtn.addEventListener("click", closeProductModal);
    modalOverlay.addEventListener("click", closeProductModal);

    // Checkout Close
    if (checkoutCloseBtn) checkoutCloseBtn.addEventListener("click", closeCheckoutModal);
    if (checkoutOverlay) checkoutOverlay.addEventListener("click", closeCheckoutModal);

    // Escape Key to Close overlays
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (cartSidebar.classList.contains("open")) toggleCart();
            if (productModal.classList.contains("open")) closeProductModal();
            if (checkoutModal && checkoutModal.classList.contains("open")) closeCheckoutModal();
            if (adminDashboard && adminDashboard.classList.contains("active")) {
                adminDashboard.classList.remove("active");
                document.body.style.overflow = "";
            }
        }
    });

    // Inquiry Form
    if (inquiryForm) {
        inquiryForm.addEventListener("submit", handleInquirySubmit);
    }

    // Newsletter Form
    if (newsletterForm) {
        newsletterForm.addEventListener("submit", handleNewsletterSubmit);
    }
    
    // Check out button opens the Checkout Form Modal
    document.getElementById("checkoutBtn").addEventListener("click", () => {
        toggleCart(); // Close sidebar first
        openCheckoutModal();
    });

    // Shipping Form Submission (Step 1)
    const shippingForm = document.getElementById("shippingForm");
    if (shippingForm) {
        shippingForm.addEventListener("submit", handleShippingSubmit);
    }

    // Checkout Saved Address dropdown change
    const addressSelect = document.getElementById("checkoutAddressSelect");
    if (addressSelect) {
        addressSelect.addEventListener("change", () => {
            const val = addressSelect.value;
            if (val) {
                try {
                    const addr = JSON.parse(val);
                    document.getElementById("checkoutName").value = addr.name;
                    document.getElementById("checkoutMobile").value = addr.mobile;
                    document.getElementById("checkoutAddress").value = addr.address;
                } catch(e) {
                    console.error("Error parsing saved address selection:", e);
                }
            } else {
                document.getElementById("checkoutName").value = "";
                document.getElementById("checkoutMobile").value = "";
                document.getElementById("checkoutAddress").value = "";
            }
        });
    }

    // Customer Dashboard Add Address form submit
    const addAddressForm = document.getElementById("addAddressForm");
    if (addAddressForm) {
        addAddressForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const name = document.getElementById("addrName").value.trim();
            const mobile = document.getElementById("addrMobile").value.trim();
            const address = document.getElementById("addrText").value.trim();
            
            fetch('/api/addresses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('sai_sankalp_session_token')
                },
                body: JSON.stringify({ name, mobile, address })
            })
            .then(res => {
                if (!res.ok) throw new Error("Failed to save address");
                return res.json();
            })
            .then(() => {
                showToast("Address saved successfully!", "fa-circle-check");
                document.getElementById("addrName").value = "";
                document.getElementById("addrMobile").value = "";
                document.getElementById("addrText").value = "";
                loadSavedAddresses();
            })
            .catch(err => {
                alert("Error: " + err.message);
            });
        });
    }

    // Copy UPI ID button
    const btnCopyUpi = document.getElementById("btnCopyUpi");
    if (btnCopyUpi) {
        btnCopyUpi.addEventListener("click", copyUpiId);
    }

    // Confirm local sandbox payment click
    const btnConfirmLocalPaid = document.getElementById("btnConfirmLocalPaid");
    if (btnConfirmLocalPaid) {
        btnConfirmLocalPaid.addEventListener("click", handleLocalPaymentConfirm);
    }

    // Card offline simulation button
    const btnCardLocalPaid = document.getElementById("btnCardLocalPaid");
    if (btnCardLocalPaid) {
        btnCardLocalPaid.addEventListener("click", handleCardLocalPaymentConfirm);
    }

    // Coupon apply button
    const btnApplyCoupon = document.getElementById('btnApplyCoupon');
    if (btnApplyCoupon) {
        btnApplyCoupon.addEventListener('click', applyCoupon);
    }
    // Allow Enter key in coupon field
    const couponInput = document.getElementById('couponCodeInput');
    if (couponInput) {
        couponInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } });
    }

    // Global Auth Navigation Controllers
    window.switchAuthTab = function(tab) {
        const tabSignin = document.getElementById("btnAuthTabSignin");
        const tabRegister = document.getElementById("btnAuthTabRegister");
        if (tab === 'signin') {
            if (tabSignin) tabSignin.classList.add("active");
            if (tabRegister) tabRegister.classList.remove("active");
            showAuthView('signin');
        } else {
            if (tabSignin) tabSignin.classList.remove("active");
            if (tabRegister) tabRegister.classList.add("active");
            showAuthView('register');
        }
    };

    window.showAuthView = function(view) {
        document.querySelectorAll('.auth-view').forEach(el => el.classList.remove('active'));
        const tabs = document.getElementById("authTabs");
        
        if (view === 'signin') {
            document.getElementById("viewSignIn").classList.add("active");
            if (tabs) tabs.style.display = "flex";
        } else if (view === 'register') {
            document.getElementById("viewRegister").classList.add("active");
            if (tabs) tabs.style.display = "flex";
        } else if (view === 'otp') {
            document.getElementById("viewOtp").classList.add("active");
            if (tabs) tabs.style.display = "none";
        } else if (view === 'forgot') {
            document.getElementById("viewForgot").classList.add("active");
            if (tabs) tabs.style.display = "none";
        } else if (view === 'reset') {
            document.getElementById("viewResetPassword").classList.add("active");
            if (tabs) tabs.style.display = "none";
        }
    };

    window.cancelOtpFlow = function() {
        showAuthView('register');
    };

    let tempRegisterEmail = "";
    let tempForgotEmail = "";

    // Sign In Form Submit
    const signInForm = document.getElementById("signInForm");
    if (signInForm) {
        signInForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const email = document.getElementById("signInEmail").value.trim();
            const password = document.getElementById("signInPassword").value;

            fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            })
            .then(res => {
                if (!res.ok) return res.json().then(d => { throw new Error(d.error || "Login failed"); });
                return res.json();
            })
            .then(data => {
                localStorage.setItem("sai_sankalp_user_email", data.email);
                localStorage.setItem("sai_sankalp_session_token", data.token);
                localStorage.setItem("sai_sankalp_user_role", data.role);
                handleLoginSuccess(data.email, data.role);
            })
            .catch(err => {
                alert("Login Error: " + err.message);
            });
        });
    }

    // Register Form Submit
    const registerForm = document.getElementById("registerForm");
    if (registerForm) {
        registerForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const email = document.getElementById("registerEmail").value.trim();
            const password = document.getElementById("registerPassword").value;
            tempRegisterEmail = email;

            fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            })
            .then(res => {
                if (!res.ok) return res.json().then(d => { throw new Error(d.error || "Registration failed"); });
                return res.json();
            })
            .then(data => {
                document.getElementById("otpEmailTarget").textContent = email;
                showAuthView('otp');
                showToast("OTP sent to your email ✉️");
            })
            .catch(err => {
                alert("Registration Error: " + err.message);
            });
        });
    }

    // OTP Verification Submit
    const otpForm = document.getElementById("otpForm");
    if (otpForm) {
        otpForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const otp = document.getElementById("otpCode").value.trim();

            fetch("/api/auth/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: tempRegisterEmail, otp })
            })
            .then(res => {
                if (!res.ok) return res.json().then(d => { throw new Error(d.error || "Verification failed"); });
                return res.json();
            })
            .then(data => {
                alert("Account verified successfully! You can now sign in.");
                switchAuthTab('signin');
                document.getElementById("otpCode").value = "";
            })
            .catch(err => {
                alert("Verification Error: " + err.message);
            });
        });
    }

    // Forgot Password Form Submit
    const forgotForm = document.getElementById("forgotForm");
    if (forgotForm) {
        forgotForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const email = document.getElementById("forgotEmail").value.trim();
            tempForgotEmail = email;

            fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            })
            .then(res => {
                if (!res.ok) return res.json().then(d => { throw new Error(d.error || "Request failed"); });
                return res.json();
            })
            .then(data => {
                showAuthView('reset');
                showToast("Reset OTP sent to your email ✉️");
            })
            .catch(err => {
                alert("Error: " + err.message);
            });
        });
    }

    // Reset Password Form Submit
    const resetForm = document.getElementById("resetForm");
    if (resetForm) {
        resetForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const otp = document.getElementById("resetOtp").value.trim();
            const newPassword = document.getElementById("resetNewPassword").value;

            fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: tempForgotEmail, otp, newPassword })
            })
            .then(res => {
                if (!res.ok) return res.json().then(d => { throw new Error(d.error || "Reset failed"); });
                return res.json();
            })
            .then(data => {
                alert("Password reset successfully! You can now sign in.");
                switchAuthTab('signin');
                document.getElementById("resetOtp").value = "";
                document.getElementById("resetNewPassword").value = "";
            })
            .catch(err => {
                alert("Reset Error: " + err.message);
            });
        });
    }

    // Guest login trigger
    if (btnContinueGuest) {
        btnContinueGuest.addEventListener("click", () => {
            localStorage.setItem("sai_sankalp_user_email", "Guest");
            localStorage.removeItem("sai_sankalp_session_token");
            localStorage.setItem("sai_sankalp_user_role", "customer");
            handleLoginSuccess("Guest", "customer");
        });
    }

    // Sign Out
    if (btnSignOut) {
        btnSignOut.addEventListener("click", () => {
            localStorage.removeItem("sai_sankalp_user_email");
            localStorage.removeItem("sai_sankalp_session_token");
            localStorage.removeItem("sai_sankalp_user_role");
            location.reload();
        });
    }

    // Auth dialog close
    const btnAuthClose = document.getElementById("btnAuthClose");
    if (btnAuthClose) {
        btnAuthClose.addEventListener("click", () => {
            loginModal.classList.remove("active");
            document.body.style.overflow = "";
        });
    }

    // Admin Dashboard Open
    if (btnAdminPanel) {
        btnAdminPanel.addEventListener("click", () => {
            adminDashboard.classList.add("active");
            document.body.style.overflow = "hidden";
            switchAdminTab("orders");
            refreshAdminData();
        });
    }

    // Admin Dashboard Close
    if (btnAdminClose) {
        btnAdminClose.addEventListener("click", () => {
            adminDashboard.classList.remove("active");
            document.body.style.overflow = "";
        });
    }

    // Customer Dashboard Open
    if (btnCustomerDashboard) {
        btnCustomerDashboard.addEventListener("click", () => {
            customerDashboard.classList.add("active");
            document.body.style.overflow = "hidden";
            openCustomerDashboard();
        });
    }

    // Customer Dashboard Close
    if (btnCustomerClose) {
        btnCustomerClose.addEventListener("click", () => {
            customerDashboard.classList.remove("active");
            document.body.style.overflow = "";
        });
    }

    // Order Details Close
    if (orderDetailsCloseBtn) {
        orderDetailsCloseBtn.addEventListener("click", () => {
            orderDetailsModal.style.display = "none";
            if (!customerDashboard.classList.contains("active") && !adminDashboard.classList.contains("active")) {
                document.body.style.overflow = "";
            }
        });
    }

    // Invoice Print
    if (btnInvoicePrint) {
        btnInvoicePrint.addEventListener("click", () => {
            window.print();
        });
    }

    // Admin Tabs Switch
    if (tabAdminOrders) {
        tabAdminOrders.addEventListener("click", () => switchAdminTab("orders"));
    }
    if (tabAdminProducts) {
        tabAdminProducts.addEventListener("click", () => switchAdminTab("products"));
    }
    if (document.getElementById("tabAdminAnalytics")) {
        document.getElementById("tabAdminAnalytics").addEventListener("click", () => switchAdminTab("analytics"));
    }
    if (document.getElementById("tabAdminPromo")) {
        document.getElementById("tabAdminPromo").addEventListener("click", () => switchAdminTab("promo"));
    }

    // Admin Notification bell toggle
    const btnAdminNotificationToggle = document.getElementById("btnAdminNotificationToggle");
    const adminNotificationsDrawer = document.getElementById("adminNotificationsDrawer");
    if (btnAdminNotificationToggle && adminNotificationsDrawer) {
        btnAdminNotificationToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            const isVisible = adminNotificationsDrawer.style.display === "block";
            adminNotificationsDrawer.style.display = isVisible ? "none" : "block";
        });
    }
    document.addEventListener("click", () => {
        if (adminNotificationsDrawer) {
            adminNotificationsDrawer.style.display = "none";
        }
    });
    if (adminNotificationsDrawer) {
        adminNotificationsDrawer.addEventListener("click", (e) => e.stopPropagation());
    }

    // Add Product Form Submit
    if (adminAddProductForm) {
        adminAddProductForm.addEventListener("submit", handleAddProductSubmit);
    }

    // Admin Order Search Input
    if (adminOrderSearch) {
        adminOrderSearch.addEventListener("input", filterAdminOrders);
    }

    // === Image Upload Preview in Admin Panel ===
    const prodImageFile = document.getElementById("prodImageFile");
    const prodImagePreview = document.getElementById("prodImagePreview");
    const prodImagePreviewWrapper = document.getElementById("prodImagePreviewWrapper");
    const prodImageFileName = document.getElementById("prodImageFileName");
    const prodImageDropLabel = document.getElementById("prodImageDropLabel");
    const prodImageClearBtn = document.getElementById("prodImageClearBtn");

    if (prodImageFile) {
        prodImageFile.addEventListener("change", () => {
            const file = prodImageFile.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    prodImagePreview.src = e.target.result;
                    prodImagePreviewWrapper.style.display = "block";
                    prodImageFileName.textContent = file.name + " (" + (file.size / 1024).toFixed(1) + " KB)";
                    if (prodImageDropLabel) {
                        prodImageDropLabel.style.borderColor = "var(--accent-color)";
                        prodImageDropLabel.style.background = "rgba(211,110,80,0.05)";
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (prodImageClearBtn) {
        prodImageClearBtn.addEventListener("click", () => {
            if (prodImageFile) prodImageFile.value = "";
            if (prodImagePreview) prodImagePreview.src = "";
            if (prodImagePreviewWrapper) prodImagePreviewWrapper.style.display = "none";
            if (prodImageFileName) prodImageFileName.textContent = "";
            if (prodImageDropLabel) {
                prodImageDropLabel.style.borderColor = "";
                prodImageDropLabel.style.background = "";
            }
        });
    }

    // Drag-over highlight on the upload label
    if (prodImageDropLabel) {
        prodImageDropLabel.addEventListener("dragover", (e) => {
            e.preventDefault();
            prodImageDropLabel.style.borderColor = "var(--accent-color)";
        });
        prodImageDropLabel.addEventListener("dragleave", () => {
            if (!prodImageFile || !prodImageFile.files.length)
                prodImageDropLabel.style.borderColor = "";
        });
        prodImageDropLabel.addEventListener("drop", (e) => {
            e.preventDefault();
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files[0]) {
                prodImageFile.files = dt.files;
                prodImageFile.dispatchEvent(new Event("change"));
            }
        });
    }
}

// Cart Logic
function toggleCart() {
    cartSidebar.classList.toggle("open");
    cartOverlay.classList.toggle("active");
}

function addToCart(productId) {
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) return;

    // Stock check
    const stock = product.stock !== undefined ? product.stock : 99;
    if (stock <= 0) {
        showToast(`"${product.title}" is out of stock.`, "fa-circle-exclamation");
        return;
    }

    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        // Don't exceed stock
        if (existingItem.quantity >= stock) {
            showToast(`Only ${stock} unit(s) available for "${product.title}".`, "fa-circle-exclamation");
            return;
        }
        existingItem.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }

    updateCartUI();
    saveCartToLocalStorage();
    showToast(`Added "${product.title}" to your bag.`, "fa-bag-shopping");
    if (!cartSidebar.classList.contains("open")) toggleCart();
}

function updateCartItemQty(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (!item) return;

    const newQty = item.quantity + change;
    if (change > 0) {
        const product = PRODUCTS.find(p => p.id === productId);
        const stock = product ? (product.stock !== undefined ? product.stock : 99) : 99;
        if (newQty > stock) {
            showToast(`Only ${stock} unit(s) of "${item.title}" available.`, "fa-circle-exclamation");
            return;
        }
    }

    item.quantity = newQty;
    if (item.quantity <= 0) cart = cart.filter(i => i.id !== productId);

    updateCartUI();
    saveCartToLocalStorage();
}

function removeCartItem(productId) {
    const item = cart.find(i => i.id === productId);
    cart = cart.filter(i => i.id !== productId);
    updateCartUI();
    saveCartToLocalStorage();
    if (item) showToast(`Removed "${item.title}" from your bag.`, "fa-trash-can");
}

function saveForLater(productId) {
    const item = cart.find(i => i.id === productId);
    if (!item) return;
    cart = cart.filter(i => i.id !== productId);
    // Avoid duplicates in saved list
    if (!savedForLater.find(i => i.id === productId)) {
        savedForLater.push({ ...item, quantity: 1 });
    }
    localStorage.setItem('sai_sankalp_saved_for_later', JSON.stringify(savedForLater));
    updateCartUI();
    saveCartToLocalStorage();
    showToast(`"${item.title}" saved for later.`, "fa-bookmark");
}

function moveToCart(productId) {
    const item = savedForLater.find(i => i.id === productId);
    if (!item) return;
    savedForLater = savedForLater.filter(i => i.id !== productId);
    localStorage.setItem('sai_sankalp_saved_for_later', JSON.stringify(savedForLater));
    addToCart(productId);
    updateCartUI();
}

function removeSavedItem(productId) {
    const item = savedForLater.find(i => i.id === productId);
    savedForLater = savedForLater.filter(i => i.id !== productId);
    localStorage.setItem('sai_sankalp_saved_for_later', JSON.stringify(savedForLater));
    updateCartUI();
    if (item) showToast(`Removed "${item.title}" from saved list.`, "fa-trash-can");
}

function applyCoupon() {
    const input = document.getElementById('couponCodeInput');
    const msgEl = document.getElementById('couponMessage');
    if (!input || !msgEl) return;
    const code = input.value.trim().toUpperCase();
    if (!code) { msgEl.innerHTML = '<span style="color:#e74c3c;">Please enter a coupon code.</span>'; return; }

    fetch("/api/coupons")
    .then(res => res.json())
    .then(coupons => {
        const coupon = coupons[code];
        if (coupon) {
            appliedCoupon = { code, ...coupon };
            msgEl.innerHTML = `<span class="coupon-badge"><i class="fa-solid fa-tag"></i> ${code} applied — ${coupon.label}!</span>`;
            updateCartUI();
            showToast(`Coupon "${code}" applied!`, 'fa-tag');
        } else {
            appliedCoupon = null;
            msgEl.innerHTML = '<span style="color:#e74c3c;"><i class="fa-solid fa-xmark" style="margin-right:4px;"></i>Invalid or expired coupon code.</span>';
            updateCartUI();
        }
    })
    .catch(err => {
        console.warn("Could not fetch coupons, using offline backup:", err);
        const coupon = COUPON_CODES[code];
        if (coupon) {
            appliedCoupon = { code, ...coupon };
            msgEl.innerHTML = `<span class="coupon-badge"><i class="fa-solid fa-tag"></i> ${code} applied — ${coupon.label}!</span>`;
            updateCartUI();
            showToast(`Coupon "${code}" applied!`, 'fa-tag');
        } else {
            appliedCoupon = null;
            msgEl.innerHTML = '<span style="color:#e74c3c;"><i class="fa-solid fa-xmark" style="margin-right:4px;"></i>Invalid or expired coupon code.</span>';
            updateCartUI();
        }
    });
}

function validateCartStock() {
    const issues = [];
    for (const item of cart) {
        const product = PRODUCTS.find(p => p.id === item.id);
        const stock = product ? (product.stock !== undefined ? product.stock : 99) : 99;
        if (stock <= 0) {
            issues.push(`"${item.title}" is out of stock.`);
        } else if (item.quantity > stock) {
            issues.push(`Only ${stock} unit(s) of "${item.title}" available (you have ${item.quantity}).`);
        }
    }
    return issues;
}

function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;
    cartCountTitle.textContent = totalItems;
    cartCount.style.display = totalItems > 0 ? "flex" : "none";

    // --- Saved for Later panel ---
    const sflSection = document.getElementById('savedForLaterSection');
    const sflList    = document.getElementById('savedForLaterList');
    const sflCount   = document.getElementById('savedForLaterCount');
    if (sflSection && sflList && sflCount) {
        sflCount.textContent = savedForLater.length;
        if (savedForLater.length > 0) {
            sflSection.style.display = 'block';
            sflList.innerHTML = savedForLater.map(item => `
                <div class="saved-item">
                    <img src="${item.image}" alt="${item.title}">
                    <div class="saved-item-info">
                        <div class="saved-item-title">${item.title}</div>
                        <div class="saved-item-price">₹${item.price.toFixed(2)}</div>
                    </div>
                    <div class="saved-item-btns">
                        <button onclick="moveToCart(${item.id})">Move to Bag</button>
                        <button onclick="removeSavedItem(${item.id})" style="color:#e74c3c;">Remove</button>
                    </div>
                </div>
            `).join('');
        } else {
            sflSection.style.display = 'none';
        }
    }

    // --- Empty cart state ---
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="empty-cart-message">
                <i class="fa-solid fa-bag-shopping"></i>
                <p>Your shopping bag is empty.</p>
                <button class="btn btn-primary" onclick="toggleCart(); window.location.hash='#shop';">Browse Shop</button>
            </div>
        `;
        cartFooter.style.display = "none";
        // update summary to zero
        const s = document.getElementById('cartSubtotal');
        if (s) s.textContent = '₹0.00';
        return;
    }

    cartFooter.style.display = "block";
    cartItemsContainer.innerHTML = "";

    let subtotal = 0;
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        const product = PRODUCTS.find(p => p.id === item.id);
        const stock = product ? (product.stock !== undefined ? product.stock : 99) : 99;
        const stockWarn = item.quantity > stock
            ? `<span style="color:#e74c3c;font-size:0.72rem;"><i class="fa-solid fa-circle-exclamation"></i> Only ${stock} in stock</span>` : '';

        const itemEl = document.createElement("div");
        itemEl.className = "cart-item";
        itemEl.innerHTML = `
            <img src="${item.image}" alt="${item.title}" class="cart-item-img">
            <div class="cart-item-info">
                <h4 class="cart-item-title">${item.title}</h4>
                <p class="cart-item-category">${item.categoryName}</p>
                <p class="cart-item-price">₹${item.price.toFixed(2)} × ${item.quantity} = <strong>₹${itemTotal.toFixed(2)}</strong></p>
                ${stockWarn}
            </div>
            <div class="cart-item-actions">
                <div class="qty-selector">
                    <button class="qty-btn" onclick="updateCartItemQty(${item.id}, -1)"><i class="fa-solid fa-minus"></i></button>
                    <span class="qty-val">${item.quantity}</span>
                    <button class="qty-btn" onclick="updateCartItemQty(${item.id}, 1)"><i class="fa-solid fa-plus"></i></button>
                </div>
                <button class="item-save-btn" onclick="saveForLater(${item.id})">Save for Later</button>
                <button class="item-remove-btn" onclick="removeCartItem(${item.id})">Remove</button>
            </div>
        `;
        cartItemsContainer.appendChild(itemEl);
    });

    // --- Price calculation ---
    // Subtotal
    const cartSubtotalEl = document.getElementById('cartSubtotal');
    if (cartSubtotalEl) cartSubtotalEl.textContent = `₹${subtotal.toFixed(2)}`;

    // Coupon discount
    let discount = 0;
    const discountRow = document.getElementById('couponDiscountRow');
    const discountEl  = document.getElementById('cartDiscount');
    const discountLbl = document.getElementById('couponDiscountLabel');
    if (appliedCoupon) {
        if (appliedCoupon.type === 'percent') {
            discount = subtotal * appliedCoupon.value / 100;
            if (discountLbl) discountLbl.textContent = `${appliedCoupon.code} (${appliedCoupon.value}% off)`;
        } else {
            discount = Math.min(appliedCoupon.value, subtotal);
            if (discountLbl) discountLbl.textContent = `${appliedCoupon.code} (Flat off)`;
        }
        if (discountRow) discountRow.style.display = 'flex';
        if (discountEl) discountEl.textContent = `-₹${discount.toFixed(2)}`;
    } else {
        if (discountRow) discountRow.style.display = 'none';
    }

    const afterDiscount = subtotal - discount;

    // Shipping: free if order >= ₹999, else ₹49
    const SHIPPING_THRESHOLD = 999;
    const SHIPPING_FEE = 49;
    const shippingCharge = afterDiscount >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    const cartShippingEl = document.getElementById('cartShipping');
    if (cartShippingEl) {
        cartShippingEl.textContent = shippingCharge === 0
            ? 'FREE 🎉'
            : `₹${shippingCharge.toFixed(2)}`;
        cartShippingEl.style.color = shippingCharge === 0 ? '#27ae60' : 'inherit';
    }

    // GST 18% on (subtotal - discount)
    const GST_RATE = 0.18;
    const gst = afterDiscount * GST_RATE;
    const cartGSTEl = document.getElementById('cartGST');
    if (cartGSTEl) cartGSTEl.textContent = `₹${gst.toFixed(2)}`;

    // Grand total
    const grandTotal = afterDiscount + shippingCharge + gst;
    const cartTotalEl = document.getElementById('cartTotal');
    if (cartTotalEl) cartTotalEl.textContent = `₹${grandTotal.toFixed(2)}`;

    // --- Stock validation message ---
    const validationMsg = document.getElementById('cartValidationMsg');
    const validationText = document.getElementById('cartValidationText');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const stockIssues = validateCartStock();
    if (stockIssues.length > 0) {
        if (validationMsg) validationMsg.style.display = 'flex';
        if (validationText) validationText.textContent = stockIssues[0];
        if (checkoutBtn) { checkoutBtn.disabled = true; checkoutBtn.style.opacity = '0.5'; checkoutBtn.style.cursor = 'not-allowed'; }
    } else {
        if (validationMsg) validationMsg.style.display = 'none';
        if (checkoutBtn) { checkoutBtn.disabled = false; checkoutBtn.style.opacity = ''; checkoutBtn.style.cursor = ''; }
    }
}

// Modal Logic
function openProductModal(productId) {
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) return;

    // --- Track Recently Viewed ---
    if (recentlyViewed.includes(productId)) {
        recentlyViewed = recentlyViewed.filter(id => id !== productId);
    }
    recentlyViewed.unshift(productId);
    if (recentlyViewed.length > 5) recentlyViewed.pop();
    localStorage.setItem('sai_sankalp_recently_viewed', JSON.stringify(recentlyViewed));

    // --- Specs List ---
    let specsHtml = "";
    if (product.specs) {
        for (const [key, value] of Object.entries(product.specs)) {
            specsHtml += `
                <div class="spec-line">
                    <strong>${key}:</strong> <span>${value}</span>
                </div>
            `;
        }
    }

    // --- Low Stock Indicator ---
    const stock = product.stock !== undefined ? product.stock : 99;
    const isLowStock = stock > 0 && stock <= 5;
    const stockWarningHtml = isLowStock
        ? `<div class="stock-alert-badge" style="margin-top: 8px;"><i class="fa-solid fa-fire"></i> Only ${stock} items left in stock!</div>`
        : stock <= 0
            ? `<div class="stock-alert-badge" style="background:#fde8e8; color:#e74c3c; margin-top: 8px;"><i class="fa-solid fa-triangle-exclamation"></i> Out of stock</div>`
            : '';

    // --- Delivery Estimation ---
    const deliv = new Date();
    deliv.setDate(deliv.getDate() + 7);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const estDeliveryStr = `${deliv.getDate()} ${months[deliv.getMonth()]} ${deliv.getFullYear()}`;

    // --- Reviews List ---
    const reviewsList = REVIEWS_DB[productId] || [];
    // Recalculate average dynamically
    let currentRating = product.rating;
    if (reviewsList.length > 0) {
        const sum = reviewsList.reduce((acc, r) => acc + r.rating, 0);
        currentRating = parseFloat((sum / reviewsList.length).toFixed(1));
    }
    
    let reviewsHtml = "";
    if (reviewsList.length === 0) {
        reviewsHtml = `<p style="color:var(--text-secondary); font-size:0.85rem; padding:10px 0;">No reviews yet. Be the first to review this craft!</p>`;
    } else {
        reviewsHtml = reviewsList.map(r => {
            let stars = "";
            for (let i = 1; i <= 5; i++) {
                stars += `<i class="fa-solid fa-star" style="color:${i <= r.rating ? '#f1c40f' : '#ccc'}; font-size:0.7rem;"></i>`;
            }
            return `
                <div class="review-card">
                    <span class="review-date">${r.date}</span>
                    <div class="review-author">${r.author}</div>
                    <div style="margin:4px 0;">${stars}</div>
                    <p class="review-comment">${r.comment}</p>
                </div>
            `;
        }).join('');
    }

    // --- Related products (Same category, excluding current product, max 3) ---
    const related = PRODUCTS.filter(p => p.category === product.category && p.id !== product.id).slice(0, 3);
    let relatedHtml = "";
    if (related.length > 0) {
        relatedHtml = `
            <div class="modal-carousel-section">
                <h3 class="carousel-title"><i class="fa-solid fa-layer-group"></i> Related Creations</h3>
                <div class="carousel-grid">
                    ${related.map(p => `
                        <div class="carousel-card" onclick="openProductModal(${p.id})">
                            <img src="${p.image}" alt="${p.title}">
                            <h4>${p.title}</h4>
                            <span>₹${p.price.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // --- Recommended products (High rating, different category, max 3) ---
    const recommended = PRODUCTS.filter(p => p.rating >= 4.7 && p.id !== product.id && p.category !== product.category).slice(0, 3);
    let recommendedHtml = "";
    if (recommended.length > 0) {
        recommendedHtml = `
            <div class="modal-carousel-section">
                <h3 class="carousel-title"><i class="fa-solid fa-thumbs-up"></i> Recommended for You</h3>
                <div class="carousel-grid">
                    ${recommended.map(p => `
                        <div class="carousel-card" onclick="openProductModal(${p.id})">
                            <img src="${p.image}" alt="${p.title}">
                            <h4>${p.title}</h4>
                            <span>₹${p.price.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // --- Recently Viewed products (excluding current, max 3) ---
    const recentProducts = recentlyViewed.filter(id => id !== product.id).map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean).slice(0, 3);
    let recentlyViewedHtml = "";
    if (recentProducts.length > 0) {
        recentlyViewedHtml = `
            <div class="modal-carousel-section">
                <h3 class="carousel-title"><i class="fa-solid fa-clock-rotate-left"></i> Recently Viewed</h3>
                <div class="carousel-grid">
                    ${recentProducts.map(p => `
                        <div class="carousel-card" onclick="openProductModal(${p.id})">
                            <img src="${p.image}" alt="${p.title}">
                            <h4>${p.title}</h4>
                            <span>₹${p.price.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    const addBtnDisabled = stock <= 0 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : '';

    modalProductDetails.innerHTML = `
        <div class="modal-img-wrapper image-zoom-container" onmousemove="zoomImage(event)" onmouseleave="resetZoomImage()">
            <img src="${product.image}" alt="${product.title}" class="modal-img" id="zoomImage">
        </div>
        <div class="modal-info">
            <span class="modal-category">${product.categoryName}</span>
            <h2 class="modal-title">${product.title}</h2>
            
            <div class="modal-price-rating">
                <span class="modal-price">₹${product.price.toFixed(2)}</span>
                <div class="product-rating">
                    <i class="fa-solid fa-star"></i>
                    <span>${currentRating} (${reviewsList.length} reviews)</span>
                </div>
            </div>

            ${stockWarningHtml}

            <p style="font-size:0.8rem; color:var(--text-secondary); margin-top:8px;">
                <i class="fa-solid fa-truck" style="color:var(--accent-color);"></i> Estimated delivery by: <strong>${estDeliveryStr}</strong>
            </p>

            <p class="modal-description">${product.description}</p>
            
            <div class="modal-specs">
                ${specsHtml}
            </div>

            <div class="modal-actions">
                <button class="btn btn-primary" onclick="addToCart(${product.id}); closeProductModal();" ${addBtnDisabled}>
                    <i class="fa-solid fa-bag-shopping"></i>
                    <span>Add to Bag</span>
                </button>
            </div>
        </div>

        <!-- Dynamic Customer Reviews Section -->
        <div class="reviews-section" style="grid-column: 1 / -1; margin-top: 30px; border-top: 1px solid var(--border-color); padding-top: 20px; text-align: left;">
            <h3 class="carousel-title" style="margin-bottom: 16px;"><i class="fa-solid fa-comments"></i> Customer Reviews &amp; Ratings</h3>
            <div class="reviews-layout-grid" style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 32px;">
                <div>
                    <h4 style="margin-bottom: 12px; font-size: 0.95rem; color: var(--text-primary);">Customer Feedback</h4>
                    <div id="reviewsListContainer" style="max-height: 280px; overflow-y: auto; padding-right: 8px;">
                        ${reviewsHtml}
                    </div>
                </div>
                <div style="background-color: var(--bg-secondary); padding: 16px; border-radius: 8px; border: 1px solid var(--border-color); height: fit-content;">
                    <h4 style="margin-bottom: 12px; font-size: 0.95rem; color: var(--text-primary);">Share Your Experience</h4>
                    <form id="addReviewForm" onsubmit="submitProductReview(event, ${product.id})">
                        <div style="margin-bottom: 12px; text-align:left;">
                            <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:4px;">Your Name</label>
                            <input type="text" id="reviewAuthor" required style="width:100%; padding:8px; border:1px solid var(--border-color); border-radius:6px; background:var(--bg-primary); color:var(--text-primary); font-family:inherit;">
                        </div>
                        <div style="margin-bottom: 12px; text-align:left;">
                            <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:4px;">Rating</label>
                            <div class="star-rating-input" style="display:flex; gap:6px; font-size:1.25rem; color:#f1c40f; cursor:pointer;">
                                <i class="fa-solid fa-star star-select" data-val="1" onclick="setSelectRating(1)"></i>
                                <i class="fa-solid fa-star star-select" data-val="2" onclick="setSelectRating(2)"></i>
                                <i class="fa-solid fa-star star-select" data-val="3" onclick="setSelectRating(3)"></i>
                                <i class="fa-solid fa-star star-select" data-val="4" onclick="setSelectRating(4)"></i>
                                <i class="fa-solid fa-star star-select" data-val="5" onclick="setSelectRating(5)"></i>
                            </div>
                            <input type="hidden" id="reviewRatingVal" value="5">
                        </div>
                        <div style="margin-bottom: 12px; text-align:left;">
                            <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:4px;">Review Comment</label>
                            <textarea id="reviewComment" rows="3" required style="width:100%; padding:8px; border:1px solid var(--border-color); border-radius:6px; background:var(--bg-primary); color:var(--text-primary); font-family:inherit; resize:vertical;"></textarea>
                        </div>
                        <button type="submit" class="btn btn-primary" style="width:100%; padding:8px; font-size:0.85rem;">Submit Review</button>
                    </form>
                </div>
            </div>
        </div>

        <!-- Carousels Section -->
        ${relatedHtml}
        ${recommendedHtml}
        ${recentlyViewedHtml}
    `;

    productModal.classList.add("open");
    modalOverlay.classList.add("active");
    document.body.style.overflow = "hidden"; // lock page scroll
}

function closeProductModal() {
    productModal.classList.remove("open");
    modalOverlay.classList.remove("active");
    document.body.style.overflow = ""; // unlock page scroll
}

// Toast Notifications
function showToast(message, icon = "fa-circle-info") {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
    `;
    toastContainer.appendChild(toast);
    
    // Auto remove after animation completes
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Form Submission handlers
function handleInquirySubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById("name").value;
    const craftType = document.getElementById("craft-type").value;
    
    // Simulated success feedback
    showToast(`Inquiry sent! Thank you ${name}. We will reply soon!`, "fa-paper-plane");
    inquiryForm.reset();
}

function handleNewsletterSubmit(e) {
    e.preventDefault();
    const emailInput = newsletterForm.querySelector("input[type='email']");
    const email = emailInput.value;
    
    showToast(`Subscribed successfully with: ${email}`, "fa-circle-check");
    newsletterForm.reset();
}

// Local Storage helpers
function saveCartToLocalStorage() {
    localStorage.setItem("sai_sankalp_cart", JSON.stringify(cart));
}

function loadCartFromLocalStorage() {
    const storedCart = localStorage.getItem("sai_sankalp_cart");
    if (storedCart) {
        try {
            cart = JSON.parse(storedCart);
            updateCartUI();
        } catch (e) {
            cart = [];
        }
    }
}

// Global Checkout State
let shippingDetails = null;
let orderTotals = { subtotal: 0, cgst: 0, sgst: 0, total: 0 };
let paymentPollingInterval = null;
let currentTransactionId = null;

// Checkout Modal Logic
function openCheckoutModal() {
    if (cart.length === 0) {
        showToast("Your bag is empty!", "fa-circle-exclamation");
        return;
    }
    
    // Reset to Step 1
    document.getElementById("checkoutStepShipping").style.display = "block";
    document.getElementById("checkoutStepPayment").style.display = "none";
    document.getElementById("step1Indicator").style.color = "var(--accent-color)";
    document.getElementById("step1Indicator").style.borderBottom = "2px solid var(--accent-color)";
    document.getElementById("step2Indicator").style.color = "var(--text-secondary)";
    document.getElementById("step2Indicator").style.borderBottom = "none";

    // Reset Forms
    const shippingForm = document.getElementById("shippingForm");
    if (shippingForm) shippingForm.reset();

    // Show saved addresses group if logged in
    const addressGroup = document.getElementById("checkoutSavedAddressGroup");
    const addressSelect = document.getElementById("checkoutAddressSelect");
    if (addressGroup && addressSelect) {
        if (currentUserEmail && currentUserEmail !== "Guest" && currentUserEmail !== "") {
            addressGroup.style.display = "block";
            fetch('/api/addresses', {
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('sai_sankalp_session_token')
                }
            })
            .then(res => res.json())
            .then(addrs => {
                addressSelect.innerHTML = `<option value="">-- Select a saved address --</option>`;
                addrs.forEach(a => {
                    const opt = document.createElement("option");
                    opt.value = JSON.stringify(a);
                    opt.textContent = `${a.name} (${a.mobile}) - ${a.address.substring(0, 30)}...`;
                    addressSelect.appendChild(opt);
                });
            })
            .catch(err => {
                console.error("Failed to load saved addresses for checkout:", err);
                addressGroup.style.display = "none";
            });
        } else {
            addressGroup.style.display = "none";
        }
    }

    // Render Checkout Summary Items
    checkoutSummaryItems.innerHTML = "";
    let subtotal = 0;
    
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        
        const line = document.createElement("div");
        line.className = "checkout-item-line";
        line.innerHTML = `
            <span class="item-title">${item.title} x${item.quantity}</span>
            <span class="item-price">₹${itemTotal.toFixed(2)}</span>
        `;
        checkoutSummaryItems.appendChild(line);
    });
    
    // Incorporate cart-level discount and shipping into checkout totals
    let cartSubtotal = cart.reduce((s, item) => s + item.price * item.quantity, 0);
    let cartDiscount = 0;
    if (appliedCoupon) {
        if (appliedCoupon.type === 'percent') {
            cartDiscount = cartSubtotal * appliedCoupon.value / 100;
        } else {
            cartDiscount = Math.min(appliedCoupon.value, cartSubtotal);
        }
    }
    const afterDiscount = cartSubtotal - cartDiscount;
    const shippingCharge = afterDiscount >= 999 ? 0 : 49;
    // Checkout uses Indian GST: 5% split as CGST 2.5% + SGST 2.5% for handloom
    const cgst = afterDiscount * 0.025;
    const sgst = afterDiscount * 0.025;
    const total = afterDiscount + shippingCharge + cgst + sgst;

    orderTotals = { subtotal: cartSubtotal, discount: cartDiscount, shipping: shippingCharge, cgst, sgst, total, couponCode: appliedCoupon ? appliedCoupon.code : null };

    // Update Invoice labels
    document.getElementById("invoiceSubtotal").textContent = `₹${cartSubtotal.toFixed(2)}`;
    document.getElementById("invoiceCgst").textContent = `₹${cgst.toFixed(2)}`;
    document.getElementById("invoiceSgst").textContent = `₹${sgst.toFixed(2)}`;
    checkoutSummaryTotal.textContent = `₹${total.toFixed(2)}`;

    // Add discount/shipping lines to the checkout summary if applicable
    const breakdownEl = document.querySelector('.invoice-breakdown');
    if (breakdownEl) {
        let extraLines = '';
        if (cartDiscount > 0) extraLines += `<div style="display:flex;justify-content:space-between;color:#27ae60;"><span>Coupon (${appliedCoupon.code}):</span><span>-₹${cartDiscount.toFixed(2)}</span></div>`;
        extraLines += `<div style="display:flex;justify-content:space-between;"><span>Shipping:</span><span>${shippingCharge === 0 ? 'FREE' : '₹'+shippingCharge.toFixed(2)}</span></div>`;
        // Reset to just the dynamic lines (subtotal, optional discount, shipping, cgst, sgst)
        breakdownEl.innerHTML = `
            <div style="display:flex;justify-content:space-between;"><span>Subtotal:</span><span id="invoiceSubtotal">₹${cartSubtotal.toFixed(2)}</span></div>
            ${extraLines}
            <div style="display:flex;justify-content:space-between;"><span>CGST (2.5%):</span><span id="invoiceCgst">₹${cgst.toFixed(2)}</span></div>
            <div style="display:flex;justify-content:space-between;"><span>SGST (2.5%):</span><span id="invoiceSgst">₹${sgst.toFixed(2)}</span></div>
        `;
    }

    // Set UPI deep link anchors for specific mobile apps
    const amVal = total.toFixed(2);
    document.getElementById("linkGpay").href = `intent://pay?pa=${paVal}&pn=${pnVal}&am=${amVal}&cu=INR&tn=${tnVal}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;
    document.getElementById("linkPhonepe").href = `intent://pay?pa=${paVal}&pn=${pnVal}&am=${amVal}&cu=INR&tn=${tnVal}#Intent;scheme=upi;package=com.phonepe.app;end`;
    document.getElementById("linkPaytm").href = `intent://pay?pa=${paVal}&pn=${pnVal}&am=${amVal}&cu=INR&tn=${tnVal}#Intent;scheme=upi;package=net.one97.paytm;end`;

    checkoutModal.classList.add("open");
    checkoutOverlay.classList.add("active");
    document.body.style.overflow = "hidden";
    
    // Always start on UPI tab
    switchPaymentMethod('upi');
}

function closeCheckoutModal() {
    if (paymentPollingInterval) {
        clearInterval(paymentPollingInterval);
        paymentPollingInterval = null;
    }
    checkoutModal.classList.remove("open");
    checkoutOverlay.classList.remove("active");
    document.body.style.overflow = ""; // unlock page scroll
}

// Shipping form submit transition to Step 2
function handleShippingSubmit(e) {
    e.preventDefault();

    // Store details locally
    shippingDetails = {
        name: document.getElementById("checkoutName").value,
        email: document.getElementById("checkoutEmail").value,
        mobile: document.getElementById("checkoutMobile").value,
        address: document.getElementById("checkoutAddress").value
    };

    // Transition to Step 2 Payment
    document.getElementById("checkoutStepShipping").style.display = "none";
    document.getElementById("checkoutStepPayment").style.display = "block";
    
    // Update step indicators
    document.getElementById("step1Indicator").style.color = "var(--text-secondary)";
    document.getElementById("step1Indicator").style.borderBottom = "none";
    document.getElementById("step2Indicator").style.color = "var(--accent-color)";
    document.getElementById("step2Indicator").style.borderBottom = "2px solid var(--accent-color)";

    // Reset status UI elements
    document.getElementById("paymentStatusTitle").textContent = "Awaiting Payment...";
    document.getElementById("paymentStatusDesc").textContent = "Please scan the QR code to pay or use the simulator.";
    document.getElementById("paymentStatusSpinner").style.display = "block";
    document.getElementById("btnOpenGateway").style.display = "inline-flex";
    document.getElementById("localOfflineSimBox").style.display = "none";

    // Initiate payment transaction
    initiatePaymentTransaction();
}

// Copy UPI ID to Clipboard
function copyUpiId() {
    const upiId = document.getElementById("upiIdText").textContent;
    navigator.clipboard.writeText(upiId).then(() => {
        showToast("UPI ID Copied to Clipboard!", "fa-circle-check");
    }).catch(err => {
        console.error("Copy failed", err);
    });
}

// Initiate payment transaction on backend
function initiatePaymentTransaction() {
    const amount = orderTotals.total;
    
    // Set loading txn state
    document.getElementById("paymentTxnIdText").textContent = "Generating...";
    
    fetch("/api/payments/initiate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ amount: amount })
    })
    .then(res => {
        if (res.ok) {
            return res.json();
        }
        throw new Error("Initiate API failed with status: " + res.status);
    })
    .then(data => {
        currentTransactionId = data.transactionId;
        document.getElementById("paymentTxnIdText").textContent = currentTransactionId;
        
        // Update simulation link
        document.getElementById("btnOpenGateway").href = `payment_gateway.html?txnId=${currentTransactionId}&amount=${amount.toFixed(2)}&isTest=${isTestMode}`;
        
        // Start polling payment status from backend
        startPaymentStatusPolling();
    })
    .catch(err => {
        console.warn("Could not contact payment API. Switching to Offline Sandbox Mode:", err);
        
        // Offline Fallback Mode
        currentTransactionId = "TXN-LOCAL-" + Math.floor(100000 + Math.random() * 900000);
        document.getElementById("paymentTxnIdText").textContent = currentTransactionId;
        
        // Hide online gateway button, show offline bypass simulation button
        document.getElementById("btnOpenGateway").style.display = "none";
        document.getElementById("localOfflineSimBox").style.display = "block";
        
        // Start local storage polling
        startLocalPaymentStatusPolling();
    });
}

// Start polling payment status from backend
function startPaymentStatusPolling() {
    if (paymentPollingInterval) {
        clearInterval(paymentPollingInterval);
    }
    
    paymentPollingInterval = setInterval(() => {
        if (!currentTransactionId) return;
        
        fetch(`/api/payments/status?transactionId=${currentTransactionId}`)
        .then(res => {
            if (res.ok) {
                return res.json();
            }
            throw new Error("Status API failed");
        })
        .then(data => {
            if (data.status === "success") {
                clearInterval(paymentPollingInterval);
                paymentPollingInterval = null;
                
                // Show success in UI
                document.getElementById("paymentStatusTitle").textContent = "Payment Verified!";
                document.getElementById("paymentStatusDesc").textContent = "Creating your order...";
                document.getElementById("paymentStatusSpinner").style.display = "none";
                document.getElementById("btnOpenGateway").style.display = "none";
                
                // Automatically submit the order to backend
                submitOrderToServer("UPI", "Verified UPI (Transaction: " + currentTransactionId + ")", currentTransactionId);
            } else if (data.status === "failed" || data.status === "cancelled") {
                clearInterval(paymentPollingInterval);
                paymentPollingInterval = null;
                
                document.getElementById("paymentStatusTitle").textContent = "Payment Failed";
                document.getElementById("paymentStatusDesc").textContent = "Transaction was " + data.status + ". Please try again.";
                document.getElementById("paymentStatusSpinner").style.display = "none";
                showToast("Payment was not authorized. Status: " + data.status, "fa-circle-xmark");
            }
        })
        .catch(err => {
            console.error("Error polling payment status:", err);
        });
    }, 2000);
}

// Start local storage polling for offline simulation
function startLocalPaymentStatusPolling() {
    if (paymentPollingInterval) {
        clearInterval(paymentPollingInterval);
    }
    
    paymentPollingInterval = setInterval(() => {
        if (!currentTransactionId) return;
        
        const localStatus = localStorage.getItem("sai_sankalp_txn_" + currentTransactionId);
        if (localStatus === "success") {
            clearInterval(paymentPollingInterval);
            paymentPollingInterval = null;
            
            // Show success in UI
            document.getElementById("paymentStatusTitle").textContent = "Local Payment Simulated!";
            document.getElementById("paymentStatusDesc").textContent = "Creating offline order...";
            document.getElementById("paymentStatusSpinner").style.display = "none";
            document.getElementById("localOfflineSimBox").style.display = "none";
            
            // Automatically submit order
            submitOrderToServer("UPI", "Local Offline Simulated (Transaction: " + currentTransactionId + ")", currentTransactionId);
        } else if (localStatus === "failed" || localStatus === "cancelled") {
            clearInterval(paymentPollingInterval);
            paymentPollingInterval = null;
            
            document.getElementById("paymentStatusTitle").textContent = "Local Payment Failed";
            document.getElementById("paymentStatusDesc").textContent = "Local simulation was " + localStatus + ".";
            document.getElementById("paymentStatusSpinner").style.display = "none";
            showToast("Local payment simulation failed.", "fa-circle-xmark");
        }
    }, 2000);
}

// Confirm local sandbox payment click
function handleLocalPaymentConfirm() {
    if (!currentTransactionId) return;
    localStorage.setItem("sai_sankalp_txn_" + currentTransactionId, "success");
    showToast("Payment simulated successfully!", "fa-circle-check");
}

// Current payment method selection (upi | card | cod)
let currentPaymentMethod = 'upi';

function switchPaymentMethod(method) {
    currentPaymentMethod = method;
    // Stop any active polling first
    if (paymentPollingInterval) { clearInterval(paymentPollingInterval); paymentPollingInterval = null; }

    // Toggle panel visibility
    document.getElementById('panelUpi').style.display  = method === 'upi'  ? 'block' : 'none';
    document.getElementById('panelCard').style.display = method === 'card' ? 'block' : 'none';
    document.getElementById('panelCod').style.display  = method === 'cod'  ? 'block' : 'none';

    // Toggle tab styles
    ['upi','card','cod'].forEach(m => {
        const tab = document.getElementById('tab' + m.charAt(0).toUpperCase() + m.slice(1));
        if (!tab) return;
        if (m === method) {
            tab.style.color = 'var(--accent-color)';
            tab.style.borderBottom = '3px solid var(--accent-color)';
        } else {
            tab.style.color = 'var(--text-secondary)';
            tab.style.borderBottom = '3px solid transparent';
        }
    });

    // Initiate payment transaction for UPI and Card
    if (method === 'upi') {
        // Reset UPI status UI
        document.getElementById('paymentStatusTitle').textContent = 'Awaiting Payment...';
        document.getElementById('paymentStatusDesc').textContent = 'Please scan the QR code to pay or use the simulator.';
        document.getElementById('paymentStatusSpinner').style.display = 'block';
        document.getElementById('btnOpenGateway').style.display = 'inline-flex';
        document.getElementById('localOfflineSimBox').style.display = 'none';
        initiatePaymentTransaction();
    } else if (method === 'card') {
        initiateCardPaymentTransaction();
    }
    // COD: no payment initiation needed
}

function submitOrderToServer(paymentMethod, paymentDetails, transactionId) {
    const orderData = {
        customerName: shippingDetails.name,
        customerEmail: shippingDetails.email,
        customerMobile: shippingDetails.mobile,
        customerAddress: shippingDetails.address,
        paymentMethod: paymentMethod,
        paymentDetails: paymentDetails,
        transactionId: transactionId,
        subtotal: orderTotals.subtotal,
        discount: orderTotals.discount || 0,
        couponCode: orderTotals.couponCode || null,
        shipping: orderTotals.shipping || 0,
        cgst: orderTotals.cgst,
        sgst: orderTotals.sgst,
        totalAmount: orderTotals.total,
        items: cart.map(item => ({
            id: item.id,
            title: item.title,
            category: item.categoryName,
            price: item.price,
            quantity: item.quantity
        }))
    };

    fetch("/api/orders", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(orderData)
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        }
        return response.json().then(err => {
            throw new Error(err.error || "Failed to process transaction. Server error.");
        });
    })
    .then(data => {
        showToast(`✅ Order #${data.orderId} placed successfully!`, "fa-circle-check");
        appliedCoupon = null;
        finalizeOrderCompletion();
    })
    .catch(error => {
        addAdminAlert("Payment Failed / Order Rejected ❌", `Email: ${orderData.customerEmail}. Error: ${error.message || error}`, "danger");
        console.error("Order submit failed, simulating offline order:", error);
        
        const orderId = "SS-OFFLINE-" + Math.floor(Math.random() * 1000000);
        
        let localOrders = [];
        const stored = localStorage.getItem(getOrdersStorageKey());
        if (stored) {
            try {
                localOrders = JSON.parse(stored);
            } catch (e) {
                localOrders = [];
            }
        }
        
        // Format timestamp
        const now = new Date();
        const timestamp = now.getFullYear() + "-" + 
            String(now.getMonth() + 1).padStart(2, '0') + "-" + 
            String(now.getDate()).padStart(2, '0') + " " + 
            String(now.getHours()).padStart(2, '0') + ":" + 
            String(now.getMinutes()).padStart(2, '0') + ":" + 
            String(now.getSeconds()).padStart(2, '0');

        localOrders.push({
            orderId: orderId,
            timestamp: timestamp,
            details: orderData
        });
        
        localStorage.setItem(getOrdersStorageKey(), JSON.stringify(localOrders));
        
        showToast(`✅ Order #${orderId} placed (offline mode)!`, "fa-circle-check");
        appliedCoupon = null;
        finalizeOrderCompletion();
    });
}

function finalizeOrderCompletion() {
    cart = [];
    updateCartUI();
    saveCartToLocalStorage();
    
    // Reset transaction state
    currentTransactionId = null;
    if (paymentPollingInterval) {
        clearInterval(paymentPollingInterval);
        paymentPollingInterval = null;
    }

    closeCheckoutModal();
}

// =================================================================
// Authentication & Storefront Administration Logic
// =================================================================

function checkLoginState() {
    currentUserEmail = localStorage.getItem("sai_sankalp_user_email") || "";
    let token = localStorage.getItem("sai_sankalp_session_token") || "";
    userRole = localStorage.getItem("sai_sankalp_user_role") || "customer";

    if (!currentUserEmail) {
        loginModal.classList.add("active");
        document.body.style.overflow = "hidden";
    } else {
        if (currentUserEmail !== "Guest" && !token) {
            loginModal.classList.add("active");
            document.body.style.overflow = "hidden";
        } else {
            handleLoginSuccess(currentUserEmail, userRole);
        }
    }
}

function handleLoginSuccess(email, role = "customer") {
    currentUserEmail = email.trim().toLowerCase();
    if (email.trim() === "Guest" || email.trim() === "guest") {
        currentUserEmail = "Guest";
        role = "customer";
    }

    userRole = role;
    loginModal.classList.remove("active");
    document.body.style.overflow = "";

    isAdmin = (role === "admin");

    if (isAdmin) {
        btnAdminPanel.style.display = "inline-block";
        btnCustomerDashboard.style.display = "none";
        btnSignOut.style.display = "inline-block";
        showToast("Logged in as Administrator ✅", "fa-user-shield");
    } else {
        isAdmin = false;
        btnAdminPanel.style.display = "none";
        btnCustomerDashboard.style.display = (currentUserEmail !== "Guest" && currentUserEmail !== "") ? "inline-block" : "none";
        btnSignOut.style.display = "inline-block";

        // Auto pre-fill checkout email if standard user
        const checkoutEmailField = document.getElementById("checkoutEmail");
        if (checkoutEmailField && currentUserEmail !== "Guest" && currentUserEmail !== "") {
            checkoutEmailField.value = currentUserEmail;
        }

        if (currentUserEmail !== "Guest" && currentUserEmail !== "") {
            showToast(`Logged in: ${currentUserEmail}`, "fa-circle-check");
            syncWishlistFromServer();
        } else {
            showToast("Signed in as Guest", "fa-user");
        }
    }
}

function fetchProducts() {
    const localProducts = localStorage.getItem("sai_sankalp_products");
    
    return fetch("/api/products?_t=" + Date.now())
        .then(res => {
            if (!res.ok) throw new Error("Failed to load catalog");
            return res.json();
        })
        .then(data => {
            PRODUCTS = data;
            localStorage.setItem("sai_sankalp_products", JSON.stringify(PRODUCTS));
            filterAndSortProducts();
            updateWishlistUI();
            
            // Scan for low stock/out of stock warnings
            if (isAdmin) {
                PRODUCTS.forEach(p => {
                    const stk = p.stock !== undefined ? p.stock : 10;
                    if (stk === 0) {
                        addAdminAlert("Sold Out! 🚨", `Product "${p.title}" is completely out of stock.`, "danger");
                    } else if (stk <= 3) {
                        addAdminAlert("Low Stock Warning ⚠️", `Only ${stk} units left of "${p.title}".`, "warning");
                    }
                });
            }

            if (adminDashboard && adminDashboard.classList.contains("active")) {
                renderAdminProductsList();
            }
            return data;
        })
        .catch(err => {
            console.warn("Could not fetch products from server, loading from localStorage/offline seed:", err);
            if (localProducts) {
                try {
                    PRODUCTS = JSON.parse(localProducts);
                } catch (e) {
                    PRODUCTS = [];
                }
            }
            
            if (!PRODUCTS || PRODUCTS.length === 0) {
                PRODUCTS = [
                    {
                        id: 2,
                        title: "Hand-Embroidered Woolen Handkerchief",
                        category: "kerchief",
                        categoryName: "Woolen Handkerchief",
                        price: 320.0,
                        rating: 4.9,
                        reviews: 18,
                        image: "images/wool_kerchief.png",
                        description: "A soft, premium woolen pocket square woven from fine merino wool. Features a delicate, hand-stitched floral emblem on the corner. Soft, warm, and highly functional for cold climates.",
                        specs: {
                          "Dimensions": "30 x 30 cm",
                          "Material": "100% Australian Merino Wool",
                          "Embroidery Yarn": "Organic dyed silk thread",
                          "Care Instructions": "Hand wash cold, dry flat"
                        }
                    },
                    {
                        id: 3,
                        title: "Oliver the Knitted Bear Doll",
                        category: "doll",
                        categoryName: "Woolen Doll",
                        price: 890.0,
                        rating: 5.0,
                        reviews: 32,
                        image: "images/wool_doll.png",
                        description: "Oliver is a lovable, cuddle-ready teddy bear doll hand-knitted from thick, chemical-free wool yarn. Features a cozy red knitted scarf. A wonderful heirloom toy or decorative accent.",
                        specs: {
                          "Height": "25 cm",
                          "Material": "100% Organic Sheep Wool",
                          "Filling": "Hypoallergenic pure cotton fill",
                          "Safety": "Embroidered features (no plastic beads)"
                        }
                    },
                    {
                        id: 4,
                        title: "Quilled Floral Frame Art",
                        category: "paper",
                        categoryName: "Paper Craft",
                        price: 1200.0,
                        rating: 4.7,
                        reviews: 12,
                        image: "images/hero_crafts.png",
                        description: "An intricate shadowbox art frame featuring three-dimensional quilled paper flowers. Meticulously rolled, shaped, and glued by hand using vibrant, fade-resistant artisan paper sheets.",
                        specs: {
                          "Dimensions": "20 x 20 x 3 cm",
                          "Frame": "Sustainable pine wood with safety glass",
                          "Paper": "120 GSM colored acid-free paper",
                          "Mount": "Sawtooth hanger attached on back"
                        }
                    },
                    {
                        id: 5,
                        title: "Sage Lace Woolen Handkerchief",
                        category: "kerchief",
                        categoryName: "Woolen Handkerchief",
                        price: 380.0,
                        rating: 4.6,
                        reviews: 15,
                        image: "images/wool_kerchief.png",
                        description: "Woven wool handkerchief in a rich cream base, framed with hand-crocheted cotton lace borders in sage green. A premium vintage-inspired design that makes a memorable gift.",
                        specs: {
                          "Dimensions": "28 x 28 cm",
                          "Material": "90% Sheep Wool, 10% Cashmere blend",
                          "Lace Border": "100% Crocheted Cotton",
                          "Care Instructions": "Dry clean recommended"
                        }
                    },
                    {
                        id: 6,
                        title: "Crochet Woodland Fawn Doll",
                        category: "doll",
                        categoryName: "Woolen Doll",
                        price: 950.0,
                        rating: 4.9,
                        reviews: 21,
                        image: "images/wool_doll.png",
                        description: "A whimsical woodland fawn, hand-crocheted (amigurumi style) with premium wool-acrylic blended yarn. Stuffed with love, featuring sleepy eyes and a tiny crocheted flower crown.",
                        specs: {
                          "Height": "30 cm",
                          "Material": "60% Alpaca Wool, 40% Soft Acrylic",
                          "Filling": "Recycled eco-fiber stuffing",
                          "Care": "Gently hand wash in lukewarm water"
                        }
                    },
                    {
                        id: 7,
                        title: "Pressed Flower Journal",
                        category: "paper",
                        categoryName: "Paper Craft",
                        price: 650.0,
                        rating: 5.0,
                        reviews: 0,
                        image: "images/paper_journal.png",
                        description: "An elegant, hand-bound diary crafted from recycled cotton rag paper. The cover features real pressed garden wildflowers, beautifully preserved. Ideal for sketching, writing, or pressed flower collections.",
                        specs: {
                          "Material": "Handmade Craft",
                          "Care": "Handle with love"
                        }
                    }
                ];
                localStorage.setItem("sai_sankalp_products", JSON.stringify(PRODUCTS));
            }
            PRODUCTS = PRODUCTS.filter(p => !p.isDeleted);
            filterAndSortProducts();
            updateWishlistUI();
            if (adminDashboard && adminDashboard.classList.contains("active")) {
                renderAdminProductsList();
            }
        });
}

function switchAdminTab(tab) {
    const tabs = {
        orders: { btn: tabAdminOrders, panel: panelAdminOrders },
        products: { btn: tabAdminProducts, panel: panelAdminProducts },
        analytics: { btn: document.getElementById("tabAdminAnalytics"), panel: document.getElementById("panelAdminAnalytics") },
        promo: { btn: document.getElementById("tabAdminPromo"), panel: document.getElementById("panelAdminPromo") }
    };
    
    // Hide all panels & reset styling
    Object.keys(tabs).forEach(k => {
        const item = tabs[k];
        if (item.btn) {
            item.btn.classList.remove("active");
            item.btn.style.color = "var(--text-secondary)";
            item.btn.style.borderBottom = "none";
        }
        if (item.panel) {
            item.panel.style.display = "none";
        }
    });
    
    // Show active panel & styling
    const active = tabs[tab];
    if (active) {
        if (active.btn) {
            active.btn.classList.add("active");
            active.btn.style.color = "var(--accent-color)";
            active.btn.style.borderBottom = "2px solid var(--accent-color)";
        }
        if (active.panel) {
            if (tab === "products") {
                active.panel.style.display = "grid";
            } else {
                active.panel.style.display = "block";
            }
        }
    }
    
    // Refresh tab-specific data
    if (tab === "analytics") {
        refreshAnalyticsTab();
    } else if (tab === "promo") {
        refreshPromoTab();
    } else if (tab === "products") {
        renderAdminProductsList();
        renderAdminCategoryList();
    }
}

function refreshAdminData() {
    fetchOrders();
    renderAdminProductsList();
}

function fetchOrders() {
    fetch("/api/orders?_t=" + Date.now(), {
        headers: {
            "X-Admin-Email": currentUserEmail
        }
    })
    .then(res => {
        if (!res.ok) throw new Error("Unauthorized access to orders");
        return res.json();
    })
    .then(data => {
        allOrders = data;
        localStorage.setItem(getOrdersStorageKey(), JSON.stringify(allOrders));
        renderAdminOrders(allOrders);
        
        // Notify new order if orders count increased
        if (allOrders.length > previousOrdersCount && previousOrdersCount > 0) {
            const lastOrder = allOrders[allOrders.length - 1];
            const details = lastOrder.details || {};
            addAdminAlert("New Order Placed! 🛍️", `Order ID: ${lastOrder.orderId} for ₹${parseFloat(details.totalAmount || 0).toFixed(2)}`, "info");
        }
        previousOrdersCount = allOrders.length;
    })
    .catch(err => {
        console.warn("Could not fetch orders from server, loading from localStorage:", err);
        const stored = localStorage.getItem(getOrdersStorageKey());
        if (stored) {
            try {
                allOrders = JSON.parse(stored);
            } catch (e) {
                allOrders = [];
            }
        } else {
            allOrders = [];
        }
        renderAdminOrders(allOrders);
    });
}

function renderAdminOrders(orders) {
    adminOrdersTableBody.innerHTML = "";
    if (!orders || orders.length === 0) {
        adminOrdersTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:30px; color:var(--text-secondary);">No orders placed yet.</td></tr>`;
        return;
    }

    // Sort by timestamp descending
    const sorted = [...orders].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    sorted.forEach(ord => {
        const det = ord.details;
        let itemsHtml = "";
        if (det.items) {
            itemsHtml = det.items.map(it => `${it.title} (x${it.quantity})`).join("<br>");
        } else {
            itemsHtml = "N/A";
        }

        // Calculate delivery date (+7 days)
        let delivDate = "Pending";
        try {
            const ordDate = new Date(ord.timestamp.replace(" ", "T"));
            ordDate.setDate(ordDate.getDate() + 7);
            const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            delivDate = `${ordDate.getDate()} ${months[ordDate.getMonth()]} ${ordDate.getFullYear()}`;
        } catch(e) {}

        const status = det.status || "Pending";

        const row = document.createElement("tr");
        row.innerHTML = `
            <td style="padding:12px 16px; font-weight:700; color:var(--accent-color);">${ord.orderId}</td>
            <td style="padding:12px 16px;">${ord.timestamp}</td>
            <td style="padding:12px 16px; font-weight:600;">${det.customerName}</td>
            <td style="padding:12px 16px;">${det.customerEmail}</td>
            <td style="padding:12px 16px;">${det.customerMobile}</td>
            <td style="padding:12px 16px; line-height:1.4;">${itemsHtml}</td>
            <td style="padding:12px 16px; font-weight:700;">₹${parseFloat(det.totalAmount).toFixed(2)}</td>
            <td style="padding:12px 16px; font-weight:600; color:var(--secondary-color);">${delivDate}</td>
            <td style="padding:12px 16px; font-size:0.8rem; max-width:200px; line-height:1.4;">${det.customerAddress}</td>
            <td style="padding:12px 16px;">
                <div style="display: flex; flex-direction: column; gap: 8px; align-items: center;">
                    <div style="display: flex; gap: 4px; align-items: center;">
                        <span style="font-size: 0.75rem; font-weight: bold; color: var(--text-secondary);">Status:</span>
                        <select class="admin-status-select" data-order-id="${ord.orderId}" onchange="changeOrderStatus('${ord.orderId}', this.value)" style="padding:4px; font-size:0.75rem; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-primary); cursor:pointer;">
                            <option value="Pending" ${status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="Confirmed" ${status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                            <option value="Processing" ${status === 'Processing' ? 'selected' : ''}>Processing</option>
                            <option value="Shipped" ${status === 'Shipped' ? 'selected' : ''}>Shipped</option>
                            <option value="Out for Delivery" ${status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
                            <option value="Delivered" ${status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                            <option value="Cancelled" ${status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                            <option value="Refunded" ${status === 'Refunded' ? 'selected' : ''}>Refunded</option>
                        </select>
                    </div>
                    <div style="display: flex; gap: 4px; justify-content: center; flex-wrap: wrap;">
                        <button class="btn btn-secondary" onclick="viewOrderDetails('${ord.orderId}')" style="padding: 4px 8px; font-size: 0.72rem; cursor: pointer; border-radius: 4px;" title="View Details & Print Invoice"><i class="fa-solid fa-eye"></i> View</button>
                        <button class="btn btn-secondary" onclick="markAsDelivered('${ord.orderId}')" style="padding: 4px 8px; font-size: 0.72rem; cursor: pointer; border-radius: 4px; color: var(--success-color);" title="Mark as Delivered"><i class="fa-solid fa-circle-check"></i> Deliver</button>
                        <button class="btn btn-secondary" onclick="resendOrderEmail('${ord.orderId}')" style="padding: 4px 8px; font-size: 0.72rem; cursor: pointer; border-radius: 4px;" title="Resend Status Email"><i class="fa-solid fa-envelope"></i> Resend</button>
                        <button class="btn btn-danger" onclick="deleteOrder('${ord.orderId}')" style="padding: 4px 8px; font-size: 0.72rem; cursor: pointer; border-radius: 4px; background: var(--accent-color); color: white; border: none;" title="Permanently Delete Order"><i class="fa-solid fa-trash"></i> Delete</button>
                    </div>
                </div>
            </td>
        `;
        adminOrdersTableBody.appendChild(row);
    });
}

function filterAdminOrders() {
    const q = adminOrderSearch.value.trim().toLowerCase();
    if (!q) {
        renderAdminOrders(allOrders);
        return;
    }

    const filtered = allOrders.filter(ord => {
        const idMatch = ord.orderId.toLowerCase().includes(q);
        const nameMatch = ord.details.customerName.toLowerCase().includes(q);
        const emailMatch = ord.details.customerEmail.toLowerCase().includes(q);
        const addrMatch = ord.details.customerAddress.toLowerCase().includes(q);
        return idMatch || nameMatch || emailMatch || addrMatch;
    });

    renderAdminOrders(filtered);
}

function renderAdminProductsList() {
    adminProductsList.innerHTML = "";
    if (!PRODUCTS || PRODUCTS.length === 0) {
        adminProductsList.innerHTML = `<p style="color:var(--text-secondary); text-align:center; padding:20px;">No products in catalog.</p>`;
        return;
    }

    PRODUCTS.forEach(p => {
        const item = document.createElement("div");
        item.className = "admin-products-list-item";
        item.setAttribute("data-product-id", p.id);
        item.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <img src="${p.image}" alt="${p.title}" style="width:50px; height:50px; object-fit:cover; border-radius:6px; border:1px solid var(--border-color);">
                <div>
                    <h4 style="margin:0; font-size:0.95rem; font-family:var(--font-body);">${p.title}</h4>
                    <span style="font-size:0.8rem; color:var(--text-secondary);">${p.categoryName} — ₹${p.price.toFixed(2)}</span>
                </div>
            </div>
            <div style="display:flex; gap:8px;">
                <button type="button" class="btn btn-secondary admin-edit-stock-btn" data-id="${p.id}"
                    style="padding:6px 10px; font-size:0.8rem; border-color:var(--accent-color); color:var(--accent-color); background:none; cursor:pointer;">
                    <i class="fa-solid fa-pen-to-square"></i> Stock: ${p.stock !== undefined ? p.stock : 10}
                </button>
                <button type="button" class="btn btn-secondary admin-delete-btn" data-id="${p.id}"
                    style="padding:6px 10px; font-size:0.8rem; border-color:#d9534f; color:#d9534f; background:none; cursor:pointer;">
                    <i class="fa-solid fa-trash-can"></i> Delete
                </button>
            </div>
        `;

        // Attach listeners directly
        const deleteBtn = item.querySelector(".admin-delete-btn");
        deleteBtn.addEventListener("click", () => deleteProduct(p.id));

        const editStockBtn = item.querySelector(".admin-edit-stock-btn");
        editStockBtn.addEventListener("click", () => editProductStock(p));

        adminProductsList.appendChild(item);
    });
}

function deleteProduct(id) {
    if (!isAdmin) {
        showToast("Admin access required to delete products.", "fa-circle-exclamation");
        return;
    }

    if (!confirm("Are you sure you want to permanently delete this product from the store?")) return;

    const row = adminProductsList.querySelector(`[data-product-id="${id}"]`);
    if (row) row.style.opacity = "0.4";

    fetch(`/api/products?id=${id}&_t=` + Date.now(), {
        method: "DELETE",
        headers: {
            "X-Admin-Email": currentUserEmail
        }
    })
    .then(res => {
        if (!res.ok) {
            const err = new Error("Delete product failed with status " + res.status);
            err.status = res.status;
            throw err;
        }
        return res.json();
    })
    .then(data => {
        showToast("Product deleted successfully!", "fa-trash-can");
        return fetchProducts();
    })
    .catch(err => {
        if (err.status === 403 || err.status === 401 || err.status === 400) {
            console.error("Delete error:", err);
            if (row) row.style.opacity = "1";
            showToast("Failed to delete product: Admin unauthorized or bad request.", "fa-circle-exclamation");
            return;
        }
        console.warn("Delete API failed, falling back to local simulation:", err);
        let localProducts = [];
        const stored = localStorage.getItem("sai_sankalp_products");
        if (stored) {
            try {
                localProducts = JSON.parse(stored);
            } catch (e) {
                localProducts = [...PRODUCTS];
            }
        } else {
            localProducts = [...PRODUCTS];
        }

        const pIndex = localProducts.findIndex(p => p.id === id);
        if (pIndex !== -1) {
            localProducts[pIndex].isDeleted = true;
            localProducts[pIndex].deletedBy = currentUserEmail || "system";
            localProducts[pIndex].deletedAt = new Date().toISOString();
        } else {
            localProducts = localProducts.filter(p => p.id !== id);
        }

        localStorage.setItem("sai_sankalp_products", JSON.stringify(localProducts));
        PRODUCTS = localProducts.filter(p => !p.isDeleted);
        
        renderProducts("all");
        renderAdminProductsList();
        showToast("Product deleted successfully (offline mode)!", "fa-trash-can");
    });
}

async function handleAddProductSubmit(e) {
    e.preventDefault();

    if (!isAdmin) {
        showToast("Admin access required to add products.", "fa-circle-exclamation");
        return;
    }

    const title       = document.getElementById("prodTitle").value.trim();
    const category    = document.getElementById("prodCategory").value;
    const price       = parseFloat(document.getElementById("prodPrice").value);
    const stock       = parseInt(document.getElementById("prodStock").value) || 10;
    const description = document.getElementById("prodDescription").value.trim();
    const imageFileEl = document.getElementById("prodImageFile");
    const imageFile   = imageFileEl ? imageFileEl.files[0] : null;

    if (!title || !category || isNaN(price) || price <= 0 || !description) {
        showToast("Please fill in all product details.", "fa-circle-exclamation");
        return;
    }
    if (!imageFile) {
        showToast("Please select a product image to upload.", "fa-circle-exclamation");
        return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(imageFile.type)) {
        showToast("Only JPG, PNG, WEBP or GIF images are allowed.", "fa-circle-exclamation");
        return;
    }
    if (imageFile.size > 5 * 1024 * 1024) {
        showToast("Image is too large. Maximum allowed size is 5 MB.", "fa-circle-exclamation");
        return;
    }

    const submitBtn = adminAddProductForm.querySelector("button[type='submit']");
    const resetBtn  = () => {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-plus"></i> Add Product to Store`;
        }
    };
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Uploading image...`;
    }

    try {
        let imagePath = "";
        try {
            const formData = new FormData();
            formData.append("image", imageFile);

            const uploadRes = await fetch("/api/upload?_t=" + Date.now(), {
                method: "POST",
                headers: { "X-Admin-Email": currentUserEmail },
                body: formData
            });

            if (!uploadRes.ok) {
                const err = new Error("Upload failed with status " + uploadRes.status);
                err.status = uploadRes.status;
                throw err;
            }

            const uploadData = await uploadRes.json();
            imagePath = uploadData.imagePath;
        } catch (uploadErr) {
            if (uploadErr.status === 403 || uploadErr.status === 401 || uploadErr.status === 400) {
                throw uploadErr;
            }
            console.warn("Server image upload failed, converting to local Base64 URL:", uploadErr);
            imagePath = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(imageFile);
            });
        }

        if (submitBtn) submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Saving product...`;

        let addSuccess = false;
        let finalProductObj = null;

        try {
            const newProduct = { title, category, price, stock, image: imagePath, description };

            const addRes = await fetch("/api/products?_t=" + Date.now(), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Admin-Email": currentUserEmail
                },
                body: JSON.stringify(newProduct)
            });

            if (!addRes.ok) {
                const err = new Error("Add product failed with status " + addRes.status);
                err.status = addRes.status;
                throw err;
            }

            finalProductObj = await addRes.json();
            addSuccess = true;
        } catch (addErr) {
            if (addErr.status === 403 || addErr.status === 401 || addErr.status === 400) {
                throw addErr;
            }
            console.warn("Server product addition failed, falling back to local simulation:", addErr);
            
            let localProducts = [];
            const stored = localStorage.getItem("sai_sankalp_products");
            if (stored) {
                try {
                    localProducts = JSON.parse(stored);
                } catch (e) {
                    localProducts = [...PRODUCTS];
                }
            } else {
                localProducts = [...PRODUCTS];
            }

            const maxId = localProducts.length > 0 ? Math.max(...localProducts.map(p => p.id)) : 0;
            const newId = maxId + 1;

            const catMap = {
                "paper": "Paper Craft",
                "kerchief": "Woolen Handkerchief",
                "doll": "Woolen Doll"
            };
            const categoryName = catMap[category] || "Handmade Craft";

            finalProductObj = {
                id: newId,
                title: title,
                category: category,
                categoryName: categoryName,
                price: price,
                stock: stock,
                rating: 5.0,
                reviews: 0,
                image: imagePath,
                description: description,
                specs: {
                    "Material": "Handmade Craft",
                    "Care": "Handle with love"
                },
                addedBy: currentUserEmail || "system",
                addedAt: new Date().toISOString(),
                deletedBy: null,
                deletedAt: null,
                isDeleted: false
            };

            localProducts.push(finalProductObj);
            localStorage.setItem("sai_sankalp_products", JSON.stringify(localProducts));
            PRODUCTS = localProducts.filter(p => !p.isDeleted);
            
            filterAndSortProducts();
            renderAdminProductsList();
            addSuccess = true;
        }

        if (addSuccess) {
            showToast(`"${finalProductObj.title || title}" added successfully!`, "fa-circle-check");
            adminAddProductForm.reset();
            const previewWrapper = document.getElementById("prodImagePreviewWrapper");
            const preview        = document.getElementById("prodImagePreview");
            const dropLabel      = document.getElementById("prodImageDropLabel");
            const fileName       = document.getElementById("prodImageFileName");
            if (previewWrapper) previewWrapper.style.display = "none";
            if (preview) preview.src = "";
            if (dropLabel) { dropLabel.style.borderColor = ""; dropLabel.style.background = ""; }
            if (fileName) fileName.textContent = "";

            if (imageFileEl) imageFileEl.value = "";

            await fetchProducts();
        }

    } catch (err) {
        console.error("Add product error:", err);
        showToast(err.message || "Failed to add product. Please try again.", "fa-circle-exclamation");
    } finally {
        resetBtn();
    }
}

// Expose actions globally for HTML onclick events
window.changeOrderStatus = changeOrderStatus;
window.markAsDelivered = markAsDelivered;
window.resendOrderEmail = resendOrderEmail;
window.deleteOrder = deleteOrder;
window.viewOrderDetails = viewOrderDetails;

async function changeOrderStatus(orderId, status) {
    try {
        const response = await fetch("/api/orders/update-status", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Admin-Email": currentUserEmail
            },
            body: JSON.stringify({ orderId, status })
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Failed to update order status");
        }
        showToast(`Order status updated to "${status}"`, "fa-circle-check");
        fetchOrders();
    } catch (err) {
        console.warn("Could not update order status on server, updating locally:", err);
        // Offline Fallback
        const idx = allOrders.findIndex(o => o.orderId === orderId);
        if (idx !== -1) {
            allOrders[idx].details.status = status;
            localStorage.setItem(getOrdersStorageKey(), JSON.stringify(allOrders));
            renderAdminOrders(allOrders);
            showToast(`Order status updated locally (Offline Sandbox) to "${status}"`, "fa-circle-check");
        } else {
            showToast("Order not found.", "fa-circle-exclamation");
        }
    }
}

function markAsDelivered(orderId) {
    changeOrderStatus(orderId, "Delivered");
}

async function resendOrderEmail(orderId) {
    try {
        const response = await fetch("/api/orders/resend-email", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Admin-Email": currentUserEmail
            },
            body: JSON.stringify({ orderId })
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Failed to resend email");
        }
        showToast("Order email resent successfully!", "fa-circle-check");
    } catch (err) {
        console.warn("Could not resend email on server:", err);
        showToast("Email resend simulation completed (Offline Sandbox)", "fa-circle-check");
    }
}

async function deleteOrder(orderId) {
    const isTest = isTestMode || (orderId && orderId.startsWith("SS-TEST-"));
    if (!isTest) {
        if (!confirm(`Are you sure you want to permanently delete order ${orderId}? This action cannot be undone.`)) {
            return;
        }
    }
    try {
        const response = await fetch(`/api/orders?orderId=${orderId}`, {
            method: "DELETE",
            headers: {
                "X-Admin-Email": currentUserEmail
            }
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Failed to delete order");
        }
        showToast(`Order ${orderId} permanently deleted.`, "fa-circle-check");
        fetchOrders();
    } catch (err) {
        console.warn("Could not delete order on server, deleting locally:", err);
        // Offline Fallback
        const idx = allOrders.findIndex(o => o.orderId === orderId);
        if (idx !== -1) {
            allOrders.splice(idx, 1);
            localStorage.setItem(getOrdersStorageKey(), JSON.stringify(allOrders));
            renderAdminOrders(allOrders);
            showToast(`Order ${orderId} deleted locally (Offline Sandbox).`, "fa-circle-check");
        } else {
            showToast("Order not found.", "fa-circle-exclamation");
        }
    }
}

function viewOrderDetails(orderId) {
    const ord = allOrders.find(o => o.orderId === orderId);
    if (!ord) {
        showToast("Order details not found.", "fa-circle-exclamation");
        return;
    }

    const det = ord.details;
    
    // Populate details fields
    document.getElementById("invOrderId").textContent = ord.orderId;
    document.getElementById("invOrderDate").textContent = ord.timestamp;
    document.getElementById("invCustName").textContent = det.customerName;
    document.getElementById("invCustEmail").textContent = det.customerEmail;
    document.getElementById("invCustMobile").textContent = det.customerMobile;
    document.getElementById("invSubtotal").textContent = `₹${parseFloat(det.subtotal).toFixed(2)}`;
    document.getElementById("invCgst").textContent = `₹${parseFloat(det.cgst).toFixed(2)}`;
    document.getElementById("invSgst").textContent = `₹${parseFloat(det.sgst).toFixed(2)}`;
    document.getElementById("invTotal").textContent = `₹${parseFloat(det.totalAmount).toFixed(2)}`;
    document.getElementById("invShippingAddr").textContent = det.customerAddress;
    document.getElementById("invPayMode").textContent = det.paymentMethod || "UPI";
    document.getElementById("invPayStatus").textContent = "Paid (Verified)";
    document.getElementById("invPayTxnId").textContent = det.transactionId || "N/A";

    // Populate items list in invoice
    const invItemsBody = document.getElementById("invItemsBody");
    invItemsBody.innerHTML = "";
    if (det.items) {
        det.items.forEach(it => {
            const tr = document.createElement("tr");
            tr.style.borderBottom = "1px solid var(--border-color)";
            tr.innerHTML = `
                <td style="padding: 8px 0; font-weight: 500;">${it.title}</td>
                <td style="padding: 8px 0; text-align: right;">₹${parseFloat(it.price).toFixed(2)}</td>
                <td style="padding: 8px 0; text-align: center;">${it.quantity}</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">₹${(parseFloat(it.price) * it.quantity).toFixed(2)}</td>
            `;
            invItemsBody.appendChild(tr);
        });
    }

    // Set order tracking visual state
    const status = det.status || "Pending";
    const specialAlert = document.getElementById("specialStatusAlert");
    const specialText = document.getElementById("specialStatusText");
    const trackingLine = document.getElementById("trackingLineProgress");

    // Remove active and completed classes first
    const nodes = ["nodePending", "nodeConfirmed", "nodeProcessing", "nodeShipped", "nodeDelivered"];
    nodes.forEach(id => {
        const node = document.getElementById(id);
        if (node) {
            node.classList.remove("completed", "active");
        }
    });

    if (status === "Cancelled" || status === "Refunded") {
        specialAlert.style.display = "block";
        specialText.textContent = status;
        trackingLine.style.width = "0%";
    } else {
        specialAlert.style.display = "none";
        
        let width = "0%";
        if (status === "Pending") {
            width = "0%";
            document.getElementById("nodePending").classList.add("active");
        } else if (status === "Confirmed") {
            width = "25%";
            document.getElementById("nodePending").classList.add("completed");
            document.getElementById("nodeConfirmed").classList.add("active");
        } else if (status === "Processing") {
            width = "50%";
            document.getElementById("nodePending").classList.add("completed");
            document.getElementById("nodeConfirmed").classList.add("completed");
            document.getElementById("nodeProcessing").classList.add("active");
        } else if (status === "Shipped") {
            width = "75%";
            document.getElementById("nodePending").classList.add("completed");
            document.getElementById("nodeConfirmed").classList.add("completed");
            document.getElementById("nodeProcessing").classList.add("completed");
            document.getElementById("nodeShipped").classList.add("active");
        } else if (status === "Out for Delivery") {
            width = "85%";
            document.getElementById("nodePending").classList.add("completed");
            document.getElementById("nodeConfirmed").classList.add("completed");
            document.getElementById("nodeProcessing").classList.add("completed");
            document.getElementById("nodeShipped").classList.add("completed");
            document.getElementById("nodeShipped").classList.add("active");
        } else if (status === "Delivered") {
            width = "100%";
            document.getElementById("nodePending").classList.add("completed");
            document.getElementById("nodeConfirmed").classList.add("completed");
            document.getElementById("nodeProcessing").classList.add("completed");
            document.getElementById("nodeShipped").classList.add("completed");
            document.getElementById("nodeDelivered").classList.add("completed");
        }
        
        trackingLine.style.width = width;
    }

    // Track which order is open
    currentViewingOrderId = orderId;

    // Toggle customer action button visibility based on role and status
    const customerActionsDiv = document.getElementById('customerInvoiceActions');
    if (customerActionsDiv) {
        if (!isAdmin && currentUserEmail && currentUserEmail !== 'Guest') {
            customerActionsDiv.style.display = 'flex';
            // Cancel button: only for Pending/Confirmed
            const btnCancel = document.getElementById('btnCustomerCancelOrder');
            if (btnCancel) {
                const canCancel = ['Pending', 'Confirmed'].includes(status);
                btnCancel.style.display = canCancel ? 'inline-flex' : 'none';
            }
            // Return button: only for Delivered
            const btnReturn = document.getElementById('btnCustomerReturnOrder');
            if (btnReturn) {
                btnReturn.style.display = (status === 'Delivered') ? 'inline-flex' : 'none';
            }
            // Refund button: only for Delivered or Cancelled
            const btnRefund = document.getElementById('btnCustomerRefundOrder');
            if (btnRefund) {
                const canRefund = ['Delivered', 'Cancelled'].includes(status);
                btnRefund.style.display = canRefund ? 'inline-flex' : 'none';
            }
        } else {
            customerActionsDiv.style.display = 'none'; // Admin doesn't see customer actions
        }
    }

    orderDetailsModal.style.display = "flex";
    document.body.style.overflow = "hidden";
}

function openCustomerDashboard() {
    document.getElementById("customerDashboardEmail").textContent = currentUserEmail;
    fetchOrders().then(() => {
        renderCustomerOrders();
    }).catch(() => {
        renderCustomerOrders();
    });
    loadSavedAddresses();
}

// =================================================================
// Card Payment Flow
// =================================================================

let cardTransactionId = null;
let cardPollingInterval = null;

function initiateCardPaymentTransaction() {
    const amount = orderTotals.total;
    document.getElementById('cardTxnIdText').textContent = 'Generating...';
    document.getElementById('cardPayStatusTitle').textContent = 'Awaiting Card Payment...';
    document.getElementById('cardPayStatusDesc').textContent = 'Use the gateway to complete card payment.';
    document.getElementById('cardPayStatusSpinner').style.display = 'block';
    document.getElementById('btnOpenCardGateway').style.display = 'inline-flex';
    document.getElementById('cardOfflineSimBox').style.display = 'none';

    fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
    })
    .then(res => { if (res.ok) return res.json(); throw new Error('Initiate API failed'); })
    .then(data => {
        cardTransactionId = data.transactionId;
        document.getElementById('cardTxnIdText').textContent = cardTransactionId;
        document.getElementById('btnOpenCardGateway').href = `payment_gateway.html?txnId=${cardTransactionId}&amount=${amount.toFixed(2)}&isTest=${isTestMode}`;
        startCardPaymentStatusPolling();
    })
    .catch(err => {
        console.warn('Card API offline. Switching to offline sandbox:', err);
        cardTransactionId = 'TXN-CARD-' + Math.floor(100000 + Math.random() * 900000);
        document.getElementById('cardTxnIdText').textContent = cardTransactionId;
        document.getElementById('btnOpenCardGateway').style.display = 'none';
        document.getElementById('cardOfflineSimBox').style.display = 'block';
        startCardLocalPaymentStatusPolling();
    });
}

function startCardPaymentStatusPolling() {
    if (cardPollingInterval) clearInterval(cardPollingInterval);
    cardPollingInterval = setInterval(() => {
        if (!cardTransactionId) return;
        fetch(`/api/payments/status?transactionId=${cardTransactionId}`)
        .then(res => { if (res.ok) return res.json(); throw new Error('Status API failed'); })
        .then(data => {
            if (data.status === 'success') {
                clearInterval(cardPollingInterval); cardPollingInterval = null;
                document.getElementById('cardPayStatusTitle').textContent = 'Card Payment Verified!';
                document.getElementById('cardPayStatusDesc').textContent = 'Creating your order...';
                document.getElementById('cardPayStatusSpinner').style.display = 'none';
                document.getElementById('btnOpenCardGateway').style.display = 'none';
                submitOrderToServer('Card', 'Verified Card (Transaction: ' + cardTransactionId + ')', cardTransactionId);
            } else if (data.status === 'failed' || data.status === 'cancelled') {
                clearInterval(cardPollingInterval); cardPollingInterval = null;
                document.getElementById('cardPayStatusTitle').textContent = 'Card Payment Failed';
                document.getElementById('cardPayStatusDesc').textContent = 'Transaction was ' + data.status + '. Please retry.';
                document.getElementById('cardPayStatusSpinner').style.display = 'none';
                showToast('Card payment not authorized: ' + data.status, 'fa-circle-xmark');
            }
        })
        .catch(err => console.error('Card payment polling error:', err));
    }, 2000);
}

function startCardLocalPaymentStatusPolling() {
    if (cardPollingInterval) clearInterval(cardPollingInterval);
    cardPollingInterval = setInterval(() => {
        if (!cardTransactionId) return;
        const localStatus = localStorage.getItem('sai_sankalp_txn_' + cardTransactionId);
        if (localStatus === 'success') {
            clearInterval(cardPollingInterval); cardPollingInterval = null;
            document.getElementById('cardPayStatusTitle').textContent = 'Card Payment Simulated!';
            document.getElementById('cardPayStatusDesc').textContent = 'Creating offline order...';
            document.getElementById('cardPayStatusSpinner').style.display = 'none';
            document.getElementById('cardOfflineSimBox').style.display = 'none';
            submitOrderToServer('Card', 'Local Offline Card (Transaction: ' + cardTransactionId + ')', cardTransactionId);
        } else if (localStatus === 'failed' || localStatus === 'cancelled') {
            clearInterval(cardPollingInterval); cardPollingInterval = null;
            document.getElementById('cardPayStatusTitle').textContent = 'Card Payment Failed';
            document.getElementById('cardPayStatusDesc').textContent = 'Local simulation was ' + localStatus;
            document.getElementById('cardPayStatusSpinner').style.display = 'none';
            showToast('Local card payment simulation failed.', 'fa-circle-xmark');
        }
    }, 2000);
}

function handleCardLocalPaymentConfirm() {
    if (!cardTransactionId) return;
    localStorage.setItem('sai_sankalp_txn_' + cardTransactionId, 'success');
    showToast('Card payment simulated successfully!', 'fa-circle-check');
}

// =================================================================
// COD Order Handler
// =================================================================

function handleCODOrder() {
    if (!shippingDetails) {
        showToast('Please fill in your shipping details first.', 'fa-circle-exclamation');
        return;
    }

    const btn = document.getElementById('btnConfirmCod');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Placing Order...'; }

    // COD doesn't need a real transaction — create a local COD txn ID
    const codTxnId = 'COD-' + Math.floor(100000 + Math.random() * 900000);
    const orderData = {
        customerName: shippingDetails.name,
        customerEmail: shippingDetails.email,
        customerMobile: shippingDetails.mobile,
        customerAddress: shippingDetails.address,
        paymentMethod: 'COD',
        paymentDetails: 'Cash on Delivery — Pay on arrival',
        transactionId: codTxnId,
        subtotal: orderTotals.subtotal,
        discount: orderTotals.discount || 0,
        couponCode: orderTotals.couponCode || null,
        shipping: (orderTotals.shipping || 0) + 25, // COD handling fee
        cgst: orderTotals.cgst,
        sgst: orderTotals.sgst,
        totalAmount: orderTotals.total + 25, // COD fee added
        isCOD: true,
        items: cart.map(item => ({
            id: item.id,
            title: item.title,
            category: item.categoryName,
            price: item.price,
            quantity: item.quantity
        }))
    };

    // For COD, we skip payment verification and create order directly (COD transactions are a special case)
    // The backend should allow COD orders. We use a local fallback if server not available.
    const orderId = 'SS-COD-' + Math.floor(Math.random() * 1000000);
    let localOrders = [];
    const stored = localStorage.getItem(getOrdersStorageKey());
    if (stored) { try { localOrders = JSON.parse(stored); } catch(e) { localOrders = []; } }

    const now = new Date();
    const timestamp = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0') + ' ' +
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0') + ':' +
        String(now.getSeconds()).padStart(2, '0');

    localOrders.push({ orderId, timestamp, details: orderData });
    localStorage.setItem(getOrdersStorageKey(), JSON.stringify(localOrders));

    showToast(`✅ COD Order #${orderId} placed! Pay on delivery.`, 'fa-handshake');
    appliedCoupon = null;
    finalizeOrderCompletion();

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-handshake"></i> Confirm COD Order'; }
}

// =================================================================
// Invoice Download
// =================================================================

let currentViewingOrderId = null; // Track which order is open in the modal

function downloadInvoice() {
    const ord = allOrders.find(o => o.orderId === currentViewingOrderId);
    if (!ord) {
        // Fallback: print
        window.print();
        return;
    }
    const det = ord.details;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const itemRows = (det.items || []).map(it => `
        <tr>
            <td style="padding:6px 0; border-bottom:1px solid #eee;">${it.title}</td>
            <td style="padding:6px 0; border-bottom:1px solid #eee; text-align:right;">&#x20b9;${parseFloat(it.price).toFixed(2)}</td>
            <td style="padding:6px 0; border-bottom:1px solid #eee; text-align:center;">${it.quantity}</td>
            <td style="padding:6px 0; border-bottom:1px solid #eee; text-align:right; font-weight:600;">&#x20b9;${(parseFloat(it.price) * it.quantity).toFixed(2)}</td>
        </tr>
    `).join('');

    const discountRow = det.discount > 0
        ? `<tr><td colspan="3" style="text-align:right;">Discount (${det.couponCode || 'Coupon'}):</td><td style="text-align:right; color:#27ae60;">-&#x20b9;${parseFloat(det.discount).toFixed(2)}</td></tr>` : '';
    const shippingRow = `<tr><td colspan="3" style="text-align:right;">Shipping:</td><td style="text-align:right;">${parseFloat(det.shipping || 0) === 0 ? 'FREE' : '&#x20b9;' + parseFloat(det.shipping || 0).toFixed(2)}</td></tr>`;

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8"><title>Invoice - ${ord.orderId}</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto; color: #333; }
            h1 { color: #8B4513; } h2 { color: #A0522D; font-size: 1rem; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; border-bottom: 2px solid #333; padding: 6px 0; font-size: 0.85rem; }
            .footer { margin-top: 30px; text-align: center; font-size: 0.8rem; color: #888; }
            .total-row td { font-weight: bold; font-size: 1.05rem; color: #8B4513; border-top: 2px solid #333; padding-top: 8px; }
            @media print { body { padding: 20px; } }
        </style>
    </head>
    <body>
        <h1>Sai Sankalp Crafts</h1>
        <p>saisameermarla@gmail.com &nbsp;|&nbsp; +91 9361483584</p>
        <hr>
        <h2>INVOICE #${ord.orderId}</h2>
        <p>Date: ${ord.timestamp} &nbsp;|&nbsp; Status: ${det.status || 'Pending'}</p>
        <p><strong>Bill To:</strong> ${det.customerName} &lt;${det.customerEmail}&gt; | ${det.customerMobile}</p>
        <p><strong>Ship To:</strong> ${det.customerAddress}</p>
        <p><strong>Payment:</strong> ${det.paymentMethod} — Txn: ${det.transactionId || 'N/A'}</p>
        <br>
        <table>
            <thead>
                <tr><th>Item</th><th style="text-align:right;">Price</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Total</th></tr>
            </thead>
            <tbody>${itemRows}</tbody>
            <tfoot>
                <tr><td colspan="3" style="text-align:right; padding-top:8px;">Subtotal:</td><td style="text-align:right; padding-top:8px;">&#x20b9;${parseFloat(det.subtotal).toFixed(2)}</td></tr>
                ${discountRow}
                ${shippingRow}
                <tr><td colspan="3" style="text-align:right;">CGST (2.5%):</td><td style="text-align:right;">&#x20b9;${parseFloat(det.cgst).toFixed(2)}</td></tr>
                <tr><td colspan="3" style="text-align:right;">SGST (2.5%):</td><td style="text-align:right;">&#x20b9;${parseFloat(det.sgst).toFixed(2)}</td></tr>
                <tr class="total-row"><td colspan="3" style="text-align:right;">Total Paid:</td><td style="text-align:right;">&#x20b9;${parseFloat(det.totalAmount).toFixed(2)}</td></tr>
            </tfoot>
        </table>
        <div class="footer">Thank you for shopping with Sai Sankalp Crafts! This is a computer-generated invoice.</div>
    </body>
    </html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice-${ord.orderId}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// =================================================================
// Customer Order Actions (Cancel, Return, Refund)
// =================================================================

function customerCancelOrder() {
    if (!currentViewingOrderId) return;
    const ord = allOrders.find(o => o.orderId === currentViewingOrderId);
    if (!ord) return;
    const status = ord.details.status || 'Pending';
    const cancellableStatuses = ['Pending', 'Confirmed'];
    if (!cancellableStatuses.includes(status)) {
        showToast('Order cannot be cancelled at this stage. Please contact support.', 'fa-circle-exclamation');
        return;
    }
    if (!confirm(`Cancel order ${currentViewingOrderId}? This action cannot be undone.`)) return;
    performCustomerOrderAction(currentViewingOrderId, 'cancel');
}

function customerRequestReturn() {
    if (!currentViewingOrderId) return;
    const ord = allOrders.find(o => o.orderId === currentViewingOrderId);
    if (!ord) return;
    const status = ord.details.status || 'Pending';
    if (status !== 'Delivered') {
        showToast('Return can only be requested for Delivered orders.', 'fa-circle-exclamation');
        return;
    }
    if (!confirm(`Request return for order ${currentViewingOrderId}? Our team will contact you.`)) return;
    performCustomerOrderAction(currentViewingOrderId, 'return');
}

function customerRequestRefund() {
    if (!currentViewingOrderId) return;
    const ord = allOrders.find(o => o.orderId === currentViewingOrderId);
    if (!ord) return;
    const status = ord.details.status || 'Pending';
    const refundableStatuses = ['Delivered', 'Cancelled'];
    if (!refundableStatuses.includes(status)) {
        showToast('Refund can only be requested for Delivered or Cancelled orders.', 'fa-circle-exclamation');
        return;
    }
    if (!confirm(`Request refund for order ${currentViewingOrderId}? Our team will process it within 5-7 business days.`)) return;
    performCustomerOrderAction(currentViewingOrderId, 'refund');
}

async function performCustomerOrderAction(orderId, action) {
    try {
        const response = await fetch('/api/orders/customer-action', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': localStorage.getItem('sai_sankalp_session_token') || ''
            },
            body: JSON.stringify({ orderId, action, customerEmail: currentUserEmail })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Action failed');
        showToast(`Order ${action} request submitted successfully!`, 'fa-circle-check');
        fetchOrders();
    } catch (err) {
        // Offline fallback: update locally
        console.warn('Customer action API failed, updating locally:', err);
        const idx = allOrders.findIndex(o => o.orderId === orderId);
        if (idx !== -1) {
            const statusMap = { cancel: 'Cancelled', return: 'Refunded', refund: 'Refunded' };
            allOrders[idx].details.status = statusMap[action] || allOrders[idx].details.status;
            localStorage.setItem(getOrdersStorageKey(), JSON.stringify(allOrders));
            showToast(`Order ${action} request submitted (offline mode).`, 'fa-circle-check');
            renderCustomerOrders();
        }
    }

    // Close modal
    if (orderDetailsModal) {
        orderDetailsModal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// Expose new globals
window.switchPaymentMethod = switchPaymentMethod;
window.handleCODOrder = handleCODOrder;
window.downloadInvoice = downloadInvoice;
window.customerCancelOrder = customerCancelOrder;
window.customerRequestReturn = customerRequestReturn;
window.customerRequestRefund = customerRequestRefund;

function renderCustomerOrders() {
    const tbody = document.getElementById("customerOrdersTableBody");
    tbody.innerHTML = "";

    const customerOrders = allOrders.filter(ord => {
        const email = (ord.details && ord.details.customerEmail) ? ord.details.customerEmail.trim().toLowerCase() : "";
        return email === currentUserEmail.trim().toLowerCase();
    });

    if (customerOrders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-secondary);">You have not placed any orders yet.</td></tr>`;
        return;
    }

    const sorted = [...customerOrders].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    sorted.forEach(ord => {
        const det = ord.details;
        let itemsHtml = "";
        if (det.items) {
            itemsHtml = det.items.map(it => `${it.title} (x${it.quantity})`).join(", ");
        } else {
            itemsHtml = "N/A";
        }

        let delivDate = "Pending";
        try {
            const ordDate = new Date(ord.timestamp.replace(" ", "T"));
            ordDate.setDate(ordDate.getDate() + 7);
            const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            delivDate = `${ordDate.getDate()} ${months[ordDate.getMonth()]} ${ordDate.getFullYear()}`;
        } catch(e) {}

        const status = det.status || "Pending";
        
        let badgeColor = "#7f8c8d";
        if (status === "Pending") badgeColor = "#e67e22";
        else if (status === "Confirmed") badgeColor = "#3498db";
        else if (status === "Processing") badgeColor = "#9b59b6";
        else if (status === "Shipped" || status === "Out for Delivery") badgeColor = "#2980b9";
        else if (status === "Delivered") badgeColor = "#2ecc71";
        else if (status === "Cancelled" || status === "Refunded") badgeColor = "#e74c3c";

        const canCancel = ['Pending', 'Confirmed'].includes(status);
        const cancelBtn = canCancel
            ? `<button class="btn" onclick="quickCancelOrder('${ord.orderId}')" style="padding:4px 8px; font-size:0.72rem; cursor:pointer; border-radius:4px; border:1px solid #e74c3c; color:#e74c3c; background:none; margin-top:4px;"><i class="fa-solid fa-ban"></i> Cancel</button>`
            : '';

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="padding:12px 16px; font-weight:700; color:var(--accent-color);">${ord.orderId}</td>
            <td style="padding:12px 16px;">${ord.timestamp}</td>
            <td style="padding:12px 16px; font-size:0.85rem; max-width:250px; line-height:1.4;">${itemsHtml}</td>
            <td style="padding:12px 16px; font-weight:700;">₹${parseFloat(det.totalAmount).toFixed(2)}</td>
            <td style="padding:12px 16px;">
                <span style="display:inline-block; padding:4px 8px; border-radius:12px; font-size:0.75rem; font-weight:700; color:white; background-color:${badgeColor};">${status}</span>
            </td>
            <td style="padding:12px 16px; font-weight:600; color:var(--secondary-color);">${delivDate}</td>
            <td style="padding:12px 16px; text-align:center;">
                <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <button class="btn btn-secondary" onclick="viewOrderDetails('${ord.orderId}')" style="padding:4px 10px; font-size:0.75rem; cursor:pointer; border-radius:4px;"><i class="fa-solid fa-file-invoice"></i> Track / Invoice</button>
                    ${cancelBtn}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function quickCancelOrder(orderId) {
    if (!confirm(`Cancel order ${orderId}? This cannot be undone.`)) return;
    const idx = allOrders.findIndex(o => o.orderId === orderId);
    if (idx !== -1) {
        const status = allOrders[idx].details.status || 'Pending';
        if (!['Pending', 'Confirmed'].includes(status)) {
            showToast('Order cannot be cancelled at this stage.', 'fa-circle-exclamation');
            return;
        }
        // Try server first
        performCustomerOrderAction(orderId, 'cancel');
    }
}
window.quickCancelOrder = quickCancelOrder;

// =================================================================
// Advanced Storefront Features Logic
// =================================================================

// 1. Left Sidebar Filters Wiring
function wireSidebarFilters() {
    const sortBy = document.getElementById("filterSortBy");
    const priceSlider = document.getElementById("priceRangeSlider");
    const inStock = document.getElementById("filterInStockOnly");
    
    if (sortBy) sortBy.addEventListener("change", filterAndSortProducts);
    if (priceSlider) {
        priceSlider.addEventListener("input", (e) => {
            const val = e.target.value;
            const maxLabel = document.getElementById("priceRangeMaxLabel");
            if (maxLabel) maxLabel.textContent = `₹${val}`;
            filterAndSortProducts();
        });
    }
    if (inStock) inStock.addEventListener("change", filterAndSortProducts);

    // Categories
    const catAll = document.getElementById("catCheckAll");
    const catChecks = document.querySelectorAll(".category-filter-check");
    catChecks.forEach(cb => {
        cb.addEventListener("change", (e) => {
            if (e.target.id === "catCheckAll") {
                if (e.target.checked) {
                    catChecks.forEach(c => { if (c.id !== "catCheckAll") c.checked = false; });
                }
            } else {
                if (e.target.checked) {
                    if (catAll) catAll.checked = false;
                }
            }
            const checkedCount = Array.from(catChecks).filter(c => c.checked).length;
            if (checkedCount === 0 && catAll) catAll.checked = true;
            filterAndSortProducts();
        });
    });

    // Brands
    const brandAll = document.getElementById("brandCheckAll");
    const brandChecks = document.querySelectorAll(".brand-filter-check");
    brandChecks.forEach(cb => {
        cb.addEventListener("change", (e) => {
            if (e.target.id === "brandCheckAll") {
                if (e.target.checked) {
                    brandChecks.forEach(c => { if (c.id !== "brandCheckAll") c.checked = false; });
                }
            } else {
                if (e.target.checked) {
                    if (brandAll) brandAll.checked = false;
                }
            }
            const checkedCount = Array.from(brandChecks).filter(c => c.checked).length;
            if (checkedCount === 0 && brandAll) brandAll.checked = true;
            filterAndSortProducts();
        });
    });
}

// Helper to deduce Brand/Artisan dynamically based on categories
function getProductBrand(product) {
    if (product.brand) return product.brand;
    if (product.category === 'paper') return 'Sai Sankalp';
    if (product.category === 'doll') return 'Artisan Crafts';
    if (product.category === 'kerchief') return 'Traditional Weavers';
    return 'Sai Sankalp';
}

// Combine all filtering criteria
function filterAndSortProducts() {
    let filtered = [...PRODUCTS];

    // Search query
    const searchVal = document.getElementById("storefrontSearchInput") ? document.getElementById("storefrontSearchInput").value.trim().toLowerCase() : "";
    if (searchVal) {
        filtered = filtered.filter(p => 
            p.title.toLowerCase().includes(searchVal) || 
            p.description.toLowerCase().includes(searchVal) ||
            p.categoryName.toLowerCase().includes(searchVal)
        );
    }

    // Categories
    const catChecks = document.querySelectorAll(".category-filter-check:checked");
    const selectedCats = Array.from(catChecks).map(cb => cb.value);
    if (!selectedCats.includes("all") && selectedCats.length > 0) {
        filtered = filtered.filter(p => selectedCats.includes(p.category));
    }

    // Brand/Artisan
    const brandChecks = document.querySelectorAll(".brand-filter-check:checked");
    const selectedBrands = Array.from(brandChecks).map(cb => cb.value);
    if (!selectedBrands.includes("all") && selectedBrands.length > 0) {
        filtered = filtered.filter(p => selectedBrands.includes(getProductBrand(p)));
    }

    // Price range slider
    const priceSlider = document.getElementById("priceRangeSlider");
    if (priceSlider) {
        const maxPrice = parseFloat(priceSlider.value);
        filtered = filtered.filter(p => p.price <= maxPrice);
    }

    // Availability
    const inStock = document.getElementById("filterInStockOnly");
    if (inStock && inStock.checked) {
        filtered = filtered.filter(p => (p.stock !== undefined ? p.stock : 99) > 0);
    }

    // Sorting
    const sortBy = document.getElementById("filterSortBy") ? document.getElementById("filterSortBy").value : "popularity";
    if (sortBy === "popularity") {
        filtered.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === "price-asc") {
        filtered.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-desc") {
        filtered.sort((a, b) => b.price - a.price);
    } else if (sortBy === "newest") {
        filtered.sort((a, b) => {
            const dateA = a.addedAt ? new Date(a.addedAt) : new Date(0);
            const dateB = b.addedAt ? new Date(b.addedAt) : new Date(0);
            return dateB - dateA;
        });
    }

    // Render filtered list
    renderProducts(filtered);
}

// 2. Wishlist Actions
function toggleWishlist(productId, event) {
    if (event) event.stopPropagation();
    
    const isAdded = !wishlist.includes(productId);
    if (!isAdded) {
        wishlist = wishlist.filter(id => id !== productId);
        showToast("Removed from Wishlist", "fa-heart-crack");
    } else {
        wishlist.push(productId);
        showToast("Added to Wishlist", "fa-heart");
    }
    
    localStorage.setItem('sai_sankalp_wishlist', JSON.stringify(wishlist));
    updateWishlistUI();
    filterAndSortProducts(); // Refresh active classes on heart button
    
    // Sync with backend if logged in
    if (currentUserEmail && currentUserEmail !== "Guest" && currentUserEmail !== "") {
        if (isAdded) {
            fetch('/api/wishlist', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('sai_sankalp_session_token')
                },
                body: JSON.stringify({ productId })
            })
            .catch(err => console.warn("Failed to sync wishlist addition:", err));
        } else {
            fetch(`/api/wishlist?productId=${productId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('sai_sankalp_session_token')
                }
            })
            .catch(err => console.warn("Failed to sync wishlist removal:", err));
        }
    }
}

function updateWishlistUI() {
    const wishlistCount = document.getElementById("wishlistCount");
    if (wishlistCount) wishlistCount.textContent = wishlist.length;

    const listContainer = document.getElementById("wishlistItemsList");
    if (!listContainer) return;

    if (wishlist.length === 0) {
        listContainer.innerHTML = `<p style="padding:15px; color:var(--text-secondary); text-align:center; font-size:0.8rem; margin:0;">Your Wishlist is empty.</p>`;
        return;
    }

    const matchedProducts = wishlist.map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean);
    listContainer.innerHTML = matchedProducts.map(p => `
        <div class="saved-item" style="padding:8px 0; border-bottom:1px solid var(--border-color); display:flex; align-items:center; gap:8px;">
            <img src="${p.image}" alt="${p.title}" style="width:40px; height:40px; object-fit:cover; border-radius:6px;">
            <div style="flex:1; min-width:0; text-align:left;">
                <div style="font-weight:600; font-size:0.8rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-primary);">${p.title}</div>
                <div style="color:var(--accent-color); font-weight:700; font-size:0.78rem;">₹${p.price.toFixed(2)}</div>
            </div>
            <div style="display:flex; flex-direction:column; gap:4px; flex-shrink:0;">
                <button type="button" onclick="addToCart(${p.id}); toggleWishlist(${p.id});" style="padding:4px 8px; font-size:0.7rem; border-radius:4px; background:var(--accent-color); color:#fff; border:none; cursor:pointer; font-weight:600;">Bag</button>
                <button type="button" onclick="toggleWishlist(${p.id})" style="padding:4px 8px; font-size:0.7rem; border-radius:4px; background:none; border:1px solid var(--border-color); color:#e74c3c; cursor:pointer; font-weight:600;"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        </div>
    `).join('');
}

// 3. Product Comparison Drawer
function toggleCompareProduct(productId, event) {
    if (event) event.stopPropagation();

    if (compareList.includes(productId)) {
        compareList = compareList.filter(id => id !== productId);
        showToast("Removed from comparison list", "fa-circle-check");
    } else {
        if (compareList.length >= 3) {
            showToast("You can compare up to 3 products at a time.", "fa-circle-exclamation");
            return;
        }
        compareList.push(productId);
        showToast("Added to comparison list", "fa-circle-check");
    }
    
    updateComparisonDrawer();
    filterAndSortProducts(); // Refresh active compare icon classes
}

function updateComparisonDrawer() {
    const drawer = document.getElementById("comparisonDrawer");
    if (!drawer) return;

    if (compareList.length === 0) {
        drawer.classList.remove("active");
        return;
    }

    drawer.classList.add("active");

    const matched = compareList.map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean);
    const wrapper = document.getElementById("comparisonTableWrapper");
    if (!wrapper) return;

    // Collect all unique specs keys
    const allSpecKeys = new Set();
    matched.forEach(p => {
        if (p.specs) {
            Object.keys(p.specs).forEach(k => allSpecKeys.add(k));
        }
    });

    const columns = matched.map(p => `
        <td>
            <div style="position:relative; display:inline-block;">
                <img src="${p.image}" alt="${p.title}" style="width:70px; height:70px; object-fit:cover; border-radius:8px; border:1px solid var(--border-color); margin-bottom:6px;">
                <button type="button" onclick="toggleCompareProduct(${p.id})" style="position:absolute; top:-6px; right:-6px; background:#e74c3c; color:#fff; border:none; border-radius:50%; width:18px; height:18px; font-size:0.6rem; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <h4 style="font-size:0.8rem; font-weight:600; margin:4px 0; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-primary);">${p.title}</h4>
        </td>
    `).join('');

    const prices = matched.map(p => `<td style="font-weight:700; color:var(--accent-color);">₹${p.price.toFixed(2)}</td>`).join('');
    const categories = matched.map(p => `<td>${p.categoryName}</td>`).join('');
    const brands = matched.map(p => `<td>${getProductBrand(p)}</td>`).join('');
    const ratings = matched.map(p => `<td><i class="fa-solid fa-star" style="color:#f1c40f;"></i> ${p.rating} (${p.reviews} reviews)</td>`).join('');
    const stocks = matched.map(p => {
        const stk = p.stock !== undefined ? p.stock : 99;
        return stk <= 0 
            ? `<td style="color:#e74c3c; font-weight:700;">Out of Stock</td>`
            : stk <= 5 
                ? `<td style="color:#e67e22; font-weight:700;">Low Stock (${stk})</td>`
                : `<td style="color:#2ecc71; font-weight:700;">In Stock (${stk})</td>`;
    }).join('');

    const specRows = Array.from(allSpecKeys).map(key => {
        const cols = matched.map(p => `<td>${(p.specs && p.specs[key]) ? p.specs[key] : '-'}</td>`).join('');
        return `<tr><td style="font-weight:600; background-color:var(--bg-secondary);">${key}</td>${cols}</tr>`;
    }).join('');

    const actions = matched.map(p => {
        const stk = p.stock !== undefined ? p.stock : 99;
        const disabled = stk <= 0 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : '';
        return `
            <td>
                <button type="button" class="btn btn-primary" onclick="addToCart(${p.id}); toggleCompareProduct(${p.id});" style="padding:6px 12px; font-size:0.75rem; font-weight:600; display:inline-flex; align-items:center; gap:4px;" ${disabled}>
                    <i class="fa-solid fa-bag-shopping"></i> Add
                </button>
            </td>
        `;
    }).join('');

    wrapper.innerHTML = `
        <table class="comparison-table">
            <thead>
                <tr>
                    <th style="width:160px; background-color:var(--bg-secondary);">Features</th>
                    ${columns}
                </tr>
            </thead>
            <tbody>
                <tr><td style="font-weight:600; background-color:var(--bg-secondary);">Price</td>${prices}</tr>
                <tr><td style="font-weight:600; background-color:var(--bg-secondary);">Category</td>${categories}</tr>
                <tr><td style="font-weight:600; background-color:var(--bg-secondary);">Artisan</td>${brands}</tr>
                <tr><td style="font-weight:600; background-color:var(--bg-secondary);">Rating</td>${ratings}</tr>
                <tr><td style="font-weight:600; background-color:var(--bg-secondary);">Availability</td>${stocks}</tr>
                ${specRows}
                <tr><td style="font-weight:600; background-color:var(--bg-secondary);">Actions</td>${actions}</tr>
            </tbody>
        </table>
    `;
}

function toggleComparisonDrawer(show) {
    const drawer = document.getElementById("comparisonDrawer");
    if (!drawer) return;
    if (show) drawer.classList.add("active");
    else {
        compareList = [];
        drawer.classList.remove("active");
        filterAndSortProducts(); // Refresh active icons
    }
}

// 4. Product Image Zoom Handlers
function zoomImage(e) {
    const container = e.currentTarget;
    const img = container.querySelector('img');
    if (!img) return;
    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    img.style.transformOrigin = `${x}% ${y}%`;
    img.style.transform = "scale(2)";
}

function resetZoomImage() {
    const img = document.getElementById('zoomImage');
    if (img) {
        img.style.transform = "scale(1)";
        img.style.transformOrigin = "center center";
    }
}

// 5. Review Form Helper Methods
let selectedReviewRating = 5;
function setSelectRating(val) {
    selectedReviewRating = val;
    const stars = document.querySelectorAll(".star-select");
    stars.forEach(star => {
        const starVal = parseInt(star.getAttribute("data-val"));
        if (starVal <= val) {
            star.style.color = "#f1c40f";
        } else {
            star.style.color = "#ccc";
        }
    });
    const ratingInput = document.getElementById("reviewRatingVal");
    if (ratingInput) ratingInput.value = val;
}

function submitProductReview(e, productId) {
    e.preventDefault();
    const authorInput = document.getElementById("reviewAuthor");
    const commentInput = document.getElementById("reviewComment");
    
    if (!authorInput || !commentInput) return;
    
    const author = authorInput.value.trim();
    const comment = commentInput.value.trim();
    const rating = parseInt(document.getElementById("reviewRatingVal").value) || 5;
    
    if (!author || !comment) {
        showToast("Please enter a name and comment.", "fa-circle-exclamation");
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    if (!REVIEWS_DB[productId]) {
        REVIEWS_DB[productId] = [];
    }
    
    REVIEWS_DB[productId].push({ author, rating, comment, date: today });
    localStorage.setItem('sai_sankalp_reviews_db', JSON.stringify(REVIEWS_DB));
    
    showToast("Review submitted successfully!", "fa-circle-check");
    
    // Update local PRODUCTS average rating in catalog
    const productIdx = PRODUCTS.findIndex(p => p.id === productId);
    if (productIdx !== -1) {
        const reviewsList = REVIEWS_DB[productId];
        const avg = reviewsList.reduce((sum, r) => sum + r.rating, 0) / reviewsList.length;
        PRODUCTS[productIdx].rating = parseFloat(avg.toFixed(1));
        PRODUCTS[productIdx].reviews = reviewsList.length;
        localStorage.setItem("sai_sankalp_products", JSON.stringify(PRODUCTS));
    }
    
    // Refresh modal and main display catalog
    openProductModal(productId);
    filterAndSortProducts();
}

// Expose advanced globals for click events
window.wireSidebarFilters = wireSidebarFilters;
window.filterAndSortProducts = filterAndSortProducts;
window.toggleWishlist = toggleWishlist;
window.updateWishlistUI = updateWishlistUI;
window.toggleCompareProduct = toggleCompareProduct;
window.updateComparisonDrawer = updateComparisonDrawer;
window.toggleComparisonDrawer = toggleComparisonDrawer;
window.zoomImage = zoomImage;
window.resetZoomImage = resetZoomImage;
window.setSelectRating = setSelectRating;
window.submitProductReview = submitProductReview;

// =========================================================================
// ENTERPRISE ADMIN EXTENSIONS (CATEGORIES, COUPONS, BANNERS, ANALYTICS)
// =========================================================================

let adminCategoriesList = [];
let previousOrdersCount = 0;
let adminAlertsList = [];

// Request Permission on first load
if (window.Notification && Notification.permission === "default") {
    Notification.requestPermission();
}

function triggerBrowserNotification(title, body) {
    if (window.Notification && Notification.permission === "granted") {
        try {
            new Notification(title, {
                body: body,
                icon: "images/wool_doll.png"
            });
        } catch(e){}
    }
}

function addAdminAlert(title, message, type = "info") {
    if (adminAlertsList.some(a => a.title === title && a.message === message)) return;
    
    const newAlert = {
        id: Date.now(),
        title,
        message,
        type,
        timestamp: new Date().toLocaleTimeString()
    };
    
    adminAlertsList.unshift(newAlert);
    renderAdminAlertsList();
    triggerBrowserNotification(title, message);
}

function renderAdminAlertsList() {
    const list = document.getElementById("adminNotificationsList");
    const badge = document.getElementById("adminNotificationBadge");
    if (!list) return;
    
    if (adminAlertsList.length === 0) {
        list.innerHTML = `<p style="margin:0; padding:10px; font-size:0.78rem; color:var(--text-secondary); text-align:center;">No new alerts.</p>`;
        if (badge) badge.style.display = "none";
        return;
    }
    
    if (badge) {
        badge.innerText = adminAlertsList.length;
        badge.style.display = "flex";
    }
    
    list.innerHTML = "";
    adminAlertsList.forEach(a => {
        const div = document.createElement("div");
        div.style.padding = "8px 10px";
        div.style.borderRadius = "6px";
        div.style.fontSize = "0.78rem";
        div.style.lineHeight = "1.3";
        div.style.marginBottom = "8px";
        
        let bg = "rgba(52, 152, 219, 0.1)";
        let border = "1px solid rgba(52, 152, 219, 0.2)";
        let color = "#2980b9";
        
        if (a.type === "warning") {
            bg = "rgba(230, 126, 34, 0.1)";
            border = "1px solid rgba(230, 126, 34, 0.2)";
            color = "#d35400";
        } else if (a.type === "danger") {
            bg = "rgba(231, 76, 60, 0.1)";
            border = "1px solid rgba(231, 76, 60, 0.2)";
            color = "#c0392b";
        }
        
        div.style.background = bg;
        div.style.border = border;
        div.style.color = color;
        
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-weight:700; margin-bottom:2px;">
                <span>${a.title}</span>
                <span style="font-size:0.65rem; opacity:0.8;">${a.timestamp}</span>
            </div>
            <div style="color:var(--text-primary); font-weight:normal;">${a.message}</div>
        `;
        list.appendChild(div);
    });
}

function clearAdminNotifications() {
    adminAlertsList = [];
    renderAdminAlertsList();
    showToast("Notifications cleared.", "fa-circle-check");
}

// Category Management
function renderAdminCategoryList() {
    const listContainer = document.getElementById("adminCategoryList");
    if (!listContainer) return;
    
    fetch("/api/categories")
    .then(res => res.json())
    .then(cats => {
        adminCategoriesList = cats;
        listContainer.innerHTML = "";
        if (cats.length === 0) {
            listContainer.innerHTML = `<p style="font-size:0.8rem; color:var(--text-secondary); text-align:center;">No custom categories.</p>`;
            return;
        }
        
        cats.forEach(c => {
            const div = document.createElement("div");
            div.style.display = "flex";
            div.style.justify = "space-between";
            div.style.alignItems = "center";
            div.style.background = "var(--bg-primary)";
            div.style.padding = "6px 10px";
            div.style.borderRadius = "6px";
            div.style.border = "1px solid var(--border-color)";
            div.style.fontSize = "0.82rem";
            
            div.innerHTML = `
                <span><strong>${c.name}</strong> <code style="color:var(--text-secondary); font-size:0.75rem;">(${c.id})</code></span>
                <button type="button" class="btn-icon" onclick="deleteAdminCategory('${c.id}')" style="color:#d9534f; background:none; border:none; cursor:pointer;" title="Delete Category"><i class="fa-solid fa-trash-can"></i></button>
            `;
            listContainer.appendChild(div);
        });
        
        const prodCategorySelect = document.getElementById("prodCategory");
        if (prodCategorySelect) {
            prodCategorySelect.innerHTML = `<option value="" disabled selected>Select category</option>`;
            cats.forEach(c => {
                prodCategorySelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            });
        }
    })
    .catch(err => console.error("Error fetching categories:", err));
}

function addAdminCategory(e) {
    e.preventDefault();
    const idField = document.getElementById("newCatId");
    const nameField = document.getElementById("newCatName");
    if (!idField || !nameField) return;
    
    const id = idField.value.trim().toLowerCase();
    const name = nameField.value.trim();
    
    if (!id || !name) return;
    
    fetch("/api/categories", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Admin-Email": currentUserEmail
        },
        body: JSON.stringify({ id, name })
    })
    .then(res => {
        if (!res.ok) return res.json().then(e => { throw new Error(e.error || "Failed to add category"); });
        return res.json();
    })
    .then(() => {
        showToast("Category added successfully!", "fa-circle-check");
        idField.value = "";
        nameField.value = "";
        renderAdminCategoryList();
    })
    .catch(err => {
        console.error("Error adding category:", err);
        showToast(err.message || "Failed to add category", "fa-circle-exclamation");
    });
}

function deleteAdminCategory(catId) {
    if (!confirm(`Are you sure you want to delete category "${catId}"? This will not delete products under this category.`)) return;
    
    fetch(`/api/categories?id=${catId}`, {
        method: "DELETE",
        headers: {
            "X-Admin-Email": currentUserEmail
        }
    })
    .then(res => {
        if (!res.ok) throw new Error("Failed to delete category");
        return res.json();
    })
    .then(() => {
        showToast("Category deleted.", "fa-circle-check");
        renderAdminCategoryList();
    })
    .catch(err => {
        console.error("Error deleting category:", err);
        showToast("Failed to delete category.", "fa-circle-exclamation");
    });
}

// Coupons & Banners Management
function refreshPromoTab() {
    renderAdminCoupons();
    renderAdminBanners();
}

function renderAdminCoupons() {
    const listContainer = document.getElementById("adminCouponsList");
    if (!listContainer) return;
    
    fetch("/api/coupons")
    .then(res => res.json())
    .then(coupons => {
        listContainer.innerHTML = "";
        const keys = Object.keys(coupons);
        if (keys.length === 0) {
            listContainer.innerHTML = `<p style="font-size:0.8rem; color:var(--text-secondary); text-align:center; padding:10px;">No coupons registered.</p>`;
            return;
        }
        
        const table = document.createElement("table");
        table.style.width = "100%";
        table.style.borderCollapse = "collapse";
        table.style.fontSize = "0.82rem";
        table.innerHTML = `
            <thead>
                <tr style="background:var(--bg-primary); border-bottom:1px solid var(--border-color); text-align:left; color:var(--text-secondary);">
                    <th style="padding:6px;">Code</th>
                    <th style="padding:6px;">Type</th>
                    <th style="padding:6px; text-align:right;">Value</th>
                    <th style="padding:6px; text-align:center;">Action</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector("tbody");
        
        keys.forEach(k => {
            const cp = coupons[k];
            const tr = document.createElement("tr");
            tr.style.borderBottom = "1px solid var(--border-color)";
            tr.innerHTML = `
                <td style="padding:6px;"><strong>${k}</strong></td>
                <td style="padding:6px; color:var(--text-secondary);">${cp.type === 'percent' ? 'Percent' : 'Flat'}</td>
                <td style="padding:6px; text-align:right; font-weight:bold;">${cp.type === 'percent' ? cp.value + '%' : '₹' + cp.value.toFixed(2)}</td>
                <td style="padding:6px; text-align:center;">
                    <button type="button" onclick="deleteAdminCoupon('${k}')" style="background:none; border:none; color:#d9534f; cursor:pointer;"><i class="fa-solid fa-trash-can"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        listContainer.appendChild(table);
    })
    .catch(err => console.error("Error fetching coupons:", err));
}

function addAdminCoupon(e) {
    e.preventDefault();
    const codeInput = document.getElementById("couponCode");
    const typeSelect = document.getElementById("couponType");
    const valueInput = document.getElementById("couponValue");
    const labelInput = document.getElementById("couponLabel");
    
    if (!codeInput || !typeSelect || !valueInput) return;
    
    const code = codeInput.value.trim().toUpperCase();
    const type = typeSelect.value;
    const value = parseFloat(valueInput.value);
    const label = labelInput ? labelInput.value.trim() : "";
    
    if (!code || isNaN(value) || value <= 0) return;
    
    fetch("/api/coupons", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Admin-Email": currentUserEmail
        },
        body: JSON.stringify({ code, type, value, label })
    })
    .then(res => {
        if (!res.ok) throw new Error("Failed to add coupon");
        return res.json();
    })
    .then(() => {
        showToast("Coupon added successfully!", "fa-circle-check");
        codeInput.value = "";
        valueInput.value = "";
        if (labelInput) labelInput.value = "";
        renderAdminCoupons();
    })
    .catch(err => {
        console.error("Error adding coupon:", err);
        showToast("Failed to add coupon.", "fa-circle-exclamation");
    });
}

function deleteAdminCoupon(code) {
    if (!confirm(`Delete coupon code ${code}?`)) return;
    
    fetch(`/api/coupons?code=${code}`, {
        method: "DELETE",
        headers: {
            "X-Admin-Email": currentUserEmail
        }
    })
    .then(res => {
        if (!res.ok) throw new Error("Failed to delete coupon");
        return res.json();
    })
    .then(() => {
        showToast("Coupon deleted.", "fa-circle-check");
        renderAdminCoupons();
    })
    .catch(err => {
        console.error("Error deleting coupon:", err);
        showToast("Failed to delete coupon.", "fa-circle-exclamation");
    });
}

function renderAdminBanners() {
    const listContainer = document.getElementById("adminBannersList");
    if (!listContainer) return;
    
    fetch("/api/banners")
    .then(res => res.json())
    .then(banners => {
        listContainer.innerHTML = "";
        if (banners.length === 0) {
            listContainer.innerHTML = `<p style="font-size:0.8rem; color:var(--text-secondary); text-align:center; padding:10px;">No banners active.</p>`;
            return;
        }
        
        banners.forEach(b => {
            const div = document.createElement("div");
            div.style.display = "flex";
            div.style.alignItems = "center";
            div.style.gap = "12px";
            div.style.padding = "8px";
            div.style.background = "var(--bg-primary)";
            div.style.borderRadius = "6px";
            div.style.border = "1px solid var(--border-color)";
            div.style.marginBottom = "8px";
            
            div.innerHTML = `
                <img src="${b.image}" style="width:50px; height:35px; object-fit:cover; border-radius:4px; border:1px solid var(--border-color);">
                <div style="flex:1; text-align:left;">
                    <h5 style="margin:0; font-size:0.82rem; font-family:var(--font-body);">${b.title}</h5>
                    <p style="margin:2px 0 0 0; font-size:0.72rem; color:var(--text-secondary);">${b.subtitle}</p>
                </div>
                <button type="button" onclick="deleteAdminBanner('${b.id}')" style="background:none; border:none; color:#d9534f; cursor:pointer;"><i class="fa-solid fa-trash-can"></i></button>
            `;
            listContainer.appendChild(div);
        });
    })
    .catch(err => console.error("Error fetching banners:", err));
}

function addAdminBanner(event) {
    event.preventDefault();
    const imgSelect = document.getElementById("bannerImageSelect");
    const titleInput = document.getElementById("bannerTitle");
    const subInput = document.getElementById("bannerSubtitle");
    
    if (!imgSelect || !titleInput || !subInput) return;
    
    const image = imgSelect.value;
    const title = titleInput.value.trim();
    const subtitle = subInput.value.trim();
    
    if (!image || !title || !subtitle) return;
    
    fetch("/api/banners", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Admin-Email": currentUserEmail
        },
        body: JSON.stringify({ image, title, subtitle })
    })
    .then(res => {
        if (!res.ok) throw new Error("Failed to add banner");
        return res.json();
    })
    .then(() => {
        showToast("Banner added successfully!", "fa-circle-check");
        imgSelect.value = "";
        titleInput.value = "";
        subInput.value = "";
        renderAdminBanners();
    })
    .catch(err => {
        console.error("Error adding banner:", err);
        showToast("Failed to add banner.", "fa-circle-exclamation");
    });
}

function deleteAdminBanner(id) {
    if (!confirm(`Delete banner #${id}?`)) return;
    
    fetch(`/api/banners?id=${id}`, {
        method: "DELETE",
        headers: {
            "X-Admin-Email": currentUserEmail
        }
    })
    .then(res => {
        if (!res.ok) throw new Error("Failed to delete banner");
        return res.json();
    })
    .then(() => {
        showToast("Banner removed.", "fa-circle-check");
        renderAdminBanners();
    })
    .catch(err => {
        console.error("Error deleting banner:", err);
        showToast("Failed to delete banner.", "fa-circle-exclamation");
    });
}

// Business Analytics Calculations
function refreshAnalyticsTab() {
    let totalRevenue = 0;
    let todaySales = 0;
    let monthlySales = 0;
    
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const customerOrdersCount = {};
    const productSalesCount = {};
    
    allOrders.forEach(o => {
        const details = o.details || {};
        const status = details.status || "Pending";
        const val = parseFloat(details.totalAmount) || 0;
        
        if (status !== "Cancelled" && status !== "Refunded") {
            totalRevenue += val;
        }
        
        if (o.timestamp) {
            const dateParts = o.timestamp.split(" ");
            const oDateStr = dateParts[0];
            if (oDateStr === todayStr) {
                todaySales += val;
            }
            try {
                const oDate = new Date(o.timestamp);
                if (oDate.getMonth() === currentMonth && oDate.getFullYear() === currentYear) {
                    monthlySales += val;
                }
            } catch(e){}
        }
        
        const email = (details.customerEmail || "").trim().toLowerCase();
        if (email) {
            customerOrdersCount[email] = (customerOrdersCount[email] || 0) + 1;
        }
        
        const items = details.items || [];
        items.forEach(it => {
            const title = it.title || "Unknown";
            productSalesCount[title] = (productSalesCount[title] || 0) + (parseInt(it.quantity) || 0);
        });
    });
    
    let lowStockCount = 0;
    let outOfStockCount = 0;
    PRODUCTS.forEach(p => {
        const stk = p.stock !== undefined ? p.stock : 10;
        if (stk === 0) {
            outOfStockCount++;
        } else if (stk <= 5) {
            lowStockCount++;
        }
    });
    
    const uniqueCustomers = Object.keys(customerOrdersCount);
    const returningCustomers = uniqueCustomers.filter(email => customerOrdersCount[email] > 1);
    const returningRate = uniqueCustomers.length > 0 ? (returningCustomers.length / uniqueCustomers.length * 100) : 0;
    
    document.getElementById("statTotalOrders").innerText = allOrders.length;
    document.getElementById("statTotalRevenue").innerText = "₹" + totalRevenue.toFixed(2);
    document.getElementById("statTodaySales").innerText = "₹" + todaySales.toFixed(2);
    document.getElementById("statMonthlySales").innerText = "₹" + monthlySales.toFixed(2);
    document.getElementById("statReturningRate").innerText = returningRate.toFixed(1) + "%";
    document.getElementById("statLowStockAlerts").innerText = lowStockCount;
    document.getElementById("statOutOfStockAlerts").innerText = outOfStockCount;
    
    if (lowStockCount > 0) {
        addAdminAlert("Low Stock Warning", `${lowStockCount} items in the catalog have stock <= 5. Please restock!`, "warning");
    }
    if (outOfStockCount > 0) {
        addAdminAlert("Out of Stock Warning", `${outOfStockCount} items in the catalog are completely sold out!`, "danger");
    }
    
    const bestSellersContainer = document.getElementById("analyticsBestSellersList");
    if (bestSellersContainer) {
        bestSellersContainer.innerHTML = "";
        const sortedProducts = Object.keys(productSalesCount).sort((a,b) => productSalesCount[b] - productSalesCount[a]);
        if (sortedProducts.length === 0) {
            bestSellersContainer.innerHTML = `<p style="font-size:0.8rem; color:var(--text-secondary); text-align:center; padding:20px;">No sales recorded yet.</p>`;
        } else {
            sortedProducts.slice(0, 5).forEach((title, idx) => {
                const div = document.createElement("div");
                div.style.display = "flex";
                div.style.justify = "space-between";
                div.style.alignItems = "center";
                div.style.background = "var(--bg-primary)";
                div.style.padding = "8px 12px";
                div.style.borderRadius = "8px";
                div.style.border = "1px solid var(--border-color)";
                div.style.fontSize = "0.85rem";
                
                div.innerHTML = `
                    <span><strong>#${idx+1}</strong> ${title}</span>
                    <span style="font-weight:700; color:var(--accent-color);">${productSalesCount[title]} sold</span>
                `;
                bestSellersContainer.appendChild(div);
            });
        }
    }
    
    renderSalesTrendChart();
    
    // Check if new orders were loaded to raise dynamic alerts
    if (allOrders.length > previousOrdersCount && previousOrdersCount > 0) {
        const lastOrder = allOrders[allOrders.length - 1];
        addAdminAlert("New Order Placed! 🛍️", `Order ID: ${lastOrder.orderId} for ₹${parseFloat(lastOrder.details?.totalAmount || 0).toFixed(2)}`, "info");
    }
    previousOrdersCount = allOrders.length;
}

function renderSalesTrendChart() {
    const wrapper = document.getElementById("analyticsChartWrapper");
    if (!wrapper) return;
    
    const monthsName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const dataPoints = [];
    
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        dataPoints.push({
            year: d.getFullYear(),
            month: d.getMonth(),
            label: monthsName[d.getMonth()],
            value: 0
        });
    }
    
    allOrders.forEach(o => {
        const details = o.details || {};
        if (details.status === "Cancelled" || details.status === "Refunded") return;
        const val = parseFloat(details.totalAmount) || 0;
        try {
            const oDate = new Date(o.timestamp);
            const m = oDate.getMonth();
            const y = oDate.getFullYear();
            const pt = dataPoints.find(p => p.month === m && p.year === y);
            if (pt) {
                pt.value += val;
            }
        } catch(e){}
    });
    
    const maxVal = Math.max(...dataPoints.map(p => p.value), 1000);
    const height = 200;
    const width = wrapper.clientWidth || 350;
    const paddingLeft = 45;
    const paddingRight = 15;
    const paddingTop = 20;
    const paddingBottom = 30;
    
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
    
    const points = dataPoints.map((pt, idx) => {
        const x = paddingLeft + (idx * (chartWidth / (dataPoints.length - 1)));
        const ratio = pt.value / maxVal;
        const y = height - paddingBottom - (ratio * chartHeight);
        return { x, y, val: pt.value, label: pt.label };
    });
    
    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        pathD += ` L ${points[i].x} ${points[i].y}`;
    }
    
    const areaD = `${pathD} L ${points[points.length-1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;
    
    let svgHtml = `
    <svg width="${width}" height="${height}" style="font-family: inherit; font-size: 0.72rem; overflow: visible;">
        <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--accent-color)" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="var(--accent-color)" stop-opacity="0.0"/>
            </linearGradient>
        </defs>
        
        <line x1="${paddingLeft}" y1="${paddingTop}" x2="${width - paddingRight}" y2="${paddingTop}" stroke="var(--border-color)" stroke-dasharray="4,4"/>
        <line x1="${paddingLeft}" y1="${paddingTop + chartHeight/2}" x2="${width - paddingRight}" y2="${paddingTop + chartHeight/2}" stroke="var(--border-color)" stroke-dasharray="4,4"/>
        <line x1="${paddingLeft}" y1="${height - paddingBottom}" x2="${width - paddingRight}" y2="${height - paddingBottom}" stroke="var(--border-color)"/>
        
        <text x="${paddingLeft - 8}" y="${paddingTop + 4}" text-anchor="end" fill="var(--text-secondary)">₹${(maxVal).toFixed(0)}</text>
        <text x="${paddingLeft - 8}" y="${paddingTop + chartHeight/2 + 4}" text-anchor="end" fill="var(--text-secondary)">₹${(maxVal/2).toFixed(0)}</text>
        <text x="${paddingLeft - 8}" y="${height - paddingBottom + 4}" text-anchor="end" fill="var(--text-secondary)">₹0</text>
        
        <path d="${areaD}" fill="url(#chartGrad)"/>
        
        <path d="${pathD}" fill="none" stroke="var(--accent-color)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    `;
    
    points.forEach(pt => {
        svgHtml += `
            <circle cx="${pt.x}" cy="${pt.y}" r="4.5" fill="white" stroke="var(--accent-color)" stroke-width="2.5"/>
            <text x="${pt.x}" y="${pt.y - 10}" text-anchor="middle" font-weight="700" fill="var(--text-primary)" style="font-size:0.68rem;">₹${pt.val.toFixed(0)}</text>
            <text x="${pt.x}" y="${height - 12}" text-anchor="middle" fill="var(--text-secondary)">${pt.label}</text>
        `;
    });
    
    svgHtml += `</svg>`;
    wrapper.innerHTML = svgHtml;
}

// Stock editor
function editProductStock(product) {
    const newStockStr = prompt(`Update stock count for "${product.title}":`, product.stock !== undefined ? product.stock : 10);
    if (newStockStr === null) return;
    const newStock = parseInt(newStockStr, 10);
    if (isNaN(newStock) || newStock < 0) {
        showToast("Invalid stock count entered.", "fa-circle-exclamation");
        return;
    }
    
    const payload = {
        id: product.id,
        title: product.title,
        price: product.price,
        stock: newStock,
        category: product.category,
        description: product.description,
        image: product.image
    };
    
    fetch("/api/products", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Admin-Email": currentUserEmail
        },
        body: JSON.stringify(payload)
    })
    .then(res => {
        if (!res.ok) throw new Error("Failed to update product stock");
        return res.json();
    })
    .then(() => {
        showToast("Stock updated successfully!", "fa-circle-check");
        if (newStock === 0) {
            addAdminAlert("Out of Stock!", `Product "${product.title}" is completely sold out.`, "danger");
        } else if (newStock <= 5) {
            addAdminAlert("Low Stock Warning", `Product "${product.title}" has only ${newStock} units left.`, "warning");
        }
        return fetchProducts();
    })
    .then(() => {
        renderAdminProductsList();
    })
    .catch(err => {
        console.error("Error updating stock:", err);
        showToast("Failed to update stock.", "fa-circle-exclamation");
    });
}

// Exports
function exportOrdersCSV() {
    if (allOrders.length === 0) {
        showToast("No orders available to export.", "fa-circle-exclamation");
        return;
    }
    
    let csv = "Order ID,Timestamp,Customer Name,Email,Mobile,Items,Subtotal,CGST,SGST,Total Paid,Status,Transaction ID,Payment Method,Address\n";
    allOrders.forEach(o => {
        const d = o.details || {};
        const itemsList = (d.items || []).map(it => `${it.title} (x${it.quantity})`).join("; ");
        
        const row = [
            o.orderId,
            o.timestamp,
            `"${d.customerName || ''}"`,
            d.customerEmail || '',
            d.customerMobile || '',
            `"${itemsList}"`,
            d.subtotal || 0,
            d.cgst || 0,
            d.sgst || 0,
            d.totalAmount || 0,
            d.status || 'Pending',
            d.transactionId || 'N/A',
            d.paymentMethod || 'N/A',
            `"${(d.customerAddress || '').replace(/"/g, '""')}"`
        ];
        csv += row.join(",") + "\n";
    });
    
    downloadCSV(csv, "sai_sankalp_orders.csv");
}

function exportCustomersCSV() {
    const customerMap = {};
    allOrders.forEach(o => {
        const d = o.details || {};
        const email = (d.customerEmail || "").trim().toLowerCase();
        if (!email) return;
        
        if (!customerMap[email]) {
            customerMap[email] = {
                name: d.customerName || 'Customer',
                mobile: d.customerMobile || 'N/A',
                address: d.customerAddress || 'N/A',
                orderCount: 0,
                totalSpend: 0
            };
        }
        
        customerMap[email].orderCount++;
        const total = parseFloat(d.totalAmount) || 0;
        if (d.status !== "Cancelled" && d.status !== "Refunded") {
            customerMap[email].totalSpend += total;
        }
    });
    
    const emails = Object.keys(customerMap);
    if (emails.length === 0) {
        showToast("No customers to export.", "fa-circle-exclamation");
        return;
    }
    
    let csv = "Email,Name,Mobile,Total Orders,Total Spent (₹),Last Known Address\n";
    emails.forEach(email => {
        const c = customerMap[email];
        const row = [
            email,
            `"${c.name}"`,
            c.mobile,
            c.orderCount,
            c.totalSpend.toFixed(2),
            `"${c.address.replace(/"/g, '""')}"`
        ];
        csv += row.join(",") + "\n";
    });
    
    downloadCSV(csv, "sai_sankalp_customers.csv");
}

function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Window exposes for template onclick/onsubmit handlers
window.switchAdminTab = switchAdminTab;
window.renderAdminCategoryList = renderAdminCategoryList;
window.addAdminCategory = addAdminCategory;
window.deleteAdminCategory = deleteAdminCategory;
window.refreshPromoTab = refreshPromoTab;
window.renderAdminCoupons = renderAdminCoupons;
window.addAdminCoupon = addAdminCoupon;
window.deleteAdminCoupon = deleteAdminCoupon;
window.renderAdminBanners = renderAdminBanners;
window.addAdminBanner = addAdminBanner;
window.deleteAdminBanner = deleteAdminBanner;
window.refreshAnalyticsTab = refreshAnalyticsTab;
window.renderSalesTrendChart = renderSalesTrendChart;
window.exportOrdersCSV = exportOrdersCSV;
window.exportCustomersCSV = exportCustomersCSV;
window.clearAdminNotifications = clearAdminNotifications;
window.editProductStock = editProductStock;

// Address and Wishlist Synchronization functions
function loadSavedAddresses() {
    const listEl = document.getElementById("savedAddressesList");
    if (!listEl) return;
    
    listEl.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 10px;">Loading saved addresses...</div>`;
    
    fetch('/api/addresses', {
        headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('sai_sankalp_session_token')
        }
    })
    .then(res => res.json())
    .then(addrs => {
        listEl.innerHTML = "";
        if (addrs.length === 0) {
            listEl.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 10px; border: 1px dashed var(--border-color); border-radius: 6px;">No saved addresses. Add one below!</div>`;
            return;
        }
        addrs.forEach(a => {
            const card = document.createElement("div");
            card.style.cssText = "border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; background: var(--bg-primary); position: relative; font-size: 0.85rem; color: var(--text-primary);";
            card.innerHTML = `
                <div style="font-weight: 700; color: var(--accent-color); margin-bottom: 4px;">${a.name}</div>
                <div style="font-weight: 600; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 6px;"><i class="fa-solid fa-phone"></i> ${a.mobile}</div>
                <div style="line-height: 1.4; margin-bottom: 8px;">${a.address}</div>
                <button type="button" class="btn btn-secondary delete-address-btn" data-id="${a.id}" style="padding: 4px 8px; font-size: 0.75rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; border-color: #e74c3c; color: #e74c3c; background: transparent; cursor: pointer;">
                    <i class="fa-solid fa-trash-can"></i> Delete
                </button>
            `;
            listEl.appendChild(card);
        });
        
        // Bind delete buttons
        listEl.querySelectorAll('.delete-address-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const aid = btn.getAttribute('data-id');
                if (confirm("Are you sure you want to delete this address?")) {
                    fetch(`/api/addresses?id=${aid}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': 'Bearer ' + localStorage.getItem('sai_sankalp_session_token')
                        }
                    })
                    .then(res => {
                        if (!res.ok) throw new Error("Delete failed");
                        return res.json();
                    })
                    .then(() => {
                        showToast("Address deleted successfully", "fa-trash");
                        loadSavedAddresses();
                    })
                    .catch(err => {
                        alert("Error: " + err.message);
                    });
                }
            });
        });
    })
    .catch(err => {
        console.error("Failed to load saved addresses:", err);
        listEl.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #e74c3c; padding: 10px;">Failed to load saved addresses.</div>`;
    });
}

function syncWishlistFromServer() {
    if (currentUserEmail && currentUserEmail !== "Guest" && currentUserEmail !== "") {
        fetch('/api/wishlist', {
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('sai_sankalp_session_token')
            }
        })
        .then(res => res.json())
        .then(srvWishlist => {
            const combined = Array.from(new Set([...wishlist, ...srvWishlist]));
            wishlist = combined;
            localStorage.setItem('sai_sankalp_wishlist', JSON.stringify(wishlist));
            updateWishlistUI();
            filterAndSortProducts();
            
            combined.forEach(pid => {
                if (!srvWishlist.includes(pid)) {
                    fetch('/api/wishlist', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + localStorage.getItem('sai_sankalp_session_token')
                        },
                        body: JSON.stringify({ productId: pid })
                    }).catch(e => console.warn(e));
                }
            });
        })
        .catch(err => console.error("Error syncing wishlist:", err));
    }
}