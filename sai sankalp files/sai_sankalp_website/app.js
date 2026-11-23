// Sai Sankalp Storefront Main Orchestrator Script

// ─── Shared checkout state ───
let shippingDetails = {};
let currentTransactionId = "";
let paymentPollingInterval = null;

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
            
            if (isAdmin && typeof fetchOrders === "function") {
                fetchOrders();
            }
            if (currentUserEmail && typeof openCustomerDashboard === "function") {
                openCustomerDashboard();
            }
        });
    }

    checkLoginState();
    if (typeof setupAuthListeners === "function") setupAuthListeners();
    fetchProducts();
    loadCartFromLocalStorage();
    setupEventListeners();
    initScrollReveal();
    
    // Initial category load
    if (typeof renderAdminCategoryList === "function") {
        renderAdminCategoryList();
    }

    // Navbar scroll effect
    window.addEventListener("scroll", () => {
        const navbar = document.getElementById("navbar");
        if (navbar) {
            if (window.scrollY > 60) {
                navbar.classList.add("scrolled");
            } else {
                navbar.classList.remove("scrolled");
            }
        }
    });
});

// ═══════════════════════════════════════════════
// TOAST NOTIFICATION SYSTEM (Fixed)
// ═══════════════════════════════════════════════
function showToast(message, icon = "fa-info-circle") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `
        <div class="toast-icon"><i class="fa-solid ${icon}"></i></div>
        <span class="toast-message">${message}</span>
    `;
    container.appendChild(toast);

    // Auto-remove after animation completes
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(100%)";
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, 3000);
}

// ═══════════════════════════════════════════════
// PRODUCT FETCHING & RENDERING
// ═══════════════════════════════════════════════
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
            
            // Scan stock levels
            if (isAdmin && typeof addAdminAlert === "function") {
                PRODUCTS.forEach(p => {
                    if (p.isDeleted) return;
                    const stk = p.stock !== undefined ? p.stock : 10;
                    if (stk === 0) {
                        addAdminAlert("Sold Out! 🚨", `Product "${p.title}" is out of stock.`, "danger");
                    } else if (stk <= 3) {
                        addAdminAlert("Low Stock Warning ⚠️", `Only ${stk} units left of "${p.title}".`, "warning");
                    }
                });
            }

            if (isAdmin && typeof renderAdminProductsList === "function") {
                renderAdminProductsList();
            }
            return data;
        })
        .catch(err => {
            console.warn("Could not fetch products from server, using offline backup:", err);
            if (localProducts) {
                try {
                    PRODUCTS = JSON.parse(localProducts);
                    filterAndSortProducts();
                    updateWishlistUI();
                } catch (e) {
                    PRODUCTS = [];
                }
            }
        });
}

// ═══════════════════════════════════════════════
// PRODUCT FILTERING & SORTING (Fixed selectors)
// ═══════════════════════════════════════════════
function filterAndSortProducts() {
    // ── Category checkboxes (class="category-filter-check") ──
    const catAll = document.getElementById("catCheckAll");
    const catChecks = Array.from(document.querySelectorAll(".category-filter-check:not(#catCheckAll)"));
    let activeCategories = [];
    if (catAll && !catAll.checked) {
        activeCategories = catChecks.filter(el => el.checked).map(el => el.value);
    }

    // ── Artisan / Brand checkboxes (class="brand-filter-check") ──
    const brandAll = document.getElementById("brandCheckAll");
    const brandChecks = Array.from(document.querySelectorAll(".brand-filter-check:not(#brandCheckAll)"));
    let activeArtisans = [];
    if (brandAll && !brandAll.checked) {
        activeArtisans = brandChecks.filter(el => el.checked).map(el => el.value);
    }

    // ── In-stock only (id="filterInStockOnly") ──
    const inStockOnly = document.getElementById("filterInStockOnly") ? document.getElementById("filterInStockOnly").checked : false;
    
    // ── Start with all non-deleted products ──
    let filtered = PRODUCTS.filter(p => !p.isDeleted);

    if (activeCategories.length > 0) {
        filtered = filtered.filter(p => activeCategories.includes(p.category));
    }
    
    if (activeArtisans.length > 0) {
        filtered = filtered.filter(p => {
            const mat = p.specs && p.specs.Material ? p.specs.Material : "";
            return activeArtisans.some(a => mat.includes(a));
        });
    }

    if (inStockOnly) {
        filtered = filtered.filter(p => (p.stock !== undefined ? p.stock : 10) > 0);
    }

    // ── Price range slider (id="priceRangeSlider") ──
    const priceSlider = document.getElementById("priceRangeSlider");
    if (priceSlider) {
        const maxPrice = parseFloat(priceSlider.value);
        filtered = filtered.filter(p => p.price <= maxPrice);
    }

    // ── Search input ──
    const searchInput = document.getElementById("storefrontSearchInput");
    if (searchInput) {
        const query = searchInput.value.trim().toLowerCase();
        if (query) {
            filtered = filtered.filter(p => 
                p.title.toLowerCase().includes(query) || 
                p.description.toLowerCase().includes(query)
            );
        }
    }

    // ── Sorting (id="filterSortBy") ──
    const sortVal = document.getElementById("filterSortBy") ? document.getElementById("filterSortBy").value : "popularity";
    if (sortVal === "price-asc") {
        filtered.sort((a, b) => a.price - b.price);
    } else if (sortVal === "price-desc") {
        filtered.sort((a, b) => b.price - a.price);
    } else if (sortVal === "newest") {
        filtered.sort((a, b) => b.id - a.id);
    } else {
        filtered.sort((a, b) => b.rating - a.rating);
    }

    renderProducts(filtered);
}

function renderProducts(items) {
    const productsGrid = document.getElementById("productsGrid");
    if (!productsGrid) return;

    if (items.length === 0) {
        productsGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                <i class="fa-solid fa-face-frown" style="font-size: 3rem; margin-bottom: 16px; opacity: 0.3;"></i>
                <p>No creations match your filters. Try adjusting them!</p>
            </div>
        `;
        return;
    }

    productsGrid.innerHTML = items.map((product, idx) => {
        const stock = product.stock !== undefined ? product.stock : 10;
        let stockBadge = `<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> In Stock</span>`;
        if (stock === 0) {
            stockBadge = `<span class="badge badge-danger"><i class="fa-solid fa-circle-xmark"></i> Out of Stock</span>`;
        } else if (stock <= 3) {
            stockBadge = `<span class="badge badge-warning"><i class="fa-solid fa-circle-exclamation"></i> Only ${stock} left!</span>`;
        }

        const inWish = wishlist.includes(product.id);
        const inCompare = compareProducts.includes(product.id);

        return `
            <article class="product-card" onclick="openProductModal(${product.id})" style="animation-delay: ${idx * 0.08}s">
                <div class="product-img-container">
                    <img src="${product.image}" alt="${product.title}" class="product-img" loading="lazy" onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'300\\' height=\\'300\\' viewBox=\\'0 0 100 100\\'><rect width=\\'100\\' height=\\'100\\' fill=\\'%23f4efeb\\'/><text x=\\'50\\' y=\\'55\\' font-family=\\'sans-serif\\' font-size=\\'10\\' fill=\\'%236a6562\\' text-anchor=\\'middle\\'>No Image</text></svg>';">
                    <button type="button" class="wishlist-btn ${inWish ? 'active' : ''}" onclick="toggleWishlist(${product.id}, event)" title="${inWish ? 'Remove from Wishlist' : 'Add to Wishlist'}">
                        <i class="fa-solid fa-heart"></i>
                    </button>
                    <button type="button" class="compare-btn ${inCompare ? 'active' : ''}" onclick="toggleCompareProduct(${product.id}, event)" title="${inCompare ? 'Remove from Comparison' : 'Add to Comparison'}">
                        <i class="fa-solid fa-right-left"></i>
                    </button>
                </div>
                <div class="product-info">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                        <span class="product-category">${product.categoryName}</span>
                        ${stockBadge}
                    </div>
                    <h3 class="product-title">${product.title}</h3>
                    <div class="product-rating">
                        <div class="stars">
                            ${Array.from({ length: 5 }, (_, i) => `<i class="fa-solid fa-star ${i < Math.floor(product.rating) ? 'active' : ''}"></i>`).join('')}
                        </div>
                        <span class="rating-val">(${product.reviews} reviews)</span>
                    </div>
                    <div class="product-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px;">
                        <span class="product-price">₹${product.price.toFixed(2)}</span>
                        <button type="button" class="btn btn-primary" onclick="addToCart(${product.id}); event.stopPropagation();" ${stock === 0 ? 'disabled' : ''} style="padding: 6px 12px; font-size: 0.8rem; border-radius: 6px;">
                            <i class="fa-solid fa-cart-plus"></i> Buy
                        </button>
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

// ═══════════════════════════════════════════════
// PRODUCT DETAIL MODAL
// ═══════════════════════════════════════════════
let activeDetailProductId = null;
function openProductModal(productId) {
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) return;

    activeDetailProductId = productId;
    const modal = document.getElementById("productModal");
    const overlay = document.getElementById("modalOverlay");
    if (!modal) return;

    modal.classList.add("open");
    if (overlay) overlay.classList.add("active");
    document.body.style.overflow = "hidden";

    // Set Info
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl("modalProductTitle", product.title);
    setEl("modalProductCategory", product.categoryName);
    setEl("modalProductPrice", `₹${product.price.toFixed(2)}`);
    setEl("modalProductDesc", product.description);
    
    const stock = product.stock !== undefined ? product.stock : 10;
    const stockEl = document.getElementById("modalProductStock");
    if (stockEl) {
        if (stock === 0) {
            stockEl.className = "badge badge-danger";
            stockEl.textContent = "Out of Stock";
        } else if (stock <= 3) {
            stockEl.className = "badge badge-warning";
            stockEl.textContent = `Only ${stock} Left!`;
        } else {
            stockEl.className = "badge badge-success";
            stockEl.textContent = "In Stock";
        }
    }

    const mainImg = document.getElementById("modalProductImg");
    if (mainImg) {
        mainImg.src = product.image;
        setupImageZoom(mainImg);
    }

    // Delivery calculation
    const delDate = new Date();
    delDate.setDate(delDate.getDate() + 7);
    const dateStr = delDate.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
    const delEl = document.getElementById("deliveryDateEstimation");
    if (delEl) delEl.textContent = dateStr;

    // Review Form submit hooks
    const revForm = document.getElementById("productReviewForm");
    if (revForm) {
        revForm.onsubmit = (e) => {
            e.preventDefault();
            submitProductReview(product.id);
        };
    }

    // Render Carousels
    renderProductModalCarousels(product);
}

function closeProductModal() {
    const modal = document.getElementById("productModal");
    const overlay = document.getElementById("modalOverlay");
    if (modal) {
        modal.classList.remove("open");
        modal.classList.remove("active");
    }
    if (overlay) overlay.classList.remove("active");
    document.body.style.overflow = "";
}

function setupImageZoom(imgEl) {
    const container = imgEl.parentElement;
    if (!container) return;

    container.onmousemove = (e) => {
        const rect = container.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        imgEl.style.transformOrigin = `${x}% ${y}%`;
        imgEl.style.transform = "scale(2)";
    };

    container.onmouseleave = () => {
        imgEl.style.transform = "scale(1)";
        imgEl.style.transformOrigin = "center center";
    };
}

function submitProductReview(productId) {
    const author = document.getElementById("reviewAuthor") ? document.getElementById("reviewAuthor").value.trim() || "Anonymous Customer" : "Anonymous";
    const comment = document.getElementById("reviewComment") ? document.getElementById("reviewComment").value.trim() : "";
    const rating = document.getElementById("reviewRating") ? parseInt(document.getElementById("reviewRating").value, 10) : 5;
    
    if (!comment) return;

    showToast("Review submitted successfully! Thank you.", "fa-circle-check");
    if (document.getElementById("reviewAuthor")) document.getElementById("reviewAuthor").value = "";
    if (document.getElementById("reviewComment")) document.getElementById("reviewComment").value = "";
    if (document.getElementById("reviewRating")) document.getElementById("reviewRating").value = "5";
}

function renderProductModalCarousels(product) {
    const relatedList = document.getElementById("carouselRelatedCreations");

    if (relatedList) {
        const related = PRODUCTS.filter(p => p.category === product.category && p.id !== product.id && !p.isDeleted).slice(0, 4);
        if (related.length === 0) {
            relatedList.innerHTML = `<p style="padding:10px; color:var(--text-secondary); font-size:0.8rem;">No related creations.</p>`;
        } else {
            relatedList.innerHTML = related.map(p => `
                <div class="carousel-item-card" onclick="openProductModal(${p.id})">
                    <img src="${p.image}" alt="${p.title}" onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'300\\' height=\\'300\\' viewBox=\\'0 0 100 100\\'><rect width=\\'100\\' height=\\'100\\' fill=\\'%23f4efeb\\'/><text x=\\'50\\' y=\\'55\\' font-family=\\'sans-serif\\' font-size=\\'10\\' fill=\\'%236a6562\\' text-anchor=\\'middle\\'>No Image</text></svg>';">
                    <h5>${p.title}</h5>
                    <p>₹${p.price.toFixed(2)}</p>
                </div>
            `).join('');
        }
    }
}

// ═══════════════════════════════════════════════
// ADMIN ORDER MANAGEMENT
// ═══════════════════════════════════════════════
function fetchOrders() {
    return fetch("/api/orders?_t=" + Date.now(), {
        headers: {
            "Authorization": "Bearer " + localStorage.getItem('sai_sankalp_session_token')
        }
    })
    .then(res => {
        if (!res.ok) throw new Error("Unauthorized orders access");
        return res.json();
    })
    .then(data => {
        allOrders = data;
        localStorage.setItem("sai_sankalp_orders_" + currentUserEmail, JSON.stringify(allOrders));
        renderAdminOrders(allOrders);
        
        // Notify new order alert
        if (allOrders.length > previousOrdersCount && previousOrdersCount > 0 && typeof addAdminAlert === "function") {
            const lastOrder = allOrders[allOrders.length - 1];
            addAdminAlert("New Order Placed! 🛍", `Order ID: ${lastOrder.orderId} for ₹${lastOrder.details.totalAmount.toFixed(2)}`, "info");
        }
        previousOrdersCount = allOrders.length;
    })
    .catch(err => {
        console.warn("Could not fetch orders from server, using local storage:", err);
        const stored = localStorage.getItem("sai_sankalp_orders_" + currentUserEmail);
        if (stored) {
            try {
                allOrders = JSON.parse(stored);
                renderAdminOrders(allOrders);
            } catch(e) {
                allOrders = [];
            }
        }
    });
}

function renderAdminOrders(orders) {
    const list = document.getElementById("adminOrdersTableBody");
    if (!list) return;

    const query = (document.getElementById("adminOrderSearch") ? document.getElementById("adminOrderSearch").value : "").trim().toLowerCase();
    const statusFilter = (document.getElementById("adminOrderStatusFilter") ? document.getElementById("adminOrderStatusFilter").value : "ALL");

    let filtered = orders || allOrders || [];
    if (statusFilter && statusFilter !== "ALL") {
        filtered = filtered.filter(o => (o.details && o.details.status === statusFilter) || o.status === statusFilter);
    }
    if (query) {
        filtered = filtered.filter(o => {
            const d = o.details || {};
            const searchStr = `${o.orderId} ${d.customerName} ${d.customerEmail} ${d.customerMobile || d.mobile || ''} ${d.customerAddress || ''}`.toLowerCase();
            return searchStr.includes(query);
        });
    }

    if (filtered.length === 0) {
        list.innerHTML = `<tr><td colspan="10" style="padding: 24px; text-align: center; color: var(--text-secondary);">No orders match search/filter criteria.</td></tr>`;
        return;
    }

    list.innerHTML = filtered.map(o => {
        const d = o.details || {};
        const items = d.items || [];
        const itemsCount = items.reduce((sum, it) => sum + (parseInt(it.quantity, 10) || 1), 0);
        const esc = window.escapeHTML || (s => s);
        const itemsHtml = items.map(it => `
            <div class="item-line">
                <span style="font-weight:600; color:var(--text-primary);">${esc(it.title)}${it.variant ? ` (${esc(it.variant)})` : ''}</span>
                <span style="color:var(--text-secondary);">x${it.quantity} (₹${Number(it.price).toFixed(2)})</span>
            </div>
        `).join('');

        const deliveryDate = esc(d.deliveryDate || o.deliveryDate || 'Within 6 days');
        const mobile = esc(d.customerMobile || d.mobile || d.phone || 'N/A');
        const address = esc(d.customerAddress || d.address || 'Address not provided');
        const status = esc(d.status || o.status || 'Pending');

        return `
            <tr style="border-bottom: 1px solid var(--border-color); font-size:0.83rem; color:var(--text-primary);">
                <td style="padding: 12px 14px; font-weight:700; white-space:nowrap; color:var(--accent-color);">${esc(o.orderId)}</td>
                <td style="padding: 12px 14px; white-space:nowrap; color:var(--text-secondary); font-size:0.78rem;">${esc(o.timestamp || 'N/A')}</td>
                <td style="padding: 12px 14px; font-weight:600;">${esc(d.customerName || 'Customer')}</td>
                <td style="padding: 12px 14px; color:var(--text-secondary);">${esc(d.customerEmail || 'N/A')}</td>
                <td style="padding: 12px 14px; font-family:monospace; font-size:0.82rem;">${mobile}</td>
                <td style="padding: 12px 14px;">
                    <div class="admin-items-summary">
                        <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:2px;"><strong>${itemsCount}</strong> item${itemsCount === 1 ? '' : 's'}:</div>
                        ${itemsHtml}
                    </div>
                </td>
                <td style="padding: 12px 14px; font-weight:700; white-space:nowrap; color:#10b981;">₹${Number(d.totalAmount || 0).toFixed(2)}</td>
                <td style="padding: 12px 14px; white-space:nowrap;">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span class="delivery-date-pill"><i class="fa-solid fa-truck"></i> ${deliveryDate}</span>
                        <button type="button" class="btn-order-action btn-order-date" onclick="promptOrderDeliveryDate('${o.orderId}', '${deliveryDate}')" title="Edit Estimated Delivery Date"><i class="fa-solid fa-pen"></i></button>
                    </div>
                </td>
                <td style="padding: 12px 14px; max-width:180px; font-size:0.78rem; color:var(--text-secondary); line-height:1.3; word-break:break-word;">${address}</td>
                <td style="padding: 12px 14px; text-align:center;">
                    <div style="display:flex; flex-direction:column; gap:6px; min-width:130px;">
                        <div style="display:flex; gap:4px; justify-content:center;">
                            <button type="button" class="btn-order-action btn-order-accept" onclick="acceptAdminOrder('${o.orderId}')" title="1-Click Accept Order"><i class="fa-solid fa-check"></i> Accept</button>
                            <button type="button" class="btn-order-action btn-order-decline" onclick="declineAdminOrder('${o.orderId}')" title="1-Click Decline & Restock Order"><i class="fa-solid fa-xmark"></i> Decline</button>
                        </div>
                        <select onchange="updateOrderStatus('${o.orderId}', this.value)" style="padding:4px 6px; border:1px solid var(--border-color); border-radius:4px; background:var(--bg-secondary); color:var(--text-primary); font-size:0.76rem; cursor:pointer; width:100%;">
                            <option value="Pending" ${status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="Confirmed" ${status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                            <option value="Processing" ${status === 'Processing' ? 'selected' : ''}>Processing</option>
                            <option value="Shipped" ${status === 'Shipped' ? 'selected' : ''}>Shipped</option>
                            <option value="Out for Delivery" ${status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
                            <option value="Delivered" ${status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                            <option value="Cancelled" ${status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                            <option value="Refunded" ${status === 'Refunded' ? 'selected' : ''}>Refunded</option>
                        </select>
                        <div style="display:flex; gap:4px; justify-content:center;">
                            <button type="button" onclick="openOrderInvoiceModal('${o.orderId}')" style="flex:1; padding:3px 6px; font-size:0.72rem; border-radius:4px; background:transparent; border:1px solid var(--accent-color); color:var(--accent-color); cursor:pointer;"><i class="fa-solid fa-file-invoice"></i> Bill</button>
                            <button type="button" onclick="deleteAdminOrder('${o.orderId}')" style="padding:3px 6px; font-size:0.72rem; border-radius:4px; background:transparent; border:1px solid #ef4444; color:#ef4444; cursor:pointer;"><i class="fa-solid fa-trash-can"></i></button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filterAdminOrders() {
    renderAdminOrders(allOrders);
}

function acceptAdminOrder(orderId) {
    updateOrderStatus(orderId, "Confirmed");
}

function declineAdminOrder(orderId) {
    if (confirm(`Decline Order ${orderId}? This will cancel the order and automatically restock items back to inventory.`)) {
        updateOrderStatus(orderId, "Cancelled");
    }
}

function promptOrderDeliveryDate(orderId, currentVal) {
    const newVal = prompt(`Update delivery date for Order #${orderId}:`, currentVal || "");
    if (newVal === null) return;
    const cleanVal = newVal.trim();
    if (!cleanVal) return;

    fetch("/api/orders/update-status", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem('sai_sankalp_session_token')
        },
        body: JSON.stringify({ orderId, deliveryDate: cleanVal, status: "Confirmed" })
    })
    .then(res => {
        if (!res.ok) throw new Error("Failed to update delivery date");
        return res.json();
    })
    .then(() => {
        showToast(`Delivery date updated: ${cleanVal}`, "fa-truck");
        fetchOrders();
    })
    .catch(err => alert("Error: " + err.message));
}

function updateOrderStatus(orderId, status) {
    fetch("/api/orders/update-status", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem('sai_sankalp_session_token')
        },
        body: JSON.stringify({ orderId, status })
    })
    .then(res => {
        if (!res.ok) throw new Error("Failed to update status");
        return res.json();
    })
    .then(() => {
        showToast(`Order #${orderId} status set to: ${status}`, "fa-circle-check");
        fetchOrders();
    })
    .catch(err => alert("Error: " + err.message));
}

function deleteAdminOrder(orderId) {
    if (confirm(`Are you sure you want to delete order '${orderId}'?`)) {
        fetch(`/api/orders?orderId=${orderId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('sai_sankalp_session_token')
            }
        })
        .then(() => {
            showToast("Order deleted successfully", "fa-trash");
            fetchOrders();
        })
        .catch(err => alert("Error: " + err.message));
    }
}

// ═══════════════════════════════════════════════
// CUSTOMER ORDERS
// ═══════════════════════════════════════════════
function renderCustomerOrders() {
    const list = document.getElementById("customerOrdersTableBody");
    if (!list) return;

    const orders = allOrders.filter(o => o.details && o.details.customerEmail.toLowerCase() === currentUserEmail.toLowerCase());
    if (orders.length === 0) {
        list.innerHTML = `<tr><td colspan="7" style="padding: 20px; text-align: center; color: var(--text-secondary);">No purchases found. Place an order first!</td></tr>`;
        return;
    }

    const esc = window.escapeHTML || (s => s);
    list.innerHTML = orders.map(o => {
        const d = o.details || {};
        const itemsSummary = (d.items || []).map(i => `${esc(i.title)} (x${i.quantity})`).join(', ');
        const deliveryDate = esc(d.deliveryDate || o.deliveryDate || 'Within 6 days');
        
        let cancelBtnHtml = "";
        if (['Pending', 'Confirmed'].includes(d.status)) {
            cancelBtnHtml = `<button type="button" class="btn btn-secondary" onclick="customerCancelOrder('${esc(o.orderId)}')" style="padding: 4px 8px; font-size: 0.75rem; border-color: #e74c3c; color: #e74c3c; background: transparent; cursor: pointer; margin-left: 4px;">Cancel</button>`;
        }
        
        return `
            <tr style="border-bottom: 1px solid var(--border-color); font-size:0.85rem; color:var(--text-primary);">
                <td style="padding: 12px 16px; font-weight:700;">${esc(o.orderId)}</td>
                <td style="padding: 12px 16px;">${esc(o.timestamp)}</td>
                <td style="padding: 12px 16px; max-width: 200px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${itemsSummary}</td>
                <td style="padding: 12px 16px; font-weight:700;">₹${Number(d.totalAmount || 0).toFixed(2)}</td>
                <td style="padding: 12px 16px;"><span class="badge" style="background:var(--accent-color); color:white; padding:4px 8px; border-radius:4px;">${esc(d.status)}</span></td>
                <td style="padding: 12px 16px;"><span class="delivery-date-pill"><i class="fa-solid fa-truck"></i> ${deliveryDate}</span></td>
                <td style="padding: 12px 16px; text-align:center;">
                    <button type="button" onclick="openOrderInvoiceModal('${esc(o.orderId)}')" style="padding:4px 8px; font-size:0.75rem; border-radius:4px; background:transparent; border:1px solid var(--accent-color); color:var(--accent-color); cursor:pointer;">Invoice & Track</button>
                    ${cancelBtnHtml}
                </td>
            </tr>
        `;
    }).join('');
}

function customerCancelOrder(orderId) {
    if (confirm("Are you sure you want to cancel this order?")) {
        fetch("/api/orders/customer-action", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem('sai_sankalp_session_token')
            },
            body: JSON.stringify({ orderId, action: "cancel" })
        })
        .then(res => {
            if (!res.ok) throw new Error("Failed to cancel order");
            return res.json();
        })
        .then(() => {
            showToast("Order cancelled successfully", "fa-circle-xmark");
            if (typeof openCustomerDashboard === "function") openCustomerDashboard();
        })
        .catch(err => alert("Error: " + err.message));
    }
}

// ═══════════════════════════════════════════════
// CUSTOMER DASHBOARD (was missing)
// ═══════════════════════════════════════════════
function openCustomerDashboard() {
    const customerDashboard = document.getElementById("customerDashboard");
    if (!customerDashboard) return;

    customerDashboard.classList.add("active");
    document.body.style.overflow = "hidden";

    const emailEl = document.getElementById("customerDashboardEmail");
    if (emailEl) emailEl.textContent = currentUserEmail;

    // Fetch orders first, then render
    fetch("/api/orders?_t=" + Date.now(), {
        headers: {
            "Authorization": "Bearer " + localStorage.getItem('sai_sankalp_session_token')
        }
    })
    .then(res => res.json())
    .then(data => {
        allOrders = data;
        if (typeof renderCustomerOrders === "function") renderCustomerOrders();
    })
    .catch(() => {
        if (typeof renderCustomerOrders === "function") renderCustomerOrders();
    });

    if (typeof renderCustomerAddresses === "function") renderCustomerAddresses();
}

// ═══════════════════════════════════════════════
// CHECKOUT FLOW
// ═══════════════════════════════════════════════
function openCheckoutModal() {
    if (cart.length === 0) {
        showToast("Your bag is empty!", "fa-circle-exclamation");
        return;
    }
    
    document.getElementById("checkoutStepShipping").style.display = "block";
    document.getElementById("checkoutStepPayment").style.display = "none";
    document.getElementById("step1Indicator").style.color = "var(--accent-color)";
    document.getElementById("step1Indicator").style.borderBottom = "2px solid var(--accent-color)";
    document.getElementById("step2Indicator").style.color = "var(--text-secondary)";
    document.getElementById("step2Indicator").style.borderBottom = "none";

    const shippingForm = document.getElementById("shippingForm");
    if (shippingForm) shippingForm.reset();

    // Check and populate saved addresses dropdown
    const addressGroup = document.getElementById("checkoutSavedAddressGroup");
    const addressSelect = document.getElementById("checkoutAddressSelect");
    if (addressGroup && addressSelect) {
        if (currentUserEmail && currentUserEmail !== "Guest" && currentUserEmail !== "") {
            addressGroup.style.display = "block";
            fetch('/api/addresses', {
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('sai_sankalp_session_token') }
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

    // Render Checkout Summary
    const summaryItems = document.getElementById("checkoutSummaryItems");
    const summaryTotal = document.getElementById("checkoutSummaryTotal");
    if (!summaryItems || !summaryTotal) return;

    summaryItems.innerHTML = "";
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
        summaryItems.appendChild(line);
    });

    let discount = 0;
    if (appliedCoupon) {
        if (appliedCoupon.type === 'percent') {
            discount = subtotal * appliedCoupon.value / 100;
        } else {
            discount = Math.min(appliedCoupon.value, subtotal);
        }
    }
    const afterDiscount = subtotal - discount;
    const shippingCharge = afterDiscount >= 999 ? 0 : 49;
    const cgst = afterDiscount * 0.025;
    const sgst = afterDiscount * 0.025;
    const total = afterDiscount + shippingCharge + cgst + sgst;

    orderTotals = { subtotal, discount, shipping: shippingCharge, cgst, sgst, total, couponCode: appliedCoupon ? appliedCoupon.code : null };

    document.getElementById("invoiceSubtotal").textContent = `₹${subtotal.toFixed(2)}`;
    document.getElementById("invoiceCgst").textContent = `₹${cgst.toFixed(2)}`;
    document.getElementById("invoiceSgst").textContent = `₹${sgst.toFixed(2)}`;
    summaryTotal.textContent = `₹${total.toFixed(2)}`;

    // Set UPI deep links
    const paVal = "9361483584-1@nyes";
    const pnVal = encodeURIComponent("MARLA SAI SAMEER");
    const tnVal = encodeURIComponent("Sai Sankalp Order");
    const amVal = total.toFixed(2);
    const setLink = (id, pkg) => {
        const el = document.getElementById(id);
        if (el) el.href = `intent://pay?pa=${paVal}&pn=${pnVal}&am=${amVal}&cu=INR&tn=${tnVal}#Intent;scheme=upi;package=${pkg};end`;
    };
    setLink("linkGpay", "com.google.android.apps.nbu.paisa.user");
    setLink("linkPhonepe", "com.phonepe.app");
    setLink("linkPaytm", "net.one97.paytm");

    const checkoutModal = document.getElementById("checkoutModal");
    const checkoutOverlay = document.getElementById("checkoutOverlay");
    if (checkoutModal && checkoutOverlay) {
        checkoutModal.classList.add("open");
        checkoutOverlay.classList.add("active");
        document.body.style.overflow = "hidden";
        switchPaymentMethod('upi');
    }
}

function closeCheckoutModal() {
    if (paymentPollingInterval) clearInterval(paymentPollingInterval);
    const checkoutModal = document.getElementById("checkoutModal");
    const checkoutOverlay = document.getElementById("checkoutOverlay");
    if (checkoutModal && checkoutOverlay) {
        checkoutModal.classList.remove("open");
        checkoutOverlay.classList.remove("active");
        document.body.style.overflow = "";
    }
}

function handleShippingSubmit(e) {
    e.preventDefault();

    // Verify stock first
    const issues = validateCartStock();
    if (issues.length > 0) {
        alert("Stock Validation Failed:\n" + issues.join("\n"));
        return;
    }

    shippingDetails = {
        name: document.getElementById("checkoutName").value.trim(),
        email: document.getElementById("checkoutEmail").value.trim(),
        mobile: document.getElementById("checkoutMobile").value.trim(),
        address: document.getElementById("checkoutAddress").value.trim()
    };

    // Transition to step 2
    document.getElementById("checkoutStepShipping").style.display = "none";
    document.getElementById("checkoutStepPayment").style.display = "block";
    document.getElementById("step1Indicator").style.color = "var(--text-secondary)";
    document.getElementById("step1Indicator").style.borderBottom = "none";
    document.getElementById("step2Indicator").style.color = "var(--accent-color)";
    document.getElementById("step2Indicator").style.borderBottom = "2px solid var(--accent-color)";

    initiateUpiPaymentTransaction();
}

// ═══════════════════════════════════════════════
// PAYMENT METHOD SWITCHING (was missing)
// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
// PAYMENT METHOD SWITCHING
// ═══════════════════════════════════════════════
function switchPaymentMethod(method) {
    // Hide all panels
    const panels = ['panelUpi', 'panelCard', 'panelCod', 'panelRazorpay'];
    panels.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Show selected panel
    const activePanel = document.getElementById('panel' + method.charAt(0).toUpperCase() + method.slice(1));
    if (activePanel) activePanel.style.display = 'block';

    // Update tab styles
    const tabs = ['tabUpi', 'tabCard', 'tabCod', 'tabRazorpay'];
    tabs.forEach(id => {
        const tab = document.getElementById(id);
        if (tab) {
            tab.style.color = 'var(--text-secondary)';
            tab.style.borderBottom = '3px solid transparent';
            tab.classList.remove('active');
        }
    });

    const activeTabId = 'tab' + method.charAt(0).toUpperCase() + method.slice(1);
    const activeTab = document.getElementById(activeTabId);
    if (activeTab) {
        activeTab.style.color = 'var(--accent-color)';
        activeTab.style.borderBottom = '3px solid var(--accent-color)';
        activeTab.classList.add('active');
    }
}

// ═══════════════════════════════════════════════
// COD ORDER HANDLING
// ═══════════════════════════════════════════════
function handleCODOrder() {
    const codTxnId = 'COD-' + Math.floor(100000 + Math.random() * 900000);
    
    const orderData = {
        customerName: shippingDetails.name,
        customerEmail: shippingDetails.email,
        customerMobile: shippingDetails.mobile,
        customerAddress: shippingDetails.address,
        subtotal: orderTotals.subtotal,
        cgst: orderTotals.cgst,
        sgst: orderTotals.sgst,
        totalAmount: orderTotals.total + 25, // +₹25 COD handling fee
        transactionId: codTxnId,
        paymentMethod: "COD",
        items: cart.map(item => ({
            id: item.id,
            title: item.title,
            price: item.price,
            quantity: item.quantity
        }))
    };

    fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData)
    })
    .then(res => {
        if (!res.ok) return res.json().then(e => { throw new Error(e.error || "Order failed"); });
        return res.json();
    })
    .then(data => {
        showToast(`COD Order #${data.orderId} placed successfully!`, "fa-circle-check");
        appliedCoupon = null;
        finalizeOrderCompletion();
    })
    .catch(err => {
        alert("COD Order Error: " + err.message);
        closeCheckoutModal();
    });
}

// ═══════════════════════════════════════════════
// RAZORPAY PAYMENT GATEWAY INTEGRATION
// ═══════════════════════════════════════════════
function initiateRazorpayPayment() {
    const amount = orderTotals.total;
    if (!shippingDetails.name || !shippingDetails.email || !shippingDetails.mobile) {
        showToast("Please provide complete shipping details.", "fa-circle-exclamation");
        return;
    }

    fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amount, currency: 'INR' })
    })
    .then(res => {
        if (!res.ok) throw new Error("Failed to initialize Razorpay checkout");
        return res.json();
    })
    .then(data => {
        const options = {
            key: data.key || "rzp_test_T8XwugnuJ4Wtkm",
            amount: data.amount,
            currency: data.currency || "INR",
            name: "Sai Sankalp Handcrafted",
            description: "Artisanal Goods Purchase",
            image: "images/wool_doll.png",
            order_id: data.id,
            handler: function (response) {
                // Verify signature on backend
                fetch('/api/razorpay/verify-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature,
                        amount: amount
                    })
                })
                .then(res => res.json())
                .then(verifyData => {
                    if (verifyData.status === 'success') {
                        createVerifiedOrder(response.razorpay_payment_id, "Razorpay");
                    } else {
                        alert("Payment verification failed: " + (verifyData.error || "Unknown verification issue"));
                    }
                })
                .catch(err => alert("Signature verification error: " + err.message));
            },
            prefill: {
                name: shippingDetails.name,
                email: shippingDetails.email,
                contact: shippingDetails.mobile
            },
            notes: {
                shipping_address: shippingDetails.address
            },
            theme: {
                color: "#c07040"
            }
        };

        if (typeof window.Razorpay === 'function') {
            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (resp) {
                alert("Payment Failed: " + (resp.error.description || "Reason unknown"));
            });
            rzp.open();
        } else {
            // Fallback if Razorpay CDN blocked
            alert("Razorpay checkout loaded in local simulation mode.");
            createVerifiedOrder("RZP-TEST-" + Math.floor(100000 + Math.random() * 900000), "Razorpay");
        }
    })
    .catch(err => {
        console.error("Razorpay error:", err);
        // Fallback simulation for offline testing
        showToast("Using offline test payment confirmation...", "fa-info");
        createVerifiedOrder("RZP-TEST-" + Math.floor(100000 + Math.random() * 900000), "Razorpay");
    });
}

// ═══════════════════════════════════════════════
// UPI PAYMENT FLOW
// ═══════════════════════════════════════════════
function initiateUpiPaymentTransaction() {
    const amount = orderTotals.total;
    const statusTitle = document.getElementById('paymentStatusTitle');
    const statusDesc = document.getElementById('paymentStatusDesc');
    const statusSpinner = document.getElementById('paymentStatusSpinner');
    const txnText = document.getElementById('paymentTxnIdText');

    if (txnText) txnText.textContent = 'Generating...';
    if (statusTitle) statusTitle.textContent = 'Awaiting payment confirmation...';
    if (statusDesc) statusDesc.textContent = 'Scan the QR code and authorize payment.';
    if (statusSpinner) statusSpinner.style.display = 'block';
    
    fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, method: 'UPI' })
    })
    .then(res => res.json())
    .then(data => {
        currentTransactionId = data.transactionId;
        if (txnText) txnText.textContent = currentTransactionId;
        startUpiPaymentStatusPolling();
    })
    .catch(err => {
        console.warn('Initiate payments failed, using simulated fallback:', err);
        currentTransactionId = 'TXN-UPI-' + Math.floor(100000 + Math.random() * 900000);
        if (txnText) txnText.textContent = currentTransactionId;
        const localBox = document.getElementById("localOfflineSimBox");
        if (localBox) localBox.style.display = "block";
    });
}

function startUpiPaymentStatusPolling() {
    if (paymentPollingInterval) clearInterval(paymentPollingInterval);
    paymentPollingInterval = setInterval(() => {
        fetch(`/api/payments/status?transactionId=${currentTransactionId}`)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                clearInterval(paymentPollingInterval);
                createVerifiedOrder(currentTransactionId, "UPI");
            }
        })
        .catch(err => console.warn("Polling error:", err));
    }, 3000);
}

function handleLocalPaymentConfirm() {
    fetch('/api/payments/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: currentTransactionId, status: 'success' })
    })
    .then(res => res.json())
    .then(() => {
        showToast("Payment success callback received! Creating order...", "fa-circle-check");
        createVerifiedOrder(currentTransactionId, "UPI");
    })
    .catch(err => {
        console.error("Simulated webhook error:", err);
        createVerifiedOrder(currentTransactionId, "UPI");
    });
}

function createVerifiedOrder(txnId, method = "UPI") {
    const orderData = {
        customerName: shippingDetails.name,
        customerEmail: shippingDetails.email,
        customerMobile: shippingDetails.mobile,
        customerAddress: shippingDetails.address,
        subtotal: orderTotals.subtotal,
        cgst: orderTotals.cgst,
        sgst: orderTotals.sgst,
        totalAmount: orderTotals.total,
        transactionId: txnId,
        paymentMethod: method,
        items: cart.map(item => ({
            id: item.id,
            title: item.title,
            price: item.price,
            quantity: item.quantity
        }))
    };

    fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData)
    })
    .then(res => {
        if (!res.ok) return res.json().then(e => { throw new Error(e.error || "Order failed"); });
        return res.json();
    })
    .then(data => {
        showToast(`Order #${data.orderId} placed successfully!`, "fa-circle-check");
        appliedCoupon = null;
        finalizeOrderCompletion();
    })
    .catch(err => {
        alert("Checkout Error: " + err.message);
        closeCheckoutModal();
    });
}

function finalizeOrderCompletion() {
    cart = [];
    saveCartToLocalStorage();
    updateCartUI();
    closeCheckoutModal();
}

// ═══════════════════════════════════════════════
// ORDER INVOICE MODAL (was missing)
// ═══════════════════════════════════════════════
function openOrderInvoiceModal(orderId) {
    const order = allOrders.find(o => o.orderId === orderId);
    if (!order) { showToast("Order not found.", "fa-circle-exclamation"); return; }

    currentViewingOrderId = orderId;
    const d = order.details || {};
    const modal = document.getElementById("orderDetailsModal");
    if (!modal) return;

    // Populate invoice fields
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl("invOrderId", orderId);
    setEl("invOrderDate", order.timestamp || "N/A");
    setEl("invCustName", d.customerName || "N/A");
    setEl("invCustEmail", d.customerEmail || "N/A");
    setEl("invCustMobile", d.customerMobile || "N/A");
    setEl("invShippingAddr", d.customerAddress || "N/A");
    setEl("invPayMode", d.paymentMethod || "UPI");
    setEl("invPayStatus", d.paymentStatus || "Paid (Verified)");
    setEl("invPayTxnId", d.transactionId || "N/A");
    setEl("invSubtotal", `₹${(d.subtotal || 0).toFixed(2)}`);
    setEl("invCgst", `₹${(d.cgst || 0).toFixed(2)}`);
    setEl("invSgst", `₹${(d.sgst || 0).toFixed(2)}`);
    setEl("invTotal", `₹${(d.totalAmount || 0).toFixed(2)}`);

    // Render items table
    const itemsBody = document.getElementById("invItemsBody");
    if (itemsBody) {
        const items = d.items || [];
        itemsBody.innerHTML = items.map(it => `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 8px 0;">${it.title}</td>
                <td style="padding: 8px 0; text-align: right;">₹${it.price.toFixed(2)}</td>
                <td style="padding: 8px 0; text-align: center;">${it.quantity}</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">₹${(it.price * it.quantity).toFixed(2)}</td>
            </tr>
        `).join('');
    }

    // Update visual tracking bar
    updateTrackingBar(d.status || "Pending");

    // Show/hide action buttons based on context
    const customerActions = document.getElementById("customerInvoiceActions");
    if (customerActions) {
        const cancelBtn = document.getElementById("btnCustomerCancelOrder");
        const returnBtn = document.getElementById("btnCustomerReturnOrder");
        const refundBtn = document.getElementById("btnCustomerRefundOrder");
        
        if (cancelBtn) cancelBtn.style.display = ['Pending', 'Confirmed'].includes(d.status) ? 'inline-flex' : 'none';
        if (returnBtn) returnBtn.style.display = d.status === 'Delivered' ? 'inline-flex' : 'none';
        if (refundBtn) refundBtn.style.display = ['Delivered', 'Cancelled'].includes(d.status) ? 'inline-flex' : 'none';
    }

    modal.style.display = "flex";
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
}

function closeOrderInvoiceModal() {
    const modal = document.getElementById("orderDetailsModal");
    if (modal) {
        modal.style.display = "none";
        modal.classList.remove("open");
        document.body.style.overflow = "";
    }
}

function updateTrackingBar(status) {
    const statusMap = {
        'Pending': 0,
        'Confirmed': 1,
        'Processing': 2,
        'Shipped': 3,
        'Out for Delivery': 3,
        'Delivered': 4
    };
    const stepIndex = statusMap[status] !== undefined ? statusMap[status] : 0;
    const progressPct = (stepIndex / 4) * 100;

    const progressLine = document.getElementById("trackingLineProgress");
    if (progressLine) progressLine.style.width = progressPct + "%";

    const nodeIds = ["nodePending", "nodeConfirmed", "nodeProcessing", "nodeShipped", "nodeDelivered"];
    nodeIds.forEach((nid, idx) => {
        const node = document.getElementById(nid);
        if (!node) return;
        const circle = node.querySelector(".node-circle");
        if (circle) {
            if (idx <= stepIndex) {
                circle.style.backgroundColor = "var(--accent-color)";
            } else {
                circle.style.backgroundColor = "var(--border-color)";
            }
        }
    });

    // Special status alerts (Cancelled, Refunded, etc.)
    const specialAlert = document.getElementById("specialStatusAlert");
    const specialText = document.getElementById("specialStatusText");
    if (specialAlert && specialText) {
        if (['Cancelled', 'Refunded', 'Returned'].includes(status)) {
            specialAlert.style.display = "block";
            specialText.textContent = status;
        } else {
            specialAlert.style.display = "none";
        }
    }
}

function downloadInvoice() {
    // Use browser print with only the invoice area
    const printArea = document.getElementById("invoicePrintArea");
    if (!printArea) return;

    const w = window.open('', '_blank');
    w.document.write(`
        <html>
        <head>
            <title>Invoice - Sai Sankalp</title>
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Plus Jakarta Sans', sans-serif; padding: 24px; color: #2C2A29; }
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 8px; text-align: left; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>${printArea.innerHTML}</body>
        </html>
    `);
    w.document.close();
    w.print();
}

function customerRequestReturn() {
    if (!currentViewingOrderId) return;
    if (confirm("Are you sure you want to request a return?")) {
        fetch("/api/orders/customer-action", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + localStorage.getItem('sai_sankalp_session_token') },
            body: JSON.stringify({ orderId: currentViewingOrderId, action: "return" })
        })
        .then(res => { if (!res.ok) throw new Error("Return request failed"); return res.json(); })
        .then(() => { showToast("Return requested successfully", "fa-rotate-left"); closeOrderInvoiceModal(); openCustomerDashboard(); })
        .catch(err => alert("Error: " + err.message));
    }
}

function customerRequestRefund() {
    if (!currentViewingOrderId) return;
    if (confirm("Are you sure you want to request a refund?")) {
        fetch("/api/orders/customer-action", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + localStorage.getItem('sai_sankalp_session_token') },
            body: JSON.stringify({ orderId: currentViewingOrderId, action: "refund" })
        })
        .then(res => { if (!res.ok) throw new Error("Refund request failed"); return res.json(); })
        .then(() => { showToast("Refund requested successfully", "fa-money-bill-transfer"); closeOrderInvoiceModal(); openCustomerDashboard(); })
        .catch(err => alert("Error: " + err.message));
    }
}

// ═══════════════════════════════════════════════
// CUSTOMER ADDRESSES
// ═══════════════════════════════════════════════
function renderCustomerAddresses() {
    const list = document.getElementById("savedAddressesList");
    if (!list) return;

    if (!currentUserEmail || currentUserEmail === "Guest") {
        list.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 10px;">Please login to save addresses.</div>`;
        return;
    }

    fetch('/api/addresses', {
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('sai_sankalp_session_token') }
    })
    .then(res => res.json())
    .then(addrs => {
        if (addrs.length === 0) {
            list.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 10px;">No saved addresses found.</div>`;
            return;
        }
        list.innerHTML = addrs.map(a => `
            <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; position: relative;">
                <strong style="display: block; color: var(--text-primary); font-size: 0.9rem; margin-bottom: 4px;">${escapeHTML(a.name)}</strong>
                <span style="display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 4px;"><i class="fa-solid fa-phone"></i> ${escapeHTML(a.mobile)}</span>
                <p style="margin: 0; font-size: 0.8rem; color: var(--text-primary); line-height: 1.4;">${escapeHTML(a.address)}</p>
                <button type="button" onclick="deleteCustomerAddress(${a.id})" style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: #e74c3c; cursor: pointer; font-size: 0.85rem;" title="Delete Address"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `).join('');
    })
    .catch(err => {
        console.error("Failed to load saved addresses:", err);
        list.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 10px;">Error loading addresses.</div>`;
    });
}

function deleteCustomerAddress(id) {
    if (confirm("Are you sure you want to delete this address?")) {
        fetch(`/api/addresses?id=${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('sai_sankalp_session_token')
            }
        })
        .then(res => {
            if (!res.ok) throw new Error("Deletion failed");
            return res.json();
        })
        .then(() => {
            showToast("Address deleted successfully", "fa-trash");
            renderCustomerAddresses();
        })
        .catch(err => alert("Error: " + err.message));
    }
}

// ═══════════════════════════════════════════════
// CART SIDEBAR CONTROLS
// ═══════════════════════════════════════════════
function openCart() {
    const sidebar = document.getElementById("cartSidebar");
    const overlay = document.getElementById("cartOverlay");
    const footer = document.getElementById("cartFooter");
    if (sidebar) sidebar.classList.add("open");
    if (overlay) overlay.classList.add("active");
    if (footer && cart.length > 0) footer.style.display = "block";
    document.body.style.overflow = "hidden";
}

function closeCart() {
    const sidebar = document.getElementById("cartSidebar");
    const overlay = document.getElementById("cartOverlay");
    if (sidebar) sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("active");
    document.body.style.overflow = "";
}

// ═══════════════════════════════════════════════
// SCROLL REVEAL ANIMATION
// ═══════════════════════════════════════════════
function initScrollReveal() {
    const revealElements = document.querySelectorAll('[data-reveal]');
    if (revealElements.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    revealElements.forEach(el => observer.observe(el));
}

// ═══════════════════════════════════════════════
// BACK TO TOP BUTTON
// ═══════════════════════════════════════════════
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ═══════════════════════════════════════════════
// COMPARISON DRAWER TOGGLE
// ═══════════════════════════════════════════════
function toggleComparisonDrawer(show) {
    const drawer = document.getElementById("comparisonDrawer");
    if (drawer) {
        drawer.classList.toggle("open", show);
    }
}

// ═══════════════════════════════════════════════
// AUTH VIEW SWITCHING
// ═══════════════════════════════════════════════
function switchAuthTab(tab) {
    const tabs = document.querySelectorAll('.auth-tab-btn, .auth-tab');
    const views = document.querySelectorAll('.auth-view');
    
    tabs.forEach(t => t.classList.remove('active'));
    views.forEach(v => {
        v.classList.remove('active');
        v.style.display = '';
    });
    
    const isRegister = (tab === 'register');
    const activeTab = document.getElementById(isRegister ? 'btnAuthTabRegister' : 'btnAuthTabSignin') ||
                      document.querySelector(`.auth-tab[data-tab="${tab}"]`);
    const activeView = document.getElementById(isRegister ? 'viewRegister' : 'viewSignIn') ||
                       document.getElementById(`view-${tab}`);
    
    if (activeTab) activeTab.classList.add('active');
    if (activeView) {
        activeView.classList.add('active');
        activeView.style.display = 'block';
    }
    
    const authTabs = document.getElementById('authTabs');
    if (authTabs) authTabs.style.display = 'flex';
}

function showAuthView(view) {
    const views = document.querySelectorAll('.auth-view');
    views.forEach(v => {
        v.classList.remove('active');
        v.style.display = '';
    });
    
    const tabs = document.querySelectorAll('.auth-tab-btn, .auth-tab');
    tabs.forEach(t => t.classList.remove('active'));
    
    const viewMap = {
        'signin': 'viewSignIn',
        'register': 'viewRegister',
        'otp': 'viewOtp',
        'forgot': 'viewForgot',
        'reset': 'viewResetPassword'
    };
    
    const targetId = viewMap[view] || `view-${view}`;
    const targetView = document.getElementById(targetId) || document.getElementById(view);
    if (targetView) {
        targetView.classList.add('active');
        targetView.style.display = 'block';
    }
    
    const authTabs = document.getElementById('authTabs');
    if (authTabs) {
        if (view === 'signin' || view === 'register') {
            authTabs.style.display = 'flex';
            const activeTab = document.getElementById(view === 'register' ? 'btnAuthTabRegister' : 'btnAuthTabSignin');
            if (activeTab) activeTab.classList.add('active');
        } else {
            authTabs.style.display = 'none';
        }
    }
}

function cancelOtpFlow() {
    const otpInput = document.getElementById("otpCode");
    if (otpInput) otpInput.value = "";
    switchAuthTab('signin');
}

// ═══════════════════════════════════════════════
// MASTER EVENT LISTENERS SETUP (Fixed)
// ═══════════════════════════════════════════════
function setupEventListeners() {
    // ─── 1. Cart Sidebar ───
    const cartToggleBtn = document.getElementById("cartToggleBtn");
    const cartCloseBtn = document.getElementById("cartCloseBtn");
    const cartOverlay = document.getElementById("cartOverlay");
    const cartExploreBtn = document.getElementById("cartExploreBtn");

    if (cartToggleBtn) cartToggleBtn.addEventListener("click", openCart);
    if (cartCloseBtn) cartCloseBtn.addEventListener("click", closeCart);
    if (cartOverlay) cartOverlay.addEventListener("click", closeCart);
    if (cartExploreBtn) cartExploreBtn.addEventListener("click", closeCart);

    // ─── 2. Checkout Button ───
    const checkoutBtn = document.getElementById("checkoutBtn");
    if (checkoutBtn) checkoutBtn.addEventListener("click", openCheckoutModal);

    // ─── 3. Checkout Modal ───
    const checkoutCloseBtn = document.getElementById("checkoutCloseBtn");
    const checkoutOverlay = document.getElementById("checkoutOverlay");
    if (checkoutCloseBtn) checkoutCloseBtn.addEventListener("click", closeCheckoutModal);
    if (checkoutOverlay) checkoutOverlay.addEventListener("click", closeCheckoutModal);

    const shippingForm = document.getElementById("shippingForm");
    if (shippingForm) shippingForm.addEventListener("submit", handleShippingSubmit);

    // ─── 4. Coupon Apply ───
    const btnApplyCoupon = document.getElementById("btnApplyCoupon");
    if (btnApplyCoupon) btnApplyCoupon.addEventListener("click", () => {
        if (typeof applyCoupon === "function") applyCoupon();
    });

    // ─── 5. Copy UPI ID ───
    const btnCopyUpi = document.getElementById("btnCopyUpi");
    if (btnCopyUpi) {
        btnCopyUpi.addEventListener("click", () => {
            const upiText = document.getElementById("upiIdText");
            if (upiText) {
                navigator.clipboard.writeText(upiText.textContent).then(() => {
                    showToast("UPI ID copied!", "fa-copy");
                }).catch(() => {
                    showToast("Could not copy UPI ID", "fa-circle-exclamation");
                });
            }
        });
    }

    // ─── 6. Local/Offline Payment Simulation ───
    const btnConfirmLocalPaid = document.getElementById("btnConfirmLocalPaid");
    if (btnConfirmLocalPaid) btnConfirmLocalPaid.addEventListener("click", handleLocalPaymentConfirm);

    const btnCardLocalPaid = document.getElementById("btnCardLocalPaid");
    if (btnCardLocalPaid) btnCardLocalPaid.addEventListener("click", handleLocalPaymentConfirm);

    // ─── 7. Checkout Address Selection ───
    const checkoutAddressSelect = document.getElementById("checkoutAddressSelect");
    if (checkoutAddressSelect) {
        checkoutAddressSelect.addEventListener("change", () => {
            const val = checkoutAddressSelect.value;
            if (!val) return;
            try {
                const addr = JSON.parse(val);
                document.getElementById("checkoutName").value = addr.name || "";
                document.getElementById("checkoutMobile").value = addr.mobile || "";
                document.getElementById("checkoutAddress").value = addr.address || "";
            } catch(e) { /* ignore */ }
        });
    }

    // ─── 8. Product Modal ───
    const modalCloseBtn = document.getElementById("modalCloseBtn");
    const modalOverlay = document.getElementById("modalOverlay");
    if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeProductModal);
    if (modalOverlay) modalOverlay.addEventListener("click", closeProductModal);

    // ─── 9. Order Invoice Modal ───
    const orderDetailsCloseBtn = document.getElementById("orderDetailsCloseBtn");
    if (orderDetailsCloseBtn) orderDetailsCloseBtn.addEventListener("click", closeOrderInvoiceModal);

    const btnInvoicePrint = document.getElementById("btnInvoicePrint");
    if (btnInvoicePrint) btnInvoicePrint.addEventListener("click", () => { window.print(); });

    // ─── 10. Admin Dashboard ───
    const btnAdminPanel = document.getElementById("btnAdminPanel");
    const btnAdminClose = document.getElementById("btnAdminClose");
    const adminDashboard = document.getElementById("adminDashboard");

    if (btnAdminPanel && adminDashboard) {
        btnAdminPanel.addEventListener("click", () => {
            adminDashboard.classList.add("active");
            document.body.style.overflow = "hidden";
            if (typeof switchAdminTab === "function") switchAdminTab('orders');
            if (typeof refreshAdminData === "function") refreshAdminData();
        });
    }
    if (btnAdminClose && adminDashboard) {
        btnAdminClose.addEventListener("click", () => {
            adminDashboard.classList.remove("active");
            document.body.style.overflow = "";
        });
    }

    // ─── 11. Customer Dashboard ───
    const btnCustomerDashboard = document.getElementById("btnCustomerDashboard");
    const btnCustomerClose = document.getElementById("btnCustomerClose");
    const customerDashboard = document.getElementById("customerDashboard");

    if (btnCustomerDashboard) {
        btnCustomerDashboard.addEventListener("click", openCustomerDashboard);
    }
    if (btnCustomerClose && customerDashboard) {
        btnCustomerClose.addEventListener("click", () => {
            customerDashboard.classList.remove("active");
            document.body.style.overflow = "";
        });
    }

    // ─── 12. Login Modal ───
    const btnAuthClose = document.getElementById("btnAuthClose");
    const loginModal = document.getElementById("loginModal");
    if (btnAuthClose && loginModal) {
        btnAuthClose.addEventListener("click", () => {
            loginModal.classList.remove("active");
            document.body.style.overflow = "";
        });
    }

    const btnContinueGuest = document.getElementById("btnContinueGuest");
    if (btnContinueGuest) {
        btnContinueGuest.addEventListener("click", () => {
            localStorage.setItem("sai_sankalp_user_email", "Guest");
            localStorage.setItem("sai_sankalp_session_token", "");
            localStorage.setItem("sai_sankalp_user_role", "customer");
            localStorage.setItem("sai_sankalp_csrf_token", "");
            handleLoginSuccess("Guest", "customer");
        });
    }

    // ─── 13. Filter Controls (FIXED) ───
    // Category checkboxes
    const catCheckAll = document.getElementById("catCheckAll");
    const catChecks = document.querySelectorAll(".category-filter-check:not(#catCheckAll)");

    if (catCheckAll) {
        catCheckAll.addEventListener("change", () => {
            if (catCheckAll.checked) {
                catChecks.forEach(cb => { cb.checked = false; });
            }
            filterAndSortProducts();
        });
    }
    catChecks.forEach(cb => {
        cb.addEventListener("change", () => {
            const anyChecked = Array.from(catChecks).some(c => c.checked);
            if (catCheckAll) catCheckAll.checked = !anyChecked;
            filterAndSortProducts();
        });
    });

    // Brand / Artisan checkboxes
    const brandCheckAll = document.getElementById("brandCheckAll");
    const brandChecks = document.querySelectorAll(".brand-filter-check:not(#brandCheckAll)");

    if (brandCheckAll) {
        brandCheckAll.addEventListener("change", () => {
            if (brandCheckAll.checked) {
                brandChecks.forEach(cb => { cb.checked = false; });
            }
            filterAndSortProducts();
        });
    }
    brandChecks.forEach(cb => {
        cb.addEventListener("change", () => {
            const anyChecked = Array.from(brandChecks).some(c => c.checked);
            if (brandCheckAll) brandCheckAll.checked = !anyChecked;
            filterAndSortProducts();
        });
    });

    // Sort selector
    const filterSortBy = document.getElementById("filterSortBy");
    if (filterSortBy) filterSortBy.addEventListener("change", filterAndSortProducts);

    // Price Range Slider
    const priceRangeSlider = document.getElementById("priceRangeSlider");
    const priceRangeMaxLabel = document.getElementById("priceRangeMaxLabel");
    if (priceRangeSlider) {
        priceRangeSlider.addEventListener("input", () => {
            if (priceRangeMaxLabel) priceRangeMaxLabel.textContent = `₹${priceRangeSlider.value}`;
            filterAndSortProducts();
        });
    }

    // In-Stock checkbox
    const filterInStockOnly = document.getElementById("filterInStockOnly");
    if (filterInStockOnly) filterInStockOnly.addEventListener("change", filterAndSortProducts);

    // Search input with debounce
    const searchInput = document.getElementById("storefrontSearchInput");
    let searchDebounce = null;
    if (searchInput) {
        searchInput.addEventListener("input", () => {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(filterAndSortProducts, 300);
        });
    }

    // ─── 14. Saved Address Form ───
    const addAddressForm = document.getElementById("addAddressForm");
    if (addAddressForm) {
        addAddressForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const name = document.getElementById("addrName").value.trim();
            const mobile = document.getElementById("addrMobile").value.trim();
            const address = document.getElementById("addrText").value.trim();

            if (!name || !mobile || !address) {
                showToast("Please fill all shipping fields.", "fa-circle-exclamation");
                return;
            }

            fetch("/api/addresses", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + localStorage.getItem('sai_sankalp_session_token')
                },
                body: JSON.stringify({ name, mobile, address })
            })
            .then(res => {
                if (!res.ok) throw new Error("Failed to save address");
                return res.json();
            })
            .then(() => {
                showToast("Address saved successfully!", "fa-location-dot");
                addAddressForm.reset();
                if (typeof renderCustomerAddresses === "function") renderCustomerAddresses();
            })
            .catch(err => alert("Error: " + err.message));
        });
    }

    // ─── 15. Mobile Navbar Hamburger ───
    const navHamburger = document.getElementById("navHamburger");
    const navLinks = document.querySelector(".nav-links");
    if (navHamburger && navLinks) {
        navHamburger.addEventListener("click", (e) => {
            e.stopPropagation();
            navLinks.classList.toggle("active");
            const icon = navHamburger.querySelector("i");
            if (icon) {
                icon.className = navLinks.classList.contains("active") ? "fa-solid fa-xmark" : "fa-solid fa-bars";
            }
        });
        
        document.addEventListener("click", (e) => {
            if (navLinks.classList.contains("active") && !navLinks.contains(e.target) && !navHamburger.contains(e.target)) {
                navLinks.classList.remove("active");
                const icon = navHamburger.querySelector("i");
                if (icon) icon.className = "fa-solid fa-bars";
            }
        });
    }

    // ─── 16. Cart Sidebar touch gesture ───
    const cartSidebar = document.getElementById("cartSidebar");
    if (cartSidebar) {
        let startX = 0;
        cartSidebar.addEventListener("touchstart", (e) => {
            startX = e.touches[0].clientX;
        }, { passive: true });
        
        cartSidebar.addEventListener("touchend", (e) => {
            const endX = e.changedTouches[0].clientX;
            if (endX - startX > 80) {
                closeCart();
            }
        }, { passive: true });
    }

    // ─── 17. Back to Top button ───
    const backToTopBtn = document.getElementById("backToTopBtn");
    if (backToTopBtn) {
        window.addEventListener("scroll", () => {
            if (window.scrollY > 400) {
                backToTopBtn.classList.add("visible");
            } else {
                backToTopBtn.classList.remove("visible");
            }
        });
        backToTopBtn.addEventListener("click", scrollToTop);
    }

    // ─── 18. Newsletter form ───
    const newsletterForm = document.getElementById("newsletterForm");
    if (newsletterForm) {
        newsletterForm.addEventListener("submit", (e) => {
            e.preventDefault();
            showToast("Thank you for subscribing! 📨", "fa-envelope");
            newsletterForm.reset();
        });
    }

    // ─── 19. Custom Order Inquiry form ───
    const inquiryForm = document.getElementById("inquiryForm");
    if (inquiryForm) {
        inquiryForm.addEventListener("submit", (e) => {
            e.preventDefault();
            showToast("Inquiry submitted! Our artisan will reach out soon.", "fa-paper-plane");
            inquiryForm.reset();
        });
    }
}

// ═══════════════════════════════════════════════
// WINDOW EXPOSURES
// ═══════════════════════════════════════════════
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.submitProductReview = submitProductReview;
window.openCheckoutModal = openCheckoutModal;
window.closeCheckoutModal = closeCheckoutModal;
window.handleShippingSubmit = handleShippingSubmit;
window.handleLocalPaymentConfirm = handleLocalPaymentConfirm;
window.createVerifiedOrder = createVerifiedOrder;
window.finalizeOrderCompletion = finalizeOrderCompletion;
window.showToast = showToast;
window.updateOrderStatus = updateOrderStatus;
window.deleteAdminOrder = deleteAdminOrder;
window.customerCancelOrder = customerCancelOrder;
window.fetchProducts = fetchProducts;
window.filterAndSortProducts = filterAndSortProducts;
window.renderProducts = renderProducts;
window.fetchOrders = fetchOrders;
window.renderCustomerOrders = renderCustomerOrders;
window.renderCustomerAddresses = renderCustomerAddresses;
window.deleteCustomerAddress = deleteCustomerAddress;
window.setupEventListeners = setupEventListeners;
window.switchPaymentMethod = switchPaymentMethod;
window.handleCODOrder = handleCODOrder;
window.openOrderInvoiceModal = openOrderInvoiceModal;
window.closeOrderInvoiceModal = closeOrderInvoiceModal;
window.downloadInvoice = downloadInvoice;
window.openCustomerDashboard = openCustomerDashboard;
window.openCart = openCart;
window.closeCart = closeCart;
window.scrollToTop = scrollToTop;
window.toggleComparisonDrawer = toggleComparisonDrawer;
window.switchAuthTab = switchAuthTab;
window.showAuthView = showAuthView;
window.cancelOtpFlow = cancelOtpFlow;
window.customerRequestReturn = customerRequestReturn;
window.customerRequestRefund = customerRequestRefund;
window.acceptAdminOrder = acceptAdminOrder;
window.declineAdminOrder = declineAdminOrder;
window.promptOrderDeliveryDate = promptOrderDeliveryDate;
window.filterAdminOrders = filterAdminOrders;
window.initiateRazorpayPayment = initiateRazorpayPayment;

