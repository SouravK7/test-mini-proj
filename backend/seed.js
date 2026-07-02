/**
 * COET Facility Booking System - Database Seed Script
 * Version: 2.0
 * Last Updated: 2026-06-24
 * * Description: Cleans and seeds the database with updated schema-compliant data,
 * including new financial columns, auditorium types, and payment ledger entries.
 * * Usage: node seed.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./config/database'); // Adjust path if necessary

// Helper wrapper for queries if your config doesn't export a generic 'query' function
const query = (text, params) => pool.query(text, params);

async function seed() {
  // Acquire a client from the pool to handle the seed transaction safely
  const client = await pool.connect();

  try {
    console.log('🌱 Starting database seeding pipeline...');
    await client.query('BEGIN');

    // ---------------------------------------------------------
    // 1. CLEAN EXISTING DATA (Safe Ordering)
    // ---------------------------------------------------------
    console.log('🧹 Clearing existing data...');
    await client.query(`
            TRUNCATE TABLE 
                cash_payments, usage_media, usage_records, sessions, 
                bookings, resource_rules, resource_amenities, 
                time_slots, resources, users 
            RESTART IDENTITY CASCADE;
        `);

    // ---------------------------------------------------------
    // 2. SEED USERS WITH REAL BCRYPT HASHES
    // ---------------------------------------------------------
    console.log('👥 Hashing passwords and seeding users...');
    const adminHash = await bcrypt.hash('admin123', 10);
    const facultyHash = await bcrypt.hash('faculty123', 10);
    const userHash = await bcrypt.hash('user123', 10);
    const publicHash = await bcrypt.hash('public123', 10);

    const userRows = await client.query(`
            INSERT INTO users (name, email, password_hash, role, phone, department, is_verified) 
            VALUES
                ('Admin User', 'admin@coet.edu', $1, 'admin', NULL, NULL, TRUE),
                ('Dr. Sharma', 'faculty@coet.edu', $2, 'faculty', NULL, 'Sports Committee', TRUE),
                ('Rahul Kumar', 'user@coet.edu', $3, 'user', '9876543210', NULL, TRUE),
                ('Community Member', 'public@gmail.com', $4, 'user', '9123456780', NULL, TRUE)
            RETURNING id, email;
        `, [adminHash, facultyHash, userHash, publicHash]);

    // Map users to local variables for relational mapping later
    const userMap = {};
    userRows.rows.forEach(u => { userMap[u.email] = u.id; });

    // ---------------------------------------------------------
    // 3. SEED TIME SLOTS
    // ---------------------------------------------------------
    console.log('⏰ Seeding time slots...');
    const slotRows = await client.query(`
            INSERT INTO time_slots (label, start_time, end_time, is_overnight, is_active) 
            VALUES
                ('6:00 AM - 8:00 AM', '06:00:00', '08:00:00', FALSE, TRUE),
                ('8:00 AM - 10:00 AM', '08:00:00', '10:00:00', FALSE, TRUE),
                ('10:00 AM - 12:00 PM', '10:00:00', '12:00:00', FALSE, TRUE),
                ('2:00 PM - 4:00 PM', '14:00:00', '16:00:00', FALSE, TRUE),
                ('4:00 PM - 6:00 PM', '16:00:00', '18:00:00', FALSE, TRUE),
                ('6:00 PM - 8:00 PM', '18:00:00', '20:00:00', FALSE, TRUE),
                ('Full Day (9:00 AM - 6:00 PM)', '09:00:00', '18:00:00', FALSE, TRUE),
                ('Marriage Event (10:00 PM - 3:00 PM next day)', '22:00:00', '15:00:00', TRUE, TRUE)
            RETURNING id, label;
        `);

    const marriageSlotId = slotRows.rows.find(s => s.label.includes('Marriage')).id;

    // ---------------------------------------------------------
    // 4. SEED RESOURCES (Playgrounds & Auditorium)
    // ---------------------------------------------------------
    console.log('🏟️ Seeding resources...');
    const resourceRows = await client.query(`
            INSERT INTO resources (name, type, sub_type, capacity, location, description, status) 
            VALUES
                ('Main Cricket Ground', 'playground', 'cricket', 200, 'North Campus', 'Full-size cricket ground with professional pitch and boundary.', 'available'),
                ('Football Field', 'playground', 'football', 150, 'South Campus', 'Standard football field with natural grass.', 'available'),
                ('Basketball Court', 'playground', 'basketball', 50, 'Sports Complex', 'Indoor basketball court with wooden flooring.', 'available'),
                ('Tennis Courts', 'playground', 'tennis', 20, 'East Block', 'Two synthetic tennis courts.', 'maintenance'),
                ('Athletics Track', 'playground', 'athletics', 100, 'Main Stadium', '400-meter synthetic running track.', 'available'),
                ('Main Auditorium', 'auditorium', 'auditorium', 800, 'Administrative Block', 'State-of-the-art auditorium with full AV setup, air conditioning, and stage lighting.', 'available')
            RETURNING id, name;
        `);

    const cricketId = resourceRows.rows.find(r => r.name === 'Main Cricket Ground').id;
    const auditoriumId = resourceRows.rows.find(r => r.name === 'Main Auditorium').id;

    // ---------------------------------------------------------
    // 5. SEED AMENITIES & RULES
    // ---------------------------------------------------------
    console.log('🛠️ Seeding resource amenities and rules...');
    await client.query(`
            INSERT INTO resource_amenities (resource_id, amenity_name) VALUES
                (${cricketId}, 'Pavilion'), (${cricketId}, 'Changing Rooms'), (${cricketId}, 'Floodlights'),
                (${auditoriumId}, 'Central Air Conditioning'), (${auditoriumId}, 'Professional Stage Lighting'), 
                (${auditoriumId}, 'HD Projector & Screen'), (${auditoriumId}, 'Professional Sound System');
            
            INSERT INTO resource_rules (resource_id, rule_text) VALUES
                (${cricketId}, 'No metal spikes allowed'), (${cricketId}, 'Prior booking required for floodlight use'),
                (${auditoriumId}, 'Booking must be submitted at least 7 days in advance'),
                (${auditoriumId}, 'Advance security deposit required for external events'),
                (${auditoriumId}, 'GST applicable on total charges for Government and External events');
        `);

    // ---------------------------------------------------------
    // 6. SEED SAMPLE WORKFLOW DATA (New 2.0 Feature Validation)
    // ---------------------------------------------------------
    console.log('📈 Seeding active sample booking and financial workflows...');

    // Mock a Partially Confirmed Auditorium booking for a Marriage ceremony
    const bookingResult = await client.query(`
            INSERT INTO bookings (
                resource_id, user_id, slot_id, booking_date, purpose, 
                event_category, event_metadata, status, 
                total_amount, advance_required, security_deposit, balance_due,
                actuals_amount, penalty_amount, settlement_notes,
                approved_by, approved_at
            ) VALUES (
                $1, $2, $3, CURRENT_DATE + INTERVAL '14 days', 'Marriage Function of Sister',
                'Marriage', '{"bride_name": "Anjali Sharma", "groom_name": "Amit Verma"}'::jsonb, 'partially_confirmed',
                50000.00, 25000.00, 20000.00, 25000.00,
                0, 0, NULL,
                $4, CURRENT_TIMESTAMP
            ) RETURNING id;
        `, [auditoriumId, userMap['public@gmail.com'], marriageSlotId, userMap['admin@coet.edu']]);

    const bookingId = bookingResult.rows[0].id;

    // Log the physical cash receipt transaction into the new ledger table
    await client.query(`
            INSERT INTO cash_payments (booking_id, logged_by, amount_paid, payment_type, receipt_no, notes)
            VALUES (
                $1, $2, 45000.00, 'advance', 'REC-2026-0001', '50% Booking Advance + Security Deposit collected in cash at window 3.'
            );
        `, [bookingId, userMap['admin@coet.edu']]);


    // Commit the complete transaction securely
    await client.query('COMMIT');

    console.log('\n===============================================');
    console.log('✅ Database successfully updated and seeded!');
    console.log('===============================================');
    console.log('📋 Validated System Credentials:');
    console.log(`   Admin:   admin@coet.edu    / admin123`);
    console.log(`   Faculty: faculty@coet.edu  / faculty123`);
    console.log(`   User:    user@coet.edu     / user123`);
    console.log(`   Public:  public@gmail.com  / public123`);
    console.log('===============================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Critical Seed error, rolling back changes...');
    await client.query('ROLLBACK');
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();