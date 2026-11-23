// Sai Sankalp Client Authentication Module
let tempRegisterEmail = "";
let tempForgotEmail = "";

function checkLoginState() {
    currentUserEmail = localStorage.getItem("sai_sankalp_user_email") || "";
    let token = localStorage.getItem("sai_sankalp_session_token") || "";
    userRole = localStorage.getItem("sai_sankalp_user_role") || "customer";

    if (!currentUserEmail) {
        const loginModal = document.getElementById("loginModal");
        if (loginModal) {
            loginModal.classList.add("active");
            document.body.style.overflow = "hidden";
        }
    } else {
        if (currentUserEmail !== "Guest" && !token) {
            const loginModal = document.getElementById("loginModal");
            if (loginModal) {
                loginModal.classList.add("active");
                document.body.style.overflow = "hidden";
            }
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
    const loginModal = document.getElementById("loginModal");
    if (loginModal) {
        loginModal.classList.remove("active");
        document.body.style.overflow = "";
    }

    isAdmin = (role === "admin");
    const btnAdminPanel = document.getElementById("btnAdminPanel");
    const btnCustomerDashboard = document.getElementById("btnCustomerDashboard");
    const btnSignOut = document.getElementById("btnSignOut");

    if (isAdmin) {
        if (btnAdminPanel) btnAdminPanel.style.display = "inline-block";
        if (btnCustomerDashboard) btnCustomerDashboard.style.display = "none";
        if (btnSignOut) btnSignOut.style.display = "inline-block";
        showToast("Logged in as Administrator ✅", "fa-user-shield");
    } else {
        isAdmin = false;
        if (btnAdminPanel) btnAdminPanel.style.display = "none";
        if (btnCustomerDashboard) btnCustomerDashboard.style.display = (currentUserEmail !== "Guest" && currentUserEmail !== "") ? "inline-block" : "none";
        if (btnSignOut) btnSignOut.style.display = "inline-block";

        const checkoutEmailField = document.getElementById("checkoutEmail");
        if (checkoutEmailField && currentUserEmail !== "Guest" && currentUserEmail !== "") {
            checkoutEmailField.value = currentUserEmail;
        }

        if (currentUserEmail !== "Guest" && currentUserEmail !== "") {
            showToast(`Logged in: ${currentUserEmail}`, "fa-circle-check");
            if (typeof syncWishlistFromServer === "function") syncWishlistFromServer();
        } else {
            showToast("Signed in as Guest", "fa-user");
        }
    }
}

function setupAuthListeners() {
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
                localStorage.setItem("sai_sankalp_csrf_token", data.csrfToken || "");
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

    // Sign Out Button Click
    const btnSignOut = document.getElementById("btnSignOut");
    if (btnSignOut) {
        btnSignOut.addEventListener("click", () => {
            localStorage.removeItem("sai_sankalp_user_email");
            localStorage.removeItem("sai_sankalp_session_token");
            localStorage.removeItem("sai_sankalp_user_role");
            localStorage.removeItem("sai_sankalp_csrf_token");
            
            currentUserEmail = "";
            userRole = "customer";
            isAdmin = false;
            wishlist = [];
            cart = [];
            localStorage.removeItem("sai_sankalp_cart");
            
            showToast("Signed out successfully ✅", "fa-right-from-bracket");
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        });
    }
}

window.checkLoginState = checkLoginState;
window.handleLoginSuccess = handleLoginSuccess;
window.setupAuthListeners = setupAuthListeners;
