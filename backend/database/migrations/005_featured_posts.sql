-- =========================================================================
-- Fieldnotes Journal — Migration 005: Featured Stories Curation
-- Phase 2A: Admin-managed Featured Stories
-- =========================================================================

ALTER TABLE posts
  ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0 AFTER status,
  ADD COLUMN featured_order INT NOT NULL DEFAULT 0 AFTER is_featured,
  ADD KEY idx_posts_featured (is_featured, status, published_at);
