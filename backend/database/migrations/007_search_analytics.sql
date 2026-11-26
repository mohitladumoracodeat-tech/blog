-- =========================================================================
-- Fieldnotes Journal — Migration 007: Search Analytics Subsystem
-- Phase 3B: Privacy-Conscious Search Analytics & Zero-Result Insights
-- =========================================================================

CREATE TABLE IF NOT EXISTS search_analytics (
  id CHAR(36) NOT NULL,
  search_query VARCHAR(160) NOT NULL,
  normalized_query VARCHAR(160) NOT NULL,
  category_scope VARCHAR(160) DEFAULT NULL,
  results_count INT UNSIGNED NOT NULL DEFAULT 0,
  has_results BOOLEAN NOT NULL DEFAULT FALSE,
  user_id CHAR(36) DEFAULT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_search_analytics_normalized (normalized_query),
  KEY idx_search_analytics_has_results (has_results),
  KEY idx_search_analytics_category (category_scope),
  KEY idx_search_analytics_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
