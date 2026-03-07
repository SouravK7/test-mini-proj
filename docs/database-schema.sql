-- =============================================
-- COET Ground Booking System - Database Schema
-- Version: 1.2
-- Database: PostgreSQL
-- Last Updated: 2026-03-08
-- =============================================

-- ============================================
-- 1. USERS TABLE
-- ============================================
-- Stores all user information with role-based access control
-- Roles: 'admin', 'faculty', 'user'

CREATE TABLE users (
    id              SERIAL          PRIMARY KEY,
    name            VARCHAR(100)    NOT NULL,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    password_hash   VARCHAR(255)    NOT NULL,
    role            VARCHAR(20)     NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'faculty', 'user')),
    phone           VARCHAR(20)     NULL,
    department      VARCHAR(100)    NULL,           -- For faculty members
    avatar_url      VARCHAR(500)    NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    is_verified     BOOLEAN         NOT NULL DEFAULT FALSE,  -- Email verification status
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);


-- ============================================
-- 2. RESOURCES TABLE (Playgrounds/Facilities)
-- ============================================
-- Stores all bookable resources (grounds, courts, etc.)

CREATE TABLE resources (
    id              SERIAL          PRIMARY KEY,
    name            VARCHAR(150)    NOT NULL,
    type            VARCHAR(50)     NOT NULL DEFAULT 'playground',
    sub_type        VARCHAR(50)     NOT NULL,       -- cricket, football, basketball, tennis, athletics
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
-- Stores amenities available for each resource (1:N relationship)

CREATE TABLE resource_amenities (
    id              SERIAL          PRIMARY KEY,
    resource_id     INT             NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    amenity_name    VARCHAR(100)    NOT NULL
);

CREATE INDEX idx_amenities_resource ON resource_amenities(resource_id);


-- ============================================
-- 4. RESOURCE RULES TABLE
-- ============================================
-- Stores usage rules for each resource (1:N relationship)

CREATE TABLE resource_rules (
    id              SERIAL          PRIMARY KEY,
    resource_id     INT             NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    rule_text       VARCHAR(255)    NOT NULL
);

CREATE INDEX idx_rules_resource ON resource_rules(resource_id);


-- ============================================
-- 5. TIME SLOTS TABLE
-- ============================================
-- Stores available booking time slots (system-wide)

CREATE TABLE time_slots (
    id              SERIAL          PRIMARY KEY,
    label           VARCHAR(50)     NOT NULL,       -- e.g., "6:00 AM - 8:00 AM"
    start_time      TIME            NOT NULL,
    end_time        TIME            NOT NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_time_slots_active ON time_slots(is_active);


-- ============================================
-- 6. BOOKINGS TABLE
-- ============================================
-- Core booking records linking users to resources and time slots

CREATE TABLE bookings (
    id                  SERIAL          PRIMARY KEY,
    resource_id         INT             NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
    user_id             INT             NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    slot_id             INT             NOT NULL REFERENCES time_slots(id) ON DELETE RESTRICT,
    booking_date        DATE            NOT NULL,
    purpose             TEXT            NOT NULL,
    status              VARCHAR(20)     NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'completed')),
    
    -- Approval tracking
    approved_by         INT             NULL REFERENCES users(id) ON DELETE SET NULL,
    approved_at         TIMESTAMP       NULL,
    
    -- Rejection tracking
    rejected_by         INT             NULL REFERENCES users(id) ON DELETE SET NULL,
    rejected_at         TIMESTAMP       NULL,
    rejection_reason    TEXT            NULL,
    
    -- Cancellation tracking
    cancelled_at        TIMESTAMP       NULL,
    
    -- Timestamps
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
-- Tracks actual usage of booked resources with evidence uploads

CREATE TABLE usage_records (
    id              SERIAL          PRIMARY KEY,
    booking_id      INT             NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    uploaded_by     INT             NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    remarks         TEXT            NULL,
    issues          TEXT            NULL,           -- Any problems reported
    gdrive_link     VARCHAR(1000)   NULL,           -- Google Drive link to evidence/media
    uploaded_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE (booking_id)                             -- One usage record per booking
);

CREATE INDEX idx_usage_booking ON usage_records(booking_id);


-- ============================================
-- 8. USAGE MEDIA TABLE
-- ============================================
-- Stores media files associated with a usage record (optional file attachments)

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
-- 9. EMAIL VERIFICATION TOKENS TABLE
-- ============================================
-- Stores time-limited tokens sent to users for email verification on registration

CREATE TABLE email_verification_tokens (
    id              SERIAL          PRIMARY KEY,
    user_id         INT             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token           VARCHAR(64)     NOT NULL UNIQUE,
    expires_at      TIMESTAMP       NOT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- 10. PASSWORD RESET TOKENS TABLE
-- ============================================
-- Stores time-limited tokens for password reset requests ("forgot password" flow)

CREATE TABLE password_reset_tokens (
    id              SERIAL          PRIMARY KEY,
    user_id         INT             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token           VARCHAR(64)     NOT NULL UNIQUE,
    expires_at      TIMESTAMP       NOT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- 11. SESSIONS TABLE (Optional: For JWT/Token Auth)
-- ============================================
-- Stores user sessions for authentication

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

-- Insert Sample Users (passwords should be hashed in production)
INSERT INTO users (name, email, password_hash, role, phone, department) VALUES
    ('Admin User', 'admin@coet.edu', '$2b$10$hashedpassword1', 'admin', NULL, NULL),
    ('Dr. Sharma', 'faculty@coet.edu', '$2b$10$hashedpassword2', 'faculty', NULL, 'Sports Committee'),
    ('Rahul Kumar', 'user@coet.edu', '$2b$10$hashedpassword3', 'user', '9876543210', NULL),
    ('Community Member', 'public@gmail.com', '$2b$10$hashedpassword4', 'user', '9123456780', NULL);

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



-- ============================================
-- ENTITY RELATIONSHIP SUMMARY
-- ============================================
/*
╔═══════════════════════════════════════════════════════════════════════════════╗
║                           CORE BOOKING SYSTEM                                  ║
╚═══════════════════════════════════════════════════════════════════════════════╝

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     users       │     │   resources     │     │   time_slots    │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │     │ id (PK)         │     │ id (PK)         │
│ name            │     │ name            │     │ label           │
│ email           │     │ type            │     │ start_time      │
│ password_hash   │     │ sub_type        │     │ end_time        │
│ role            │     │ capacity        │     │ is_active       │
│ phone           │     │ location        │     └─────────────────┘
│ department      │     │ description     │              │
│ avatar_url      │     │ image_url       │              │
│ is_active       │     │ status          │              │
│ is_verified  ◄──┼─┐   │ created_at      │              │
│ created_at      │ │   │ updated_at      │              │
│ updated_at      │ │   └─────────────────┘              │
└─────────────────┘ │          │                        │
        │           │          │                        │
        │           │          │         ┌──────────────┴────────────┐
        │           │          │         │                           │
        │           │          ▼         ▼                           │
        │           │  ┌──────────────────┐   ┌──────────────────┐   │
        │           │  │resource_amenities│   │  resource_rules  │   │
        │           │  ├──────────────────┤   ├──────────────────┤   │
        │           │  │ id (PK)          │   │ id (PK)          │   │
        │           │  │ resource_id (FK) │   │ resource_id (FK) │   │
        │           │  │ amenity_name     │   │ rule_text        │   │
        │           │  └──────────────────┘   └──────────────────┘   │
        │           │                                                │
        │           │              ┌─────────────────┐               │
        └──────────►│    bookings  │◄──────────────┘
                    ├─────────────────┤
                    │ id (PK)         │
                    │ resource_id(FK) │──────► resources
                    │ user_id (FK)    │──────► users
                    │ slot_id (FK)    │──────► time_slots
                    │ booking_date    │
                    │ purpose         │
                    │ status          │
                    │ approved_by(FK) │──────► users
                    │ approved_at     │
                    │ rejected_by(FK) │──────► users
                    │ rejected_at     │
                    │ rejection_reason│
                    │ cancelled_at    │
                    │ created_at      │
                    │ updated_at      │
                    └─────────────────┘
                            │
                            │
                            ▼
                    ┌─────────────────┐
                    │  usage_records  │
                    ├─────────────────┤
                    │ id (PK)         │
                    │ booking_id (FK) │──────► bookings (UNIQUE)
                    │ uploaded_by(FK) │──────► users
                    │ remarks         │
                    │ issues          │
                    │ gdrive_link     │
                    │ uploaded_at     │
                    └─────────────────┘
                            │
                            │
                            ▼
                    ┌─────────────────┐
                    │   usage_media   │
                    ├─────────────────┤
                    │ id (PK)         │
                    │usage_record_id  │──────► usage_records
                    │ file_name       │
                    │ file_url        │
                    │ file_type       │
                    │ file_size       │
                    │ uploaded_at     │
                    └─────────────────┘


╔═══════════════════════════════════════════════════════════════════════════════╗
║            AUTHENTICATION (SEPARATE FROM CORE BOOKING SYSTEM)                  ║
╚═══════════════════════════════════════════════════════════════════════════════╝

┌─────────────────┐       ┌──────────────────────────┐
│     users       │       │  email_verification_      │
├─────────────────┤       │       tokens              │
│ id (PK)         │◄──────├──────────────────────────┤
│ ...             │       │ id (PK)                   │
│ is_verified     │       │ user_id (FK)              │
└─────────────────┘       │ token (UNIQUE)            │
        ▲                 │ expires_at                │
        │                 │ created_at                │
        │                 └──────────────────────────┘
        │
        │                 ┌──────────────────────────┐
        │                 │  password_reset_tokens    │
        └─────────────────├──────────────────────────┤
                          │ id (PK)                   │
                          │ user_id (FK)              │
                          │ token (UNIQUE)            │
                          │ expires_at                │
                          │ created_at                │
                          └──────────────────────────┘

                          ┌─────────────────┐
                          │    sessions     │
            ┌─────────────├─────────────────┤
            │             │ id (PK)         │
            ▼             │ user_id (FK)    │
      ┌─────────────────┐ │ token (UNIQUE)  │
      │     users       │ │ expires_at      │
      │ id (PK)         │ │ created_at      │
      │ ...             │ └─────────────────┘
      └─────────────────┘

Note: The sessions table is used for authentication/login tracking.
      email_verification_tokens stores one-time tokens emailed to users
      on registration so they can verify their account (sets is_verified=true).
      password_reset_tokens stores one-time tokens for the "forgot password" flow.
      All token tables use ON DELETE CASCADE to clean up when a user is deleted.
*/
