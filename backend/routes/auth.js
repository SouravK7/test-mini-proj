const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
    try {
        const { name, email, password, phone } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
        }

        // Check if email exists
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

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res, next) => {
    try {
        const { email } = req.body;

        // Always return success to prevent email enumeration
        res.json({
            success: true,
            message: 'If an account exists with this email, a reset link has been sent.'
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res, next) => {
    try {
        // For JWT, logout is handled client-side by removing the token
        // Optionally, you could blacklist tokens in a sessions table
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
