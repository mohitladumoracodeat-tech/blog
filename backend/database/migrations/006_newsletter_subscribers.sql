-- =========================================================================
-- Fieldnotes Journal — Migration 006: Newsletter Subscription System
-- Phase 2C: Newsletter Subscribers & Admin Management
-- =========================================================================

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  status ENUM('PENDING', 'SUBSCRIBED', 'UNSUBSCRIBED') NOT NULL DEFAULT 'PENDING',
  verification_token_hash CHAR(64) DEFAULT NULL,
  verification_expires_at DATETIME(3) DEFAULT NULL,
  unsubscribe_token_hash CHAR(64) NOT NULL,
  subscribed_at DATETIME(3) DEFAULT NULL,
  unsubscribed_at DATETIME(3) DEFAULT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_newsletter_subscribers_email (email),
  KEY idx_newsletter_subscribers_status (status),
  KEY idx_newsletter_subscribers_verification (verification_token_hash),
  KEY idx_newsletter_subscribers_unsubscribe (unsubscribe_token_hash),
  KEY idx_newsletter_subscribers_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
