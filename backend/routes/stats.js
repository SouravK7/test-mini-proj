const express = require('express');
const { query } = require('../config/database');
const { authenticate, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/stats/dashboard - Dashboard statistics
router.get('/stats/dashboard', authenticate, async (req, res, next) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const stats = {};

        // Total resources
        const resourcesResult = await query('SELECT COUNT(*) as total FROM resources');
        stats.totalResources = parseInt(resourcesResult.rows[0].total);

        // Active resources
        const activeResult = await query("SELECT COUNT(*) as total FROM resources WHERE status = 'available'");
        stats.activeResources = parseInt(activeResult.rows[0].total);

        // Bookings today
        const todayResult = await query('SELECT COUNT(*) as total FROM bookings WHERE booking_date = $1', [today]);
        stats.bookingsToday = parseInt(todayResult.rows[0].total);

        // Pending approvals
        const pendingResult = await query("SELECT COUNT(*) as total FROM bookings WHERE status = 'pending'");
        stats.pendingApprovals = parseInt(pendingResult.rows[0].total);

        // Completed this month
        const monthStart = new Date();
        monthStart.setDate(1);
        const completedResult = await query(`
      SELECT COUNT(*) as total FROM bookings 
      WHERE status = 'completed' AND booking_date >= $1
    `, [monthStart.toISOString().split('T')[0]]);
        stats.completedThisMonth = parseInt(completedResult.rows[0].total);

        // Total users
        const usersResult = await query('SELECT COUNT(*) as total FROM users WHERE is_active = true');
        stats.totalUsers = parseInt(usersResult.rows[0].total);

        res.json({ success: true, data: stats });
    } catch (error) {
        next(error);
    }
});

// GET /api/time-slots - List all time slots
router.get('/time-slots', optionalAuth, async (req, res, next) => {
    try {
        const result = await query('SELECT * FROM time_slots WHERE is_active = true ORDER BY start_time');

        const slots = result.rows.map(slot => ({
            id: slot.id,
            label: slot.label,
            start: slot.start_time,
            end: slot.end_time
        }));

        res.json({ success: true, data: slots });
    } catch (error) {
        next(error);
    }
});

// GET /api/calendar - Public calendar data
router.get('/calendar', optionalAuth, async (req, res, next) => {
    try {
        const { startDate, endDate, resourceId } = req.query;

        let sql = `
      SELECT b.id, b.booking_date, b.status, b.purpose,
        r.name as resource_name, r.sub_type as resource_type,
        ts.label as slot_label, ts.start_time, ts.end_time
      FROM bookings b
      JOIN resources r ON b.resource_id = r.id
      JOIN time_slots ts ON b.slot_id = ts.id
      WHERE b.status IN ('approved', 'pending')
    `;
        const params = [];
        let paramCount = 0;

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

        if (resourceId) {
            paramCount++;
            sql += ` AND b.resource_id = $${paramCount}`;
            params.push(resourceId);
        }

        sql += ` ORDER BY b.booking_date, ts.start_time`;

        const result = await query(sql, params);

        res.json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
