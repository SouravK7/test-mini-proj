/* =============================================
   MAIN APPLICATION LOGIC
   ============================================= */

const App = {
    // Current page info
    currentPage: null,

    // Initialize application
    init() {
        this.currentPage = this.getCurrentPage();
        this.setupNavigation();
        this.setupMobileMenu();
        this.setupDropdowns();
        this.updateUserInfo();

        // Initialize page-specific functionality
        this.initPage();
    },

    // Get current page name from URL
    getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.substring(path.lastIndexOf('/') + 1);
        return filename.replace('.html', '') || 'index';
    },

    // Setup sidebar navigation
    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const currentPage = this.currentPage;

        navItems.forEach(item => {
            const href = item.getAttribute('href');
            if (href && href.includes(currentPage + '.html')) {
                item.classList.add('active');
            }

            // Hide items based on role
            const requiredRole = item.dataset.role;
            if (requiredRole) {
                const user = AUTH.getCurrentUser();
                const roles = requiredRole.split(',');
                if (!user || !roles.includes(user.role)) {
                    item.style.display = 'none';
                }
            }
        });

        // Also hide nav-sections based on role
        const navSections = document.querySelectorAll('.nav-section[data-role]');
        navSections.forEach(section => {
            const requiredRole = section.dataset.role;
            if (requiredRole) {
                const user = AUTH.getCurrentUser();
                const roles = requiredRole.split(',');
                if (!user || !roles.includes(user.role)) {
                    section.style.display = 'none';
                }
            }
        });
    },


    // Mobile menu toggle
    setupMobileMenu() {
        const menuBtn = document.querySelector('.mobile-menu-btn');
        const sidebar = document.querySelector('.sidebar');

        if (menuBtn && sidebar) {
            menuBtn.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });

            // Close on outside click
            document.addEventListener('click', (e) => {
                if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
                    sidebar.classList.remove('open');
                }
            });
        }
    },

    // Setup dropdown menus
    setupDropdowns() {
        document.querySelectorAll('.dropdown').forEach(dropdown => {
            const trigger = dropdown.querySelector('[data-dropdown]');
            const menu = dropdown.querySelector('.dropdown-menu');

            if (trigger && menu) {
                trigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    menu.classList.toggle('active');
                });
            }
        });

        // Close dropdowns on outside click
        document.addEventListener('click', () => {
            document.querySelectorAll('.dropdown-menu.active').forEach(menu => {
                menu.classList.remove('active');
            });
        });
    },

    // Update user info in navbar
    updateUserInfo() {
        const user = AUTH.getCurrentUser();
        if (!user) return;

        const nameEl = document.querySelector('.navbar-user-name');
        const roleEl = document.querySelector('.navbar-user-role');
        const avatarEl = document.querySelector('.navbar-user .avatar');

        if (nameEl) nameEl.textContent = user.name;
        if (roleEl) roleEl.textContent = Utils.capitalize(user.role);
        if (avatarEl) avatarEl.textContent = AUTH.getUserInitials(user.name);
    },

    // Initialize page-specific functionality
    initPage() {
        const pageInits = {
            'dashboard': () => this.initDashboard(),
            'resources': () => this.initResources(),
            'resource-detail': () => this.initResourceDetail(),
            'booking-form': () => this.initBookingForm(),
            'my-bookings': () => this.initMyBookings(),
            'calendar': () => this.initCalendar(),
            'approvals': () => this.initApprovals(),
            'usage-upload': () => this.initUsageUpload(),
            'reports': () => this.initReports()
        };

        const init = pageInits[this.currentPage];
        if (init) init();
    },

    // Dashboard initialization
    async initDashboard() {
        const user = AUTH.getCurrentUser();
        if (!user) return;

        // Load stats for admin
        if (user.role === 'admin') {
            const result = await API.getDashboardStats();
            if (result.success) {
                this.updateDashboardStats(result.data);
            }
        }

        // Load recent bookings
        await this.loadRecentBookings();
    },

    updateDashboardStats(stats) {
        document.querySelectorAll('[data-stat]').forEach(el => {
            const key = el.dataset.stat;
            if (stats[key] !== undefined) {
                el.textContent = stats[key];
            }
        });
    },

    async loadRecentBookings() {
        const user = AUTH.getCurrentUser();
        const filters = user.role === 'admin' ? {} : { userId: user.id };

        const result = await API.getBookings(filters);
        if (!result.success) return;

        const container = document.getElementById('recent-bookings');
        if (!container) return;

        const bookings = result.data.slice(0, 5);

        if (bookings.length === 0) {
            container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📅</div>
          <div class="empty-state-title">No bookings yet</div>
          <div class="empty-state-description">Your booking history will appear here.</div>
        </div>
      `;
            return;
        }

        container.innerHTML = bookings.map(b => `
      <tr>
        <td>${b.resource?.name || 'Unknown'}</td>
        <td>${Utils.formatDate(b.date)}</td>
        <td>${b.slot?.label || ''}</td>
        <td>${Utils.getStatusBadge(b.status)}</td>
      </tr>
    `).join('');
    },

    // Resources page
    async initResources() {
        await this.loadResources();
        this.setupResourceFilters();
    },

    async loadResources(filters = {}) {
        const container = document.getElementById('resources-grid');
        if (!container) return;

        const loading = Utils.showLoading(container);
        const result = await API.getResources(filters);
        Utils.hideLoading(loading);

        if (!result.success) {
            Notifications.error('Error', 'Failed to load resources');
            return;
        }

        if (result.data.length === 0) {
            container.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-state-icon">🏟️</div>
          <div class="empty-state-title">No resources found</div>
          <div class="empty-state-description">Try adjusting your filters.</div>
        </div>
      `;
            return;
        }

        container.innerHTML = result.data.map(r => `
      <div class="card resource-card">
        <div class="resource-card-image">
          <span>🏟️</span>
        </div>
        <div class="resource-card-body">
          <h3 class="resource-card-title">${r.name}</h3>
          <p class="text-sm text-secondary">${Utils.truncate(r.description, 80)}</p>
        </div>
        <div class="resource-card-footer">
          ${Utils.getStatusBadge(r.status)}
          <a href="resource-detail.html?id=${r.id}" class="btn btn-primary btn-sm">View Details</a>
        </div>
      </div>
    `).join('');
    },

    setupResourceFilters() {
        const searchInput = document.getElementById('search-input');
        const typeFilter = document.getElementById('type-filter');
        const statusFilter = document.getElementById('status-filter');

        const applyFilters = Utils.debounce(() => {
            this.loadResources({
                search: searchInput?.value || '',
                type: typeFilter?.value || '',
                status: statusFilter?.value || ''
            });
        }, 300);

        searchInput?.addEventListener('input', applyFilters);
        typeFilter?.addEventListener('change', applyFilters);
        statusFilter?.addEventListener('change', applyFilters);
    },

    // Resource detail page
    async initResourceDetail() {
        const id = Utils.getUrlParam('id');
        if (!id) {
            window.location.href = 'resources.html';
            return;
        }

        const result = await API.getResourceById(id);
        if (!result.success) {
            Notifications.error('Error', 'Resource not found');
            window.location.href = 'resources.html';
            return;
        }

        this.renderResourceDetail(result.data);
        this.loadResourceAvailability(id, Utils.getToday());
    },

    renderResourceDetail(resource) {
        document.getElementById('resource-name')?.textContent = resource.name;
        document.getElementById('resource-location')?.textContent = resource.location;
        document.getElementById('resource-capacity')?.textContent = resource.capacity;
        document.getElementById('resource-description')?.textContent = resource.description;
        document.getElementById('resource-status')?.innerHTML = Utils.getStatusBadge(resource.status);

        const amenitiesList = document.getElementById('resource-amenities');
        if (amenitiesList && resource.amenities) {
            amenitiesList.innerHTML = resource.amenities.map(a => `<li>✓ ${a}</li>`).join('');
        }
    },

    async loadResourceAvailability(resourceId, date) {
        const container = document.getElementById('time-slots');
        if (!container) return;

        const result = await API.checkAvailability(resourceId, date);
        if (!result.success) return;

        container.innerHTML = result.data.map(slot => `
      <div class="time-slot ${slot.available ? 'slot-available' : 'slot-unavailable'}" 
           data-slot-id="${slot.id}" 
           data-available="${slot.available}">
        ${slot.label}
      </div>
    `).join('');

        // Click handler for available slots
        container.querySelectorAll('.time-slot.slot-available').forEach(el => {
            el.addEventListener('click', () => {
                const slotId = el.dataset.slotId;
                window.location.href = `booking-form.html?resource=${resourceId}&date=${date}&slot=${slotId}`;
            });
        });
    },

    // Booking form
    async initBookingForm() {
        const resourceId = Utils.getUrlParam('resource');
        const date = Utils.getUrlParam('date');
        const slotId = Utils.getUrlParam('slot');

        // Pre-fill form if params exist
        if (resourceId) {
            const resourceSelect = document.getElementById('resource-select');
            if (resourceSelect) resourceSelect.value = resourceId;
        }
        if (date) {
            const dateInput = document.getElementById('booking-date');
            if (dateInput) dateInput.value = date;
        }

        // Load resources for dropdown
        await this.loadResourceOptions();

        // Load slots when date changes
        const dateInput = document.getElementById('booking-date');
        const resourceSelect = document.getElementById('resource-select');

        const loadSlots = async () => {
            if (resourceSelect?.value && dateInput?.value) {
                await this.loadBookingSlots(resourceSelect.value, dateInput.value, slotId);
            }
        };

        dateInput?.addEventListener('change', loadSlots);
        resourceSelect?.addEventListener('change', loadSlots);

        // Initial load if both values present
        if (resourceId && date) {
            await loadSlots();
        }

        // Form submission
        const form = document.getElementById('booking-form');
        form?.addEventListener('submit', (e) => this.handleBookingSubmit(e));
    },

    async loadResourceOptions() {
        const select = document.getElementById('resource-select');
        if (!select) return;

        const result = await API.getResources({ status: 'available' });
        if (!result.success) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="">Select a resource</option>' +
            result.data.map(r => `<option value="${r.id}" ${r.id == currentValue ? 'selected' : ''}>${r.name}</option>`).join('');
    },

    async loadBookingSlots(resourceId, date, preselectedSlot = null) {
        const container = document.getElementById('slot-container');
        if (!container) return;

        const result = await API.checkAvailability(resourceId, date);
        if (!result.success) return;

        container.innerHTML = `
      <label class="form-label required">Select Time Slot</label>
      <div class="slot-grid" id="time-slots">
        ${result.data.map(slot => `
          <div class="time-slot ${slot.available ? 'slot-available' : 'slot-unavailable'} ${slot.id == preselectedSlot ? 'slot-selected' : ''}" 
               data-slot-id="${slot.id}" 
               data-available="${slot.available}">
            ${slot.label}
          </div>
        `).join('')}
      </div>
      <input type="hidden" name="slotId" id="slot-input" value="${preselectedSlot || ''}">
    `;

        // Slot selection
        container.querySelectorAll('.time-slot.slot-available').forEach(el => {
            el.addEventListener('click', () => {
                container.querySelectorAll('.time-slot').forEach(s => s.classList.remove('slot-selected'));
                el.classList.add('slot-selected');
                document.getElementById('slot-input').value = el.dataset.slotId;
            });
        });
    },

    async handleBookingSubmit(e) {
        e.preventDefault();

        const form = e.target;
        const rules = {
            'resource-select': [{ type: 'required', message: 'Please select a resource' }],
            'booking-date': [{ type: 'required' }, { type: 'futureDate' }],
            'purpose': [{ type: 'required' }, { type: 'minLength', value: 10, message: 'Please provide more details (min 10 characters)' }]
        };

        if (!FormValidator.validateForm(form, rules)) return;

        const slotId = document.getElementById('slot-input')?.value;
        if (!slotId) {
            Notifications.error('Error', 'Please select a time slot');
            return;
        }

        const user = AUTH.getCurrentUser();
        const data = {
            resourceId: form.querySelector('#resource-select').value,
            date: form.querySelector('#booking-date').value,
            slotId: slotId,
            purpose: form.querySelector('#purpose').value,
            userId: user?.id
        };

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span> Submitting...';

        const result = await API.createBooking(data);

        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Booking Request';

        if (result.success) {
            Notifications.success('Success', 'Booking request submitted successfully!');
            setTimeout(() => {
                window.location.href = 'my-bookings.html';
            }, 1500);
        } else {
            Notifications.error('Error', result.error || 'Failed to submit booking');
        }
    },

    // My bookings page
    async initMyBookings() {
        await this.loadMyBookings();
        this.setupBookingTabs();
    },

    async loadMyBookings(status = '') {
        const user = AUTH.getCurrentUser();
        const container = document.getElementById('bookings-table-body');
        if (!container) return;

        const filters = { userId: user?.id };
        if (status) filters.status = status;

        const result = await API.getBookings(filters);
        if (!result.success) return;

        if (result.data.length === 0) {
            container.innerHTML = `
        <tr>
          <td colspan="6" class="text-center p-6">
            <div class="empty-state-icon">📅</div>
            <p>No bookings found</p>
          </td>
        </tr>
      `;
            return;
        }

        container.innerHTML = result.data.map(b => `
      <tr>
        <td>${b.resource?.name || 'Unknown'}</td>
        <td>${Utils.formatDate(b.date)}</td>
        <td>${b.slot?.label || ''}</td>
        <td>${Utils.truncate(b.purpose, 40)}</td>
        <td>${Utils.getStatusBadge(b.status)}</td>
        <td>
          ${b.status === 'pending' ? `<button class="btn btn-ghost btn-sm" onclick="App.cancelBooking(${b.id})">Cancel</button>` : ''}
        </td>
      </tr>
    `).join('');
    },

    setupBookingTabs() {
        document.querySelectorAll('.tab[data-status]').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.loadMyBookings(tab.dataset.status);
            });
        });
    },

    async cancelBooking(id) {
        const confirmed = await Modal.confirm({
            title: 'Cancel Booking?',
            message: 'Are you sure you want to cancel this booking request?',
            type: 'warning',
            confirmText: 'Yes, Cancel'
        });

        if (!confirmed) return;

        const result = await API.cancelBooking(id);
        if (result.success) {
            Notifications.success('Cancelled', 'Booking has been cancelled');
            this.loadMyBookings();
        } else {
            Notifications.error('Error', 'Failed to cancel booking');
        }
    },

    // Admin approvals
    async initApprovals() {
        if (!AUTH.requireRole('admin')) return;
        await this.loadPendingApprovals();
    },

    async loadPendingApprovals() {
        const container = document.getElementById('approvals-table-body');
        if (!container) return;

        const result = await API.getBookings({ status: 'pending' });
        if (!result.success) return;

        if (result.data.length === 0) {
            container.innerHTML = `
        <tr>
          <td colspan="7" class="text-center p-6">
            <div class="empty-state-icon">✓</div>
            <p>No pending approvals</p>
          </td>
        </tr>
      `;
            return;
        }

        container.innerHTML = result.data.map(b => `
      <tr>
        <td>${b.user?.name || 'Unknown'}</td>
        <td>${b.resource?.name || 'Unknown'}</td>
        <td>${Utils.formatDate(b.date)}</td>
        <td>${b.slot?.label || ''}</td>
        <td>${Utils.truncate(b.purpose, 40)}</td>
        <td>${Utils.timeAgo(b.createdAt)}</td>
        <td>
          <div class="flex gap-2">
            <button class="btn btn-success btn-sm" onclick="App.approveBooking(${b.id})">Approve</button>
            <button class="btn btn-danger btn-sm" onclick="App.rejectBooking(${b.id})">Reject</button>
          </div>
        </td>
      </tr>
    `).join('');
    },

    async approveBooking(id) {
        const confirmed = await Modal.confirm({
            title: 'Approve Booking?',
            message: 'This will confirm the booking for the requested time slot.',
            type: 'success',
            confirmText: 'Approve'
        });

        if (!confirmed) return;

        const result = await API.updateBookingStatus(id, 'approved');
        if (result.success) {
            Notifications.success('Approved', 'Booking has been approved');
            this.loadPendingApprovals();
        } else {
            Notifications.error('Error', result.error || 'Failed to approve');
        }
    },

    async rejectBooking(id) {
        const reason = prompt('Enter rejection reason (optional):');

        const result = await API.updateBookingStatus(id, 'rejected', reason);
        if (result.success) {
            Notifications.success('Rejected', 'Booking has been rejected');
            this.loadPendingApprovals();
        } else {
            Notifications.error('Error', result.error || 'Failed to reject');
        }
    },

    // Calendar page
    initCalendar() {
        // Simplified calendar - can integrate FullCalendar later
        this.renderMiniCalendar();
    },

    renderMiniCalendar() {
        const container = document.getElementById('calendar-grid');
        if (!container) return;

        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];

        document.getElementById('calendar-month')?.textContent = `${monthNames[month]} ${year}`;

        let html = '<div class="mini-calendar-grid">';
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        days.forEach(d => html += `<div class="font-semibold text-sm text-secondary">${d}</div>`);

        for (let i = 0; i < firstDay; i++) {
            html += '<div class="mini-calendar-day other-month"></div>';
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const isToday = day === today.getDate();
            html += `<div class="mini-calendar-day ${isToday ? 'today' : ''}">${day}</div>`;
        }

        html += '</div>';
        container.innerHTML = html;
    },

    // Usage upload
    initUsageUpload() {
        if (!AUTH.hasRole(['admin', 'faculty'])) {
            window.location.href = 'dashboard.html';
            return;
        }

        this.loadCompletedBookingsForUpload();
        this.setupFileUpload();
    },

    async loadCompletedBookingsForUpload() {
        const select = document.getElementById('booking-select');
        if (!select) return;

        const result = await API.getBookings({ status: 'approved' });
        if (!result.success) return;

        select.innerHTML = '<option value="">Select a booking</option>' +
            result.data.map(b => `
        <option value="${b.id}">${b.resource?.name} - ${Utils.formatDate(b.date)} (${b.slot?.label})</option>
      `).join('');
    },

    setupFileUpload() {
        const dropzone = document.getElementById('file-dropzone');
        const fileInput = document.getElementById('file-input');
        const fileList = document.getElementById('file-list');

        if (!dropzone || !fileInput) return;

        dropzone.addEventListener('click', () => fileInput.click());

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            this.handleFiles(files, fileList);
        });

        fileInput.addEventListener('change', () => {
            this.handleFiles(fileInput.files, fileList);
        });
    },

    handleFiles(files, listContainer) {
        if (!listContainer) return;

        Array.from(files).forEach(file => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.innerHTML = `
        <span class="file-item-name">${file.name}</span>
        <span class="file-item-size">${Utils.formatFileSize(file.size)}</span>
        <button class="file-item-remove" onclick="this.parentElement.remove()">×</button>
      `;
            listContainer.appendChild(item);
        });
    },

    // Reports page
    initReports() {
        if (!AUTH.requireRole('admin')) return;
        this.loadReportsData();
    },

    async loadReportsData() {
        const container = document.getElementById('reports-table-body');
        if (!container) return;

        const result = await API.getBookings({});
        if (!result.success) return;

        container.innerHTML = result.data.map(b => `
      <tr>
        <td>${b.resource?.name || 'Unknown'}</td>
        <td>${b.user?.name || 'Unknown'}</td>
        <td>${Utils.formatDate(b.date)}</td>
        <td>${b.slot?.label || ''}</td>
        <td>${Utils.getStatusBadge(b.status)}</td>
        <td>${Utils.timeAgo(b.createdAt)}</td>
      </tr>
    `).join('');
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Skip auth check for public pages and login
    const publicPages = ['index', 'register', 'forgot-password', 'public-calendar', 'public-booking'];
    const currentPage = App.getCurrentPage();

    if (!publicPages.includes(currentPage)) {
        if (!AUTH.isAuthenticated()) {
            window.location.href = '../index.html';
            return;
        }
    }

    App.init();
});

// Logout function (called from HTML)
function logout(event) {
    if (event) event.preventDefault();
    AUTH.logout();
    return false;
}
