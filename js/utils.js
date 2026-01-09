/* =============================================
   UTILITY FUNCTIONS
   ============================================= */

const Utils = {
    // Date formatting
    formatDate(dateStr, format = 'short') {
        const date = new Date(dateStr);
        const options = {
            short: { month: 'short', day: 'numeric', year: 'numeric' },
            long: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
            time: { hour: '2-digit', minute: '2-digit' },
            full: { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        };
        return date.toLocaleDateString('en-IN', options[format] || options.short);
    },

    // Relative time (e.g., "2 hours ago")
    timeAgo(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);

        const intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60
        };

        for (const [unit, secondsInUnit] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInUnit);
            if (interval >= 1) {
                return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
            }
        }
        return 'Just now';
    },

    // Get today's date in YYYY-MM-DD format
    getToday() {
        return new Date().toISOString().split('T')[0];
    },

    // Add days to date
    addDays(dateStr, days) {
        const date = new Date(dateStr);
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    },

    // Capitalize first letter
    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    // Truncate text
    truncate(str, length = 100) {
        if (!str || str.length <= length) return str;
        return str.substring(0, length) + '...';
    },

    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Debounce function
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Get URL parameter
    getUrlParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    },

    // Set URL parameter
    setUrlParam(param, value) {
        const url = new URL(window.location);
        url.searchParams.set(param, value);
        window.history.pushState({}, '', url);
    },

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Create element from HTML string
    createElement(html) {
        const template = document.createElement('template');
        template.innerHTML = html.trim();
        return template.content.firstChild;
    },

    // Show loading overlay
    showLoading(container) {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = '<div class="spinner spinner-lg"></div>';
        container.style.position = 'relative';
        container.appendChild(overlay);
        return overlay;
    },

    // Hide loading overlay
    hideLoading(overlay) {
        if (overlay && overlay.parentElement) {
            overlay.remove();
        }
    },

    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // Get status badge HTML
    getStatusBadge(status) {
        const statusMap = {
            pending: { class: 'badge-pending', label: 'Pending' },
            approved: { class: 'badge-approved', label: 'Approved' },
            rejected: { class: 'badge-rejected', label: 'Rejected' },
            completed: { class: 'badge-completed', label: 'Completed' },
            cancelled: { class: 'badge-rejected', label: 'Cancelled' },
            available: { class: 'badge-approved', label: 'Available' },
            maintenance: { class: 'badge-pending', label: 'Maintenance' }
        };
        const info = statusMap[status] || { class: '', label: status };
        return `<span class="badge ${info.class}">${info.label}</span>`;
    }
};

// Modal helper
const Modal = {
    show(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    hide(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    // Confirmation dialog
    confirm(options) {
        return new Promise((resolve) => {
            const { title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'warning' } = options;

            const icons = { warning: '⚠', danger: '⚠', success: '✓' };

            const backdrop = Utils.createElement(`
        <div class="modal-backdrop active" id="confirm-modal">
          <div class="modal" style="max-width: 400px;">
            <div class="modal-body text-center">
              <div class="confirm-icon confirm-${type}">${icons[type] || icons.warning}</div>
              <h3 style="margin-bottom: var(--space-2);">${title}</h3>
              <p style="color: var(--text-secondary);">${message}</p>
            </div>
            <div class="modal-footer" style="justify-content: center;">
              <button class="btn btn-secondary" id="confirm-cancel">${cancelText}</button>
              <button class="btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'}" id="confirm-ok">${confirmText}</button>
            </div>
          </div>
        </div>
      `);

            document.body.appendChild(backdrop);

            backdrop.querySelector('#confirm-cancel').onclick = () => {
                backdrop.remove();
                resolve(false);
            };

            backdrop.querySelector('#confirm-ok').onclick = () => {
                backdrop.remove();
                resolve(true);
            };

            backdrop.onclick = (e) => {
                if (e.target === backdrop) {
                    backdrop.remove();
                    resolve(false);
                }
            };
        });
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Utils, Modal };
}
