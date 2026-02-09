-- =============================================
-- COET Ground Booking System - Database Schema
-- Version: 1.0
-- Database: MySQL / PostgreSQL Compatible
-- =============================================

-- ============================================
-- 1. USERS TABLE
-- ============================================
-- Stores all user information with role-based access control
-- Roles: 'admin', 'faculty', 'user'

CREATE TABLE users (
    id              INT             PRIMARY KEY AUTO_INCREMENT,
    name            VARCHAR(100)    NOT NULL,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    password_hash   VARCHAR(255)    NOT NULL,
    role            ENUM('admin', 'faculty', 'user') NOT NULL DEFAULT 'user',
    phone           VARCHAR(20)     NULL,
    department      VARCHAR(100)    NULL,           -- For faculty members
    avatar_url      VARCHAR(500)    NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_users_email (email),
    INDEX idx_users_role (role)
);


-- ============================================
-- 2. RESOURCES TABLE (Playgrounds/Facilities)
-- ============================================
-- Stores all bookable resources (grounds, courts, etc.)

CREATE TABLE resources (
    id              INT             PRIMARY KEY AUTO_INCREMENT,
    name            VARCHAR(150)    NOT NULL,
    type            VARCHAR(50)     NOT NULL DEFAULT 'playground',
    sub_type        VARCHAR(50)     NOT NULL,       -- cricket, football, basketball, tennis, athletics
    capacity        INT             NOT NULL DEFAULT 0,
    location        VARCHAR(200)    NOT NULL,
    description     TEXT            NULL,
    image_url       VARCHAR(500)    NULL,
    status          ENUM('available', 'maintenance', 'unavailable') NOT NULL DEFAULT 'available',
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_resources_status (status),
    INDEX idx_resources_sub_type (sub_type)
);


-- ============================================
-- 3. RESOURCE AMENITIES TABLE
-- ============================================
-- Stores amenities available for each resource (1:N relationship)

CREATE TABLE resource_amenities (
    id              INT             PRIMARY KEY AUTO_INCREMENT,
    resource_id     INT             NOT NULL,
    amenity_name    VARCHAR(100)    NOT NULL,
    
    FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
    INDEX idx_amenities_resource (resource_id)
);


-- ============================================
-- 4. RESOURCE RULES TABLE
-- ============================================
-- Stores usage rules for each resource (1:N relationship)

CREATE TABLE resource_rules (
    id              INT             PRIMARY KEY AUTO_INCREMENT,
    resource_id     INT             NOT NULL,
    rule_text       VARCHAR(255)    NOT NULL,
    
    FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
    INDEX idx_rules_resource (resource_id)
);


-- ============================================
-- 5. TIME SLOTS TABLE
-- ============================================
-- Stores available booking time slots (system-wide)

CREATE TABLE time_slots (
    id              INT             PRIMARY KEY AUTO_INCREMENT,
    label           VARCHAR(50)     NOT NULL,       -- e.g., "6:00 AM - 8:00 AM"
    start_time      TIME            NOT NULL,
    end_time        TIME            NOT NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    
    INDEX idx_time_slots_active (is_active)
);


-- ============================================
-- 6. BOOKINGS TABLE
-- ============================================
-- Core booking records linking users to resources and time slots

CREATE TABLE bookings (
    id                  INT             PRIMARY KEY AUTO_INCREMENT,
    resource_id         INT             NOT NULL,
    user_id             INT             NOT NULL,
    slot_id             INT             NOT NULL,
    booking_date        DATE            NOT NULL,
    purpose             TEXT            NOT NULL,
    status              ENUM('pending', 'approved', 'rejected', 'cancelled', 'completed') NOT NULL DEFAULT 'pending',
    
    -- Approval tracking
    approved_by         INT             NULL,
    approved_at         TIMESTAMP       NULL,
    
    -- Rejection tracking
    rejected_by         INT             NULL,
    rejected_at         TIMESTAMP       NULL,
    rejection_reason    TEXT            NULL,
    
    -- Cancellation tracking
    cancelled_at        TIMESTAMP       NULL,
    
    -- Timestamps
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (slot_id) REFERENCES time_slots(id) ON DELETE RESTRICT,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (rejected_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes for common queries
    INDEX idx_bookings_resource_date (resource_id, booking_date),
    INDEX idx_bookings_user (user_id),
    INDEX idx_bookings_status (status),
    INDEX idx_bookings_date (booking_date),
    
    -- Prevent double booking (unique constraint on resource + date + slot for active bookings)
    -- Note: This is enforced at application level for status-based logic
    UNIQUE KEY unique_booking (resource_id, booking_date, slot_id, status)
);


-- ============================================
-- 7. USAGE RECORDS TABLE
-- ============================================
-- Tracks actual usage of booked resources with evidence uploads

CREATE TABLE usage_records (
    id              INT             PRIMARY KEY AUTO_INCREMENT,
    booking_id      INT             NOT NULL,
    uploaded_by     INT             NOT NULL,
    remarks         TEXT            NULL,
    issues          TEXT            NULL,           -- Any problems reported
    uploaded_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT,
    
    INDEX idx_usage_booking (booking_id)
);


-- ============================================
-- 8. USAGE MEDIA TABLE
-- ============================================
-- Stores media files (photos/videos) for usage records (1:N relationship)

CREATE TABLE usage_media (
    id              INT             PRIMARY KEY AUTO_INCREMENT,
    usage_record_id INT             NOT NULL,
    file_name       VARCHAR(255)    NOT NULL,
    file_url        VARCHAR(500)    NOT NULL,
    file_type       ENUM('image', 'video', 'document') NOT NULL DEFAULT 'image',
    file_size       INT             NULL,           -- Size in bytes
    uploaded_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (usage_record_id) REFERENCES usage_records(id) ON DELETE CASCADE,
    INDEX idx_media_usage_record (usage_record_id)
);


-- ============================================
-- 9. SESSIONS TABLE (Optional: For JWT/Token Auth)
-- ============================================
-- Stores user sessions for authentication

CREATE TABLE sessions (
    id              INT             PRIMARY KEY AUTO_INCREMENT,
    user_id         INT             NOT NULL,
    token           VARCHAR(500)    NOT NULL UNIQUE,
    expires_at      TIMESTAMP       NOT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sessions_token (token),
    INDEX idx_sessions_user (user_id)
);


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
-- VIEW: Booking Details (Joins for common queries)
-- ============================================

CREATE VIEW v_booking_details AS
SELECT 
    b.id AS booking_id,
    b.booking_date,
    b.purpose,
    b.status,
    b.created_at,
    b.approved_at,
    b.rejected_at,
    b.rejection_reason,
    r.id AS resource_id,
    r.name AS resource_name,
    r.location AS resource_location,
    r.sub_type AS resource_type,
    u.id AS user_id,
    u.name AS user_name,
    u.email AS user_email,
    u.role AS user_role,
    ts.id AS slot_id,
    ts.label AS slot_label,
    ts.start_time,
    ts.end_time,
    approver.name AS approved_by_name,
    rejecter.name AS rejected_by_name
FROM bookings b
JOIN resources r ON b.resource_id = r.id
JOIN users u ON b.user_id = u.id
JOIN time_slots ts ON b.slot_id = ts.id
LEFT JOIN users approver ON b.approved_by = approver.id
LEFT JOIN users rejecter ON b.rejected_by = rejecter.id;


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
│ created_at      │     │ created_at      │              │
│ updated_at      │     │ updated_at      │              │
└─────────────────┘     └─────────────────┘              │
        │                       │                        │
        │                       │                        │
        │         ┌─────────────┴─────────────┐          │
        │         │                           │          │
        │         ▼                           ▼          │
        │  ┌──────────────────┐   ┌──────────────────┐   │
        │  │resource_amenities│   │  resource_rules  │   │
        │  ├──────────────────┤   ├──────────────────┤   │
        │  │ id (PK)          │   │ id (PK)          │   │
        │  │ resource_id (FK) │   │ resource_id (FK) │   │
        │  │ amenity_name     │   │ rule_text        │   │
        │  └──────────────────┘   └──────────────────┘   │
        │                                                │
        │              ┌─────────────────┐               │
        └─────────────►│    bookings     │◄──────────────┘
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
                       │ booking_id (FK) │──────► bookings
                       │ uploaded_by(FK) │──────► users
                       │ remarks         │
                       │ issues          │
                       │ uploaded_at     │
                       └─────────────────┘
                               │
                               │
                               ▼
                       ┌─────────────────┐
                       │   usage_media   │
                       ├─────────────────┤
                       │ id (PK)         │
                       │ usage_rec_id(FK)│──────► usage_records
                       │ file_name       │
                       │ file_url        │
                       │ file_type       │
                       │ file_size       │
                       │ uploaded_at     │
                       └─────────────────┘


╔═══════════════════════════════════════════════════════════════════════════════╗
║            AUTHENTICATION (SEPARATE FROM CORE BOOKING SYSTEM)                  ║
╚═══════════════════════════════════════════════════════════════════════════════╝

┌─────────────────┐              ┌─────────────────┐
│     users       │              │    sessions     │
├─────────────────┤              ├─────────────────┤
│ id (PK)         │◄─────────────│ user_id (FK)    │
│ ...             │              │ id (PK)         │
└─────────────────┘              │ token           │
                                 │ expires_at      │
                                 │ created_at      │
                                 └─────────────────┘

Note: The sessions table is used for authentication/login tracking.
      It is separate from the core booking workflow and is optional
      if using stateless JWT tokens without server-side validation.
*/

