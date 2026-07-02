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
            'reports': () => this.initReports(),
            'report-details': () => this.initReportDetails(),
            'add-resource': () => this.initAddResource(),
            'payment-ledger': () => this.initPaymentLedger()
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

            // Redirect "View All" to reports page which lists all bookings
            const viewAllBtn = document.getElementById('dashboard-view-all-btn');
            if (viewAllBtn) {
                viewAllBtn.href = 'reports.html';
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
        // Show "Add Resource" button for admin
        const user = AUTH.getCurrentUser();
        if (user && user.role === 'admin') {
            const addBtn = document.getElementById('add-resource-btn');
            if (addBtn) addBtn.style.display = '';
        }

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

        const user = AUTH.getCurrentUser();
        const isAdmin = user && user.role === 'admin';

        container.innerHTML = result.data.map(r => {
            const adminDropdown = isAdmin ? `
              <select class="form-select resource-status-select" data-resource-id="${r.id}" data-current-status="${r.status}" style="width: auto; font-size: 0.75rem; padding: 3px 6px; min-width: 120px;">
                <option value="available"${r.status === 'available' ? ' selected' : ''}>Available</option>
                <option value="maintenance"${r.status === 'maintenance' ? ' selected' : ''}>Maintenance</option>
                <option value="unavailable"${r.status === 'unavailable' ? ' selected' : ''}>Unavailable</option>
              </select>` : '';

            return `
      <div class="card resource-card">
        <div class="resource-card-image">
          <span><i class="fa-solid fa-futbol"></i></span>
        </div>
        <div class="resource-card-body">
          <h3 class="resource-card-title">${r.name}</h3>
          <p class="text-sm text-secondary">${Utils.truncate(r.description, 80)}</p>
        </div>
        <div class="resource-card-footer">
          ${isAdmin ? adminDropdown : Utils.getStatusBadge(r.status)}
          <a href="resource-detail.html?id=${r.id}" class="btn btn-primary btn-sm">View Details</a>
        </div>
      </div>
    `;
        }).join('');

        // Attach change listeners to admin status dropdowns
        if (isAdmin) {
            container.querySelectorAll('.resource-status-select').forEach(select => {
                select.addEventListener('change', (e) => {
                    const resourceId = e.target.dataset.resourceId;
                    const newStatus = e.target.value;
                    const previousStatus = e.target.dataset.currentStatus;
                    this.changeResourceStatus(resourceId, newStatus, e.target, previousStatus);
                });
            });
        }
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

    async changeResourceStatus(id, newStatus, selectEl, previousStatus) {
        const labels = { available: 'Available', maintenance: 'Under Maintenance', unavailable: 'Unavailable' };
        const confirmed = await Modal.confirm({
            title: 'Change Resource Status?',
            message: `Are you sure you want to set this resource to <strong>${labels[newStatus]}</strong>?`,
            type: newStatus === 'available' ? 'success' : 'warning',
            confirmText: `Yes, ${labels[newStatus]}`
        });

        if (!confirmed) {
            // Revert dropdown to previous value
            if (selectEl) selectEl.value = previousStatus;
            return;
        }

        const result = await API.updateResourceStatus(id, newStatus);
        if (result.success) {
            Notifications.success('Status Updated', `Resource is now ${labels[newStatus]}`);
            this.loadResources();
        } else {
            Notifications.error('Error', result.error || 'Failed to update status');
            if (selectEl) selectEl.value = previousStatus;
        }
    },

    // Add resource page (form logic is inline in add-resource.html)
    initAddResource() {
        // Handled by inline script
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

        container.innerHTML = result.data.map(b => {
            // Payment summary panel for auditorium bookings with financial data
            const hasPaymentData = b.totalAmount && parseFloat(b.totalAmount) > 0;
            const paymentWarningStatuses = ['awaiting_advance', 'partially_confirmed'];
            const isAwaitingAdvance = b.status === 'awaiting_advance';
            const isPartiallyConfirmed = b.status === 'partially_confirmed';
            const isPaymentPending = isAwaitingAdvance || isPartiallyConfirmed;

            const paymentBanner = isPaymentPending ? `
                <tr class="payment-banner-row">
                    <td colspan="8" style="padding: 0;">
                        <div class="payment-visit-banner">
                            <div class="payment-banner-icon"><i class="fa-solid fa-building-columns"></i></div>
                            <div class="payment-banner-content">
                                <strong>Action Required: ${isAwaitingAdvance ? 'Advance Payment to Confirm Booking' : 'Final Balance Payment'}</strong>
                                <p>Please visit the <strong>College Administrative Office</strong> during working hours (9 AM – 5 PM) with your ID proof and booking reference <strong>#${b.id}</strong>.</p>
                                ${isAwaitingAdvance ? `<p class="text-sm mt-1" style="opacity: 0.9;">*Note: A 50% booking advance plus the full refundable security deposit must be paid to confirm this reservation.</p>` : ''}
                            </div>
                            ${hasPaymentData ? `
                            <div class="payment-summary-inline">
                                <div class="psm-item"><span>Event Rental</span><strong>${Utils.formatCurrency(b.totalAmount)}</strong></div>
                                ${b.securityDeposit && parseFloat(b.securityDeposit) > 0 ? `<div class="psm-item"><span>Security Deposit</span><strong>${Utils.formatCurrency(b.securityDeposit)} (Refundable)</strong></div>` : ''}
                                <div class="psm-item"><span>Booking Subtotal</span><strong>${Utils.formatCurrency(parseFloat(b.totalAmount || 0) + parseFloat(b.securityDeposit || 0))}</strong></div>
                                ${isAwaitingAdvance ? `
                                <div class="psm-item"><span>Due Now (To Confirm)</span><strong class="text-danger">${Utils.formatCurrency(parseFloat(b.advanceRequired || 0) + parseFloat(b.securityDeposit || 0))}</strong></div>
                                <div class="psm-item"><span>Due Later (Balance)</span><strong>${Utils.formatCurrency(parseFloat(b.totalAmount || 0) - parseFloat(b.advanceRequired || 0))}</strong></div>
                                ` : `
                                <div class="psm-item"><span>Paid So Far</span><strong class="text-success">${Utils.formatCurrency(b.totalPaid || 0)}</strong></div>
                                <div class="psm-item"><span>Due Now (Balance)</span><strong class="text-danger">${Utils.formatCurrency(b.balanceDue)}</strong></div>
                                `}
                            </div>` : ''}
                        </div>
                    </td>
                </tr>
            ` : '';

            return `
            ${paymentBanner}
            <tr>
                <td>${b.resource?.name || 'Unknown'}</td>
                <td>${Utils.formatDate(b.date)}</td>
                <td class="whitespace-nowrap">${b.slot?.label || ''}</td>
                <td>
                    <div title="${Utils.escapeHtml(b.purpose)}">${Utils.truncate(b.purpose, 40)}</div>
                    ${b.eventCategory ? `<div class="text-xs text-secondary mt-1"><i class="fa-solid fa-tag"></i> ${Utils.escapeHtml(b.eventCategory)}</div>` : ''}
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
                    ${['pending_approval', 'pending'].includes(b.status) ? `<button class="btn btn-ghost btn-sm" onclick="App.cancelBooking(${b.id})">Cancel</button>` : ''}
                    ${b.status === 'awaiting_advance' ? `<button class="btn btn-ghost btn-sm" onclick="App.cancelBooking(${b.id})">Cancel</button>` : ''}
                    ${b.status === 'fully_confirmed' ? `<button class="btn btn-primary btn-sm" onclick="App.openPostEventSettlementModal(${b.id}, ${b.securityDeposit || 0})">Settle Event</button>` : ''}
                    ${b.status === 'approved' ? `<button class="btn btn-primary btn-sm" onclick="App.completeBooking(${b.id})">Mark Completed</button>` : ''}
                </td>
            </tr>
        `;
        }).join('');
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
        await this.loadAwaitingPaymentBookings();
    },

    async loadPendingApprovals() {
        const container = document.getElementById('approvals-table-body');
        if (!container) return;

        const result = await API.getBookings({ status: 'pending_approval' });
        if (!result.success) {
            container.innerHTML = `<tr><td colspan="8" class="text-center p-6 text-danger">Failed to load approvals. ${result.error || ''}</td></tr>`;
            return;
        }

        if (result.data.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center p-6">
                        <div class="empty-state-icon"><i class="fa-solid fa-check"></i></div>
                        <p>No pending approval requests</p>
                    </td>
                </tr>
            `;
            return;
        }

        container.innerHTML = result.data.map(b => `
            <tr>
                <td><strong>${Utils.escapeHtml(b.user?.name || 'Unknown')}</strong><br><span class="text-xs text-secondary">${Utils.escapeHtml(b.user?.email || '')}</span></td>
                <td>${Utils.escapeHtml(b.resource?.name || 'Unknown')}<br><span class="badge" style="font-size:10px;background:var(--color-primary-50);color:var(--color-primary)">${b.resource?.type === 'auditorium' ? 'Auditorium' : 'Ground'}</span></td>
                <td>${Utils.formatDate(b.date)}</td>
                <td>${b.slot?.label || ''}</td>
                <td>
                    ${b.eventCategory ? `<span class="badge badge-partial" style="margin-bottom:4px;">${Utils.escapeHtml(b.eventCategory)}</span><br>` : ''}
                    <span style="font-size:13px;">${Utils.truncate(b.purpose, 35)}</span>
                </td>
                <td>${Utils.timeAgo(b.createdAt)}</td>
                <td>
                    <div class="flex gap-2">
                        <button class="btn btn-primary btn-sm" onclick="App.openPaymentCallModal(${b.id}, '${Utils.escapeHtml(b.eventCategory || '')}', '${Utils.escapeHtml(b.resource?.name || '')}')">Issue Payment Call</button>
                        <button class="btn btn-danger btn-sm" onclick="App.rejectBooking(${b.id})">Reject</button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    async loadAwaitingPaymentBookings() {
        const container = document.getElementById('awaiting-payment-table-body');
        if (!container) return;

        // Load both awaiting_advance and partially_confirmed
        const [awaitingResult, partialResult] = await Promise.all([
            API.getBookings({ status: 'awaiting_advance' }),
            API.getBookings({ status: 'partially_confirmed' })
        ]);

        const bookings = [
            ...(awaitingResult.success ? awaitingResult.data : []),
            ...(partialResult.success ? partialResult.data : [])
        ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        if (bookings.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center p-6">
                        <div class="empty-state-icon"><i class="fa-solid fa-money-bill-wave"></i></div>
                        <p>No bookings awaiting payment</p>
                    </td>
                </tr>
            `;
            return;
        }

        container.innerHTML = bookings.map(b => `
            <tr>
                <td><strong>${Utils.escapeHtml(b.user?.name || 'Unknown')}</strong><br><span class="text-xs text-secondary">${Utils.escapeHtml(b.user?.email || '')}</span></td>
                <td>${Utils.escapeHtml(b.resource?.name || 'Unknown')}</td>
                <td>${Utils.formatDate(b.date)}</td>
                <td>${b.eventCategory ? Utils.escapeHtml(b.eventCategory) : '-'}</td>
                <td>${Utils.getStatusBadge(b.status)}</td>
                <td>
                    <div style="font-size:13px;">
                        <div>Subtotal: <strong>${Utils.formatCurrency(parseFloat(b.totalAmount || 0) + parseFloat(b.securityDeposit || 0))}</strong></div>
                        <div>Paid: <strong class="text-success">${Utils.formatCurrency(b.totalPaid)}</strong></div>
                        <div>Balance: <strong class="text-danger">${Utils.formatCurrency(b.balanceDue)}</strong></div>
                    </div>
                </td>
                <td>${Utils.timeAgo(b.createdAt)}</td>
                <td>
                    <button class="btn btn-success btn-sm" onclick="App.openLogPaymentModal(${b.id}, '${Utils.escapeHtml(b.user?.name || '')}', ${b.balanceDue})">Log Cash Payment</button>
                </td>
            </tr>
        `).join('');
    },

    // ---- Payment Call Modal ----
    openPaymentCallModal(bookingId, eventCategory, resourceName) {
        // Fee defaults per category
        const feeDefaults = {
            'Internal Academic':    { base: 5000,  security: 0 },
            'Internal Non-Academic':{ base: 15000, security: 0 },
            'Government':           { base: 20000, security: 0 },
            'External Educational': { base: 40000, security: 20000 },
            'Marriage':             { base: 72000, security: 20000 }
        };
        const defaults = feeDefaults[eventCategory] || { base: 0, security: 0 };

        const backdrop = Utils.createElement(`
            <div class="modal-backdrop active" id="payment-call-modal">
                <div class="modal" style="max-width: 520px;">
                    <div class="modal-header">
                        <h3 class="modal-title"><i class="fa-solid fa-file-invoice-dollar"></i> Issue Payment Call</h3>
                        <button class="modal-close" onclick="document.getElementById('payment-call-modal').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p class="text-secondary mb-4">Set the fee structure for <strong>${Utils.escapeHtml(resourceName)}</strong> — Booking <strong>#${bookingId}</strong>.</p>
                        <div class="fee-note mb-4">
                            <i class="fa-solid fa-circle-info"></i>
                            Base fee for <strong>${Utils.escapeHtml(eventCategory || 'this event')}</strong> is pre-filled. Add actuals (diesel, GST, generator) to the total.
                        </div>
                        <div class="form-group">
                            <label class="form-label required">Event Rental (₹)</label>
                            <input type="number" id="pc-total" class="form-input" value="${defaults.base}" min="0" step="100" placeholder="e.g. 72000">
                            <p class="form-hint">Non-refundable charges (rental + cleaning + actuals). Exclude Security Deposit.</p>
                        </div>
                        <div class="form-group">
                            <label class="form-label required">Booking Advance (₹)</label>
                            <input type="number" id="pc-advance" class="form-input" value="${Math.round(defaults.base * 0.5)}" min="0" step="100" placeholder="e.g. 36000">
                            <p class="form-hint">50% of the rental amount required to lock the date.</p>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Security Deposit (₹)</label>
                            <input type="number" id="pc-security" class="form-input" value="${defaults.security}" min="0" step="100" placeholder="e.g. 20000">
                            <p class="form-hint">Refundable deposit. Will be collected upfront.</p>
                        </div>
                        <div class="fee-preview" id="fee-preview">
                            <div class="fee-preview-row"><span>Event Rental</span><strong id="preview-total">₹${defaults.base.toLocaleString('en-IN')}</strong></div>
                            <div class="fee-preview-row"><span>Security Deposit</span><strong id="preview-security">₹${defaults.security.toLocaleString('en-IN')}</strong></div>
                            <div class="fee-preview-row"><span>Due Now (Advance + Security)</span><strong id="preview-due-now" class="text-danger">₹${(Math.round(defaults.base * 0.5) + defaults.security).toLocaleString('en-IN')}</strong></div>
                            <div class="fee-preview-row"><span>Due Later (Balance)</span><strong id="preview-balance">₹${(defaults.base - Math.round(defaults.base * 0.5)).toLocaleString('en-IN')}</strong></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="document.getElementById('payment-call-modal').remove()">Cancel</button>
                        <button class="btn btn-primary" id="pc-submit-btn" onclick="App.submitPaymentCall(${bookingId})">
                            <i class="fa-solid fa-paper-plane"></i> Issue Payment Call
                        </button>
                    </div>
                </div>
            </div>
        `);
        document.body.appendChild(backdrop);

        // Live preview update
        const updatePreview = () => {
            const total = parseFloat(document.getElementById('pc-total').value) || 0;
            const advance = parseFloat(document.getElementById('pc-advance').value) || 0;
            const security = parseFloat(document.getElementById('pc-security').value) || 0;
            const balance = Math.max(0, total - advance);
            const dueNow = advance + security;
            
            document.getElementById('preview-total').textContent = `₹${total.toLocaleString('en-IN')}`;
            document.getElementById('preview-security').textContent = `₹${security.toLocaleString('en-IN')}`;
            document.getElementById('preview-due-now').textContent = `₹${dueNow.toLocaleString('en-IN')}`;
            document.getElementById('preview-balance').textContent = `₹${balance.toLocaleString('en-IN')}`;
        };
        ['pc-total', 'pc-advance', 'pc-security'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', updatePreview);
        });
    },

    async submitPaymentCall(bookingId) {
        const totalAmount = parseFloat(document.getElementById('pc-total').value);
        const advanceRequired = parseFloat(document.getElementById('pc-advance').value);
        const securityDeposit = parseFloat(document.getElementById('pc-security').value) || 0;

        if (isNaN(totalAmount) || totalAmount <= 0) {
            Notifications.error('Validation', 'Please enter a valid total amount');
            return;
        }
        if (isNaN(advanceRequired) || advanceRequired < 0) {
            Notifications.error('Validation', 'Please enter a valid advance amount');
            return;
        }

        const btn = document.getElementById('pc-submit-btn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Issuing...';

        const result = await API.issuePaymentCall(bookingId, { totalAmount, advanceRequired, securityDeposit });
        document.getElementById('payment-call-modal')?.remove();

        if (result.success) {
            Notifications.success('Payment Call Issued', 'The user has been notified to visit the office with advance payment.');
            this.loadPendingApprovals();
            this.loadAwaitingPaymentBookings();
        } else {
            Notifications.error('Error', result.error || 'Failed to issue payment call');
        }
    },

    // ---- Log Cash Payment Modal ----
    openLogPaymentModal(bookingId, userName, balanceDue) {
        const backdrop = Utils.createElement(`
            <div class="modal-backdrop active" id="log-payment-modal">
                <div class="modal" style="max-width: 460px;">
                    <div class="modal-header">
                        <h3 class="modal-title"><i class="fa-solid fa-money-bill-wave"></i> Log Cash Payment</h3>
                        <button class="modal-close" onclick="document.getElementById('log-payment-modal').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p class="text-secondary mb-4">Recording cash received from <strong>${Utils.escapeHtml(userName)}</strong> for Booking <strong>#${bookingId}</strong>.</p>
                        ${balanceDue > 0 ? `<div class="fee-note mb-4" style="background: var(--color-danger-50); border-color: var(--color-danger);"><i class="fa-solid fa-circle-exclamation"></i> Balance due: <strong>${Utils.formatCurrency(balanceDue)}</strong></div>` : ''}
                        <div class="form-group">
                            <label class="form-label required">Amount Received (₹)</label>
                            <input type="number" id="lp-amount" class="form-input" min="1" step="100" placeholder="Enter amount received">
                        </div>
                        <div class="form-group">
                            <label class="form-label required">Payment Type</label>
                            <select id="lp-type" class="form-select">
                                <option value="advance">Advance Payment</option>
                                <option value="balance">Balance Payment</option>
                                <option value="security_refund">Security Refund</option>
                                <option value="penalty">Penalty</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label required">Receipt Number</label>
                            <input type="text" id="lp-receipt" class="form-input" placeholder="e.g. REC-2026-0042" style="font-family: monospace;">
                            <p class="form-hint">Enter the receipt number from the physical receipt book</p>
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label class="form-label">Notes (optional)</label>
                            <input type="text" id="lp-notes" class="form-input" placeholder="Any additional notes...">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="document.getElementById('log-payment-modal').remove()">Cancel</button>
                        <button class="btn btn-success" id="lp-submit-btn" onclick="App.submitCashPayment(${bookingId})">
                            <i class="fa-solid fa-check"></i> Log Payment
                        </button>
                    </div>
                </div>
            </div>
        `);
        document.body.appendChild(backdrop);
        document.getElementById('lp-amount')?.focus();
    },

    async submitCashPayment(bookingId) {
        const amountPaid = parseFloat(document.getElementById('lp-amount').value);
        const paymentType = document.getElementById('lp-type').value;
        const receiptNo = document.getElementById('lp-receipt').value.trim();
        const notes = document.getElementById('lp-notes').value.trim();

        if (isNaN(amountPaid) || amountPaid <= 0) {
            Notifications.error('Validation', 'Please enter a valid amount');
            return;
        }
        if (!receiptNo) {
            Notifications.error('Validation', 'Receipt number is required');
            return;
        }

        const btn = document.getElementById('lp-submit-btn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Logging...';

        const result = await API.logCashPayment(bookingId, { amountPaid, paymentType, receiptNo, notes });
        document.getElementById('log-payment-modal')?.remove();

        if (result.success) {
            const statusLabel = result.newStatus?.replace(/_/g, ' ') || 'updated';
            Notifications.success('Payment Logged!', `Booking is now <strong>${statusLabel}</strong>. Receipt: ${receiptNo}`);
            this.loadPendingApprovals();
            this.loadAwaitingPaymentBookings();
        } else {
            Notifications.error('Error', result.error || 'Failed to log payment');
        }
    },

    async rejectBooking(id) {
        const reason = await Modal.prompt({
            title: 'Reject Booking',
            message: 'Please provide a reason for rejecting this booking request:',
            placeholder: 'Reason for rejection (optional)',
            confirmText: 'Reject'
        });

        if (reason === null) return;

        const result = await API.updateBookingStatus(id, 'rejected', reason);
        if (result.success) {
            Notifications.success('Rejected', 'Booking has been rejected');
            this.loadPendingApprovals();
            this.loadAwaitingPaymentBookings();
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

    openPostEventSettlementModal(bookingId, securityDeposit = 0) {
        const backdrop = Utils.createElement(`
            <div class="modal-backdrop active" id="settlement-modal">
                <div class="modal" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3 class="modal-title"><i class="fa-solid fa-file-invoice-dollar"></i> Post-Event Settlement</h3>
                        <button class="modal-close" onclick="document.getElementById('settlement-modal').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p class="text-secondary mb-4">Finalize billing for Booking <strong>#${bookingId}</strong>.</p>
                        
                        <div class="form-group">
                            <label class="form-label">Extra Actuals (Diesel/Electricity) (₹)</label>
                            <input type="number" id="settle-actuals" class="form-input" value="0" min="0" step="100">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Damages / Penalties (₹)</label>
                            <input type="number" id="settle-penalty" class="form-input" value="0" min="0" step="100">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Settlement Note</label>
                            <textarea id="settle-notes" class="form-input" rows="2" placeholder="e.g. 5 hours extra diesel, chair damaged"></textarea>
                        </div>
                        
                        <div class="fee-preview">
                            <div class="fee-preview-row"><span>Original Security Deposit</span><strong>₹${securityDeposit.toLocaleString('en-IN')}</strong></div>
                            <div class="fee-preview-row"><span>Deductions</span><strong class="text-danger" id="settle-deductions">₹0</strong></div>
                            <div class="fee-preview-row"><span id="settle-refund-label">Final Refund Due</span><strong id="settle-refund" class="text-success">₹${securityDeposit.toLocaleString('en-IN')}</strong></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="document.getElementById('settlement-modal').remove()">Cancel</button>
                        <button class="btn btn-primary" onclick="App.submitSettlement(${bookingId}, ${securityDeposit})">
                            <i class="fa-solid fa-check-double"></i> Complete & Settle
                        </button>
                    </div>
                </div>
            </div>
        `);
        document.body.appendChild(backdrop);

        const updateSettlementPreview = () => {
            const actuals = parseFloat(document.getElementById('settle-actuals').value) || 0;
            const penalty = parseFloat(document.getElementById('settle-penalty').value) || 0;
            const deductions = actuals + penalty;
            const refund = securityDeposit - deductions;
            
            document.getElementById('settle-deductions').textContent = `₹${deductions.toLocaleString('en-IN')}`;
            const refundEl = document.getElementById('settle-refund');
            const refundLabel = document.getElementById('settle-refund-label');
            
            if (refund < 0) {
                refundEl.className = 'text-danger';
                refundLabel.textContent = 'Balance Due from User';
                refundEl.textContent = `₹${Math.abs(refund).toLocaleString('en-IN')}`;
            } else {
                refundEl.className = 'text-success';
                refundLabel.textContent = 'Final Refund Due';
                refundEl.textContent = `₹${refund.toLocaleString('en-IN')}`;
            }
        };

        ['settle-actuals', 'settle-penalty'].forEach(id => {
            document.getElementById(id).addEventListener('input', updateSettlementPreview);
        });
    },

    async submitSettlement(bookingId, securityDeposit) {
        const actualsAmount = parseFloat(document.getElementById('settle-actuals').value) || 0;
        const penaltyAmount = parseFloat(document.getElementById('settle-penalty').value) || 0;
        const settlementNotes = document.getElementById('settle-notes').value.trim();

        try {
            const res = await fetch(`/api/bookings/${bookingId}/settle`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ actualsAmount, penaltyAmount, settlementNotes })
            });
            const result = await res.json();
            
            if (result.success) {
                Notifications.success('Settled', 'Booking successfully settled and completed');
                document.getElementById('settlement-modal').remove();
                if (this.getCurrentPage() === 'my-bookings') {
                    this.loadMyBookings();
                } else if (this.getCurrentPage() === 'reports') {
                    this.loadReportsData();
                } else {
                    window.location.reload();
                }
            } else {
                Notifications.error('Settlement Failed', result.error);
            }
        } catch (error) {
            Notifications.error('Network Error', error.message);
        }
    },

    // Payment Ledger page (admin)
    async initPaymentLedger() {
        if (!AUTH.requireRole('admin')) return;
        await this.loadPaymentLedger();
        this.setupLedgerFilters();
    },

    async loadPaymentLedger(filters = {}) {
        const container = document.getElementById('ledger-table-body');
        const summaryContainer = document.getElementById('ledger-summary');
        if (!container) return;

        container.innerHTML = `<tr><td colspan="9" class="text-center p-6"><div class="spinner mx-auto"></div></td></tr>`;

        const result = await API.getAllPayments(filters);
        if (!result.success) {
            container.innerHTML = `<tr><td colspan="9" class="text-center p-6 text-danger">Failed to load payments. ${result.error || ''}</td></tr>`;
            return;
        }

        // Update summary card
        if (summaryContainer && result.meta) {
            summaryContainer.innerHTML = `
                <div class="stat-card">
                    <div class="stat-value">${result.meta.total}</div>
                    <div class="stat-label">Total Transactions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value text-success">${Utils.formatCurrency(result.meta.totalReceived)}</div>
                    <div class="stat-label">Total Cash Received</div>
                </div>
            `;
        }

        if (result.data.length === 0) {
            container.innerHTML = `<tr><td colspan="9" class="text-center p-6"><div class="empty-state-icon"><i class="fa-solid fa-receipt"></i></div><p>No cash transactions found</p></td></tr>`;
            return;
        }

        container.innerHTML = result.data.map(p => `
            <tr>
                <td style="font-weight:600;">#${p.booking_id}</td>
                <td>${Utils.escapeHtml(p.resource_name || '-')}</td>
                <td>${Utils.escapeHtml(p.booker_name || '-')}<br><span class="text-xs text-secondary">${Utils.escapeHtml(p.booker_email || '')}</span></td>
                <td>${Utils.formatDate(p.booking_date)}</td>
                <td>${p.event_category ? Utils.escapeHtml(p.event_category) : '-'}</td>
                <td><strong class="text-success">${Utils.formatCurrency(p.amount_paid)}</strong></td>
                <td><span class="badge ${p.payment_type === 'advance' ? 'badge-partial' : p.payment_type === 'balance' ? 'badge-approved' : 'badge-pending'}">${Utils.formatPaymentType(p.payment_type)}</span></td>
                <td style="font-family:monospace;">${Utils.escapeHtml(p.receipt_no)}</td>
                <td>${Utils.escapeHtml(p.logged_by_name || '-')}<br><span class="text-xs text-secondary">${new Date(p.created_at).toLocaleString('en-IN')}</span></td>
            </tr>
        `).join('');
    },

    setupLedgerFilters() {
        const applyFilters = Utils.debounce(() => {
            const filters = {};
            const typeFilter = document.getElementById('ledger-type-filter')?.value;
            const startDate = document.getElementById('ledger-start-date')?.value;
            const endDate = document.getElementById('ledger-end-date')?.value;
            if (typeFilter) filters.paymentType = typeFilter;
            if (startDate) filters.startDate = startDate;
            if (endDate) filters.endDate = endDate;
            this.loadPaymentLedger(filters);
        }, 300);

        document.getElementById('ledger-type-filter')?.addEventListener('change', applyFilters);
        document.getElementById('ledger-start-date')?.addEventListener('change', applyFilters);
        document.getElementById('ledger-end-date')?.addEventListener('change', applyFilters);
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
        // Handled by inline script in usage-upload.html
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
          <div style="display: grid; grid-template-columns: 120px 140px; gap: 8px; justify-content: flex-end; align-items: center;">
            <div style="text-align: right;">
              <a href="report-details.html?id=${b.id}" class="btn btn-secondary btn-sm" style="width: 100%;"><i class="fa-solid fa-eye"></i> View Details</a>
            </div>
            <div style="text-align: left;">
              ${b.status === 'approved' ? `<button class="btn btn-primary btn-sm" onclick="App.completeBooking(${b.id})" style="width: 100%;">Mark Completed</button>` : ''}
            </div>
          </div>
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
    },

    // Report Details page
    async initReportDetails() {
        if (!AUTH.requireRole('admin')) return;

        const id = Utils.getUrlParam('id');
        if (!id) {
            window.location.href = 'reports.html';
            return;
        }

        const container = document.getElementById('report-details-container');
        if (!container) return;

        try {
            // First we need to get the booking data.
            const bookingResult = await API.getBookingById(id);
            if (!bookingResult.success) throw new Error(bookingResult.error || 'Failed to fetch booking');

            const booking = bookingResult.data;

            // Then get usage records for this booking
            const usageResult = await API.getUsageRecords({ bookingId: id });
            const usageRecords = usageResult.success ? usageResult.data : [];
            const usageRecord = usageRecords.length > 0 ? usageRecords[0] : null;

            this.renderReportDetails(booking, usageRecord);
        } catch (error) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon text-danger"><i class="fa-solid fa-triangle-exclamation"></i></div>
                    <div class="empty-state-title">Error Loading Details</div>
                    <div class="empty-state-description">${error.message || 'An unknown error occurred'}</div>
                    <a href="reports.html" class="btn btn-primary mt-4">Back to Reports</a>
                </div>
            `;
        }
    },

    renderReportDetails(booking, usageRecord) {
        const template = document.getElementById('report-details-template');
        const container = document.getElementById('report-details-container');

        if (!template || !container) return;

        // Clone template content
        const clone = template.content.cloneNode(true);

        // Update Status badge in header
        const statusBadgeContainer = document.getElementById('booking-status-badge');
        if (statusBadgeContainer) {
            statusBadgeContainer.innerHTML = Utils.getStatusBadge(booking.status);
        }

        // Populate standard booking details
        clone.getElementById('detail-booking-id').textContent = `#${booking.id}`;
        clone.getElementById('detail-date').textContent = Utils.formatDate(booking.date);
        clone.getElementById('detail-slot').textContent = booking.slot?.label || '-';
        clone.getElementById('detail-created-at').textContent = new Date(booking.createdAt).toLocaleString();

        // Resource details
        clone.getElementById('detail-resource-name').textContent = booking.resource?.name || '-';
        clone.getElementById('detail-resource-location').textContent = booking.resource?.location || '-';
        clone.getElementById('detail-purpose').textContent = booking.purpose || '-';

        // User details
        clone.getElementById('detail-user-name').textContent = booking.user?.name || '-';
        clone.getElementById('detail-user-email').textContent = booking.user?.email || '-';
        clone.getElementById('detail-user-role').textContent = booking.user?.role || '-';

        // Usage Report Section
        const usageSection = clone.getElementById('usage-report-section');
        if (usageRecord) {
            usageSection.innerHTML = `
                <div class="detail-group">
                    <div class="detail-label">Status</div>
                    <div class="detail-value text-success"><i class="fa-solid fa-check-circle"></i> Output Submitted</div>
                </div>
                <div class="detail-group">
                    <div class="detail-label">Submitted On</div>
                    <div class="detail-value">${new Date(usageRecord.uploaded_at || usageRecord.uploadedAt || new Date()).toLocaleString()}</div>
                </div>
                
                <div class="report-section mt-4 pt-4 border-t" style="border-top: 1px solid var(--border-color);">
                    <div class="detail-label mb-2">Remarks / Feedback</div>
                    <div class="p-4 bg-light rounded" style="background-color: var(--surface-bg); border: 1px solid var(--border-color); white-space: pre-wrap;">${Utils.escapeHtml(usageRecord.remarks || 'No remarks provided.')}</div>
                </div>
                
                ${usageRecord.issues ? `
                <div class="report-section mt-4">
                    <div class="detail-label mb-2 text-danger"><i class="fa-solid fa-triangle-exclamation"></i> Reported Issues</div>
                    <div class="p-4 rounded" style="background-color: #fef2f2; border: 1px solid #fecaca; color: #991b1b; white-space: pre-wrap;">${Utils.escapeHtml(usageRecord.issues)}</div>
                </div>
                ` : ''}
                
                ${usageRecord.gdrive_link || usageRecord.gdriveLink || booking.gdriveLink ? `
                <div class="report-section mt-4 pt-4 border-t" style="border-top: 1px solid var(--border-color);">
                    <div class="detail-label mb-2">Evidence / Media Link</div>
                    <a href="${Utils.escapeHtml(usageRecord.gdrive_link || usageRecord.gdriveLink || booking.gdriveLink)}" target="_blank" class="btn btn-primary">
                        <i class="fa-brands fa-google-drive mr-2"></i> View Files on Google Drive
                    </a>
                </div>
                ` : ''}
            `;
        } else {
            usageSection.innerHTML = `
                <div class="empty-state p-4 text-center">
                    <div class="empty-state-icon" style="opacity: 0.5;"><i class="fa-solid fa-file-circle-xmark"></i></div>
                    <p class="text-secondary">No usage report has been submitted for this booking yet.</p>
                </div>
            `;
        }

        // Approval Details if available
        if (['approved', 'rejected'].includes(booking.status)) {
            const approvalCard = clone.getElementById('approval-details-card');
            const approvalContent = clone.getElementById('approval-details-content');
            approvalCard.style.display = 'block';

            if (booking.status === 'approved') {
                approvalContent.innerHTML = `
                    <div class="detail-group">
                        <div class="detail-label">Approved By ID</div>
                        <div class="detail-value">${booking.approvedBy || '-'}</div>
                    </div>
                    <div class="detail-group">
                        <div class="detail-label">Approved At</div>
                        <div class="detail-value">${booking.approvedAt ? new Date(booking.approvedAt).toLocaleString() : '-'}</div>
                    </div>
                `;
            } else if (booking.status === 'rejected') {
                approvalContent.innerHTML = `
                    <div class="detail-group">
                        <div class="detail-label">Rejected By ID</div>
                        <div class="detail-value">${booking.rejectedBy || '-'}</div>
                    </div>
                    <div class="detail-group">
                        <div class="detail-label">Rejected At</div>
                        <div class="detail-value">${booking.rejectedAt ? new Date(booking.rejectedAt).toLocaleString() : '-'}</div>
                    </div>
                    <div class="detail-group sm-col-span-2 mt-2">
                        <div class="detail-label">Rejection Reason</div>
                        <div class="detail-value text-danger">${Utils.escapeHtml(booking.rejectionReason || 'No reason provided')}</div>
                    </div>
                `;
            }
        }

        // Add settlement details if completed
        if (booking.status === 'completed' && (booking.actualsAmount > 0 || booking.penaltyAmount > 0 || booking.settlementNotes)) {
            const settlementCard = clone.getElementById('settlement-details-card');
            const settlementContent = clone.getElementById('settlement-details-content');
            if (settlementCard && settlementContent) {
                settlementCard.style.display = 'block';
                settlementContent.innerHTML = `
                    <div class="detail-group">
                        <div class="detail-label">Actuals & Extra Charges</div>
                        <div class="detail-value text-danger">₹${(booking.actualsAmount || 0).toLocaleString('en-IN')}</div>
                    </div>
                    <div class="detail-group">
                        <div class="detail-label">Damages / Penalties</div>
                        <div class="detail-value text-danger">₹${(booking.penaltyAmount || 0).toLocaleString('en-IN')}</div>
                    </div>
                    <div class="detail-group sm-col-span-2 mt-2">
                        <div class="detail-label">Settlement Note</div>
                        <div class="detail-value">${Utils.escapeHtml(booking.settlementNotes || 'No notes provided')}</div>
                    </div>
                `;
            }
        }

        // Replace loading state with content
        container.innerHTML = '';
        container.appendChild(clone);
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
