/* =============================================
   FORM VALIDATORS
   ============================================= */

const Validators = {
    // Email validation
    email(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    },

    // Phone (10 digits)
    phone(phone) {
        const regex = /^[0-9]{10}$/;
        return regex.test(phone.replace(/[- ]/g, ''));
    },

    // Required (not empty)
    required(value) {
        if (typeof value === 'string') {
            return value.trim() !== '';
        }
        return value !== null && value !== undefined;
    },

    // Min length
    minLength(value, min) {
        return value && value.length >= min;
    },

    // Max length
    maxLength(value, max) {
        return !value || value.length <= max;
    },

    // Future date
    futureDate(dateStr) {
        const date = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date >= today;
    },

    // Date in range
    dateInRange(dateStr, minDays = 0, maxDays = 365) {
        const date = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const minDate = new Date(today);
        minDate.setDate(minDate.getDate() + minDays);

        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() + maxDays);

        return date >= minDate && date <= maxDate;
    },

    // Password strength
    password(password) {
        // At least 6 characters
        return password && password.length >= 6;
    },

    // Passwords match
    passwordsMatch(password, confirmPassword) {
        return password === confirmPassword;
    },

    // Numeric
    numeric(value) {
        return !isNaN(value) && !isNaN(parseFloat(value));
    },

    // Positive number
    positiveNumber(value) {
        return this.numeric(value) && parseFloat(value) > 0;
    }
};

// Form validation helper
const FormValidator = {
    // Validate a single field
    validateField(input, rules) {
        const value = input.value;
        const errors = [];

        for (const rule of rules) {
            let isValid = true;
            let message = '';

            switch (rule.type) {
                case 'required':
                    isValid = Validators.required(value);
                    message = rule.message || 'This field is required';
                    break;
                case 'email':
                    isValid = !value || Validators.email(value);
                    message = rule.message || 'Please enter a valid email';
                    break;
                case 'phone':
                    isValid = !value || Validators.phone(value);
                    message = rule.message || 'Please enter a valid 10-digit phone number';
                    break;
                case 'minLength':
                    isValid = Validators.minLength(value, rule.value);
                    message = rule.message || `Minimum ${rule.value} characters required`;
                    break;
                case 'maxLength':
                    isValid = Validators.maxLength(value, rule.value);
                    message = rule.message || `Maximum ${rule.value} characters allowed`;
                    break;
                case 'futureDate':
                    isValid = !value || Validators.futureDate(value);
                    message = rule.message || 'Please select a future date';
                    break;
                case 'password':
                    isValid = Validators.password(value);
                    message = rule.message || 'Password must be at least 6 characters';
                    break;
                case 'match':
                    const matchInput = document.getElementById(rule.value);
                    isValid = matchInput && value === matchInput.value;
                    message = rule.message || 'Fields do not match';
                    break;
                case 'custom':
                    isValid = rule.validator(value);
                    message = rule.message || 'Invalid value';
                    break;
            }

            if (!isValid) {
                errors.push(message);
                break; // Stop at first error
            }
        }

        return { isValid: errors.length === 0, errors };
    },

    // Show error on field
    showError(input, message) {
        const formGroup = input.closest('.form-group');
        if (!formGroup) return;

        formGroup.classList.add('has-error');
        input.classList.add('is-error');

        let errorEl = formGroup.querySelector('.form-error');
        if (!errorEl) {
            errorEl = document.createElement('span');
            errorEl.className = 'form-error';
            input.parentNode.appendChild(errorEl);
        }
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    },

    // Clear error on field
    clearError(input) {
        const formGroup = input.closest('.form-group');
        if (!formGroup) return;

        formGroup.classList.remove('has-error');
        input.classList.remove('is-error');

        const errorEl = formGroup.querySelector('.form-error');
        if (errorEl) {
            errorEl.style.display = 'none';
        }
    },

    // Validate entire form
    validateForm(form, rulesMap) {
        let isValid = true;

        for (const [fieldName, rules] of Object.entries(rulesMap)) {
            const input = form.querySelector(`[name="${fieldName}"]`) || form.querySelector(`#${fieldName}`);
            if (!input) continue;

            this.clearError(input);
            const result = this.validateField(input, rules);

            if (!result.isValid) {
                this.showError(input, result.errors[0]);
                isValid = false;
            }
        }

        return isValid;
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Validators, FormValidator };
}
