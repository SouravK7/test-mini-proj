const express = require('express');
const { query } = require('../config/database');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/resources - List all resources
router.get('/', optionalAuth, async (req, res, next) => {
    try {
        const { type, status, search } = req.query;

        let sql = `
      SELECT r.*, 
        COALESCE(json_agg(DISTINCT ra.amenity_name) FILTER (WHERE ra.id IS NOT NULL), '[]') as amenities,
        COALESCE(json_agg(DISTINCT rr.rule_text) FILTER (WHERE rr.id IS NOT NULL), '[]') as rules
      FROM resources r
      LEFT JOIN resource_amenities ra ON r.id = ra.resource_id
      LEFT JOIN resource_rules rr ON r.id = rr.resource_id
      WHERE 1=1
    `;
        const params = [];
        let paramCount = 0;

        if (type) {
            paramCount++;
            sql += ` AND r.sub_type = $${paramCount}`;
            params.push(type);
        }

        if (status) {
            paramCount++;
            sql += ` AND r.status = $${paramCount}`;
            params.push(status);
        }

        if (search) {
            paramCount++;
            sql += ` AND (r.name ILIKE $${paramCount} OR r.location ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        sql += ` GROUP BY r.id ORDER BY r.name`;

        const result = await query(sql, params);

        res.json({ success: true, data: result.rows });
    } catch (error) {
        next(error);
    }
});

// GET /api/resources/:id - Get single resource
router.get('/:id', optionalAuth, async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await query(`
      SELECT r.*, 
        COALESCE(json_agg(DISTINCT ra.amenity_name) FILTER (WHERE ra.id IS NOT NULL), '[]') as amenities,
        COALESCE(json_agg(DISTINCT rr.rule_text) FILTER (WHERE rr.id IS NOT NULL), '[]') as rules
      FROM resources r
      LEFT JOIN resource_amenities ra ON r.id = ra.resource_id
      LEFT JOIN resource_rules rr ON r.id = rr.resource_id
      WHERE r.id = $1
      GROUP BY r.id
    `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Resource not found' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// POST /api/resources - Create resource (admin only)
router.post('/', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const { name, type, subType, capacity, location, description, imageUrl, amenities, rules } = req.body;

        if (!name || !subType || !location) {
            return res.status(400).json({ success: false, error: 'Name, subType, and location are required' });
        }

        // Insert resource
        const resourceResult = await query(`
      INSERT INTO resources (name, type, sub_type, capacity, location, description, image_url, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'available')
      RETURNING *
    `, [name, type || 'playground', subType, capacity || 0, location, description, imageUrl]);

        const resource = resourceResult.rows[0];

        // Insert amenities
        if (amenities && amenities.length > 0) {
            for (const amenity of amenities) {
                await query('INSERT INTO resource_amenities (resource_id, amenity_name) VALUES ($1, $2)',
                    [resource.id, amenity]);
            }
        }

        // Insert rules
        if (rules && rules.length > 0) {
            for (const rule of rules) {
                await query('INSERT INTO resource_rules (resource_id, rule_text) VALUES ($1, $2)',
                    [resource.id, rule]);
            }
        }

        res.status(201).json({ success: true, data: { ...resource, amenities: amenities || [], rules: rules || [] } });
    } catch (error) {
        next(error);
    }
});

// PUT /api/resources/:id - Update resource (admin only)
router.put('/:id', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, type, subType, capacity, location, description, imageUrl, status, amenities, rules } = req.body;

        // Check if resource exists
        const existing = await query('SELECT id FROM resources WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Resource not found' });
        }

        // Update resource
        const result = await query(`
      UPDATE resources 
      SET name = COALESCE($1, name),
          type = COALESCE($2, type),
          sub_type = COALESCE($3, sub_type),
          capacity = COALESCE($4, capacity),
          location = COALESCE($5, location),
          description = COALESCE($6, description),
          image_url = COALESCE($7, image_url),
          status = COALESCE($8, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `, [name, type, subType, capacity, location, description, imageUrl, status, id]);

        // Update amenities if provided
        if (amenities) {
            await query('DELETE FROM resource_amenities WHERE resource_id = $1', [id]);
            for (const amenity of amenities) {
                await query('INSERT INTO resource_amenities (resource_id, amenity_name) VALUES ($1, $2)', [id, amenity]);
            }
        }

        // Update rules if provided
        if (rules) {
            await query('DELETE FROM resource_rules WHERE resource_id = $1', [id]);
            for (const rule of rules) {
                await query('INSERT INTO resource_rules (resource_id, rule_text) VALUES ($1, $2)', [id, rule]);
            }
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/resources/:id - Delete resource (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
    try {
        const { id } = req.params;

        // Check for existing bookings
        const bookings = await query(
            "SELECT id FROM bookings WHERE resource_id = $1 AND status IN ('pending', 'approved')",
            [id]
        );

        if (bookings.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete resource with active bookings'
            });
        }

        const result = await query('DELETE FROM resources WHERE id = $1 RETURNING id', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Resource not found' });
        }

        res.json({ success: true, message: 'Resource deleted' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
