const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Verify JWT token
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Fetch user from database to ensure they still exist and are active
        const result = await query(
            'SELECT id, name, email, role, department, is_active FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0 || !result.rows[0].is_active) {
            return res.status(401).json({ success: false, error: 'User not found or inactive' });
        }

        req.user = result.rows[0];
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, error: 'Token expired' });
        }
        return res.status(401).json({ success: false, error: 'Invalid token' });
    }
};

// Role-based authorization
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        next();
    };
};

// Optional authentication (for public routes that benefit from user context)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            const result = await query(
                'SELECT id, name, email, role FROM users WHERE id = $1 AND is_active = true',
                [decoded.userId]
            );

            if (result.rows.length > 0) {
                req.user = result.rows[0];
            }
        }
    } catch (error) {
        // Ignore token errors for optional auth
    }
    next();
};

module.exports = { authenticate, authorize, optionalAuth };
