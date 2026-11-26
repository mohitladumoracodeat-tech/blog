-- Migration 004: Create post_bookmarks table for saved stories
CREATE TABLE IF NOT EXISTS post_bookmarks (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  post_id CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_post_bookmarks_user_post (user_id, post_id),
  KEY idx_post_bookmarks_user_created (user_id, created_at),
  KEY idx_post_bookmarks_post (post_id),
  CONSTRAINT fk_post_bookmarks_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_post_bookmarks_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
