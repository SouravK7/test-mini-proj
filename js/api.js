/* =============================================
   API ABSTRACTION LAYER
   Real API implementation using fetch()
   ============================================= */

const API = {
    // Base URL - point directly to backend for local development 
    baseUrl: `http://${window.location.hostname}:3000`,

    // Get auth token from storage
    getToken() {
        const session = localStorage.getItem('tec_user_session');
        if (session) {
            const parsed = JSON.parse(session);
            return parsed.token;
        }
        return null;
    },

    // Create headers with auth token
    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    },

    // Generic fetch wrapper
    async request(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers: this.getHeaders()
            });

            const data = await response.json();

            if (!response.ok) {
                return { success: false, error: data.error || 'Request failed' };
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: 'Network error. Please try again.' };
        }
    },

    // ============ RESOURCES ============
    async getResources(filters = {}) {
        const params = new URLSearchParams();
        if (filters.type) params.append('type', filters.type);
        if (filters.status) params.append('status', filters.status);
        if (filters.search) params.append('search', filters.search);

        const queryString = params.toString();
        return this.request(`/api/resources${queryString ? '?' + queryString : ''}`);
    },

    async getResourceById(id) {
        return this.request(`/api/resources/${id}`);
    },

    async createResource(data) {
        return this.request('/api/resources', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async updateResource(id, data) {
        return this.request(`/api/resources/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async deleteResource(id) {
        return this.request(`/api/resources/${id}`, { method: 'DELETE' });
    },

    // ============ BOOKINGS ============
    async getBookings(filters = {}) {
        const params = new URLSearchParams();
        if (filters.userId) params.append('userId', filters.userId);
        if (filters.resourceId) params.append('resourceId', filters.resourceId);
        if (filters.status) params.append('status', filters.status);
        if (filters.date) params.append('date', filters.date);

        const queryString = params.toString();
        return this.request(`/api/bookings${queryString ? '?' + queryString : ''}`);
    },

    async getBookingById(id) {
        return this.request(`/api/bookings/${id}`);
    },

    async createBooking(data) {
        return this.request('/api/bookings', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async updateBookingStatus(id, status, reason = null) {
        return this.request(`/api/bookings/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status, reason })
        });
    },

    async cancelBooking(id) {
        return this.request(`/api/bookings/${id}`, { method: 'DELETE' });
    },

    // ============ AVAILABILITY ============
    async checkAvailability(resourceId, date) {
        return this.request(`/api/bookings/availability/${resourceId}/${date}`);
    },

    // ============ USAGE RECORDS ============
    async getUsageRecords(filters = {}) {
        const params = new URLSearchParams();
        if (filters.bookingId) params.append('bookingId', filters.bookingId);

        const queryString = params.toString();
        return this.request(`/api/usage-records${queryString ? '?' + queryString : ''}`);
    },

    async createUsageRecord(data) {
        return this.request('/api/usage-records', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    // ============ STATS ============
    async getDashboardStats() {
        return this.request('/api/stats/dashboard');
    },

    // ============ TIME SLOTS ============
    async getTimeSlots() {
        const result = await this.request('/api/time-slots');
        return result.success ? result.data : [];
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}
