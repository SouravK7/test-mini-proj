const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { sendMail } = require('../config/mailer');

const router = express.Router();

// ── Helper: send verification email ──────────────────────────────────────────
async function sendVerificationEmail(user, token) {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const link = `${appUrl}/pages/verify-email.html?token=${token}`;

    await sendMail({
        to: user.email,
        subject: 'Verify your COET Resource Booking account',
        html: `
        <div style="font-family:sans-serif;max-width:560px;margin:auto">
          <h2 style="color:#10b981">COET Resource Booking</h2>
          <p>Hi ${user.name},</p>
          <p>Thanks for registering! Please verify your email address by clicking the button below.
             This link expires in <strong>24 hours</strong>.</p>
          <a href="${link}"
             style="display:inline-block;padding:12px 24px;background:#10b981;color:#fff;
                    border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">
            Verify Email
          </a>
          <p style="color:#6b7280;font-size:13px">
            Or copy this link:<br><a href="${link}">${link}</a>
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb">
          <p style="color:#9ca3af;font-size:12px">
            If you didn't create an account, you can ignore this email.
          </p>
        </div>`
    });
}

// POST /api/auth/register ─────────────────────────────────────────────────────
router.post('/register', async (req, res, next) => {
    try {
        const { name, email, password, phone } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
        }

        // Check if email exists
        const existingUser = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ success: false, error: 'Email already registered' });
        }

        // Hash password & insert user (is_verified defaults to false)
        const passwordHash = await bcrypt.hash(password, 10);
        const result = await query(
            `INSERT INTO users (name, email, password_hash, role, phone, is_verified)
             VALUES ($1, $2, $3, 'user', $4, false)
             RETURNING id, name, email, role`,
            [name, email.toLowerCase(), passwordHash, phone || null]
        );
        const user = result.rows[0];

        // Generate verification token (expires 24 h)
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await query(
            `INSERT INTO email_verification_tokens (user_id, token, expires_at)
             VALUES ($1, $2, $3)`,
            [user.id, token, expiresAt]
        );

        // Send email (non-blocking — don't fail registration if mail fails)
        sendVerificationEmail(user, token).catch(err =>
            console.error('Verification email failed to send:', err.message)
        );

        res.status(201).json({
            success: true,
            requiresVerification: true,
            message: 'Account created! Please check your email to verify your account.'
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/auth/verify-email?token=TOKEN ──────────────────────────────────────
router.get('/verify-email', async (req, res, next) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ success: false, error: 'Verification token is required' });
        }

        // Find token
        const tokenResult = await query(
            `SELECT evt.user_id, evt.expires_at
             FROM email_verification_tokens evt
             WHERE evt.token = $1`,
            [token]
        );

        if (tokenResult.rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Invalid or already used verification link' });
        }

        const { user_id, expires_at } = tokenResult.rows[0];

        if (new Date() > new Date(expires_at)) {
            // Clean up expired token
            await query('DELETE FROM email_verification_tokens WHERE token = $1', [token]);
            return res.status(400).json({ success: false, error: 'Verification link has expired. Please register again.' });
        }

        // Mark user as verified & remove token
        await query('UPDATE users SET is_verified = true WHERE id = $1', [user_id]);
        await query('DELETE FROM email_verification_tokens WHERE token = $1', [token]);

        res.json({ success: true, message: 'Email verified successfully! You can now log in.' });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/login ────────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password are required' });
        }

        // Find user
        const result = await query(
            'SELECT id, name, email, password_hash, role, department, is_active, is_verified FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(401).json({ success: false, error: 'Account is deactivated' });
        }

        // Block unverified accounts
        if (!user.is_verified) {
            return res.status(401).json({
                success: false,
                error: 'Please verify your email before logging in. Check your inbox for the verification link.'
            });
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

// POST /api/auth/forgot-password ──────────────────────────────────────────────
router.post('/forgot-password', async (req, res, next) => {
    try {
        const { email } = req.body;

        // Always respond with success to prevent email enumeration
        res.json({
            success: true,
            message: 'If an account exists with this email, a reset link has been sent.'
        });

        if (!email) return;

        // Look up user (fire-and-forget after response is sent)
        const result = await query(
            'SELECT id, name, email FROM users WHERE email = $1 AND is_active = true',
            [email.toLowerCase()]
        );
        if (result.rows.length === 0) return;

        const user = result.rows[0];

        // Delete any existing reset tokens for this user
        await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);

        // Generate token (expires 1 hour)
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await query(
            'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, token, expiresAt]
        );

        const appUrl = process.env.APP_URL || 'http://localhost:3000';
        const link = `${appUrl}/pages/reset-password.html?token=${token}`;

        sendMail({
            to: user.email,
            subject: 'Reset your COET Resource Booking password',
            html: `
            <div style="font-family:sans-serif;max-width:560px;margin:auto">
              <h2 style="color:#10b981">COET Resource Booking</h2>
              <p>Hi ${user.name},</p>
              <p>We received a request to reset your password.
                 Click the button below — this link expires in <strong>1 hour</strong>.</p>
              <a href="${link}"
                 style="display:inline-block;padding:12px 24px;background:#10b981;color:#fff;
                        border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0">
                Reset Password
              </a>
              <p style="color:#6b7280;font-size:13px">
                Or copy this link:<br><a href="${link}">${link}</a>
              </p>
              <hr style="border:none;border-top:1px solid #e5e7eb">
              <p style="color:#9ca3af;font-size:12px">
                If you didn't request a password reset, you can ignore this email.
              </p>
            </div>`
        }).catch(err => console.error('Reset email failed:', err.message));

    } catch (error) {
        next(error);
    }
});

// POST /api/auth/reset-password ────────────────────────────────────────────────
router.post('/reset-password', async (req, res, next) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ success: false, error: 'Token and new password are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
        }

        // Find token
        const tokenResult = await query(
            'SELECT user_id, expires_at FROM password_reset_tokens WHERE token = $1',
            [token]
        );
        if (tokenResult.rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Invalid or already used reset link' });
        }

        const { user_id, expires_at } = tokenResult.rows[0];
        if (new Date() > new Date(expires_at)) {
            await query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
            return res.status(400).json({ success: false, error: 'Reset link has expired. Please request a new one.' });
        }

        // Update password & delete token
        const passwordHash = await bcrypt.hash(password, 10);
        await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, user_id]);
        await query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);

        res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
    } catch (error) {
        next(error);
    }
});


// POST /api/auth/logout ───────────────────────────────────────────────────────
router.post('/logout', authenticate, async (req, res, next) => {
    try {
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        next(error);
    }
});

// GET /api/auth/me ────────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
    res.json({ success: true, data: req.user });
});

module.exports = router;
