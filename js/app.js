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

        // Hide stats section for non-admin users
        const statsSection = document.getElementById('stats-section');
        if (statsSection && user.role !== 'admin') {
            statsSection.style.display = 'none';
        }

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
        const container = document.getElementById('recent-bookings');
        if (!container) return;

        if (!result.success) {
            container.innerHTML = `<tr><td colspan="4" class="text-center p-6 text-danger">Failed to load bookings. ${result.error || ''}</td></tr>`;
            return;
        }

        const bookings = result.data.slice(0, 5);

        if (bookings.length === 0) {
            container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><i class="fa-solid fa-calendar-days"></i></div>
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
            container.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-state-icon text-danger"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <div class="empty-state-title">Failed to load resources</div>
          <div class="empty-state-description">${result.error || 'Network error'}</div>
        </div>
      `;
            return;
        }

        if (result.data.length === 0) {
            container.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-state-icon"><i class="fa-solid fa-futbol"></i></div>
          <div class="empty-state-title">No resources found</div>
          <div class="empty-state-description">Try adjusting your filters.</div>
        </div>
      `;
            return;
        }

        container.innerHTML = result.data.map(r => `
      <div class="card resource-card">
        <div class="resource-card-image">
          <span><i class="fa-solid fa-futbol"></i></span>
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
        const nameEl = document.getElementById('resource-name');
        if (nameEl) nameEl.textContent = resource.name;

        const locationEl = document.getElementById('resource-location');
        if (locationEl) locationEl.textContent = resource.location;

        const capacityEl = document.getElementById('resource-capacity');
        if (capacityEl) capacityEl.textContent = resource.capacity;

        const descEl = document.getElementById('resource-description');
        if (descEl) descEl.textContent = resource.description;

        const statusEl = document.getElementById('resource-status');
        if (statusEl) statusEl.innerHTML = Utils.getStatusBadge(resource.status);

        const amenitiesList = document.getElementById('resource-amenities');
        if (amenitiesList && resource.amenities) {
            amenitiesList.innerHTML = resource.amenities.map(a => `<li><i class="fa-solid fa-check"></i> ${a}</li>`).join('');
        }

        const rulesList = document.getElementById('resource-rules');
        if (rulesList && resource.rules && resource.rules.length > 0) {
            rulesList.innerHTML = resource.rules.map(r => `<li>${r}</li>`).join('');
        } else if (rulesList) {
            rulesList.innerHTML = '<li>No specific rules posted.</li>';
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

    // Booking form logic is completely handled inline in pages/booking-form.html
    initBookingForm() {
        // Leaving stub to prevent errors in pageInits mapping
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
        if (!result.success) {
            container.innerHTML = `<tr><td colspan="8" class="text-center p-6 text-danger">Failed to load bookings. ${result.error || ''}</td></tr>`;
            return;
        }

        if (result.data.length === 0) {
            container.innerHTML = `
        <tr>
          <td colspan="8" class="text-center p-6">
            <div class="empty-state-icon"><i class="fa-solid fa-calendar-days"></i></div>
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
        <td class="whitespace-nowrap">${b.slot?.label || ''}</td>
        <td>
            <div title="${Utils.escapeHtml(b.purpose)}">${Utils.truncate(b.purpose, 40)}</div>
        </td>
        <td>${Utils.getStatusBadge(b.status)}</td>
        <td>
            ${b.status === 'rejected' && b.rejectionReason ? Utils.escapeHtml(b.rejectionReason) : '<span class="text-muted">-</span>'}
        </td>
        <td>
            ${b.status === 'completed'
                ? (b.hasUsageRecord ? '<span class="badge badge-success">Submitted</span>' : '<span class="badge badge-warning">Pending</span>')
                : '<span class="text-muted">-</span>'}
        </td>
        <td>
            ${b.status === 'pending' ? `<button class="btn btn-ghost btn-sm" onclick="App.cancelBooking(${b.id})">Cancel</button>` : ''}
            ${b.status === 'approved' ? `<button class="btn btn-primary btn-sm" onclick="App.completeBooking(${b.id})">Mark Completed</button>` : ''}
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
        if (!result.success) {
            container.innerHTML = `<tr><td colspan="7" class="text-center p-6 text-danger">Failed to load approvals. ${result.error || ''}</td></tr>`;
            return;
        }

        if (result.data.length === 0) {
            container.innerHTML = `
        <tr>
          <td colspan="7" class="text-center p-6">
            <div class="empty-state-icon"><i class="fa-solid fa-check"></i></div>
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
        const reason = await Modal.prompt({
            title: 'Reject Booking',
            message: 'Please provide a reason for rejecting this booking request:',
            placeholder: 'Reason for rejection (optional)',
            confirmText: 'Reject'
        });

        // User clicked cancel
        if (reason === null) return;

        const result = await API.updateBookingStatus(id, 'rejected', reason);
        if (result.success) {
            Notifications.success('Rejected', 'Booking has been rejected');
            this.loadPendingApprovals();
        } else {
            Notifications.error('Error', result.error || 'Failed to reject');
        }
    },

    async completeBooking(id) {
        const confirmed = await Modal.confirm({
            title: 'Mark Completed',
            message: 'Are you sure you want to mark this booking as thoroughly completed?',
            confirmText: 'Mark Completed',
            type: 'success'
        });
        if (!confirmed) return;

        const result = await API.updateBookingStatus(id, 'completed', null);
        if (result.success) {
            Notifications.success('Completed', 'Booking marked as completed');
            if (this.getCurrentPage() === 'my-bookings') {
                this.loadMyBookings();
            } else {
                this.loadReportsData();
            }
        } else {
            Notifications.error('Error', result.error || 'Failed to complete booking');
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

        const monthTitle = document.getElementById('calendar-month');
        if (monthTitle) monthTitle.textContent = `${monthNames[month]} ${year}`;

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
        if (!AUTH.hasRole(['admin', 'faculty', 'user'])) {
            window.location.href = 'dashboard.html';
            return;
        }

        this.loadCompletedBookingsForUpload();
        this.setupFileUpload();
    },

    async loadCompletedBookingsForUpload() {
        const select = document.getElementById('booking-select');
        if (!select) return;

        const result = await API.getBookings({ status: 'completed' });
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
        <button class="file-item-remove" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
      `;
            listContainer.appendChild(item);
        });
    },

    // Reports page
    initReports() {
        if (!AUTH.requireRole('admin')) return;
        this.loadReportsData();

        const exportBtn = document.querySelector('button .fa-download')?.parentElement;
        if (exportBtn) {
            exportBtn.onclick = () => this.exportReportsCSV();
        }
    },

    async loadReportsData() {
        const container = document.getElementById('reports-table-body');
        if (!container) return;

        // Fetch filter values
        const filters = {};
        const startDate = document.getElementById('date-from')?.value;
        if (startDate) filters.startDate = startDate;

        const endDate = document.getElementById('date-to')?.value;
        if (endDate) filters.endDate = endDate;

        const status = document.getElementById('report-status')?.value;
        if (status) filters.status = status;

        const result = await API.getBookings(filters);
        if (!result.success) {
            container.innerHTML = `<tr><td colspan="7" class="text-center p-6 text-danger">Failed to load reports. ${result.error || ''}</td></tr>`;
            return;
        }

        container.innerHTML = result.data.map(b => `
      <tr>
        <td>${b.resource?.name || 'Unknown'}</td>
        <td>${b.user?.name || 'Unknown'}</td>
        <td>${Utils.formatDate(b.date)}</td>
        <td>${b.slot?.label || ''}</td>
        <td>${Utils.getStatusBadge(b.status)}</td>
        <td>
          ${['rejected', 'cancelled', 'approved'].includes(b.status)
                ? '<span class="text-muted text-sm" style="color: var(--text-muted);">-</span>'
                : b.gdriveLink
                    ? `<a href="${Utils.escapeHtml(b.gdriveLink)}" target="_blank" class="btn btn-ghost btn-sm" title="View Evidence on GDrive"><i class="fa-brands fa-google-drive" style="color: #0F9D58; margin-right: 4px;"></i> View Link</a>`
                    : '<span class="text-muted text-sm" style="color: var(--text-muted);">Not Submitted</span>'}
        </td>
        <td>${Utils.timeAgo(b.createdAt)}</td>
        <td class="text-right">
          ${b.status === 'approved' ? `<button class="btn btn-primary btn-sm" onclick="App.completeBooking(${b.id})">Mark Completed</button>` : ''}
        </td>
      </tr>
    `).join('');
    },

    async exportReportsCSV() {
        // Fetch filter values
        const filters = {};
        const startDate = document.getElementById('date-from')?.value;
        if (startDate) filters.startDate = startDate;

        const endDate = document.getElementById('date-to')?.value;
        if (endDate) filters.endDate = endDate;

        const status = document.getElementById('report-status')?.value;
        if (status) filters.status = status;

        const result = await API.getBookings(filters);
        if (!result.success || !result.data || result.data.length === 0) {
            Notifications.error('Export Error', 'No data available to export');
            return;
        }

        // CSV Headers
        const headers = ['Booking ID', 'Resource Name', 'User Name', 'User Email', 'Booking Date', 'Time Slot', 'Purpose', 'Status', 'Evidence Link', 'Created At'];

        // Escape helper for CSV data
        const escapeCSV = (str) => {
            if (str === null || str === undefined) return '""';
            const escaped = String(str).replace(/"/g, '""');
            return `"${escaped}"`;
        };

        // CSV Rows
        const rows = result.data.map(b => [
            escapeCSV(b.id),
            escapeCSV(b.resource?.name),
            escapeCSV(b.user?.name),
            escapeCSV(b.user?.email),
            escapeCSV(Utils.formatDate(b.date)),
            escapeCSV(b.slot?.label),
            escapeCSV(b.purpose),
            escapeCSV(b.status),
            escapeCSV(b.gdriveLink || ''),
            escapeCSV(new Date(b.createdAt).toLocaleString())
        ].join(','));

        const csvContent = [headers.join(','), ...rows].join('\n');

        // Create a downloadable blob
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        const timestamp = new Date().toISOString().split('T')[0];
        link.setAttribute('href', url);
        link.setAttribute('download', `bookings_report_${timestamp}.csv`);
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        Notifications.success('Success', 'Report exported as CSV');
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Skip auth check for public pages and login
    const publicPages = ['index', 'register', 'forgot-password', 'public-calendar', 'public-booking'];
    const currentPage = App.getCurrentPage();

    if (!publicPages.includes(currentPage)) {
        if (!AUTH.isAuthenticated()) {
            window.location.href = '../login.html';
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
