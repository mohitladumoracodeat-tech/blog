-- Baseline schema for the Blog Management System.
-- Existing databases that already contain these tables are safe to re-run:
-- every statement uses CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
  bio VARCHAR(500) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_active (role, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS images (
  id CHAR(36) NOT NULL PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  original_file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(1024) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  uploaded_by_id CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_images_uploader FOREIGN KEY (uploaded_by_id)
    REFERENCES users (id) ON DELETE RESTRICT,
  KEY idx_images_uploader_created (uploaded_by_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_profile_images (
  user_id CHAR(36) NOT NULL PRIMARY KEY,
  image_id CHAR(36) NOT NULL,
  UNIQUE KEY uq_user_profile_image (image_id),
  CONSTRAINT fk_profile_images_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_profile_images_image FOREIGN KEY (image_id)
    REFERENCES images (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  image_id CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_categories_name (name),
  UNIQUE KEY uq_categories_slug (slug),
  UNIQUE KEY uq_categories_image (image_id),
  CONSTRAINT fk_categories_image FOREIGN KEY (image_id)
    REFERENCES images (id) ON DELETE SET NULL,
  KEY idx_categories_active_name (is_active, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tags (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  slug VARCHAR(140) NOT NULL,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_tags_name (name),
  UNIQUE KEY uq_tags_slug (slug),
  KEY idx_tags_active_name (is_active, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS posts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  author_id CHAR(36) NOT NULL,
  category_id CHAR(36) NOT NULL,
  featured_image_id CHAR(36) NULL,
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(220) NOT NULL,
  excerpt VARCHAR(500) NULL,
  content MEDIUMTEXT NOT NULL,
  status ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
  submitted_at DATETIME(3) NULL,
  reviewed_at DATETIME(3) NULL,
  published_at DATETIME(3) NULL,
  rejection_reason VARCHAR(1000) NULL,
  deleted_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_posts_slug (slug),
  UNIQUE KEY uq_posts_featured_image (featured_image_id),
  CONSTRAINT fk_posts_author FOREIGN KEY (author_id)
    REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT fk_posts_category FOREIGN KEY (category_id)
    REFERENCES categories (id) ON DELETE RESTRICT,
  CONSTRAINT fk_posts_featured_image FOREIGN KEY (featured_image_id)
    REFERENCES images (id) ON DELETE SET NULL,
  KEY idx_posts_public (status, published_at),
  KEY idx_posts_author_status_updated (author_id, status, updated_at),
  KEY idx_posts_category_public (category_id, status, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_tags (
  post_id CHAR(36) NOT NULL,
  tag_id CHAR(36) NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  CONSTRAINT fk_post_tags_post FOREIGN KEY (post_id)
    REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_post_tags_tag FOREIGN KEY (tag_id)
    REFERENCES tags (id) ON DELETE CASCADE,
  KEY idx_post_tags_tag_post (tag_id, post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_images (
  post_id CHAR(36) NOT NULL,
  image_id CHAR(36) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  caption VARCHAR(255) NULL,
  PRIMARY KEY (post_id, image_id),
  CONSTRAINT fk_post_images_post FOREIGN KEY (post_id)
    REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_post_images_image FOREIGN KEY (image_id)
    REFERENCES images (id) ON DELETE CASCADE,
  KEY idx_post_images_position (post_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  post_id CHAR(36) NOT NULL,
  author_id CHAR(36) NOT NULL,
  content TEXT NOT NULL,
  status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  deleted_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_comments_post FOREIGN KEY (post_id)
    REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_author FOREIGN KEY (author_id)
    REFERENCES users (id) ON DELETE RESTRICT,
  KEY idx_comments_post_status_created (post_id, status, created_at),
  KEY idx_comments_author_created (author_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_likes (
  user_id CHAR(36) NOT NULL,
  post_id CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, post_id),
  CONSTRAINT fk_post_likes_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_post_likes_post FOREIGN KEY (post_id)
    REFERENCES posts (id) ON DELETE CASCADE,
  KEY idx_post_likes_post_created (post_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_views (
  id CHAR(36) NOT NULL PRIMARY KEY,
  post_id CHAR(36) NOT NULL,
  user_id CHAR(36) NULL,
  visitor_key VARCHAR(128) NULL,
  viewed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  viewed_on DATE GENERATED ALWAYS AS (DATE(viewed_at)) STORED,
  CONSTRAINT fk_post_views_post FOREIGN KEY (post_id)
    REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_post_views_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE SET NULL,
  UNIQUE KEY uq_post_views_daily_visitor (post_id, visitor_key, viewed_on),
  KEY idx_post_views_post_viewed (post_id, viewed_at),
  KEY idx_post_views_user_viewed (user_id, viewed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seo_metadata (
  id CHAR(36) NOT NULL PRIMARY KEY,
  post_id CHAR(36) NULL,
  category_id CHAR(36) NULL,
  tag_id CHAR(36) NULL,
  page_key VARCHAR(100) NULL,
  title VARCHAR(200) NULL,
  description VARCHAR(320) NULL,
  keywords VARCHAR(500) NULL,
  canonical_url VARCHAR(2048) NULL,
  og_title VARCHAR(200) NULL,
  og_description VARCHAR(320) NULL,
  og_image_url VARCHAR(2048) NULL,
  twitter_title VARCHAR(200) NULL,
  twitter_description VARCHAR(320) NULL,
  twitter_image_url VARCHAR(2048) NULL,
  robots_index BOOLEAN NOT NULL DEFAULT TRUE,
  robots_follow BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_seo_post (post_id),
  UNIQUE KEY uq_seo_category (category_id),
  UNIQUE KEY uq_seo_tag (tag_id),
  UNIQUE KEY uq_seo_page (page_key),
  CONSTRAINT fk_seo_post FOREIGN KEY (post_id)
    REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_seo_category FOREIGN KEY (category_id)
    REFERENCES categories (id) ON DELETE CASCADE,
  CONSTRAINT fk_seo_tag FOREIGN KEY (tag_id)
    REFERENCES tags (id) ON DELETE CASCADE,
  CONSTRAINT chk_seo_single_owner CHECK (
    (post_id IS NOT NULL) + (category_id IS NOT NULL) +
    (tag_id IS NOT NULL) + (page_key IS NOT NULL) = 1
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_messages (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  status ENUM('NEW', 'READ', 'RESOLVED') NOT NULL DEFAULT 'NEW',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_contact_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_settings (
  `key` VARCHAR(100) NOT NULL PRIMARY KEY,
  `value` TEXT NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  refresh_token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_auth_sessions_refresh_hash (refresh_token_hash),
  CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  KEY idx_auth_sessions_user_expiry (user_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_reviews (
  id CHAR(36) NOT NULL PRIMARY KEY,
  post_id CHAR(36) NOT NULL,
  reviewer_id CHAR(36) NOT NULL,
  decision ENUM('APPROVED', 'REJECTED') NOT NULL,
  reason VARCHAR(1000) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_post_reviews_post FOREIGN KEY (post_id)
    REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_post_reviews_reviewer FOREIGN KEY (reviewer_id)
    REFERENCES users (id) ON DELETE RESTRICT,
  KEY idx_post_reviews_post_created (post_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS slug_redirects (
  id CHAR(36) NOT NULL PRIMARY KEY,
  entity_type ENUM('POST', 'CATEGORY', 'TAG') NOT NULL,
  old_slug VARCHAR(220) NOT NULL,
  new_slug VARCHAR(220) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_slug_redirect_source (entity_type, old_slug),
  KEY idx_slug_redirect_target (entity_type, new_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comment_reviews (
  id CHAR(36) NOT NULL PRIMARY KEY,
  comment_id CHAR(36) NOT NULL,
  reviewer_id CHAR(36) NOT NULL,
  decision ENUM('APPROVED', 'REJECTED') NOT NULL,
  reason VARCHAR(1000) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_comment_reviews_comment FOREIGN KEY (comment_id)
    REFERENCES comments (id) ON DELETE CASCADE,
  CONSTRAINT fk_comment_reviews_reviewer FOREIGN KEY (reviewer_id)
    REFERENCES users (id) ON DELETE RESTRICT,
  KEY idx_comment_reviews_comment_created (comment_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_password_resets_token_hash (token_hash),
  CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  KEY idx_password_resets_user_expires (user_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

