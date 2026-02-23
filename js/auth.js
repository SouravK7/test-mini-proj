/* =============================================
   AUTHENTICATION MODULE
   Real API implementation
   ============================================= */

const AUTH = {
    // Storage key
    STORAGE_KEY: 'tec_user_session',

    // API Base URL - uses same origin since frontend & backend are served together
    baseUrl: '',

    // Login
    async login(email, password) {
        try {
            const response = await fetch(`${this.baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!data.success) {
                return { success: false, error: data.error || 'Login failed' };
            }

            // Store session with token
            const session = {
                id: data.data.id,
                name: data.data.name,
                email: data.data.email,
                role: data.data.role,
                department: data.data.department || null,
                token: data.data.token,
                loginAt: new Date().toISOString()
            };

            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
            return { success: true, data: session };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Network error. Please try again.' };
        }
    },

    // Register
    async register(userData) {
        try {
            const response = await fetch(`${this.baseUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (!data.success) {
                return { success: false, error: data.error || 'Registration failed' };
            }

            // Store session with token
            const session = {
                id: data.data.id,
                name: data.data.name,
                email: data.data.email,
                role: data.data.role,
                token: data.data.token,
                loginAt: new Date().toISOString()
            };

            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
            return { success: true, data: session };
        } catch (error) {
            console.error('Register error:', error);
            return { success: false, error: 'Network error. Please try again.' };
        }
    },

    // Forgot Password
    async forgotPassword(email) {
        try {
            const response = await fetch(`${this.baseUrl}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            return { success: true, message: 'If an account exists, a reset link has been sent.' };
        }
    },

    // Logout
    logout() {
        localStorage.removeItem(this.STORAGE_KEY);
        window.location.href = '../index.html';
    },

    // Get current user
    getCurrentUser() {
        const session = localStorage.getItem(this.STORAGE_KEY);
        return session ? JSON.parse(session) : null;
    },

    // Check if authenticated
    isAuthenticated() {
        return this.getCurrentUser() !== null;
    },

    // Check role
    hasRole(role) {
        const user = this.getCurrentUser();
        if (!user) return false;

        if (Array.isArray(role)) {
            return role.includes(user.role);
        }
        return user.role === role;
    },

    // Check if admin
    isAdmin() {
        return this.hasRole('admin');
    },

    // Check if faculty
    isFaculty() {
        return this.hasRole(['admin', 'faculty']);
    },

    // Require authentication (redirect if not logged in)
    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '../index.html';
            return false;
        }
        return true;
    },

    // Require specific role
    requireRole(role) {
        if (!this.requireAuth()) return false;

        if (!this.hasRole(role)) {
            Notifications.error('Access Denied', 'You do not have permission to access this page.');
            window.location.href = 'dashboard.html';
            return false;
        }
        return true;
    },

    // Get user initials for avatar
    getUserInitials(name) {
        if (!name) return '?';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AUTH;
}
