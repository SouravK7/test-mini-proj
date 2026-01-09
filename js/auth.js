/* =============================================
   AUTHENTICATION MODULE
   ============================================= */

const AUTH = {
    // Storage key
    STORAGE_KEY: 'tec_user_session',

    // Login
    async login(email, password) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));

        const user = MockData.users.find(u =>
            u.email.toLowerCase() === email.toLowerCase() &&
            u.password === password
        );

        if (!user) {
            return { success: false, error: 'Invalid email or password' };
        }

        // Store session (exclude password)
        const session = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department || null,
            loginAt: new Date().toISOString()
        };

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
        return { success: true, data: session };
    },

    // Register
    async register(userData) {
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if email exists
        const exists = MockData.users.find(u =>
            u.email.toLowerCase() === userData.email.toLowerCase()
        );

        if (exists) {
            return { success: false, error: 'Email already registered' };
        }

        const newUser = {
            id: MockData.users.length + 1,
            name: userData.name,
            email: userData.email,
            password: userData.password,
            role: 'user',
            phone: userData.phone || null
        };

        MockData.users.push(newUser);

        // Auto login after registration
        return this.login(userData.email, userData.password);
    },

    // Forgot Password (simulate email send)
    async forgotPassword(email) {
        await new Promise(resolve => setTimeout(resolve, 500));

        const user = MockData.users.find(u =>
            u.email.toLowerCase() === email.toLowerCase()
        );

        if (!user) {
            // Don't reveal if email exists
            return { success: true, message: 'If an account exists, a reset link has been sent.' };
        }

        return { success: true, message: 'Password reset link sent to your email.' };
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
