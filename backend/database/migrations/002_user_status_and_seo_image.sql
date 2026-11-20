-- Account status for activate / deactivate / block (keeps is_active for existing queries).
ALTER TABLE users
  ADD COLUMN status ENUM('active', 'inactive', 'blocked') NOT NULL DEFAULT 'active' AFTER is_active,
  ADD KEY idx_users_status (status);

UPDATE users
SET status = CASE
  WHEN is_active = TRUE THEN 'active'
  ELSE 'inactive'
END;

-- Optional structured OG image reference; og_image_url remains for external URLs.
ALTER TABLE seo_metadata
  ADD COLUMN og_image_id CHAR(36) NULL AFTER og_image_url,
  ADD KEY idx_seo_og_image (og_image_id);

ALTER TABLE seo_metadata
  ADD CONSTRAINT fk_seo_og_image FOREIGN KEY (og_image_id)
    REFERENCES images (id) ON DELETE SET NULL;
