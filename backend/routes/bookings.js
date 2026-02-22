const express = require('express');
const { query } = require('../config/database');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/bookings - List bookings with filters
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { userId, resourceId, status, date, startDate, endDate } = req.query;

        let sql = `
      SELECT b.*, 
        r.name as resource_name, r.location as resource_location, r.sub_type as resource_type,
        u.name as user_name, u.email as user_email, u.role as user_role,
        ts.label as slot_label, ts.start_time, ts.end_time,
        approver.name as approved_by_name,
        rejecter.name as rejected_by_name
      FROM bookings b
      JOIN resources r ON b.resource_id = r.id
      JOIN users u ON b.user_id = u.id
      JOIN time_slots ts ON b.slot_id = ts.id
      LEFT JOIN users approver ON b.approved_by = approver.id
      LEFT JOIN users rejecter ON b.rejected_by = rejecter.id
      WHERE 1=1
    `;
        const params = [];
        let paramCount = 0;

        // Non-admin users can only see their own bookings
        if (req.user.role === 'user') {
            paramCount++;
            sql += ` AND b.user_id = $${paramCount}`;
            params.push(req.user.id);
        } else if (userId) {
            paramCount++;
            sql += ` AND b.user_id = $${paramCount}`;
            params.push(userId);
        }

        if (resourceId) {
            paramCount++;
            sql += ` AND b.resource_id = $${paramCount}`;
            params.push(resourceId);
        }

        if (status) {
            paramCount++;
            sql += ` AND b.status = $${paramCount}`;
            params.push(status);
        }

        if (date) {
            paramCount++;
            sql += ` AND b.booking_date = $${paramCount}`;
            params.push(date);
        }

        if (startDate) {
            paramCount++;
            sql += ` AND b.booking_date >= $${paramCount}`;
            params.push(startDate);
        }

        if (endDate) {
            paramCount++;
            sql += ` AND b.booking_date <= $${paramCount}`;
            params.push(endDate);
        }

        sql += ` ORDER BY b.booking_date DESC, ts.start_time`;

        const result = await query(sql, params);

        // Transform to match frontend expectations
        const bookings = result.rows.map(row => ({
            id: row.id,
            resourceId: row.resource_id,
            userId: row.user_id,
            slotId: row.slot_id,
            date: row.booking_date,
            purpose: row.purpose,
            status: row.status,
            createdAt: row.created_at,
            approvedBy: row.approved_by,
            approvedAt: row.approved_at,
            rejectedBy: row.rejected_by,
            rejectedAt: row.rejected_at,
            rejectionReason: row.rejection_reason,
            resource: {
                id: row.resource_id,
                name: row.resource_name,
                location: row.resource_location,
                subType: row.resource_type
            },
            user: {
                id: row.user_id,
                name: row.user_name,
                email: row.user_email,
                role: row.user_role
            },
            slot: {
                id: row.slot_id,
                label: row.slot_label,
                start: row.start_time,
                end: row.end_time
            }
        }));

        res.json({ success: true, data: bookings });
    } catch (error) {
        next(error);
    }
});

// POST /api/bookings - Create booking
router.post('/', authenticate, async (req, res, next) => {
    try {
        const { resourceId, date, slotId, purpose } = req.body;

        if (!resourceId || !date || !slotId || !purpose) {
            return res.status(400).json({
                success: false,
                error: 'resourceId, date, slotId, and purpose are required'
            });
        }

        // Check for conflicts
        const conflict = await query(`
      SELECT id FROM bookings 
      WHERE resource_id = $1 AND booking_date = $2 AND slot_id = $3 
        AND status IN ('pending', 'approved')
    `, [resourceId, date, slotId]);

        if (conflict.rows.length > 0) {
            return res.status(409).json({ success: false, error: 'Time slot already booked' });
        }

        // Check if resource exists and is available
        const resource = await query('SELECT status FROM resources WHERE id = $1', [resourceId]);
        if (resource.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Resource not found' });
        }
        if (resource.rows[0].status !== 'available') {
            return res.status(400).json({ success: false, error: 'Resource is not available for booking' });
        }

        // Create booking
        const result = await query(`
      INSERT INTO bookings (resource_id, user_id, slot_id, booking_date, purpose, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *
    `, [resourceId, req.user.id, slotId, date, purpose]);

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// PUT /api/bookings/:id/status - Approve/reject booking (admin/faculty)
router.put('/:id/status', authenticate, authorize('admin', 'faculty'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Status must be approved or rejected' });
        }

        // Get current booking
        const existing = await query('SELECT * FROM bookings WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }

        if (existing.rows[0].status !== 'pending') {
            return res.status(400).json({ success: false, error: 'Can only approve/reject pending bookings' });
        }

        let sql, params;
        if (status === 'approved') {
            sql = `
        UPDATE bookings 
        SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
            params = [req.user.id, id];
        } else {
            sql = `
        UPDATE bookings 
        SET status = 'rejected', rejected_by = $1, rejected_at = CURRENT_TIMESTAMP, rejection_reason = $2
        WHERE id = $3
        RETURNING *
      `;
            params = [req.user.id, reason, id];
        }

        const result = await query(sql, params);
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/bookings/:id - Cancel booking
router.delete('/:id', authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;

        // Get booking
        const existing = await query('SELECT * FROM bookings WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }

        const booking = existing.rows[0];

        // Users can only cancel their own bookings, admins can cancel any
        if (req.user.role !== 'admin' && booking.user_id !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        if (!['pending', 'approved'].includes(booking.status)) {
            return res.status(400).json({ success: false, error: 'Cannot cancel this booking' });
        }

        await query(`
      UPDATE bookings 
      SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);

        res.json({ success: true, message: 'Booking cancelled' });
    } catch (error) {
        next(error);
    }
});

// GET /api/availability/:resourceId/:date - Check slot availability
router.get('/availability/:resourceId/:date', optionalAuth, async (req, res, next) => {
    try {
        const { resourceId, date } = req.params;

        // Get all time slots
        const slotsResult = await query('SELECT * FROM time_slots WHERE is_active = true ORDER BY start_time');

        // Get booked slots for this resource and date
        const bookedResult = await query(`
      SELECT slot_id FROM bookings 
      WHERE resource_id = $1 AND booking_date = $2 AND status IN ('pending', 'approved')
    `, [resourceId, date]);

        const bookedSlotIds = bookedResult.rows.map(r => r.slot_id);

        const slots = slotsResult.rows.map(slot => ({
            id: slot.id,
            label: slot.label,
            start: slot.start_time,
            end: slot.end_time,
            available: !bookedSlotIds.includes(slot.id)
        }));

        res.json({ success: true, data: slots });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
