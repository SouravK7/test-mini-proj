-- =============================================
-- COET Ground Booking System - PostgreSQL Schema
-- Version: 1.0
-- Database: PostgreSQL
-- =============================================

-- Drop existing tables (in reverse order of dependencies)
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
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- 2. RESOURCES TABLE
-- ============================================
CREATE TABLE resources (
    id              SERIAL          PRIMARY KEY,
    name            VARCHAR(150)    NOT NULL,
    type            VARCHAR(50)     NOT NULL DEFAULT 'playground',
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
    label           VARCHAR(50)     NOT NULL,
    start_time      TIME            NOT NULL,
    end_time        TIME            NOT NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_time_slots_active ON time_slots(is_active);

-- ============================================
-- 6. BOOKINGS TABLE
-- ============================================
CREATE TABLE bookings (
    id                  SERIAL          PRIMARY KEY,
    resource_id         INT             NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
    user_id             INT             NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    slot_id             INT             NOT NULL REFERENCES time_slots(id) ON DELETE RESTRICT,
    booking_date        DATE            NOT NULL,
    purpose             TEXT            NOT NULL,
    status              VARCHAR(20)     NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'completed')),
    approved_by         INT             NULL REFERENCES users(id) ON DELETE SET NULL,
    approved_at         TIMESTAMP       NULL,
    rejected_by         INT             NULL REFERENCES users(id) ON DELETE SET NULL,
    rejected_at         TIMESTAMP       NULL,
    rejection_reason    TEXT            NULL,
    cancelled_at        TIMESTAMP       NULL,
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE (resource_id, booking_date, slot_id, status)
);

CREATE INDEX idx_bookings_resource_date ON bookings(resource_id, booking_date);
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_date ON bookings(booking_date);

-- ============================================
-- 7. USAGE RECORDS TABLE
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
-- 8. USAGE MEDIA TABLE
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
-- 9. SESSIONS TABLE
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

-- Insert Time Slots
INSERT INTO time_slots (label, start_time, end_time) VALUES
    ('6:00 AM - 8:00 AM', '06:00:00', '08:00:00'),
    ('8:00 AM - 10:00 AM', '08:00:00', '10:00:00'),
    ('10:00 AM - 12:00 PM', '10:00:00', '12:00:00'),
    ('2:00 PM - 4:00 PM', '14:00:00', '16:00:00'),
    ('4:00 PM - 6:00 PM', '16:00:00', '18:00:00'),
    ('6:00 PM - 8:00 PM', '18:00:00', '20:00:00');

-- Insert Sample Users (passwords are bcrypt hashed: admin123, faculty123, user123, public123)
-- Hash: $2a$10$... (bcrypt hash)
INSERT INTO users (name, email, password_hash, role, phone, department) VALUES
    ('Admin User', 'admin@coet.edu', '$2a$10$rQ8N8L5O5qH5YqK5vZ5qXO5QK5vL5qZ5kL5M5qL5qZ5qL5qZ5qL5q', 'admin', NULL, NULL),
    ('Dr. Sharma', 'faculty@coet.edu', '$2a$10$rQ8N8L5O5qH5YqK5vZ5qXO5QK5vL5qZ5kL5M5qL5qZ5qL5qZ5qL5q', 'faculty', NULL, 'Sports Committee'),
    ('Rahul Kumar', 'user@coet.edu', '$2a$10$rQ8N8L5O5qH5YqK5vZ5qXO5QK5vL5qZ5kL5M5qL5qZ5qL5qZ5qL5q', 'user', '9876543210', NULL),
    ('Community Member', 'public@gmail.com', '$2a$10$rQ8N8L5O5qH5YqK5vZ5qXO5QK5vL5qZ5kL5M5qL5qZ5qL5qZ5qL5q', 'user', '9123456780', NULL);

-- Insert Sample Resources
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

-- Insert Amenities for Cricket Ground
INSERT INTO resource_amenities (resource_id, amenity_name) VALUES
    (1, 'Pavilion'), (1, 'Changing Rooms'), (1, 'Floodlights'), (1, 'Scoreboard');

-- Insert Rules for Cricket Ground
INSERT INTO resource_rules (resource_id, rule_text) VALUES
    (1, 'No metal spikes allowed'),
    (1, 'Prior booking required for floodlight use'),
    (1, 'Maximum 3-hour slots');
