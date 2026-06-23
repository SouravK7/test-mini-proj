const express = require('express');
const { query } = require('../config/database');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// ============================================
// Fee structure constants (from official rental chart)
// These pre-populate the "Issue Payment Call" modal.
// Admin can adjust for actuals (diesel, GST, etc.)
// ============================================
const FEE_DEFAULTS = {
    'Internal Academic':    { base: 5000,  security: 0 },
    'Internal Non-Academic':{ base: 15000, security: 0 },
    'Government':           { base: 20000, security: 0 },
    'External Educational': { base: 40000, security: 20000 },
    'Marriage':             { base: 72000, security: 20000 }
};

// Active booking statuses (used for conflict checking)
const ACTIVE_STATUSES = ['pending_approval', 'awaiting_advance', 'partially_confirmed', 'fully_confirmed', 'completed'];

// Statuses that allow cancellation
const CANCELLABLE_STATUSES = ['pending_approval', 'awaiting_advance', 'partially_confirmed'];

// ============================================
// Helper: build the full booking SELECT SQL
// ============================================
function buildBookingSelectSQL(whereClause = 'WHERE 1=1') {
    return `
        SELECT b.*,
            r.name AS resource_name, r.location AS resource_location,
            r.sub_type AS resource_type, r.type AS resource_main_type,
            u.name AS user_name, u.email AS user_email, u.role AS user_role,
            ts.label AS slot_label, ts.start_time, ts.end_time, ts.is_overnight,
            approver.name AS approved_by_name,
            rejecter.name AS rejected_by_name,
            EXISTS(SELECT 1 FROM usage_records ur WHERE ur.booking_id = b.id) AS has_usage_record,
            (SELECT gdrive_link FROM usage_records ur WHERE ur.booking_id = b.id) AS gdrive_link,
            COALESCE(
                (SELECT SUM(cp.amount_paid) FROM cash_payments cp
                 WHERE cp.booking_id = b.id AND cp.payment_type IN ('advance','balance')),
                0
            ) AS total_paid
        FROM bookings b
        JOIN resources r ON b.resource_id = r.id
        JOIN users u ON b.user_id = u.id
        JOIN time_slots ts ON b.slot_id = ts.id
        LEFT JOIN users approver ON b.approved_by = approver.id
        LEFT JOIN users rejecter ON b.rejected_by = rejecter.id
        ${whereClause}
    `;
}

// ============================================
// Helper: transform a DB row → frontend object
// ============================================
function transformBooking(row) {
    return {
        id: row.id,
        resourceId: row.resource_id,
        userId: row.user_id,
        slotId: row.slot_id,
        date: row.booking_date,
        purpose: row.purpose,
        status: row.status,
        eventCategory: row.event_category,
        eventMetadata: row.event_metadata,
        totalAmount: row.total_amount,
        advanceRequired: row.advance_required,
        securityDeposit: row.security_deposit,
        balanceDue: row.balance_due,
        totalPaid: row.total_paid,
        createdAt: row.created_at,
        approvedBy: row.approved_by,
        approvedAt: row.approved_at,
        approvedByName: row.approved_by_name,
        rejectedBy: row.rejected_by,
        rejectedAt: row.rejected_at,
        rejectionReason: row.rejection_reason,
        hasUsageRecord: row.has_usage_record === true || row.has_usage_record === 'true',
        gdriveLink: row.gdrive_link,
        resource: {
            id: row.resource_id,
            name: row.resource_name,
            location: row.resource_location,
            subType: row.resource_type,
            type: row.resource_main_type
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
            end: row.end_time,
            isOvernight: row.is_overnight
        }
    };
}

// ============================================
// GET /api/bookings - List bookings with filters
// ============================================
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { userId, resourceId, status, date, startDate, endDate } = req.query;
        const params = [];
        let paramCount = 0;
        let conditions = '';

        // Non-admin users can only see their own bookings
        if (req.user.role === 'user') {
            paramCount++;
            conditions += ` AND b.user_id = $${paramCount}`;
            params.push(req.user.id);
        } else if (userId) {
            paramCount++;
            conditions += ` AND b.user_id = $${paramCount}`;
            params.push(userId);
        }

        if (resourceId) {
            paramCount++;
            conditions += ` AND b.resource_id = $${paramCount}`;
            params.push(resourceId);
        }

        if (status) {
            paramCount++;
            conditions += ` AND b.status = $${paramCount}`;
            params.push(status);
        }

        if (date) {
            paramCount++;
            conditions += ` AND b.booking_date = $${paramCount}`;
            params.push(date);
        }

        if (startDate) {
            paramCount++;
            conditions += ` AND b.booking_date >= $${paramCount}`;
            params.push(startDate);
        }

        if (endDate) {
            paramCount++;
            conditions += ` AND b.booking_date <= $${paramCount}`;
            params.push(endDate);
        }

        const sql = buildBookingSelectSQL(`WHERE 1=1${conditions}`) + ` ORDER BY b.created_at DESC`;
        const result = await query(sql, params);
        res.json({ success: true, data: result.rows.map(transformBooking) });
    } catch (error) {
        next(error);
    }
});

// ============================================
// GET /api/bookings/:id - Get single booking
// ============================================
router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        const sql = buildBookingSelectSQL('WHERE b.id = $1');
        const result = await query(sql, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }

        const row = result.rows[0];
        if (req.user.role === 'user' && row.user_id !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        res.json({ success: true, data: transformBooking(row) });
    } catch (error) {
        next(error);
    }
});

// ============================================
// POST /api/bookings - Create booking
// ============================================
router.post('/', authenticate, async (req, res, next) => {
    try {
        const {
            resourceId, date, slotId, purpose,
            isCustom, customStart, customEnd,
            eventCategory, eventMetadata
        } = req.body;

        if (!resourceId || !date || !purpose) {
            return res.status(400).json({
                success: false,
                error: 'resourceId, date, and purpose are required'
            });
        }

        // Validate event_category if provided
        const validCategories = ['Internal Academic', 'Internal Non-Academic', 'Government', 'External Educational', 'Marriage'];
        if (eventCategory && !validCategories.includes(eventCategory)) {
            return res.status(400).json({ success: false, error: 'Invalid event category' });
        }

        // Check if resource exists and is available
        const resourceResult = await query('SELECT id, status, type FROM resources WHERE id = $1', [resourceId]);
        if (resourceResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Resource not found' });
        }
        const resource = resourceResult.rows[0];
        if (resource.status !== 'available') {
            return res.status(400).json({ success: false, error: 'Resource is not available for booking' });
        }

        // Auditorium requires an event category
        if (resource.type === 'auditorium' && !eventCategory) {
            return res.status(400).json({ success: false, error: 'Event category is required for auditorium bookings' });
        }

        // Validate marriage metadata
        if (eventCategory === 'Marriage') {
            if (!eventMetadata || !eventMetadata.bride_name || !eventMetadata.groom_name) {
                return res.status(400).json({ success: false, error: 'Bride and groom names are required for Marriage bookings' });
            }
        }

        let finalSlotId = slotId;
        let reqStart, reqEnd;
        let isOvernightBooking = false;

        if (isCustom) {
            if (!customStart || !customEnd) {
                return res.status(400).json({ success: false, error: 'customStart and customEnd are required for custom bookings' });
            }
            reqStart = `${customStart}:00`;
            reqEnd = `${customEnd}:00`;
            const customLabel = `Custom: ${customStart} - ${customEnd}`;
            const existingSlot = await query(
                'SELECT id FROM time_slots WHERE label = $1 AND start_time = $2 AND end_time = $3',
                [customLabel, reqStart, reqEnd]
            );
            if (existingSlot.rows.length > 0) {
                finalSlotId = existingSlot.rows[0].id;
            } else {
                const newSlot = await query(
                    'INSERT INTO time_slots (label, start_time, end_time, is_active) VALUES ($1, $2, $3, false) RETURNING id',
                    [customLabel, reqStart, reqEnd]
                );
                finalSlotId = newSlot.rows[0].id;
            }
        } else if (!finalSlotId) {
            return res.status(400).json({ success: false, error: 'slotId is required for preset bookings' });
        } else {
            const presetSlot = await query('SELECT start_time, end_time, is_overnight FROM time_slots WHERE id = $1', [finalSlotId]);
            if (presetSlot.rows.length === 0) {
                return res.status(400).json({ success: false, error: 'Invalid slotId' });
            }
            reqStart = presetSlot.rows[0].start_time;
            reqEnd = presetSlot.rows[0].end_time;
            isOvernightBooking = presetSlot.rows[0].is_overnight;
        }

        // --------------------------------------------------------
        // Overnight marriage slot validation
        // For auditorium + Marriage, the overnight slot (10 PM → 3 PM next day)
        // is allowed. Conflict check must cover BOTH the start date (10 PM→midnight)
        // AND the end date (midnight→3 PM).
        // --------------------------------------------------------
        const isMarriageOvernightSlot = resource.type === 'auditorium'
            && eventCategory === 'Marriage'
            && isOvernightBooking;

        if (isMarriageOvernightSlot) {
            // Check conflicts on the start date (10 PM - midnight range)
            const conflictDay1 = await query(`
                SELECT b.id FROM bookings b
                JOIN time_slots ts ON b.slot_id = ts.id
                WHERE b.resource_id = $1 AND b.booking_date = $2
                  AND b.status = ANY($3::text[])
                  AND (ts.is_overnight = true OR ts.start_time < '24:00:00')
                  AND ts.start_time >= $4
            `, [resourceId, date, ACTIVE_STATUSES, reqStart]);

            // Check conflicts on the end date (midnight → 3 PM range)
            const endDate = new Date(date);
            endDate.setDate(endDate.getDate() + 1);
            const endDateStr = endDate.toISOString().split('T')[0];

            const conflictDay2 = await query(`
                SELECT b.id FROM bookings b
                JOIN time_slots ts ON b.slot_id = ts.id
                WHERE b.resource_id = $1 AND b.booking_date = $2
                  AND b.status = ANY($3::text[])
                  AND ts.start_time < $4
            `, [resourceId, endDateStr, ACTIVE_STATUSES, reqEnd]);

            if (conflictDay1.rows.length > 0 || conflictDay2.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    error: 'This marriage event time conflicts with an existing booking'
                });
            }
        } else {
            // Standard daytime conflict check
            const conflict = await query(`
                SELECT b.id FROM bookings b
                JOIN time_slots ts ON b.slot_id = ts.id
                WHERE b.resource_id = $1 AND b.booking_date = $2
                  AND b.status = ANY($3::text[])
                  AND (ts.start_time < $5 AND ts.end_time > $4)
            `, [resourceId, date, ACTIVE_STATUSES, reqStart, reqEnd]);

            if (conflict.rows.length > 0) {
                return res.status(409).json({ success: false, error: 'This time period overlaps with an existing booking' });
            }
        }

        // Create booking
        const result = await query(`
            INSERT INTO bookings (resource_id, user_id, slot_id, booking_date, purpose, status, event_category, event_metadata)
            VALUES ($1, $2, $3, $4, $5, 'pending_approval', $6, $7)
            RETURNING *
        `, [resourceId, req.user.id, finalSlotId, date, purpose, eventCategory || null, eventMetadata ? JSON.stringify(eventMetadata) : null]);

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// ============================================
// PUT /api/bookings/:id/status - Admin actions
//
// Actions:
//   'issue_payment_call' (admin) → awaiting_advance + set fee data
//   'rejected'           (admin) → rejected
//   'cancelled'          (user/admin) → cancelled
//   'completed'          (admin) → completed (from fully_confirmed)
// ============================================
router.put('/:id/status', authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, reason, totalAmount, advanceRequired, securityDeposit } = req.body;

        const allowedActions = ['issue_payment_call', 'rejected', 'cancelled', 'completed'];
        if (!allowedActions.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Status must be one of: ${allowedActions.join(', ')}`
            });
        }

        const existing = await query('SELECT * FROM bookings WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }
        const booking = existing.rows[0];

        // Authorization
        if (['issue_payment_call', 'rejected'].includes(status) && !['admin', 'faculty'].includes(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Only admins/faculty can perform this action' });
        }
        if (status === 'cancelled' && req.user.role === 'user' && booking.user_id !== req.user.id) {
            return res.status(403).json({ success: false, error: 'You can only cancel your own bookings' });
        }
        if (status === 'completed' && !['admin', 'faculty'].includes(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Only admins/faculty can mark bookings as completed' });
        }

        // State transition validation
        if (status === 'issue_payment_call' && booking.status !== 'pending_approval') {
            return res.status(400).json({ success: false, error: 'Can only issue payment call for pending_approval bookings' });
        }
        if (status === 'rejected' && !['pending_approval', 'awaiting_advance'].includes(booking.status)) {
            return res.status(400).json({ success: false, error: 'Can only reject pending or awaiting advance bookings' });
        }
        if (status === 'cancelled' && !CANCELLABLE_STATUSES.includes(booking.status)) {
            return res.status(400).json({ success: false, error: 'Cannot cancel a booking in its current state' });
        }
        if (status === 'completed' && booking.status !== 'fully_confirmed') {
            return res.status(400).json({ success: false, error: 'Can only complete fully confirmed bookings' });
        }

        let sql, params, resultData;

        if (status === 'issue_payment_call') {
            // Validate fee data
            if (totalAmount === undefined || totalAmount === null) {
                return res.status(400).json({ success: false, error: 'totalAmount is required for issuing a payment call' });
            }

            const total = parseFloat(totalAmount);
            const advance = parseFloat(advanceRequired) || 0;
            const security = parseFloat(securityDeposit) || 0;
            const balance = total - advance;

            sql = `
                UPDATE bookings
                SET status = 'awaiting_advance',
                    total_amount = $1,
                    advance_required = $2,
                    security_deposit = $3,
                    balance_due = $4,
                    approved_by = $5,
                    approved_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $6
                RETURNING *
            `;
            params = [total, advance, security, balance, req.user.id, id];

        } else if (status === 'rejected') {
            sql = `
                UPDATE bookings
                SET status = 'rejected',
                    rejected_by = $1,
                    rejected_at = CURRENT_TIMESTAMP,
                    rejection_reason = $2,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
                RETURNING *
            `;
            params = [req.user.id, reason || null, id];

        } else if (status === 'cancelled') {
            sql = `
                UPDATE bookings
                SET status = 'cancelled',
                    cancelled_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `;
            params = [id];

        } else if (status === 'completed') {
            sql = `
                UPDATE bookings
                SET status = 'completed',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `;
            params = [id];
        }

        const result = await query(sql, params);
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// ============================================
// DELETE /api/bookings/:id - Cancel booking
// ============================================
router.delete('/:id', authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;
        const existing = await query('SELECT * FROM bookings WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }
        const booking = existing.rows[0];

        if (req.user.role !== 'admin' && booking.user_id !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        if (!CANCELLABLE_STATUSES.includes(booking.status)) {
            return res.status(400).json({ success: false, error: 'Cannot cancel this booking' });
        }

        await query(`
            UPDATE bookings SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP WHERE id = $1
        `, [id]);

        res.json({ success: true, message: 'Booking cancelled' });
    } catch (error) {
        next(error);
    }
});

// ============================================
// POST /api/bookings/:id/payments - Log a cash payment (admin only)
// ============================================
router.post('/:id/payments', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { amountPaid, paymentType, receiptNo, notes } = req.body;

        // Validate input
        if (!amountPaid || !paymentType || !receiptNo) {
            return res.status(400).json({ success: false, error: 'amountPaid, paymentType, and receiptNo are required' });
        }
        const validTypes = ['advance', 'balance', 'security_refund', 'penalty'];
        if (!validTypes.includes(paymentType)) {
            return res.status(400).json({ success: false, error: `paymentType must be one of: ${validTypes.join(', ')}` });
        }

        const amount = parseFloat(amountPaid);
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({ success: false, error: 'amountPaid must be a positive number' });
        }

        // Get booking
        const bookingResult = await query('SELECT * FROM bookings WHERE id = $1', [id]);
        if (bookingResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }
        const booking = bookingResult.rows[0];

        // Booking must be in a payable state
        const payableStatuses = ['awaiting_advance', 'partially_confirmed'];
        if (!payableStatuses.includes(booking.status)) {
            return res.status(400).json({
                success: false,
                error: `Cannot log payment for a booking in '${booking.status}' status`
            });
        }

        // Check for duplicate receipt number
        const dupReceipt = await query('SELECT id FROM cash_payments WHERE receipt_no = $1', [receiptNo]);
        if (dupReceipt.rows.length > 0) {
            return res.status(409).json({ success: false, error: `Receipt number '${receiptNo}' has already been used` });
        }

        // Insert payment record
        const paymentResult = await query(`
            INSERT INTO cash_payments (booking_id, logged_by, amount_paid, payment_type, receipt_no, notes)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [id, req.user.id, amount, paymentType, receiptNo, notes || null]);

        // Recalculate balance and update booking status
        const newBalanceDue = Math.max(0, parseFloat(booking.balance_due || 0) - amount);
        let newStatus = booking.status;

        if (paymentType === 'advance') {
            newStatus = 'partially_confirmed';
        } else if (paymentType === 'balance') {
            newStatus = newBalanceDue <= 0 ? 'fully_confirmed' : 'partially_confirmed';
        }

        await query(`
            UPDATE bookings
            SET balance_due = $1, status = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
        `, [newBalanceDue, newStatus, id]);

        res.status(201).json({
            success: true,
            data: paymentResult.rows[0],
            newStatus,
            newBalanceDue
        });
    } catch (error) {
        next(error);
    }
});

// ============================================
// GET /api/bookings/:id/payments - Get payment history for a booking
// ============================================
router.get('/:id/payments', authenticate, async (req, res, next) => {
    try {
        const { id } = req.params;

        // Verify access
        const bookingResult = await query('SELECT user_id FROM bookings WHERE id = $1', [id]);
        if (bookingResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }
        if (req.user.role === 'user' && bookingResult.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        const result = await query(`
            SELECT cp.*, u.name AS logged_by_name, u.email AS logged_by_email
            FROM cash_payments cp
            JOIN users u ON cp.logged_by = u.id
            WHERE cp.booking_id = $1
            ORDER BY cp.created_at ASC
        `, [id]);

        res.json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
});

// ============================================
// GET /api/bookings/availability/:resourceId/:date - Check slot availability
// ============================================
router.get('/availability/:resourceId/:date', optionalAuth, async (req, res, next) => {
    try {
        const { resourceId, date } = req.params;

        // Get resource type
        const resourceResult = await query('SELECT type FROM resources WHERE id = $1', [resourceId]);
        const isAuditorium = resourceResult.rows.length > 0 && resourceResult.rows[0].type === 'auditorium';

        // Get all active preset time slots
        const slotsResult = await query('SELECT * FROM time_slots WHERE is_active = true ORDER BY start_time');

        // Get booked slots for this resource and date (active bookings)
        const bookedResult = await query(`
            SELECT b.slot_id, ts.start_time, ts.end_time, ts.is_overnight
            FROM bookings b
            JOIN time_slots ts ON b.slot_id = ts.id
            WHERE b.resource_id = $1 AND b.booking_date = $2
              AND b.status = ANY($3::text[])
        `, [resourceId, date, ACTIVE_STATUSES]);

        // Also check the PREVIOUS day for overnight bookings that extend into this date
        const prevDate = new Date(date);
        prevDate.setDate(prevDate.getDate() - 1);
        const prevDateStr = prevDate.toISOString().split('T')[0];

        const overnightBookings = await query(`
            SELECT b.slot_id, ts.start_time, ts.end_time, ts.is_overnight
            FROM bookings b
            JOIN time_slots ts ON b.slot_id = ts.id
            WHERE b.resource_id = $1 AND b.booking_date = $2
              AND ts.is_overnight = true
              AND b.status = ANY($3::text[])
        `, [resourceId, prevDateStr, ACTIVE_STATUSES]);

        const bookedSlots = [...bookedResult.rows, ...overnightBookings.rows];

        const slots = slotsResult.rows
            // For non-auditorium resources, hide the marriage overnight slot
            .filter(slot => isAuditorium || !slot.is_overnight)
            .map(slot => {
                let isOverlapping = false;

                if (slot.is_overnight) {
                    // Marriage overnight slot is unavailable if there's any booking that day
                    isOverlapping = bookedSlots.length > 0;
                } else {
                    isOverlapping = bookedSlots.some(booked => {
                        if (booked.is_overnight) {
                            // An overnight booking from prev day blocks early morning slots
                            return slot.start_time < booked.end_time;
                        }
                        return slot.start_time < booked.end_time && slot.end_time > booked.start_time;
                    });
                }

                return {
                    id: slot.id,
                    label: slot.label,
                    start: slot.start_time,
                    end: slot.end_time,
                    isOvernight: slot.is_overnight,
                    available: !isOverlapping
                };
            });

        res.json({ success: true, data: slots });
    } catch (error) {
        next(error);
    }
});

// ============================================
// GET /api/bookings/fee-defaults - Return fee defaults per category (admin helper)
// ============================================
router.get('/fee-defaults', authenticate, authorize('admin'), async (req, res) => {
    res.json({ success: true, data: FEE_DEFAULTS });
});

module.exports = router;
module.exports.FEE_DEFAULTS = FEE_DEFAULTS;
