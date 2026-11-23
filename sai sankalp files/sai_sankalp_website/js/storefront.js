// Sai Sankalp Storefront & Customer Experience Module

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
            if (typeof filterAndSortProducts === "function") filterAndSortProducts();
            
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
    if (typeof filterAndSortProducts === "function") filterAndSortProducts();
    
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

    listContainer.innerHTML = wishlist.map(id => {
        const p = PRODUCTS.find(prod => prod.id === id);
        if (!p) return '';
        return `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid var(--border-color);">
                <img src="${p.image}" alt="${p.title}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;" onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'300\' viewBox=\'0 0 100 100\'><rect width=\'100\' height=\'100\' fill=\'%23f4efeb\'/><text x=\'50\' y=\'55\' font-family=\'sans-serif\' font-size=\'10\' fill=\'%236a6562\' text-anchor=\'middle\'>No Image</text></svg>';">
                <div style="flex-grow:1; font-size:0.8rem;">
                    <div style="font-weight:600; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:140px;">${p.title}</div>
                    <div style="color:var(--accent-color); font-weight:700;">₹${p.price.toFixed(2)}</div>
                </div>
                <div style="display:flex; gap:4px;">
                    <button type="button" onclick="addToCart(${p.id}); toggleWishlist(${p.id});" style="padding:4px 8px; font-size:0.7rem; border-radius:4px; background:var(--accent-color); color:white; border:none; cursor:pointer;"><i class="fa-solid fa-cart-plus"></i></button>
                    <button type="button" onclick="toggleWishlist(${p.id})" style="padding:4px 8px; font-size:0.7rem; border-radius:4px; background:transparent; color:#e74c3c; border:1px solid #e74c3c; cursor:pointer;"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>
        `;
    }).join('');
}

// Compare Drawer Logic
function toggleCompareProduct(productId, event) {
    if (event) event.stopPropagation();
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) return;

    if (compareProducts.includes(productId)) {
        compareProducts = compareProducts.filter(id => id !== productId);
        showToast("Removed from Comparison", "fa-circle-minus");
    } else {
        if (compareProducts.length >= 3) {
            showToast("You can compare up to 3 products only.", "fa-circle-exclamation");
            return;
        }
        compareProducts.push(productId);
        showToast("Added to Comparison", "fa-circle-plus");
    }

    updateCompareDrawer();
}

function updateCompareDrawer() {
    const drawer = document.getElementById("compareDrawer") || document.getElementById("comparisonDrawer");
    const container = document.getElementById("compareDrawerItems") || document.getElementById("comparisonTableWrapper");
    const countEl = document.getElementById("compareCount");
    
    if (!drawer || !container) return;

    if (compareProducts.length === 0) {
        drawer.style.display = "none";
        return;
    }

    drawer.style.display = "block";
    if (countEl) countEl.textContent = compareProducts.length;

    container.innerHTML = compareProducts.map(id => {
        const p = PRODUCTS.find(prod => prod.id === id);
        if (!p) return '';
        return `
            <div style="display: flex; align-items: center; gap: 8px; background: var(--bg-primary); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); position: relative;">
                <img src="${p.image}" alt="${p.title}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 4px;" onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'300\' viewBox=\'0 0 100 100\'><rect width=\'100\' height=\'100\' fill=\'%23f4efeb\'/><text x=\'50\' y=\'55\' font-family=\'sans-serif\' font-size=\'10\' fill=\'%236a6562\' text-anchor=\'middle\'>No Image</text></svg>';">
                <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-primary); max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.title}</span>
                <button type="button" onclick="toggleCompareProduct(${p.id})" style="background: none; border: none; color: #e74c3c; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center;"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `;
    }).join('');
}

function openCompareModal() {
    const modal = document.getElementById("compareModal");
    const tableBody = document.getElementById("compareTableBody");
    if (!modal || !tableBody) return;

    if (compareProducts.length < 2) {
        showToast("Select at least 2 products to compare.", "fa-circle-exclamation");
        return;
    }

    modal.style.display = "flex";
    document.body.style.overflow = "hidden";

    const prods = compareProducts.map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean);

    let html = `
        <tr style="border-bottom: 1px solid var(--border-color);">
            <th style="padding: 12px; color: var(--text-secondary); text-align: left; width: 150px;">Creation</th>
            ${prods.map(p => `
                <td style="padding: 12px; text-align: center;">
                    <img src="${p.image}" alt="${p.title}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; margin-bottom: 8px;" onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'300\' viewBox=\'0 0 100 100\'><rect width=\'100\' height=\'100\' fill=\'%23f4efeb\'/><text x=\'50\' y=\'55\' font-family=\'sans-serif\' font-size=\'10\' fill=\'%236a6562\' text-anchor=\'middle\'>No Image</text></svg>';">
                    <div style="font-weight: 700; color: var(--text-primary); font-size: 0.9rem;">${p.title}</div>
                </td>
            `).join('')}
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color);">
            <th style="padding: 12px; color: var(--text-secondary); text-align: left;">Price</th>
            ${prods.map(p => `<td style="padding: 12px; text-align: center; font-weight: 700; color: var(--accent-color); font-size: 1rem;">₹${p.price.toFixed(2)}</td>`).join('')}
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color);">
            <th style="padding: 12px; color: var(--text-secondary); text-align: left;">Artisan</th>
            ${prods.map(p => `<td style="padding: 12px; text-align: center; font-weight: 600; color: var(--text-primary);">${p.specs.Material || 'Traditional'}</td>`).join('')}
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color);">
            <th style="padding: 12px; color: var(--text-secondary); text-align: left;">Stock Level</th>
            ${prods.map(p => {
                const stock = p.stock !== undefined ? p.stock : 10;
                let stockHtml = `<span class="badge badge-success">In Stock (${stock})</span>`;
                if (stock === 0) stockHtml = `<span class="badge badge-danger">Out of Stock</span>`;
                else if (stock <= 3) stockHtml = `<span class="badge badge-warning">Only ${stock} left!</span>`;
                return `<td style="padding: 12px; text-align: center;">${stockHtml}</td>`;
            }).join('')}
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color);">
            <th style="padding: 12px; color: var(--text-secondary); text-align: left;">Actions</th>
            ${prods.map(p => `
                <td style="padding: 12px; text-align: center;">
                    <button type="button" class="btn btn-primary" onclick="addToCart(${p.id}); document.getElementById('compareModal').style.display='none'; document.body.style.overflow='';" style="padding: 6px 12px; font-size: 0.8rem; border-radius: 4px;"><i class="fa-solid fa-cart-plus"></i> Add to Bag</button>
                </td>
            `).join('')}
        </tr>
    `;

    tableBody.innerHTML = html;
}

function closeCompareModal() {
    const modal = document.getElementById("compareModal");
    if (modal) {
        modal.style.display = "none";
        document.body.style.overflow = "";
    }
}

function clearCompareProducts() {
    compareProducts = [];
    updateCompareDrawer();
}

function loadStorefrontBanners() {
    fetch('/api/banners')
    .then(res => res.json())
    .then(banners => {
        if (!banners || banners.length === 0) return;
        const banner = banners[0];
        const heroTag = document.querySelector(".hero-tagline");
        const heroDesc = document.querySelector(".hero-description");
        if (heroTag && banner.title) {
            heroTag.innerHTML = `<i class="fa-solid fa-sparkles" style="color:var(--accent-color); margin-right:6px;"></i> ${banner.title}`;
        }
        if (heroDesc && banner.subtitle) {
            heroDesc.textContent = banner.subtitle;
        }
    })
    .catch(e => console.warn("Banners fetch error:", e));
}

document.addEventListener("DOMContentLoaded", () => {
    loadStorefrontBanners();
});

window.syncWishlistFromServer = syncWishlistFromServer;
window.toggleWishlist = toggleWishlist;
window.updateWishlistUI = updateWishlistUI;
window.toggleCompareProduct = toggleCompareProduct;
window.updateCompareDrawer = updateCompareDrawer;
window.openCompareModal = openCompareModal;
window.closeCompareModal = closeCompareModal;
window.clearCompareProducts = clearCompareProducts;
window.loadStorefrontBanners = loadStorefrontBanners;

