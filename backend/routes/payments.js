const express = require('express');
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ============================================
// GET /api/payments - Admin Cash Ledger
// Returns ALL cash payment transactions across all bookings
// ============================================
router.get('/', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const { bookingId, paymentType, startDate, endDate } = req.query;
        const params = [];
        let paramCount = 0;
        let conditions = '';

        if (bookingId) {
            paramCount++;
            conditions += ` AND cp.booking_id = $${paramCount}`;
            params.push(bookingId);
        }
        if (paymentType) {
            paramCount++;
            conditions += ` AND cp.payment_type = $${paramCount}`;
            params.push(paymentType);
        }
        if (startDate) {
            paramCount++;
            conditions += ` AND cp.created_at >= $${paramCount}`;
            params.push(startDate);
        }
        if (endDate) {
            paramCount++;
            conditions += ` AND cp.created_at < ($${paramCount}::date + interval '1 day')`;
            params.push(endDate);
        }

        const sql = `
            SELECT
                cp.id,
                cp.booking_id,
                cp.amount_paid,
                cp.payment_type,
                cp.receipt_no,
                cp.notes,
                cp.created_at,
                -- Logged-by admin info
                admin_user.name AS logged_by_name,
                admin_user.email AS logged_by_email,
                -- Booking info
                b.booking_date,
                b.purpose,
                b.event_category,
                b.status AS booking_status,
                b.total_amount,
                b.balance_due,
                -- Resource info
                r.name AS resource_name,
                r.type AS resource_type,
                -- Booker info
                booker.name AS booker_name,
                booker.email AS booker_email
            FROM cash_payments cp
            JOIN users admin_user ON cp.logged_by = admin_user.id
            JOIN bookings b ON cp.booking_id = b.id
            JOIN resources r ON b.resource_id = r.id
            JOIN users booker ON b.user_id = booker.id
            WHERE 1=1${conditions}
            ORDER BY cp.created_at DESC
        `;

        const result = await query(sql, params);

        // Compute summary stats
        const totalReceived = result.rows.reduce((sum, row) => {
            if (['advance', 'balance'].includes(row.payment_type)) {
                return sum + parseFloat(row.amount_paid);
            }
            return sum;
        }, 0);

        res.json({
            success: true,
            data: result.rows,
            meta: {
                total: result.rows.length,
                totalReceived
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
