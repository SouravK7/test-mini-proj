-- =============================================
-- COET Facility Booking System - PostgreSQL Schema
-- Version: 2.0
-- Database: PostgreSQL
-- Last Updated: 2026-06-20
-- Changes: Added auditorium type, payment workflow statuses,
--          financial columns, cash_payments ledger table
-- =============================================

-- Drop existing tables (in reverse order of dependencies)
DROP TABLE IF EXISTS cash_payments CASCADE;
DROP TABLE IF EXISTS email_verification_tokens CASCADE;
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS usage_media CASCADE;
DROP TABLE IF EXISTS usage_records CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS resource_rules CASCADE;
DROP TABLE IF EXISTS resource_amenities CASCADE;
DROP TABLE IF EXISTS time_slots CASCADE;
DROP TABLE IF EXISTS resources CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- 1. USERS TABLE
-- ============================================
CREATE TABLE users (
    id              SERIAL          PRIMARY KEY,
    name            VARCHAR(100)    NOT NULL,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    password_hash   VARCHAR(255)    NOT NULL,
    role            VARCHAR(20)     NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'faculty', 'user')),
    phone           VARCHAR(20)     NULL,
    department      VARCHAR(100)    NULL,
    avatar_url      VARCHAR(500)    NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    is_verified     BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- 2. RESOURCES TABLE
-- type: 'playground' | 'auditorium'
-- ============================================
CREATE TABLE resources (
    id              SERIAL          PRIMARY KEY,
    name            VARCHAR(150)    NOT NULL,
    type            VARCHAR(50)     NOT NULL DEFAULT 'playground' CHECK (type IN ('playground', 'auditorium')),
    sub_type        VARCHAR(50)     NOT NULL,
    capacity        INT             NOT NULL DEFAULT 0,
    location        VARCHAR(200)    NOT NULL,
    description     TEXT            NULL,
    image_url       VARCHAR(500)    NULL,
    status          VARCHAR(20)     NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'maintenance', 'unavailable')),
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_resources_status ON resources(status);
CREATE INDEX idx_resources_type ON resources(type);
CREATE INDEX idx_resources_sub_type ON resources(sub_type);

-- ============================================
-- 3. RESOURCE AMENITIES TABLE
-- ============================================
CREATE TABLE resource_amenities (
    id              SERIAL          PRIMARY KEY,
    resource_id     INT             NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    amenity_name    VARCHAR(100)    NOT NULL
);

CREATE INDEX idx_amenities_resource ON resource_amenities(resource_id);

-- ============================================
-- 4. RESOURCE RULES TABLE
-- ============================================
CREATE TABLE resource_rules (
    id              SERIAL          PRIMARY KEY,
    resource_id     INT             NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    rule_text       VARCHAR(255)    NOT NULL
);

CREATE INDEX idx_rules_resource ON resource_rules(resource_id);

-- ============================================
-- 5. TIME SLOTS TABLE
-- ============================================
CREATE TABLE time_slots (
    id              SERIAL          PRIMARY KEY,
    label           VARCHAR(100)    NOT NULL,
    start_time      TIME            NOT NULL,
    end_time        TIME            NOT NULL,
    is_overnight    BOOLEAN         NOT NULL DEFAULT FALSE, -- TRUE for marriage overnight slot
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_time_slots_active ON time_slots(is_active);

-- ============================================
-- 6. BOOKINGS TABLE
--
-- Status workflow:
--   pending_approval  -> awaiting_advance (admin issues payment call)
--   awaiting_advance  -> partially_confirmed (advance paid)
--   partially_confirmed -> fully_confirmed (balance paid)
--   Any non-final -> rejected | cancelled
--   fully_confirmed -> completed
--
-- event_category values:
--   'Internal Academic' | 'Internal Non-Academic' | 'Government'
--   | 'External Educational' | 'Marriage'
-- ============================================
CREATE TABLE bookings (
    id                  SERIAL          PRIMARY KEY,
    resource_id         INT             NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
    user_id             INT             NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    slot_id             INT             NOT NULL REFERENCES time_slots(id) ON DELETE RESTRICT,
    booking_date        DATE            NOT NULL,
    purpose             TEXT            NOT NULL,

    -- Event classification (required for auditorium bookings)
    event_category      VARCHAR(50)     NULL CHECK (event_category IS NULL OR event_category IN (
                            'Internal Academic', 'Internal Non-Academic',
                            'Government', 'External Educational', 'Marriage'
                        )),
    event_metadata      JSONB           NULL,   -- { "bride_name": "...", "groom_name": "...", ... }

    -- Payment workflow status
    status              VARCHAR(25)     NOT NULL DEFAULT 'pending_approval' CHECK (status IN (
                            'pending_approval',
                            'awaiting_advance',
                            'partially_confirmed',
                            'fully_confirmed',
                            'rejected',
                            'cancelled',
                            'completed'
                        )),

    -- Financial tracking (populated when admin issues payment call)
    total_amount        DECIMAL(12,2)   NULL,
    advance_required    DECIMAL(12,2)   NULL,
    security_deposit    DECIMAL(12,2)   NULL,
    balance_due         DECIMAL(12,2)   NULL,

    -- Admin action tracking
    approved_by         INT             NULL REFERENCES users(id) ON DELETE SET NULL,
    approved_at         TIMESTAMP       NULL,
    rejected_by         INT             NULL REFERENCES users(id) ON DELETE SET NULL,
    rejected_at         TIMESTAMP       NULL,
    rejection_reason    TEXT            NULL,
    cancelled_at        TIMESTAMP       NULL,

    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bookings_resource_date ON bookings(resource_id, booking_date);
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_date ON bookings(booking_date);
CREATE INDEX idx_bookings_event_category ON bookings(event_category);

-- ============================================
-- 7. CASH PAYMENTS TABLE (Ledger)
-- Each row = one physical cash transaction logged by an admin
-- payment_type: 'advance' | 'balance' | 'security_refund' | 'penalty'
-- ============================================
CREATE TABLE cash_payments (
    id              SERIAL          PRIMARY KEY,
    booking_id      INT             NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    logged_by       INT             NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount_paid     DECIMAL(12,2)   NOT NULL CHECK (amount_paid > 0),
    payment_type    VARCHAR(20)     NOT NULL CHECK (payment_type IN ('advance', 'balance', 'security_refund', 'penalty')),
    receipt_no      VARCHAR(100)    NOT NULL,
    notes           TEXT            NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cash_payments_booking ON cash_payments(booking_id);
CREATE INDEX idx_cash_payments_logged_by ON cash_payments(logged_by);
CREATE INDEX idx_cash_payments_created_at ON cash_payments(created_at);

-- ============================================
-- 8. USAGE RECORDS TABLE
-- ============================================
CREATE TABLE usage_records (
    id              SERIAL          PRIMARY KEY,
    booking_id      INT             NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    uploaded_by     INT             NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    remarks         TEXT            NULL,
    issues          TEXT            NULL,
    gdrive_link     VARCHAR(1000)   NULL,
    uploaded_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(booking_id)
);

CREATE INDEX idx_usage_booking ON usage_records(booking_id);

-- ============================================
-- 9. USAGE MEDIA TABLE
-- ============================================
CREATE TABLE usage_media (
    id              SERIAL          PRIMARY KEY,
    usage_record_id INT             NOT NULL REFERENCES usage_records(id) ON DELETE CASCADE,
    file_name       VARCHAR(255)    NOT NULL,
    file_url        VARCHAR(500)    NOT NULL,
    file_type       VARCHAR(20)     NOT NULL DEFAULT 'image' CHECK (file_type IN ('image', 'video', 'document')),
    file_size       INT             NULL,
    uploaded_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_media_usage_record ON usage_media(usage_record_id);

-- ============================================
-- 10. EMAIL VERIFICATION TOKENS TABLE
-- ============================================
CREATE TABLE email_verification_tokens (
    id              SERIAL          PRIMARY KEY,
    user_id         INT             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token           VARCHAR(64)     NOT NULL UNIQUE,
    expires_at      TIMESTAMP       NOT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 11. PASSWORD RESET TOKENS TABLE
-- ============================================
CREATE TABLE password_reset_tokens (
    id              SERIAL          PRIMARY KEY,
    user_id         INT             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token           VARCHAR(64)     NOT NULL UNIQUE,
    expires_at      TIMESTAMP       NOT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 12. SESSIONS TABLE
-- ============================================
CREATE TABLE sessions (
    id              SERIAL          PRIMARY KEY,
    user_id         INT             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token           VARCHAR(500)    NOT NULL UNIQUE,
    expires_at      TIMESTAMP       NOT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- ============================================
-- SAMPLE DATA INSERTS
-- ============================================

-- Insert Time Slots (daytime presets)
INSERT INTO time_slots (label, start_time, end_time, is_overnight, is_active) VALUES
    ('6:00 AM - 8:00 AM',   '06:00:00', '08:00:00', FALSE, TRUE),
    ('8:00 AM - 10:00 AM',  '08:00:00', '10:00:00', FALSE, TRUE),
    ('10:00 AM - 12:00 PM', '10:00:00', '12:00:00', FALSE, TRUE),
    ('2:00 PM - 4:00 PM',   '14:00:00', '16:00:00', FALSE, TRUE),
    ('4:00 PM - 6:00 PM',   '16:00:00', '18:00:00', FALSE, TRUE),
    ('6:00 PM - 8:00 PM',   '18:00:00', '20:00:00', FALSE, TRUE),
    -- Full-day auditorium slot (daytime)
    ('Full Day (9:00 AM - 6:00 PM)', '09:00:00', '18:00:00', FALSE, TRUE),
    -- Marriage overnight slot: 10 PM Day-1 → 3 PM Day-2 (stored as a single record)
    ('Marriage Event (10:00 PM - 3:00 PM next day)', '22:00:00', '15:00:00', TRUE, TRUE);

-- Insert Sample Users (passwords are bcrypt hashed: admin123, faculty123, user123, public123)
INSERT INTO users (name, email, password_hash, role, phone, department) VALUES
    ('Admin User',       'admin@coet.edu',   '$2a$10$rQ8N8L5O5qH5YqK5vZ5qXO5QK5vL5qZ5kL5M5qL5qZ5qL5qZ5qL5q', 'admin',   NULL,         NULL),
    ('Dr. Sharma',       'faculty@coet.edu', '$2a$10$rQ8N8L5O5qH5YqK5vZ5qXO5QK5vL5qZ5kL5M5qL5qZ5qL5qZ5qL5q', 'faculty', NULL,         'Sports Committee'),
    ('Rahul Kumar',      'user@coet.edu',    '$2a$10$rQ8N8L5O5qH5YqK5vZ5qXO5QK5vL5qZ5kL5M5qL5qZ5qL5qZ5qL5q', 'user',    '9876543210', NULL),
    ('Community Member', 'public@gmail.com', '$2a$10$rQ8N8L5O5qH5YqK5vZ5qXO5QK5vL5qZ5kL5M5qL5qZ5qL5qZ5qL5q', 'user',    '9123456780', NULL);

-- Insert Sample Resources (Playgrounds)
INSERT INTO resources (name, type, sub_type, capacity, location, description, status) VALUES
    ('Main Cricket Ground', 'playground', 'cricket', 200, 'North Campus',
     'Full-size cricket ground with professional pitch and boundary. Suitable for matches and practice sessions.', 'available'),
    ('Football Field', 'playground', 'football', 150, 'South Campus',
     'Standard football field with natural grass. Suitable for matches and training.', 'available'),
    ('Basketball Court', 'playground', 'basketball', 50, 'Sports Complex',
     'Indoor basketball court with wooden flooring and proper markings.', 'available'),
    ('Tennis Courts', 'playground', 'tennis', 20, 'East Block',
     'Two synthetic tennis courts available for singles and doubles matches.', 'maintenance'),
    ('Athletics Track', 'playground', 'athletics', 100, 'Main Stadium',
     '400-meter synthetic running track with multiple lanes and field event facilities.', 'available');

-- Insert Sample Auditorium Resource
INSERT INTO resources (name, type, sub_type, capacity, location, description, status) VALUES
    ('Main Auditorium', 'auditorium', 'auditorium', 800, 'Administrative Block',
     'State-of-the-art auditorium with full AV setup, air conditioning, stage lighting, and a seating capacity of 800. Available for academic programs, cultural events, government functions, external institutions, and marriage ceremonies.', 'available');

-- Insert Amenities for Cricket Ground (id=1)
INSERT INTO resource_amenities (resource_id, amenity_name) VALUES
    (1, 'Pavilion'), (1, 'Changing Rooms'), (1, 'Floodlights'), (1, 'Scoreboard');

-- Insert Amenities for Main Auditorium (id=6)
INSERT INTO resource_amenities (resource_id, amenity_name) VALUES
    (6, 'Central Air Conditioning'),
    (6, 'Professional Stage Lighting'),
    (6, 'HD Projector & Screen'),
    (6, 'Professional Sound System'),
    (6, 'Green Room / Backstage'),
    (6, 'Parking (100 cars)'),
    (6, 'Catering Area'),
    (6, 'Accessible Ramps & Lifts');

-- Insert Rules for Cricket Ground (id=1)
INSERT INTO resource_rules (resource_id, rule_text) VALUES
    (1, 'No metal spikes allowed'),
    (1, 'Prior booking required for floodlight use'),
    (1, 'Maximum 3-hour slots');

-- Insert Rules for Auditorium (id=6)
INSERT INTO resource_rules (resource_id, rule_text) VALUES
    (6, 'Booking must be submitted at least 7 days in advance'),
    (6, 'Advance security deposit required for external events'),
    (6, 'Catering arrangements must be approved by the management'),
    (6, 'Decorations must not damage walls, floors, or fixtures'),
    (6, 'All electrical connections must be done through college electricians'),
    (6, 'GST applicable on total charges for Government and External events');
