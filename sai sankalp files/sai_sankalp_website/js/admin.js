// Sai Sankalp Store Administration Module

function switchAdminTab(tab) {
    const tabs = {
        'orders': {
            btn: document.
            ("tabAdminOrders") || document.getElementById("tabOrders"),
            panel: document.getElementById("panelAdminOrders") || document.getElementById("panelOrders")
        },
        'products': {
            btn: document.getElementById("tabAdminProducts") || document.getElementById("tabProducts"),
            panel: document.getElementById("panelAdminProducts") || document.getElementById("panelProducts")
        },
        'analytics': {
            btn: document.getElementById("tabAdminAnalytics") || document.getElementById("tabAnalytics"),
            panel: document.getElementById("panelAdminAnalytics") || document.getElementById("panelAnalytics")
        },
        'promo': {
            btn: document.getElementById("tabAdminPromo") || document.getElementById("tabPromo"),
            panel: document.getElementById("panelAdminPromo") || document.getElementById("panelPromo")
        },
        'gateway': {
            btn: document.getElementById("tabAdminGateway"),
            panel: document.getElementById("panelAdminGateway")
        }
    };

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
    if (typeof fetchOrders === "function") fetchOrders();
    renderAdminProductsList();
}

function renderAdminProductsList(filterTerm) {
    const container = document.getElementById("adminProductsList");
    if (!container) return;

    let list = PRODUCTS;
    const query = (filterTerm !== undefined ? filterTerm : (document.getElementById("adminProductSearch") ? document.getElementById("adminProductSearch").value : "")).trim().toLowerCase();

    if (query) {
        list = PRODUCTS.filter(p =>
            (p.title && p.title.toLowerCase().includes(query)) ||
            (p.categoryName && p.categoryName.toLowerCase().includes(query)) ||
            (p.description && p.description.toLowerCase().includes(query)) ||
            String(p.id).includes(query)
        );
    }

    if (list.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--text-secondary); padding:20px;">No products match query.</div>`;
        return;
    }

    container.innerHTML = list.map(p => {
        const stock = p.stock !== undefined ? p.stock : 10;
        let stockClass = "badge-success";
        if (stock === 0) stockClass = "badge-danger";
        else if (stock <= 3) stockClass = "badge-warning";

        return `
            <div class="admin-product-card" style="border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; display: flex; align-items: center; gap: 12px; background: var(--bg-primary);">
                <img src="${p.image}" alt="${p.title}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'300\' viewBox=\'0 0 100 100\'><rect width=\'100\' height=\'100\' fill=\'%23f4efeb\'/><text x=\'50\' y=\'55\' font-family=\'sans-serif\' font-size=\'10\' fill=\'%236a6562\' text-anchor=\'middle\'>No Image</text></svg>';">
                <div style="flex-grow:1; font-size:0.85rem;">
                    <div style="font-weight: 700; color: var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:160px;">${p.title}</div>
                    <div style="color: var(--text-secondary); font-size:0.75rem; margin-top:2px;">Category: ${p.categoryName || p.category}</div>
                    <div style="color: var(--accent-color); font-weight:700; margin-top:2px;">₹${Number(p.price).toFixed(2)}</div>
                </div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <button type="button" class="btn ${stockClass}" onclick="editProductStock(${p.id})" style="padding: 4px 8px; font-size: 0.75rem; border-radius: 4px; cursor: pointer; border: none;">Stock: ${stock}</button>
                    <button type="button" onclick="openEditProductModal(${p.id})" style="padding: 4px 8px; font-size: 0.75rem; border-radius: 4px; background: transparent; border: 1px solid var(--accent-color); color: var(--accent-color); cursor: pointer;"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                    <button type="button" onclick="deleteAdminProduct(${p.id})" style="padding: 4px 8px; font-size: 0.75rem; border-radius: 4px; background: transparent; border: 1px solid #e74c3c; color: #e74c3c; cursor: pointer;"><i class="fa-solid fa-trash-can"></i> Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

// ═══════════════════════════════════════════════
// EDIT PRODUCT MODAL
// ═══════════════════════════════════════════════
function openEditProductModal(productId) {
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) {
        showToast("Product not found.", "fa-circle-exclamation");
        return;
    }

    const modal = document.getElementById("editProductModal");
    if (!modal) return;

    document.getElementById("editProdId").value = product.id;
    document.getElementById("editProdName").value = product.title || "";
    document.getElementById("editProdPrice").value = product.price || 0;
    document.getElementById("editProdStock").value = product.stock !== undefined ? product.stock : 10;
    document.getElementById("editProdRating").value = product.rating || 4.5;
    document.getElementById("editProdImageUrl").value = product.image || "";
    document.getElementById("editProdDescription").value = product.description || "";

    const preview = document.getElementById("editProdImagePreview");
    if (preview) preview.src = product.image || "";

    // Populate category dropdown
    fetch("/api/categories")
        .then(res => res.json())
        .then(cats => {
            const catSelect = document.getElementById("editProdCategory");
            if (catSelect) {
                catSelect.innerHTML = cats.map(c =>
                    `<option value="${c.id}" ${c.id === product.category ? 'selected' : ''}>${c.name}</option>`
                ).join('');
            }
        })
        .catch(e => console.warn("Error loading categories for edit:", e));

    modal.style.display = "flex";
}

function closeEditProductModal() {
    const modal = document.getElementById("editProductModal");
    if (modal) modal.style.display = "none";
}

function handleUpdateProductSubmit(e) {
    if (e) e.preventDefault();

    const id = parseInt(document.getElementById("editProdId").value, 10);
    const title = document.getElementById("editProdName").value.trim();
    const category = document.getElementById("editProdCategory").value;
    const price = parseFloat(document.getElementById("editProdPrice").value);
    const stock = parseInt(document.getElementById("editProdStock").value, 10);
    const rating = parseFloat(document.getElementById("editProdRating").value) || 4.5;
    const image = document.getElementById("editProdImageUrl").value.trim();
    const description = document.getElementById("editProdDescription").value.trim();

    if (!title || isNaN(price) || isNaN(stock)) {
        showToast("Please enter valid product details.", "fa-circle-exclamation");
        return;
    }

    const payload = {
        id,
        title,
        category,
        price,
        stock,
        rating,
        image: image || "images/hero_weaving.png",
        description,
        variants: []
    };

    fetch("/api/products", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem('sai_sankalp_session_token')
        },
        body: JSON.stringify(payload)
    })
        .then(res => {
            if (!res.ok) throw new Error("Failed to update product");
            return res.json();
        })
        .then(() => {
            showToast("Product updated successfully!", "fa-circle-check");
            closeEditProductModal();
            if (typeof fetchProducts === "function") fetchProducts();
        })
        .catch(err => alert("Error updating product: " + err.message));
}

function deleteAdminProduct(productId) {
    if (confirm("Are you sure you want to delete this product from the storefront?")) {
        fetch(`/api/products?id=${productId}`, {
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
                showToast("Product deleted successfully", "fa-trash");
                if (typeof fetchProducts === "function") fetchProducts();
            })
            .catch(err => {
                alert("Error: " + err.message);
            });
    }
}

function editProductStock(productId) {
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) return;

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
            "Authorization": "Bearer " + localStorage.getItem('sai_sankalp_session_token')
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
            } else if (newStock <= 3) {
                addAdminAlert("Low Stock Warning ⚠️", `Only ${newStock} units left of "${product.title}".`, "warning");
            }
            if (typeof fetchProducts === "function") fetchProducts();
        })
        .catch(err => {
            alert("Error updating stock: " + err.message);
        });
}

function addAdminAlert(title, message, type = "info") {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    adminNotifications.unshift({ title, message, type, time: timeStr });

    // Update bell notification badge
    const badge = document.getElementById("adminNotifBadge") || document.getElementById("adminNotificationBadge");
    if (badge) {
        badge.textContent = adminNotifications.length;
        badge.style.display = "flex";
    }

    // Play subtle notification alert audio if desired, or show toast
    showToast(`${title}: ${message}`, type === 'danger' ? 'fa-triangle-exclamation' : 'fa-bell');

    // Also display in browser push notification
    if (Notification.permission === "granted") {
        new Notification(title, { body: message, icon: 'images/wool_doll.png' });
    }

    renderAdminNotifications();
}

function renderAdminNotifications() {
    const list = document.getElementById("adminNotificationsList");
    if (!list) return;

    if (adminNotifications.length === 0) {
        list.innerHTML = `<div style="padding: 15px; color: var(--text-secondary); text-align: center; font-size: 0.8rem;">No notifications.</div>`;
        return;
    }

    list.innerHTML = adminNotifications.map(n => {
        let icon = "fa-bell";
        let color = "var(--text-secondary)";
        if (n.type === 'danger') { icon = "fa-circle-exclamation"; color = "#e74c3c"; }
        else if (n.type === 'warning') { icon = "fa-triangle-exclamation"; color = "#f39c12"; }

        return `
            <div style="padding: 10px; border-bottom: 1px solid var(--border-color); display: flex; gap: 8px; font-size: 0.8rem;">
                <i class="fa-solid ${icon}" style="color: ${color}; margin-top: 2px;"></i>
                <div style="flex-grow: 1;">
                    <div style="font-weight: 600; color: var(--text-primary);">${n.title}</div>
                    <div style="color: var(--text-secondary); margin-top: 2px; line-height: 1.3;">${n.message}</div>
                    <div style="font-size: 0.7rem; color: var(--text-secondary); text-align: right; margin-top: 4px;">${n.time}</div>
                </div>
            </div>
        `;
    }).join('');
}

function clearAdminNotifications() {
    adminNotifications = [];
    const badge = document.getElementById("adminNotifBadge") || document.getElementById("adminNotificationBadge");
    if (badge) badge.style.display = "none";
    renderAdminNotifications();
}

// Categories Management
function renderAdminCategoryList() {
    fetch("/api/categories")
        .then(res => res.json())
        .then(cats => {
            const list = document.getElementById("adminCategoryList");
            if (list) {
                list.innerHTML = cats.map(c => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 6px 10px; background:var(--bg-secondary); border-radius:4px; margin-bottom:4px; font-size:0.8rem; color:var(--text-primary);">
                    <span>${c.name} (Code: ${c.id})</span>
                    <button type="button" onclick="deleteAdminCategory('${c.id}')" style="background:none; border:none; color:#e74c3c; cursor:pointer;"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `).join('');
            }

            // Also populate Add Product Form category select dropdown
            const prodCategorySelect = document.getElementById("prodCategory");
            if (prodCategorySelect) {
                prodCategorySelect.innerHTML = `<option value="" disabled selected>Select category</option>`;
                cats.forEach(c => {
                    prodCategorySelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
                });
            }
        })
        .catch(err => console.error("Error loading category options:", err));
}

function addAdminCategory(e) {
    if (e) e.preventDefault();
    const id = document.getElementById("newCatId").value.trim().toLowerCase();
    const name = document.getElementById("newCatName").value.trim();
    if (!id || !name) return;

    fetch("/api/categories", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem('sai_sankalp_session_token')
        },
        body: JSON.stringify({ id, name })
    })
        .then(res => res.json())
        .then(() => {
            showToast("Category registered successfully", "fa-circle-check");
            document.getElementById("newCatId").value = "";
            document.getElementById("newCatName").value = "";
            renderAdminCategoryList();
        })
        .catch(err => alert("Error: " + err.message));
}

function deleteAdminCategory(id) {
    if (confirm(`Delete category code '${id}'?`)) {
        fetch(`/api/categories?id=${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('sai_sankalp_session_token')
            }
        })
            .then(() => {
                showToast("Category deleted", "fa-trash");
                renderAdminCategoryList();
            })
            .catch(err => alert("Error: " + err.message));
    }
}

// Coupons Registry
function refreshPromoTab() {
    refreshPromoCoupons();
    refreshPromoBanners();
}

function refreshPromoCoupons() {
    fetch("/api/coupons")
        .then(res => res.json())
        .then(coupons => {
            const list = document.getElementById("adminCouponsList");
            if (!list) return;

            list.innerHTML = Object.keys(coupons).map(code => {
                const c = coupons[code];
                return `
                <tr style="border-bottom: 1px solid var(--border-color); font-size:0.85rem; color:var(--text-primary);">
                    <td style="padding:10px; font-weight:700;">${code}</td>
                    <td style="padding:10px; text-transform:capitalize;">${c.type}</td>
                    <td style="padding:10px;">${c.type === 'percent' ? c.value + '%' : '₹' + c.value}</td>
                    <td style="padding:10px; color:var(--text-secondary);">${c.label}</td>
                    <td style="padding:10px; text-align:center;">
                        <button type="button" onclick="deleteAdminCoupon('${code}')" style="background:none; border:none; color:#e74c3c; cursor:pointer;"><i class="fa-solid fa-trash-can"></i></button>
                    </td>
                </tr>
            `;
            }).join('');
        });
}

function addAdminCoupon(e) {
    if (e) e.preventDefault();
    const codeInput = document.getElementById("couponCode") || document.getElementById("newCouponCode");
    const typeInput = document.getElementById("couponType") || document.getElementById("newCouponType");
    const valInput = document.getElementById("couponValue") || document.getElementById("newCouponVal");
    const labelInput = document.getElementById("couponLabel") || document.getElementById("newCouponLabel");

    if (!codeInput || !valInput) return;
    const code = codeInput.value.trim().toUpperCase();
    const type = typeInput ? typeInput.value : "percent";
    const value = parseFloat(valInput.value);
    const label = labelInput ? labelInput.value.trim() : "";

    if (!code || isNaN(value)) return;

    fetch("/api/coupons", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem('sai_sankalp_session_token')
        },
        body: JSON.stringify({ code, type, value, label })
    })
        .then(res => res.json())
        .then(() => {
            showToast("Coupon registered successfully", "fa-tag");
            codeInput.value = "";
            valInput.value = "";
            if (labelInput) labelInput.value = "";
            refreshPromoCoupons();
        })
        .catch(err => alert("Error: " + err.message));
}

function deleteAdminCoupon(code) {
    if (confirm(`Delete coupon code '${code}'?`)) {
        fetch(`/api/coupons?code=${code}`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('sai_sankalp_session_token')
            }
        })
            .then(() => {
                showToast("Coupon deleted", "fa-trash");
                refreshPromoCoupons();
            })
            .catch(err => alert("Error: " + err.message));
    }
}

// Banners Manager
function refreshPromoBanners() {
    fetch("/api/banners")
        .then(res => res.json())
        .then(banners => {
            const list = document.getElementById("adminBannersList");
            if (!list) return;

            list.innerHTML = banners.map(b => `
            <div style="display:flex; gap:12px; align-items:center; padding: 10px; border:1px solid var(--border-color); border-radius:6px; margin-bottom:8px; background:var(--bg-primary);">
                <img src="${b.image}" alt="${b.title}" style="width:60px; height:40px; object-fit:cover; border-radius:4px;" onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'300\' viewBox=\'0 0 100 100\'><rect width=\'100\' height=\'100\' fill=\'%23f4efeb\'/><text x=\'50\' y=\'55\' font-family=\'sans-serif\' font-size=\'10\' fill=\'%236a6562\' text-anchor=\'middle\'>No Image</text></svg>';">
                <div style="flex-grow:1; font-size:0.8rem;">
                    <div style="font-weight:700; color:var(--text-primary);">${b.title}</div>
                    <div style="color:var(--text-secondary);">${b.subtitle}</div>
                </div>
                <button type="button" onclick="deleteAdminBanner(${b.id})" style="background:none; border:none; color:#e74c3c; cursor:pointer;"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `).join('');
        });
}

function addAdminBanner(e) {
    if (e) e.preventDefault();
    const imgSelect = document.getElementById("bannerImageSelect") || document.getElementById("newBannerImg");
    const titleInput = document.getElementById("bannerTitle") || document.getElementById("newBannerTitle");
    const subInput = document.getElementById("bannerSubtitle") || document.getElementById("newBannerSub");

    if (!imgSelect || !titleInput) return;
    const image = imgSelect.value.trim();
    const title = titleInput.value.trim();
    const subtitle = subInput ? subInput.value.trim() : "";
    if (!image || !title) return;

    fetch("/api/banners", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + localStorage.getItem('sai_sankalp_session_token')
        },
        body: JSON.stringify({ image, title, subtitle })
    })
        .then(res => res.json())
        .then(() => {
            showToast("Banner added", "fa-image");
            imgSelect.value = "";
            titleInput.value = "";
            if (subInput) subInput.value = "";
            refreshPromoBanners();
        })
        .catch(err => alert("Error: " + err.message));
}

function deleteAdminBanner(id) {
    if (confirm("Delete this banner?")) {
        fetch(`/api/banners?id=${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('sai_sankalp_session_token')
            }
        })
            .then(() => {
                showToast("Banner deleted", "fa-trash");
                refreshPromoBanners();
            })
            .catch(err => alert("Error: " + err.message));
    }
}

// ═══════════════════════════════════════════════
// BUSINESS ANALYTICS & TIME RANGE FILTERING
// ═══════════════════════════════════════════════
let currentAnalyticsRange = 'all';

function setAnalyticsRange(range, btn) {
    currentAnalyticsRange = range;
    document.querySelectorAll(".analytics-range-btn").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    refreshAnalyticsTab();
}

function refreshAnalyticsTab() {
    fetch("/api/orders", {
        headers: {
            "Authorization": "Bearer " + localStorage.getItem('sai_sankalp_session_token')
        }
    })
        .then(res => res.json())
        .then(orders => {
            allOrders = orders;

            const now = new Date();
            const todayStr = now.toISOString().slice(0, 10);
            const thisMonthStr = now.toISOString().slice(0, 7);

            // Filter orders by active time range
            let filteredOrders = orders;
            if (currentAnalyticsRange === '30d') {
                const cutoff = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
                filteredOrders = orders.filter(o => new Date(o.timestamp || 0) >= cutoff);
            } else if (currentAnalyticsRange === '7d') {
                const cutoff = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
                filteredOrders = orders.filter(o => new Date(o.timestamp || 0) >= cutoff);
            } else if (currentAnalyticsRange === 'today') {
                filteredOrders = orders.filter(o => (o.timestamp || "").startsWith(todayStr));
            }

            let totalRevenue = 0;
            let todaySales = 0;
            let monthlySales = 0;
            let validOrdersCount = 0;
            const customerOrderCounts = {};

            // Compute revenue metrics
            filteredOrders.forEach(o => {
                const det = o.details || {};
                const amt = parseFloat(det.totalAmount || 0);
                const ts = o.timestamp || "";
                const email = (det.customerEmail || "").toLowerCase();

                if (email) {
                    customerOrderCounts[email] = (customerOrderCounts[email] || 0) + 1;
                }

                if (det.status !== "Cancelled" && det.status !== "Refunded") {
                    totalRevenue += amt;
                    validOrdersCount += 1;
                }
            });

            // Compute global today/monthly across all orders
            orders.forEach(o => {
                const det = o.details || {};
                const amt = parseFloat(det.totalAmount || 0);
                const ts = o.timestamp || "";
                if (det.status !== "Cancelled" && det.status !== "Refunded") {
                    if (ts.startsWith(todayStr)) todaySales += amt;
                    if (ts.startsWith(thisMonthStr)) monthlySales += amt;
                }
            });

            // 8 Key KPI Metrics
            const aov = validOrdersCount > 0 ? (totalRevenue / validOrdersCount) : 0;
            const totalUniqueCustomers = Object.keys(customerOrderCounts).length;
            const returningCustomers = Object.values(customerOrderCounts).filter(cnt => cnt > 1).length;
            const returningRate = totalUniqueCustomers > 0 ? Math.round((returningCustomers / totalUniqueCustomers) * 100) : 0;

            const lowStockCount = PRODUCTS.filter(p => {
                const s = p.stock !== undefined ? p.stock : 10;
                return s > 0 && s < 5;
            }).length;

            const outOfStockCount = PRODUCTS.filter(p => {
                const s = p.stock !== undefined ? p.stock : 10;
                return s === 0;
            }).length;

            const elTotalOrders = document.getElementById("statTotalOrders");
            const elTotalRevenue = document.getElementById("statTotalRevenue");
            const elTodaySales = document.getElementById("statTodaySales");
            const elMonthlySales = document.getElementById("statMonthlySales");
            const elConversionRate = document.getElementById("statConversionRate");
            const elReturningRate = document.getElementById("statReturningRate");
            const elLowStock = document.getElementById("statLowStockAlerts");
            const elOutOfStock = document.getElementById("statOutOfStockAlerts");

            if (elTotalOrders) elTotalOrders.textContent = filteredOrders.length;
            if (elTotalRevenue) elTotalRevenue.textContent = `₹${totalRevenue.toFixed(2)}`;
            if (elTodaySales) elTodaySales.textContent = `₹${todaySales.toFixed(2)}`;
            if (elMonthlySales) elMonthlySales.textContent = `₹${monthlySales.toFixed(2)}`;
            if (elConversionRate) elConversionRate.textContent = `₹${aov.toFixed(2)}`;
            if (elReturningRate) elReturningRate.textContent = `${returningRate}%`;
            if (elLowStock) elLowStock.textContent = lowStockCount;
            if (elOutOfStock) elOutOfStock.textContent = outOfStockCount;

            // Render Best Sellers
            const productQuantities = {};
            filteredOrders.forEach(o => {
                const det = o.details || {};
                if (det.status !== "Cancelled") {
                    (det.items || []).forEach(it => {
                        productQuantities[it.title] = (productQuantities[it.title] || 0) + (it.quantity || 1);
                    });
                }
            });

            const sortedBests = Object.keys(productQuantities).map(k => ({
                title: k, qty: productQuantities[k]
            })).sort((a, b) => b.qty - a.qty).slice(0, 5);

            const listEl = document.getElementById("analyticsBestSellersList");
            if (listEl) {
                if (sortedBests.length === 0) {
                    listEl.innerHTML = `<div style="text-align:center; color:var(--text-secondary); padding:20px; font-size:0.85rem;">No sales in selected range.</div>`;
                } else {
                    listEl.innerHTML = sortedBests.map((p, idx) => `
                    <div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid var(--border-color); font-size:0.85rem; color:var(--text-primary);">
                        <span>${idx + 1}. ${p.title}</span>
                        <strong style="color:var(--accent-color);">${p.qty} sold</strong>
                    </div>
                `).join('');
                }
            }

            renderSalesTrendChart();
        });
}

function renderSalesTrendChart() {
    const chartWrapper = document.getElementById("analyticsChartWrapper") || document.getElementById("analyticsSalesChart");
    if (!chartWrapper) return;

    // Draw an animated SVG representing monthly sales distributions
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const salesData = new Array(12).fill(0);

    allOrders.forEach(o => {
        const det = o.details || {};
        if (det.status !== "Cancelled" && o.timestamp) {
            const m = parseInt(o.timestamp.slice(5, 7), 10) - 1;
            if (m >= 0 && m < 12) {
                salesData[m] += parseFloat(det.totalAmount || 0);
            }
        }
    });

    const maxVal = Math.max(...salesData, 5000);
    const points = salesData.map((val, idx) => {
        const x = 50 + idx * 45;
        const y = 200 - (val / maxVal * 150);
        return { x, y, val };
    });

    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        pathD += ` L ${points[i].x} ${points[i].y}`;
    }

    let svgHtml = `
        <svg viewBox="0 0 600 250" style="width: 100%; height: 100%; font-family: inherit;">
            <line x1="50" y1="200" x2="550" y2="200" stroke="var(--border-color)" stroke-width="1.5"/>
            <line x1="50" y1="50" x2="50" y2="200" stroke="var(--border-color)" stroke-width="1.5"/>
    `;

    // Draw Grid Lines
    for (let i = 1; i <= 4; i++) {
        const y = 200 - i * 37.5;
        svgHtml += `<line x1="50" y1="${y}" x2="550" y2="${y}" stroke="var(--border-color)" stroke-dasharray="4" opacity="0.3"/>`;
        svgHtml += `<text x="15" y="${y + 4}" font-size="9" fill="var(--text-secondary)">₹${Math.round(maxVal * (i * 0.25))}</text>`;
    }

    // Draw Sales Line
    svgHtml += `<path d="${pathD}" fill="none" stroke="var(--accent-color)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;

    // Draw points and labels
    points.forEach((p, idx) => {
        svgHtml += `<circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--accent-color)" stroke="white" stroke-width="1.5"/>`;
        svgHtml += `<text x="${p.x}" y="220" font-size="9" fill="var(--text-secondary)" text-anchor="middle">${months[idx]}</text>`;
        if (p.val > 0) {
            svgHtml += `<text x="${p.x}" y="${p.y - 8}" font-size="8" font-weight="700" fill="var(--text-primary)" text-anchor="middle">₹${Math.round(p.val)}</text>`;
        }
    });

    svgHtml += `</svg>`;
    chartWrapper.innerHTML = svgHtml;
}

function exportOrdersCSV() {
    if (allOrders.length === 0) return;
    let csv = "Order ID,Timestamp,Customer Name,Customer Email,Subtotal,CGST,SGST,Total,Status,Payment Method,Transaction ID\n";
    allOrders.forEach(o => {
        const d = o.details || {};
        csv += `"${o.orderId}","${o.timestamp}","${d.customerName}","${d.customerEmail}",${d.subtotal},${d.cgst},${d.sgst},${d.totalAmount},"${d.status}","${d.paymentMethod}","${d.transactionId}"\n`;
    });
    downloadCSV(csv, "sai_sankalp_orders.csv");
}

function exportCustomersCSV() {
    if (allOrders.length === 0) return;
    const customers = {};
    allOrders.forEach(o => {
        const d = o.details || {};
        const email = d.customerEmail;
        if (!email) return;
        if (!customers[email]) {
            customers[email] = { name: d.customerName, email, ordersCount: 0, totalSpend: 0 };
        }
        customers[email].ordersCount += 1;
        if (d.status !== "Cancelled") {
            customers[email].totalSpend += parseFloat(d.totalAmount || 0);
        }
    });

    let csv = "Customer Name,Email Address,Total Orders,Lifetime Value (LTV)\n";
    Object.keys(customers).forEach(k => {
        const c = customers[k];
        csv += `"${c.name}","${c.email}",${c.ordersCount},${c.totalSpend.toFixed(2)}\n`;
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

window.switchAdminTab = switchAdminTab;
window.refreshAdminData = refreshAdminData;
window.renderAdminProductsList = renderAdminProductsList;
window.openEditProductModal = openEditProductModal;
window.closeEditProductModal = closeEditProductModal;
window.handleUpdateProductSubmit = handleUpdateProductSubmit;
window.deleteAdminProduct = deleteAdminProduct;
window.editProductStock = editProductStock;
window.addAdminAlert = addAdminAlert;
window.renderAdminNotifications = renderAdminNotifications;
window.clearAdminNotifications = clearAdminNotifications;
window.renderAdminCategoryList = renderAdminCategoryList;
window.addAdminCategory = addAdminCategory;
window.deleteAdminCategory = deleteAdminCategory;
window.refreshPromoTab = refreshPromoTab;
window.addAdminCoupon = addAdminCoupon;
window.deleteAdminCoupon = deleteAdminCoupon;
window.addAdminBanner = addAdminBanner;
window.deleteAdminBanner = deleteAdminBanner;
window.refreshAnalyticsTab = refreshAnalyticsTab;
window.setAnalyticsRange = setAnalyticsRange;
window.renderSalesTrendChart = renderSalesTrendChart;
window.exportOrdersCSV = exportOrdersCSV;
window.exportCustomersCSV = exportCustomersCSV;

let uploadedImageUrl = "";

document.addEventListener("DOMContentLoaded", () => {
    const dropLabel = document.getElementById("prodImageDropLabel");
    const fileInput = document.getElementById("prodImageFile");
    const previewWrapper = document.getElementById("prodImagePreviewWrapper");
    const previewImg = document.getElementById("prodImagePreview");
    const clearBtn = document.getElementById("prodImageClearBtn");
    const fileNameEl = document.getElementById("prodImageFileName");
    const addProductForm = document.getElementById("adminAddProductForm");

    // Product search input
    const prodSearch = document.getElementById("adminProductSearch");
    if (prodSearch) {
        prodSearch.addEventListener("input", (e) => {
            renderAdminProductsList(e.target.value);
        });
    }

    // Order search & filter
    const orderSearch = document.getElementById("adminOrderSearch");
    const orderStatusFilter = document.getElementById("adminOrderStatusFilter");
    if (orderSearch) {
        orderSearch.addEventListener("input", () => {
            if (typeof filterAdminOrders === "function") filterAdminOrders();
        });
    }
    if (orderStatusFilter) {
        orderStatusFilter.addEventListener("change", () => {
            if (typeof filterAdminOrders === "function") filterAdminOrders();
        });
    }

    // Admin notifications bell toggle
    const notifBtn = document.getElementById("btnAdminNotificationToggle");
    const notifDrawer = document.getElementById("adminNotificationsDrawer");
    if (notifBtn && notifDrawer) {
        notifBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = notifDrawer.style.display === "block";
            notifDrawer.style.display = isOpen ? "none" : "block";
        });
        document.addEventListener("click", (e) => {
            if (!notifDrawer.contains(e.target) && !notifBtn.contains(e.target)) {
                notifDrawer.style.display = "none";
            }
        });
    }

    // Edit Product modal image file listener
    const editFileInput = document.getElementById("editProdImageFile");
    const editPreviewImg = document.getElementById("editProdImagePreview");
    const editUrlInput = document.getElementById("editProdImageUrl");
    if (editFileInput) {
        editFileInput.addEventListener("change", () => {
            if (editFileInput.files && editFileInput.files[0]) {
                const file = editFileInput.files[0];
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (editPreviewImg) editPreviewImg.src = e.target.result;
                };
                reader.readAsDataURL(file);

                const formData = new FormData();
                formData.append("image", file);
                fetch("/api/upload", {
                    method: "POST",
                    headers: {
                        "Authorization": "Bearer " + localStorage.getItem('sai_sankalp_session_token')
                    },
                    body: formData
                })
                    .then(res => res.json())
                    .then(data => {
                        if (data.status === "success" && data.url) {
                            if (editUrlInput) editUrlInput.value = data.url;
                            if (editPreviewImg) editPreviewImg.src = data.url;
                            showToast("Edit image uploaded successfully!", "fa-image");
                        }
                    })
                    .catch(err => console.warn("Edit image upload error:", err));
            }
        });
    }

    if (dropLabel && fileInput) {
        // Drag over
        dropLabel.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropLabel.style.borderColor = "var(--accent-color)";
        });

        // Drag leave
        dropLabel.addEventListener("dragleave", () => {
            dropLabel.style.borderColor = "var(--border-color)";
        });

        // Drop
        dropLabel.addEventListener("drop", (e) => {
            e.preventDefault();
            dropLabel.style.borderColor = "var(--border-color)";
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleImageUpload(e.dataTransfer.files[0]);
            }
        });

        // File select
        fileInput.addEventListener("change", () => {
            if (fileInput.files && fileInput.files[0]) {
                handleImageUpload(fileInput.files[0]);
            }
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            uploadedImageUrl = "";
            if (fileInput) fileInput.value = "";
            if (previewWrapper) previewWrapper.style.display = "none";
            if (dropLabel) dropLabel.style.display = "flex";
        });
    }

    function handleImageUpload(file) {
        // Show local preview immediately (optimistic UI)
        const reader = new FileReader();
        reader.onload = (e) => {
            if (previewImg) previewImg.src = e.target.result;
            if (previewWrapper) previewWrapper.style.display = "block";
            if (dropLabel) dropLabel.style.display = "none";
            if (fileNameEl) fileNameEl.textContent = file.name;
        };
        reader.readAsDataURL(file);

        // Upload to server
        const formData = new FormData();
        formData.append("image", file);

        fetch("/api/upload", {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + localStorage.getItem('sai_sankalp_session_token')
            },
            body: formData
        })
            .then(res => {
                if (!res.ok) throw new Error("Upload failed");
                return res.json();
            })
            .then(data => {
                if (data.status === "success" && data.url) {
                    uploadedImageUrl = data.url;
                    showToast("Image uploaded successfully!", "fa-image");
                } else {
                    throw new Error("Invalid response");
                }
            })
            .catch(err => {
                console.error("Image upload error:", err);
                showToast("Failed to upload image to server.", "fa-circle-exclamation");
                uploadedImageUrl = "";
                if (previewWrapper) previewWrapper.style.display = "none";
                if (dropLabel) dropLabel.style.display = "flex";
            });
    }

    if (addProductForm) {
        addProductForm.addEventListener("submit", (e) => {
            e.preventDefault();

            const title = document.getElementById("prodTitle").value.trim();
            const category = document.getElementById("prodCategory").value;
            const priceVal = document.getElementById("prodPrice").value;
            const stockVal = document.getElementById("prodStock").value;
            const description = document.getElementById("prodDescription").value.trim();

            if (!title || !category || !priceVal || !stockVal || !description) {
                showToast("Please fill all required fields.", "fa-circle-exclamation");
                return;
            }

            const price = parseFloat(priceVal);
            const stock = parseInt(stockVal, 10);

            if (isNaN(price) || price < 0) {
                showToast("Price must be a valid positive number.", "fa-circle-exclamation");
                return;
            }

            if (isNaN(stock) || stock < 0) {
                showToast("Stock must be a valid non-negative integer.", "fa-circle-exclamation");
                return;
            }

            if (!uploadedImageUrl) {
                showToast("Please upload a product image.", "fa-circle-exclamation");
                return;
            }

            const payload = {
                title,
                category,
                price,
                stock,
                description,
                image: uploadedImageUrl,
                variants: []
            };

            fetch("/api/products", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + localStorage.getItem('sai_sankalp_session_token')
                },
                body: JSON.stringify(payload)
            })
                .then(res => {
                    if (!res.ok) throw new Error("Failed to add product");
                    return res.json();
                })
                .then(() => {
                    showToast("Product added successfully!", "fa-circle-check");
                    addProductForm.reset();
                    uploadedImageUrl = "";
                    if (previewWrapper) previewWrapper.style.display = "none";
                    if (dropLabel) dropLabel.style.display = "flex";
                    if (typeof fetchProducts === "function") fetchProducts();
                })
                .catch(err => {
                    alert("Error: " + err.message);
                });
        });
    }
});
