// Sai Sankalp Shopping Cart Module

function saveCartToLocalStorage() {
    localStorage.setItem('sai_sankalp_cart', JSON.stringify(cart));
}

function loadCartFromLocalStorage() {
    const stored = localStorage.getItem('sai_sankalp_cart');
    if (stored) {
        try {
            cart = JSON.parse(stored);
        } catch (e) {
            cart = [];
        }
    }
    updateCartUI();
}

function addToCart(productId) {
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) return;

    const stock = product.stock !== undefined ? product.stock : 10;
    if (stock <= 0) {
        showToast(`"${product.title}" is out of stock!`, "fa-circle-exclamation");
        return;
    }

    const existing = cart.find(item => item.id === productId);
    if (existing) {
        if (existing.quantity >= stock) {
            showToast(`Only ${stock} unit(s) available in stock.`, "fa-circle-exclamation");
            return;
        }
        existing.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            title: product.title,
            price: product.price,
            image: product.image,
            categoryName: product.categoryName,
            quantity: 1
        });
    }

    saveCartToLocalStorage();
    updateCartUI();
    showToast(`Added "${product.title}" to bag`, "fa-bag-shopping");
}

function updateCartQty(productId, newQty) {
    const item = cart.find(i => i.id === productId);
    if (!item) return;

    const product = PRODUCTS.find(p => p.id === productId);
    const stock = product ? (product.stock !== undefined ? product.stock : 10) : 10;

    if (newQty > stock) {
        showToast(`Only ${stock} unit(s) available in stock.`, "fa-circle-exclamation");
        item.quantity = stock;
    } else if (newQty <= 0) {
        removeFromCart(productId);
        return;
    } else {
        item.quantity = newQty;
    }

    saveCartToLocalStorage();
    updateCartUI();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCartToLocalStorage();
    updateCartUI();
    showToast("Item removed from bag", "fa-trash");
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
        const COUPON_CODES = {
            'CRAFT10': { type: 'percent', value: 10, label: '10% off your order' },
            'GIFT20': { type: 'percent', value: 20, label: '20% gift discount' },
            'WELCOME15': { type: 'percent', value: 15, label: '15% welcome discount' }
        };
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
        const stock = product ? (product.stock !== undefined ? product.stock : 10) : 10;
        if (stock <= 0) {
            issues.push(`"${item.title}" is out of stock.`);
        } else if (item.quantity > stock) {
            issues.push(`Only ${stock} unit(s) of "${item.title}" available.`);
        }
    }
    return issues;
}

function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCount = document.getElementById("cartCount");
    const cartCountTitle = document.getElementById("cartCountTitle");
    if (cartCount) {
        cartCount.textContent = totalItems;
        cartCount.style.display = totalItems > 0 ? "flex" : "none";
    }
    if (cartCountTitle) cartCountTitle.textContent = totalItems;

    // Render Cart Items List
    const cartItemsList = document.getElementById("cartItemsList") || document.getElementById("cartItemsContainer");
    if (!cartItemsList) return;

    if (cart.length === 0) {
        cartItemsList.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                <i class="fa-solid fa-bag-shopping" style="font-size: 3rem; margin-bottom: 16px; opacity: 0.3;"></i>
                <p>Your bag is empty.</p>
            </div>
        `;
        document.getElementById("cartSubtotal").textContent = "₹0.00";
        return;
    }

    let subtotal = 0;
    cartItemsList.innerHTML = cart.map(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        return `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.title}" class="cart-item-img" onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'300\' viewBox=\'0 0 100 100\'><rect width=\'100\' height=\'100\' fill=\'%23f4efeb\'/><text x=\'50\' y=\'55\' font-family=\'sans-serif\' font-size=\'10\' fill=\'%236a6562\' text-anchor=\'middle\'>No Image</text></svg>';">
                <div class="cart-item-details">
                    <h4 class="cart-item-title">${item.title}</h4>
                    <p class="cart-item-price">₹${item.price.toFixed(2)}</p>
                    <div class="cart-item-actions">
                        <div class="qty-control">
                            <button type="button" class="qty-btn" onclick="updateCartQty(${item.id}, ${item.quantity - 1})">-</button>
                            <span class="qty-val">${item.quantity}</span>
                            <button type="button" class="qty-btn" onclick="updateCartQty(${item.id}, ${item.quantity + 1})">+</button>
                        </div>
                        <button type="button" class="remove-item-btn" onclick="removeFromCart(${item.id})">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Apply Coupon Discount
    let discount = 0;
    if (appliedCoupon) {
        if (appliedCoupon.type === 'percent') {
            discount = subtotal * appliedCoupon.value / 100;
        } else {
            discount = Math.min(appliedCoupon.value, subtotal);
        }
    }

    const finalSubtotal = subtotal - discount;
    document.getElementById("cartSubtotal").textContent = `₹${finalSubtotal.toFixed(2)}`;
}

window.saveCartToLocalStorage = saveCartToLocalStorage;
window.loadCartFromLocalStorage = loadCartFromLocalStorage;
window.addToCart = addToCart;
window.updateCartQty = updateCartQty;
window.removeFromCart = removeFromCart;
window.applyCoupon = applyCoupon;
window.validateCartStock = validateCartStock;
window.updateCartUI = updateCartUI;
