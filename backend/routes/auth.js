const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ============================================
// OTP In-Memory Store
// ============================================
const otpStore = new Map();

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function storeOTP(key, data, expiryMinutes = 5) {
    otpStore.set(key, {
        ...data,
        expiresAt: Date.now() + expiryMinutes * 60 * 1000
    });
    // Auto-cleanup after expiry
    setTimeout(() => otpStore.delete(key), expiryMinutes * 60 * 1000);
}

function verifyOTP(key, otp) {
    const record = otpStore.get(key);
    if (!record) return { valid: false, error: 'OTP not found or expired. Please request a new one.' };
    if (Date.now() > record.expiresAt) {
        otpStore.delete(key);
        return { valid: false, error: 'OTP has expired. Please request a new one.' };
    }
    if (record.otp !== otp) return { valid: false, error: 'Invalid OTP. Please try again.' };
    return { valid: true, data: record };
}

// ============================================
// REGISTRATION
// ============================================

// POST /api/auth/send-register-otp - Send OTP for email verification during registration
router.post('/send-register-otp', async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, error: 'Email is required' });
        }

        // Check if email already exists
        const existingUser = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ success: false, error: 'Email already registered' });
        }

        const otp = generateOTP();
        const key = `register_${email.toLowerCase()}`;
        storeOTP(key, { otp, email: email.toLowerCase() });

        // In production, send OTP via email. For now, return it in response.
        res.json({
            success: true,
            message: 'OTP generated for email verification',
            otp: otp // Displayed on page since no email service
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/register - Register with OTP verification
router.post('/register', async (req, res, next) => {
    try {
        const { name, email, password, phone, otp } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
        }

        if (!otp) {
            return res.status(400).json({ success: false, error: 'OTP is required for email verification' });
        }

        // Verify OTP
        const key = `register_${email.toLowerCase()}`;
        const otpResult = verifyOTP(key, otp);
        if (!otpResult.valid) {
            return res.status(400).json({ success: false, error: otpResult.error });
        }

        // Remove used OTP
        otpStore.delete(key);

        // Check if email exists (double check)
        const existingUser = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ success: false, error: 'Email already registered' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Insert user
        const result = await query(
            `INSERT INTO users (name, email, password_hash, role, phone) 
       VALUES ($1, $2, $3, 'user', $4) 
       RETURNING id, name, email, role`,
            [name, email.toLowerCase(), passwordHash, phone || null]
        );

        const user = result.rows[0];

        // Generate token
        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.status(201).json({
            success: true,
            data: { ...user, token }
        });
    } catch (error) {
        next(error);
    }
});

// ============================================
// LOGIN
// ============================================

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password are required' });
        }

        // Find user
        const result = await query(
            'SELECT id, name, email, password_hash, role, department, is_active FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(401).json({ success: false, error: 'Account is deactivated' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        // Generate token
        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.json({
            success: true,
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department,
                token
            }
        });
    } catch (error) {
        next(error);
    }
});

// ============================================
// FORGOT PASSWORD
// ============================================

// POST /api/auth/forgot-password - Generate OTP for password reset
router.post('/forgot-password', async (req, res, next) => {
    try {
        const { method, value } = req.body;

        if (!method || !value) {
            return res.status(400).json({ success: false, error: 'Method and value are required' });
        }

        if (!['email', 'phone'].includes(method)) {
            return res.status(400).json({ success: false, error: 'Method must be "email" or "phone"' });
        }

        // Find user by email or phone
        let sql, param;
        if (method === 'email') {
            sql = 'SELECT id, name, email FROM users WHERE email = $1 AND is_active = true';
            param = value.toLowerCase();
        } else {
            sql = 'SELECT id, name, email FROM users WHERE phone = $1 AND is_active = true';
            param = value;
        }

        const result = await query(sql, [param]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: `No active account found with this ${method}`
            });
        }

        const user = result.rows[0];
        const otp = generateOTP();
        const key = `reset_${user.id}`;
        storeOTP(key, { otp, userId: user.id });

        // In production, send OTP via email/SMS. For now, return it in response.
        res.json({
            success: true,
            message: `OTP generated for password reset`,
            userId: user.id,
            userName: user.name,
            otp: otp // Displayed on page since no email/SMS service
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/verify-otp - Verify OTP and get reset token
router.post('/verify-otp', async (req, res, next) => {
    try {
        const { userId, otp } = req.body;

        if (!userId || !otp) {
            return res.status(400).json({ success: false, error: 'User ID and OTP are required' });
        }

        const key = `reset_${userId}`;
        const otpResult = verifyOTP(key, otp);
        if (!otpResult.valid) {
            return res.status(400).json({ success: false, error: otpResult.error });
        }

        // Remove used OTP
        otpStore.delete(key);

        // Generate a short-lived reset token (10 minutes)
        const resetToken = jwt.sign(
            { userId: parseInt(userId), purpose: 'password-reset' },
            process.env.JWT_SECRET,
            { expiresIn: '10m' }
        );

        res.json({
            success: true,
            message: 'OTP verified successfully',
            resetToken
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/reset-password - Reset password with reset token
router.post('/reset-password', async (req, res, next) => {
    try {
        const { resetToken, newPassword } = req.body;

        if (!resetToken || !newPassword) {
            return res.status(400).json({ success: false, error: 'Reset token and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
        }

        // Verify reset token
        let decoded;
        try {
            decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(400).json({ success: false, error: 'Invalid or expired reset token. Please start over.' });
        }

        if (decoded.purpose !== 'password-reset') {
            return res.status(400).json({ success: false, error: 'Invalid reset token' });
        }

        // Hash new password
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Update password
        await query(
            'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [passwordHash, decoded.userId]
        );

        res.json({
            success: true,
            message: 'Password has been reset successfully'
        });
    } catch (error) {
        next(error);
    }
});

// ============================================
// OTHER AUTH ROUTES
// ============================================

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res, next) => {
    try {
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        next(error);
    }
});

// GET /api/auth/me - Get current user
router.get('/me', authenticate, async (req, res) => {
    res.json({ success: true, data: req.user });
});

module.exports = router;
