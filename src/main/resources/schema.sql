-- =============================================================================
-- Skopia - Web-Based Video Browsing System Database Schema DDL
-- Compatible with MySQL 8.0+
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    registered_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    account_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
);

-- Inheritance Table: STAFF (Subclass of USER)
CREATE TABLE IF NOT EXISTS staff (
    employee_no BIGINT PRIMARY KEY,
    designation VARCHAR(100) NOT NULL,
    hire_date DATE NOT NULL,
    FOREIGN KEY (employee_no) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Inheritance Table: MARKETING_OFFICER (Subclass of STAFF)
CREATE TABLE IF NOT EXISTS marketing_officers (
    employee_no BIGINT PRIMARY KEY,
    officer_code VARCHAR(50) UNIQUE NOT NULL,
    department VARCHAR(100) NOT NULL,
    FOREIGN KEY (employee_no) REFERENCES staff(employee_no) ON DELETE CASCADE
);

-- Inheritance Table: ADMINISTRATOR (Subclass of STAFF)
CREATE TABLE IF NOT EXISTS administrators (
    employee_no BIGINT PRIMARY KEY,
    admin_level VARCHAR(50) NOT NULL,
    last_login DATETIME,
    FOREIGN KEY (employee_no) REFERENCES staff(employee_no) ON DELETE CASCADE
);

-- Inheritance Table: SUPPORT_OFFICER (Subclass of STAFF)
CREATE TABLE IF NOT EXISTS support_officers (
    employee_no BIGINT PRIMARY KEY,
    support_level VARCHAR(50) NOT NULL,
    shift VARCHAR(50),
    FOREIGN KEY (employee_no) REFERENCES staff(employee_no) ON DELETE CASCADE
);

-- Inheritance Table: VIEWER (Subclass of USER)
CREATE TABLE IF NOT EXISTS viewers (
    viewer_id BIGINT PRIMARY KEY,
    preferred_language VARCHAR(20) DEFAULT 'en',
    device_type VARCHAR(50),
    FOREIGN KEY (viewer_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Inheritance Table: CONTENT_CREATOR (Subclass of VIEWER)
CREATE TABLE IF NOT EXISTS content_creators (
    viewer_id BIGINT PRIMARY KEY,
    channel_name VARCHAR(100) NOT NULL,
    channel_bio TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    total_uploads INT NOT NULL DEFAULT 0,
    FOREIGN KEY (viewer_id) REFERENCES viewers(viewer_id) ON DELETE CASCADE
);

-- Inheritance Table: GUEST_VIEWER (Subclass of VIEWER)
CREATE TABLE IF NOT EXISTS guest_viewers (
    viewer_id BIGINT PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45),
    session_start DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (viewer_id) REFERENCES viewers(viewer_id) ON DELETE CASCADE
);

-- Inheritance Table: REGISTERED_VIEWER (Subclass of VIEWER)
CREATE TABLE IF NOT EXISTS registered_viewers (
    viewer_id BIGINT PRIMARY KEY,
    street VARCHAR(255),
    city VARCHAR(100),
    postal_code VARCHAR(20),
    display_name VARCHAR(100),
    join_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    contact_no VARCHAR(30),
    notify_channel VARCHAR(50) DEFAULT 'EMAIL',
    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (viewer_id) REFERENCES viewers(viewer_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activity_logs (
    log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    actor_user_id BIGINT,
    target_user_id BIGINT,
    detail VARCHAR(500),
    action_type VARCHAR(100) NOT NULL,
    action_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (target_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Access Tiers
CREATE TABLE IF NOT EXISTS access_tiers (
    tier_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tier_name VARCHAR(50) NOT NULL UNIQUE,
    tier_desc VARCHAR(255)
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
    category_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    category_desc VARCHAR(255),
    parent_category_id BIGINT,
    FOREIGN KEY (parent_category_id) REFERENCES categories(category_id) ON DELETE SET NULL
);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
    tag_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tag_name VARCHAR(50) NOT NULL UNIQUE
);

-- Videos
CREATE TABLE IF NOT EXISTS videos (
    video_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    creator_id BIGINT NOT NULL,
    tier_id BIGINT NOT NULL,
    category_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    upload_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    duration INT NOT NULL, -- in seconds
    view_count BIGINT NOT NULL DEFAULT 0,
    resolution VARCHAR(20),
    video_status VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
    video_url VARCHAR(500),
    thumbnail_url VARCHAR(500),
    FOREIGN KEY (creator_id) REFERENCES content_creators(viewer_id) ON DELETE CASCADE,
    FOREIGN KEY (tier_id) REFERENCES access_tiers(tier_id),
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

-- Video Likes
CREATE TABLE IF NOT EXISTS video_likes (
    user_id BIGINT NOT NULL,
    video_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, video_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (video_id) REFERENCES videos(video_id) ON DELETE CASCADE
);

-- Many-to-Many: Video <-> Tag
CREATE TABLE IF NOT EXISTS video_tags (
    video_id BIGINT NOT NULL,
    tag_id BIGINT NOT NULL,
    PRIMARY KEY (video_id, tag_id),
    FOREIGN KEY (video_id) REFERENCES videos(video_id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(tag_id) ON DELETE CASCADE
);

-- Subtitles
CREATE TABLE IF NOT EXISTS subtitles (
    subtitle_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    video_id BIGINT NOT NULL,
    language VARCHAR(50) NOT NULL,
    subtitle_format VARCHAR(20) NOT NULL DEFAULT 'VTT',
    subtitle_url VARCHAR(500) NOT NULL,
    FOREIGN KEY (video_id) REFERENCES videos(video_id) ON DELETE CASCADE
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
    comment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    video_id BIGINT NOT NULL,
    viewer_id BIGINT NOT NULL,
    parent_comment_id BIGINT,
    comment_text TEXT NOT NULL,
    posted_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    comment_status VARCHAR(20) NOT NULL DEFAULT 'VISIBLE',
    FOREIGN KEY (video_id) REFERENCES videos(video_id) ON DELETE CASCADE,
    FOREIGN KEY (viewer_id) REFERENCES registered_viewers(viewer_id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES comments(comment_id) ON DELETE SET NULL
);

-- Watchlists
CREATE TABLE IF NOT EXISTS watchlists (
    watchlist_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    viewer_id BIGINT NOT NULL,
    list_name VARCHAR(100) NOT NULL,
    created_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (viewer_id) REFERENCES registered_viewers(viewer_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS watchlist_items (
    watchlist_id BIGINT NOT NULL,
    video_id BIGINT NOT NULL,
    added_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (watchlist_id, video_id),
    FOREIGN KEY (watchlist_id) REFERENCES watchlists(watchlist_id) ON DELETE CASCADE,
    FOREIGN KEY (video_id) REFERENCES videos(video_id) ON DELETE CASCADE
);

-- Watch History
CREATE TABLE IF NOT EXISTS watch_history (
    viewer_id BIGINT NOT NULL,
    video_id BIGINT NOT NULL,
    watched_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_position INT NOT NULL DEFAULT 0, -- playback offset in seconds
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (viewer_id, video_id),
    FOREIGN KEY (viewer_id) REFERENCES registered_viewers(viewer_id) ON DELETE CASCADE,
    FOREIGN KEY (video_id) REFERENCES videos(video_id) ON DELETE CASCADE
);

-- Recommendations
CREATE TABLE IF NOT EXISTS recommendations (
    rec_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    viewer_id BIGINT NOT NULL,
    video_id BIGINT NOT NULL,
    score DOUBLE NOT NULL DEFAULT 0.0,
    reason VARCHAR(255),
    generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (viewer_id) REFERENCES registered_viewers(viewer_id) ON DELETE CASCADE,
    FOREIGN KEY (video_id) REFERENCES videos(video_id) ON DELETE CASCADE
);

-- Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
    plan_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    plan_name VARCHAR(100) NOT NULL UNIQUE,
    price DECIMAL(10, 2) NOT NULL,
    duration_days INT NOT NULL,
    benefit TEXT
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    subscription_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    viewer_id BIGINT NOT NULL,
    plan_id BIGINT NOT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    sub_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (viewer_id) REFERENCES registered_viewers(viewer_id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(plan_id)
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    payment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    subscription_id BIGINT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    paid_datetime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    pay_method VARCHAR(50) NOT NULL,
    pay_status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    gateway_ref VARCHAR(100),
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(subscription_id) ON DELETE CASCADE
);

-- Receipts
CREATE TABLE IF NOT EXISTS receipts (
    receipt_no BIGINT AUTO_INCREMENT PRIMARY KEY,
    payment_id BIGINT NOT NULL UNIQUE,
    issued_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE CASCADE
);

-- Refunds
CREATE TABLE IF NOT EXISTS refunds (
    refund_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    payment_id BIGINT NOT NULL,
    processed_by BIGINT,
    refund_amount DECIMAL(10, 2) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    refund_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    processed_date DATETIME,
    FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE CASCADE,
    FOREIGN KEY (processed_by) REFERENCES administrators(employee_no) ON DELETE SET NULL
);

-- Reports & Complaints
CREATE TABLE IF NOT EXISTS reports (
    report_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    reporter_id BIGINT NOT NULL,
    video_id BIGINT,
    comment_id BIGINT,
    assigned_to BIGINT,
    report_type VARCHAR(50) NOT NULL,
    report_desc TEXT NOT NULL,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    report_status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    FOREIGN KEY (reporter_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (video_id) REFERENCES videos(video_id) ON DELETE SET NULL,
    FOREIGN KEY (comment_id) REFERENCES comments(comment_id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES support_officers(employee_no) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS report_status_logs (
    seq_no BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_id BIGINT NOT NULL,
    changed_by BIGINT,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note VARCHAR(255),
    FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS complaints (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_id BIGINT NOT NULL,
    reporting_viewer_id BIGINT NOT NULL,
    assigned_officer_id BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    resolution_notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    closed_at DATETIME,
    FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE,
    FOREIGN KEY (reporting_viewer_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_officer_id) REFERENCES support_officers(employee_no) ON DELETE SET NULL
);

-- Notifications & Announcements
CREATE TABLE IF NOT EXISTS notifications (
    notification_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    notif_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS announcements (
    ann_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    published_by BIGINT NOT NULL,
    ann_title VARCHAR(255) NOT NULL,
    ann_body TEXT NOT NULL,
    publish_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    audience VARCHAR(50) NOT NULL DEFAULT 'ALL',
    FOREIGN KEY (published_by) REFERENCES administrators(employee_no) ON DELETE CASCADE
);

-- =============================================================================
-- Advertisement Management (FR5)
--
-- Four columns here are not on the EER diagram, and each earns its place:
--   ad_campaigns.advertiser   the diagram assumed the officer's own department
--                             was the advertiser; the campaign list is
--                             unreadable without naming who a booking runs for.
--   advertisements.ad_status  FR5 asks for Draft / Active / Inactive per
--                             advertisement, which the diagram had only at
--                             campaign level.
--   ad_impressions.clicked_at when a click happened. was_clicked alone gives a
--                             CTR but no click trend.
--   created_at / updated_at   ordinary audit columns.
-- =============================================================================

CREATE TABLE IF NOT EXISTS ad_campaigns (
    campaign_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    created_by BIGINT NOT NULL,
    campaign_name VARCHAR(100) NOT NULL,
    advertiser VARCHAR(150),
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    budget DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    -- DRAFT | SCHEDULED | ACTIVE | PAUSED | EXPIRED | ARCHIVED
    campaign_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES marketing_officers(employee_no) ON DELETE CASCADE,
    -- The serving query filters on status and intersects the window; without
    -- these it is a full scan on every pre-roll.
    INDEX ix_campaign_status (campaign_status),
    INDEX ix_campaign_window (start_date, end_date),
    CONSTRAINT ck_campaign_window CHECK (end_date > start_date)
);

CREATE TABLE IF NOT EXISTS advertisements (
    ad_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    campaign_id BIGINT NOT NULL,
    ad_title VARCHAR(100) NOT NULL,
    media_url VARCHAR(500) NOT NULL,
    ad_type VARCHAR(50) NOT NULL,              -- VIDEO | IMAGE
    ad_duration INT NOT NULL DEFAULT 0,        -- seconds; 0 for a still image
    click_url VARCHAR(500),                    -- NULL means not clickable
    ad_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',  -- DRAFT | ACTIVE | INACTIVE
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES ad_campaigns(campaign_id) ON DELETE CASCADE,
    INDEX ix_ad_campaign (campaign_id),
    INDEX ix_ad_status (ad_status)
);

-- Targeting. Exactly one of video_id and category_id is set: both would be
-- ambiguous about what the placement targets, neither would target everything
-- by accident. MySQL cannot express "exactly one" as a FOREIGN KEY, so the
-- CHECK below is the schema-level half and AdPlacementService is the other.
CREATE TABLE IF NOT EXISTS ad_placements (
    placement_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ad_id BIGINT NOT NULL,
    video_id BIGINT,
    category_id BIGINT,
    slot_position VARCHAR(50) NOT NULL DEFAULT 'PREROLL',  -- PREROLL | MIDROLL | POSTROLL | OVERLAY | LOBBY
    priority INT NOT NULL DEFAULT 1,
    active_from DATETIME NOT NULL,
    active_to DATETIME NOT NULL,
    FOREIGN KEY (ad_id) REFERENCES advertisements(ad_id) ON DELETE CASCADE,
    FOREIGN KEY (video_id) REFERENCES videos(video_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE CASCADE,
    INDEX ix_placement_video (video_id),
    INDEX ix_placement_category (category_id),
    INDEX ix_placement_slot (slot_position),
    CONSTRAINT ck_placement_one_target
        CHECK ((video_id IS NULL) <> (category_id IS NULL)),
    -- The same creative twice in one slot on one title is a double billing.
    UNIQUE KEY uq_placement_video (ad_id, video_id, slot_position),
    UNIQUE KEY uq_placement_category (ad_id, category_id, slot_position)
);

-- Delivery log. A click lives on the impression it belongs to rather than in a
-- table of its own: a click with no preceding impression cannot happen, and
-- keeping them together makes CTR a count over one set of rows.
CREATE TABLE IF NOT EXISTS ad_impressions (
    impression_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    placement_id BIGINT NOT NULL,
    viewer_id BIGINT,                          -- NULL for a signed-out viewer
    -- The title it ran against. Recorded separately from the placement because a
    -- category placement names no title, and "which titles did this campaign run
    -- against?" is a question only this column can answer.
    video_id BIGINT,
    shown_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    was_clicked BOOLEAN NOT NULL DEFAULT FALSE,
    clicked_at DATETIME,
    device_type VARCHAR(50),
    FOREIGN KEY (placement_id) REFERENCES ad_placements(placement_id) ON DELETE CASCADE,
    FOREIGN KEY (viewer_id) REFERENCES registered_viewers(viewer_id) ON DELETE SET NULL,
    FOREIGN KEY (video_id) REFERENCES videos(video_id) ON DELETE SET NULL,
    INDEX ix_impression_placement (placement_id),
    INDEX ix_impression_video (video_id),
    -- Every dashboard query is a range on shown_at.
    INDEX ix_impression_shown_at (shown_at)
);
