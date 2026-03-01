const express = require('express');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/usage-records
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { bookingId } = req.query;
        let sql = `
            SELECT ur.*, u.name as uploader_name
            FROM usage_records ur
            JOIN users u ON ur.uploaded_by = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 0;

        if (bookingId) {
            paramCount++;
            sql += ` AND ur.booking_id = $${paramCount}`;
            params.push(bookingId);
        }

        sql += ` ORDER BY ur.uploaded_at DESC`;

        const result = await query(sql, params);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
});

// POST /api/usage-records
router.post('/', authenticate, async (req, res, next) => {
    try {
        const { bookingId, remarks, issues, gdriveLink } = req.body;

        if (!bookingId || !remarks) {
            return res.status(400).json({
                success: false,
                error: 'bookingId and remarks are required'
            });
        }

        // Verify that the booking exists and user has permission
        const bookingCheck = await query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
        if (bookingCheck.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }

        const booking = bookingCheck.rows[0];
        if (req.user.role !== 'admin' && req.user.role !== 'faculty' && req.user.id !== booking.user_id) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        // Check if a usage record already exists for this booking
        const usageCheck = await query('SELECT id FROM usage_records WHERE booking_id = $1', [bookingId]);
        if (usageCheck.rows.length > 0) {
            return res.status(409).json({ success: false, error: 'A usage record has already been submitted for this booking.' });
        }

        // Create usage record
        const result = await query(`
            INSERT INTO usage_records (booking_id, uploaded_by, remarks, issues, gdrive_link)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [bookingId, req.user.id, remarks, issues || null, gdriveLink || null]);

        res.status(201).json({ success: true, data: result.rows[0] });

    } catch (error) {
        next(error);
    }
});

module.exports = router;
