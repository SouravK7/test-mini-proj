/* =============================================
   THEME TOGGLE — Dark/Light Mode
   Persistent via localStorage
   ============================================= */

const ThemeToggle = (() => {
    const STORAGE_KEY = 'coet-theme';

    function getPreferred() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return stored;
        // Default to dark
        return 'dark';
    }

    function apply(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(STORAGE_KEY, theme);
    }

    function toggle() {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        apply(next);
    }

    // Apply on load (before DOM ready to prevent flash)
    apply(getPreferred());

    // Bind toggle buttons once DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.theme-toggle').forEach(btn => {
            btn.addEventListener('click', toggle);
        });
    });

    return { toggle, apply, getPreferred };
})();
