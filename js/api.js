/* =============================================
   API ABSTRACTION LAYER
   Swap mock calls with real fetch() when backend is ready
   ============================================= */

const API = {
    // Base URL - change when backend is ready
    baseUrl: '',

    // Simulate network delay for realistic behavior
    delay: (ms = 300) => new Promise(resolve => setTimeout(resolve, ms)),

    // ============ RESOURCES ============
    async getResources(filters = {}) {
        await this.delay();
        let resources = [...MockData.resources];

        if (filters.type) {
            resources = resources.filter(r => r.subType === filters.type);
        }
        if (filters.status) {
            resources = resources.filter(r => r.status === filters.status);
        }
        if (filters.search) {
            const search = filters.search.toLowerCase();
            resources = resources.filter(r =>
                r.name.toLowerCase().includes(search) ||
                r.location.toLowerCase().includes(search)
            );
        }

        return { success: true, data: resources };
    },

    async getResourceById(id) {
        await this.delay();
        const resource = MockData.resources.find(r => r.id === parseInt(id));
        if (!resource) {
            return { success: false, error: 'Resource not found' };
        }
        return { success: true, data: resource };
    },

    async createResource(data) {
        await this.delay();
        const newResource = {
            id: MockData.resources.length + 1,
            ...data,
            status: 'available'
        };
        MockData.resources.push(newResource);
        return { success: true, data: newResource };
    },

    async updateResource(id, data) {
        await this.delay();
        const index = MockData.resources.findIndex(r => r.id === parseInt(id));
        if (index === -1) {
            return { success: false, error: 'Resource not found' };
        }
        MockData.resources[index] = { ...MockData.resources[index], ...data };
        return { success: true, data: MockData.resources[index] };
    },

    async deleteResource(id) {
        await this.delay();
        const index = MockData.resources.findIndex(r => r.id === parseInt(id));
        if (index === -1) {
            return { success: false, error: 'Resource not found' };
        }
        MockData.resources.splice(index, 1);
        return { success: true };
    },

    // ============ BOOKINGS ============
    async getBookings(filters = {}) {
        await this.delay();
        let bookings = [...MockData.bookings];

        if (filters.userId) {
            bookings = bookings.filter(b => b.userId === parseInt(filters.userId));
        }
        if (filters.resourceId) {
            bookings = bookings.filter(b => b.resourceId === parseInt(filters.resourceId));
        }
        if (filters.status) {
            bookings = bookings.filter(b => b.status === filters.status);
        }
        if (filters.date) {
            bookings = bookings.filter(b => b.date === filters.date);
        }

        // Enrich with resource and user data
        bookings = bookings.map(b => ({
            ...b,
            resource: MockData.resources.find(r => r.id === b.resourceId),
            user: MockData.users.find(u => u.id === b.userId),
            slot: MockData.timeSlots.find(s => s.id === b.slotId)
        }));

        return { success: true, data: bookings };
    },

    async getBookingById(id) {
        await this.delay();
        const booking = MockData.bookings.find(b => b.id === parseInt(id));
        if (!booking) {
            return { success: false, error: 'Booking not found' };
        }
        return {
            success: true,
            data: {
                ...booking,
                resource: MockData.resources.find(r => r.id === booking.resourceId),
                user: MockData.users.find(u => u.id === booking.userId),
                slot: MockData.timeSlots.find(s => s.id === booking.slotId)
            }
        };
    },

    async createBooking(data) {
        await this.delay();

        // Check for conflicts
        const conflict = MockData.bookings.find(b =>
            b.resourceId === parseInt(data.resourceId) &&
            b.date === data.date &&
            b.slotId === parseInt(data.slotId) &&
            ['pending', 'approved'].includes(b.status)
        );

        if (conflict) {
            return { success: false, error: 'Time slot already booked' };
        }

        const newBooking = {
            id: MockData.bookings.length + 1,
            ...data,
            resourceId: parseInt(data.resourceId),
            slotId: parseInt(data.slotId),
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        MockData.bookings.push(newBooking);
        return { success: true, data: newBooking };
    },

    async updateBookingStatus(id, status, reason = null) {
        await this.delay();
        const index = MockData.bookings.findIndex(b => b.id === parseInt(id));
        if (index === -1) {
            return { success: false, error: 'Booking not found' };
        }

        const currentUser = AUTH.getCurrentUser();
        MockData.bookings[index].status = status;

        if (status === 'approved') {
            MockData.bookings[index].approvedBy = currentUser?.id;
            MockData.bookings[index].approvedAt = new Date().toISOString();
        } else if (status === 'rejected') {
            MockData.bookings[index].rejectedBy = currentUser?.id;
            MockData.bookings[index].rejectedAt = new Date().toISOString();
            MockData.bookings[index].rejectionReason = reason;
        }

        return { success: true, data: MockData.bookings[index] };
    },

    async cancelBooking(id) {
        return this.updateBookingStatus(id, 'cancelled');
    },

    // ============ AVAILABILITY ============
    async checkAvailability(resourceId, date) {
        await this.delay(200);

        const bookedSlots = MockData.bookings
            .filter(b =>
                b.resourceId === parseInt(resourceId) &&
                b.date === date &&
                ['pending', 'approved'].includes(b.status)
            )
            .map(b => b.slotId);

        const slots = MockData.timeSlots.map(slot => ({
            ...slot,
            available: !bookedSlots.includes(slot.id)
        }));

        return { success: true, data: slots };
    },

    // ============ USAGE RECORDS ============
    async getUsageRecords(filters = {}) {
        await this.delay();
        let records = [...MockData.usageRecords];

        if (filters.bookingId) {
            records = records.filter(r => r.bookingId === parseInt(filters.bookingId));
        }

        return { success: true, data: records };
    },

    async createUsageRecord(data) {
        await this.delay();
        const currentUser = AUTH.getCurrentUser();
        const newRecord = {
            id: MockData.usageRecords.length + 1,
            ...data,
            uploadedBy: currentUser?.id,
            uploadedAt: new Date().toISOString()
        };
        MockData.usageRecords.push(newRecord);

        // Mark booking as completed
        const bookingIndex = MockData.bookings.findIndex(b => b.id === parseInt(data.bookingId));
        if (bookingIndex !== -1) {
            MockData.bookings[bookingIndex].status = 'completed';
        }

        return { success: true, data: newRecord };
    },

    // ============ STATS ============
    async getDashboardStats() {
        await this.delay();
        const today = new Date().toISOString().split('T')[0];

        return {
            success: true,
            data: {
                totalResources: MockData.resources.length,
                activeResources: MockData.resources.filter(r => r.status === 'available').length,
                bookingsToday: MockData.bookings.filter(b => b.date === today).length,
                pendingApprovals: MockData.bookings.filter(b => b.status === 'pending').length,
                completedThisMonth: MockData.bookings.filter(b => b.status === 'completed').length,
                totalUsers: MockData.users.length
            }
        };
    },

    // ============ TIME SLOTS ============
    getTimeSlots() {
        return MockData.timeSlots;
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}
