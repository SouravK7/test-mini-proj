/* =============================================
   NOTIFICATIONS / TOAST SYSTEM
   ============================================= */

const Notifications = {
    container: null,

    // Initialize container
    init() {
        if (this.container) return;

        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        this.container.id = 'toast-container';
        document.body.appendChild(this.container);
    },

    // Show notification
    show(title, message, type = 'info', duration = 5000) {
        this.init();

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

        this.container.appendChild(toast);

        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.style.animation = 'toastSlideOut 0.3s ease forwards';
                    setTimeout(() => toast.remove(), 300);
                }
            }, duration);
        }

        return toast;
    },

    // Convenience methods
    success(title, message) {
        return this.show(title, message, 'success');
    },

    error(title, message) {
        return this.show(title, message, 'error', 7000);
    },

    warning(title, message) {
        return this.show(title, message, 'warning', 6000);
    },

    info(title, message) {
        return this.show(title, message, 'info');
    },

    // Clear all
    clear() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
};

// Add slide out animation
const style = document.createElement('style');
style.textContent = `
  @keyframes toastSlideOut {
    to {
      opacity: 0;
      transform: translateX(100%);
    }
  }
`;
document.head.appendChild(style);

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Notifications;
}
