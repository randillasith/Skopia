CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(60) NOT NULL UNIQUE,
    email VARCHAR(254) NULL UNIQUE,
    password_hash VARCHAR(255) NULL,
    display_name VARCHAR(100) NOT NULL,
    role ENUM('VIEWER','CREATOR') NOT NULL DEFAULT 'VIEWER',
    avatar_url VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
    category_id INT PRIMARY KEY AUTO_INCREMENT,
    category_name VARCHAR(80) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS videos (
    video_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    creator_id BIGINT NOT NULL,
    category_id INT NOT NULL,
    title VARCHAR(180) NOT NULL,
    description TEXT NOT NULL,
    video_url VARCHAR(700) NOT NULL,
    thumbnail_url VARCHAR(700) NOT NULL,
    duration_seconds INT NOT NULL DEFAULT 0,
    view_count BIGINT NOT NULL DEFAULT 0,
    access_type ENUM('FREE','PREMIUM') NOT NULL DEFAULT 'FREE',
    video_status ENUM('PUBLISHED','DRAFT') NOT NULL DEFAULT 'PUBLISHED',
    upload_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_video_creator FOREIGN KEY (creator_id) REFERENCES users(user_id),
    CONSTRAINT fk_video_category FOREIGN KEY (category_id) REFERENCES categories(category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS video_likes (
    user_id BIGINT NOT NULL,
    video_id BIGINT NOT NULL,
    liked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, video_id),
    CONSTRAINT fk_like_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_like_video FOREIGN KEY (video_id) REFERENCES videos(video_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS comments (
    comment_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    video_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    parent_comment_id BIGINT NULL,
    comment_text VARCHAR(1000) NOT NULL,
    posted_datetime TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    comment_status ENUM('VISIBLE','DELETED') NOT NULL DEFAULT 'VISIBLE',
    CONSTRAINT fk_comment_video FOREIGN KEY (video_id) REFERENCES videos(video_id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_parent FOREIGN KEY (parent_comment_id) REFERENCES comments(comment_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS watchlists (
    watchlist_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL UNIQUE,
    list_name VARCHAR(100) NOT NULL DEFAULT 'My Watchlist',
    created_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_watchlist_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS watchlist_items (
    watchlist_id BIGINT NOT NULL,
    video_id BIGINT NOT NULL,
    added_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (watchlist_id, video_id),
    CONSTRAINT fk_watchitem_list FOREIGN KEY (watchlist_id) REFERENCES watchlists(watchlist_id) ON DELETE CASCADE,
    CONSTRAINT fk_watchitem_video FOREIGN KEY (video_id) REFERENCES videos(video_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS watch_history (
    user_id BIGINT NOT NULL,
    video_id BIGINT NOT NULL,
    last_position INT NOT NULL DEFAULT 0,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    watched_datetime TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, video_id),
    CONSTRAINT fk_history_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_history_video FOREIGN KEY (video_id) REFERENCES videos(video_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_subscriptions (
    user_id BIGINT PRIMARY KEY,
    plan_code ENUM('MONTHLY','YEARLY') NOT NULL,
    status ENUM('ACTIVE','CANCELED','EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    current_period_start DATETIME NOT NULL,
    current_period_end DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_subscription_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payments (
    payment_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    provider_reference VARCHAR(80) NOT NULL UNIQUE,
    plan_code ENUM('MONTHLY','YEARLY') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    status ENUM('SUCCEEDED','FAILED','REFUNDED') NOT NULL,
    card_brand VARCHAR(30),
    card_last4 CHAR(4),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO users (user_id, username, display_name, role, avatar_url) VALUES
    (1, 'nethmi.viewer', 'Nethmi Perera', 'VIEWER', 'https://i.pravatar.cc/160?img=47'),
    (2, 'starlight.records', 'Starlight Records', 'CREATOR', 'https://i.pravatar.cc/160?img=12');

INSERT IGNORE INTO categories (category_id, category_name) VALUES
    (1, 'Music'), (2, 'Technology & AI'), (3, 'Education'), (4, 'Travel'), (5, 'Entertainment');

INSERT IGNORE INTO videos
    (video_id, creator_id, category_id, title, description, video_url, thumbnail_url, duration_seconds, view_count, access_type, video_status)
VALUES
    (1, 2, 1, 'Acoustic Sessions 2026: Live from Colombo',
     'An intimate live performance featuring original melodies and a behind-the-scenes look at the recording session.',
     'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
     'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1400&q=85', 900, 48231, 'FREE', 'PUBLISHED'),
    (2, 2, 2, 'Building Responsible AI Products',
     'A practical introduction to designing useful, transparent, and responsible AI experiences.',
     'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
     'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1400&q=85', 596, 18740, 'FREE', 'PUBLISHED'),
    (3, 2, 3, 'Study Smarter: A Deep Work Guide',
     'Simple, research-informed techniques for focused study sessions and better recall.',
     'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
     'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1400&q=85', 653, 12506, 'FREE', 'PUBLISHED'),
    (4, 2, 4, 'Hidden Coastlines of Sri Lanka',
     'A cinematic trip through quiet beaches, fishing villages, and dramatic southern coastlines.',
     'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
     'https://images.unsplash.com/photo-1588598198321-9735fd52455b?auto=format&fit=crop&w=1400&q=85', 735, 32900, 'FREE', 'PUBLISHED');

INSERT IGNORE INTO videos
    (video_id, creator_id, category_id, title, description, video_url, thumbnail_url, duration_seconds, view_count, access_type, video_status)
VALUES
    (5, 2, 5, 'The Art of Visual Storytelling',
     'A premium masterclass on composition, pacing, light, and building memorable stories for the screen.',
     'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
     'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1400&q=85', 1280, 8640, 'PREMIUM', 'PUBLISHED');

INSERT IGNORE INTO watchlists (watchlist_id, user_id, list_name) VALUES (1, 1, 'My Watchlist');
INSERT IGNORE INTO watchlist_items (watchlist_id, video_id) VALUES (1, 3);
INSERT IGNORE INTO watch_history (user_id, video_id, last_position, is_completed) VALUES (1, 2, 212, FALSE);
INSERT IGNORE INTO video_likes (user_id, video_id) VALUES (1, 1);
INSERT IGNORE INTO comments (comment_id, video_id, user_id, comment_text) VALUES
    (1, 1, 1, 'The sound and camera work are excellent. More sessions like this, please!');
