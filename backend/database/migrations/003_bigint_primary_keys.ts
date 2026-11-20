import type { Connection, RowDataPacket } from "mysql2/promise";
import { logger } from "../../src/config/logger";
import { parseDatabaseUrl } from "../../src/config/mysql";

interface ColumnRow extends RowDataPacket {
  DATA_TYPE: string;
  COLUMN_NAME: string;
}

const ENTITY_TABLES = [
  "users",
  "images",
  "categories",
  "tags",
  "posts",
  "comments",
  "post_views",
  "seo_metadata",
  "contact_messages",
  "auth_sessions",
  "post_reviews",
  "comment_reviews",
  "slug_redirects",
  "password_resets",
] as const;

function quote(identifier: string): string {
  return `\`${identifier.replace(/`/g, "``")}\``;
}

async function columnDataType(
  connection: Connection,
  table: string,
  column: string,
): Promise<string | null> {
  const { database } = parseDatabaseUrl();
  const [rows] = await connection.execute<ColumnRow[]>(
    `SELECT DATA_TYPE, COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [database, table, column],
  );
  return rows[0]?.DATA_TYPE ?? null;
}

async function hasColumn(connection: Connection, table: string, column: string): Promise<boolean> {
  return (await columnDataType(connection, table, column)) !== null;
}

async function createIdMap(connection: Connection, table: string): Promise<void> {
  const mapTable = `_id_map_${table}`;
  await connection.query(`DROP TABLE IF EXISTS ${quote(mapTable)}`);
  await connection.query(`
    CREATE TABLE ${quote(mapTable)} (
      old_id CHAR(36) NOT NULL PRIMARY KEY,
      new_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      UNIQUE KEY uq_new_id (new_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await connection.query(
    `INSERT INTO ${quote(mapTable)} (old_id)
     SELECT id FROM ${quote(table)} ORDER BY id`,
  );
}

async function setAutoIncrement(connection: Connection, table: string): Promise<void> {
  const [rows] = await connection.query<Array<RowDataPacket & { nextId: number | string | null }>>(
    `SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM ${quote(table)}`,
  );
  const nextId = Number(rows[0]?.nextId ?? 1);
  await connection.query(`ALTER TABLE ${quote(table)} AUTO_INCREMENT = ${Number.isFinite(nextId) ? nextId : 1}`);
}

export async function up(connection: Connection): Promise<void> {
  const usersIdType = await columnDataType(connection, "users", "id");
  if (usersIdType === "bigint") {
    logger.info("Primary keys are already BIGINT; skipping UUID remapping");
  } else if (usersIdType === "char") {
    logger.info("Converting CHAR(36) primary keys to BIGINT UNSIGNED while preserving rows");
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");

    for (const table of ENTITY_TABLES) {
      await createIdMap(connection, table);
    }

    await connection.query("DROP TABLE IF EXISTS users__new");
    await connection.query(`
      CREATE TABLE users__new (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        email VARCHAR(254) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
        bio VARCHAR(500) NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        status ENUM('active', 'inactive', 'blocked') NOT NULL DEFAULT 'active',
        deleted_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_users_username (username),
        UNIQUE KEY uq_users_email (email),
        KEY idx_users_role_active (role, is_active),
        KEY idx_users_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    const statusSelect = (await hasColumn(connection, "users", "status"))
      ? "u.status"
      : "CASE WHEN u.is_active = TRUE THEN 'active' ELSE 'inactive' END";
    await connection.query(`
      INSERT INTO users__new
        (id, username, email, password_hash, role, bio, is_active, status, deleted_at, created_at, updated_at)
      SELECT m.new_id, u.username, u.email, u.password_hash, u.role, u.bio, u.is_active,
             ${statusSelect}, u.deleted_at, u.created_at, u.updated_at
      FROM users u
      JOIN _id_map_users m ON m.old_id = u.id
    `);

    await connection.query("DROP TABLE IF EXISTS images__new");
    await connection.query(`
      CREATE TABLE images__new (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL,
        original_file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(1024) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        file_size INT UNSIGNED NOT NULL,
        uploaded_by_id BIGINT UNSIGNED NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        KEY idx_images_uploader_created (uploaded_by_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      INSERT INTO images__new
        (id, file_name, original_file_name, file_path, mime_type, file_size, uploaded_by_id, created_at)
      SELECT mi.new_id, i.file_name, i.original_file_name, i.file_path, i.mime_type, i.file_size,
             mu.new_id, i.created_at
      FROM images i
      JOIN _id_map_images mi ON mi.old_id = i.id
      JOIN _id_map_users mu ON mu.old_id = i.uploaded_by_id
    `);

    await connection.query("DROP TABLE IF EXISTS user_profile_images__new");
    await connection.query(`
      CREATE TABLE user_profile_images__new (
        user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
        image_id BIGINT UNSIGNED NOT NULL,
        UNIQUE KEY uq_user_profile_image (image_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      INSERT INTO user_profile_images__new (user_id, image_id)
      SELECT mu.new_id, mi.new_id
      FROM user_profile_images p
      JOIN _id_map_users mu ON mu.old_id = p.user_id
      JOIN _id_map_images mi ON mi.old_id = p.image_id
    `);

    await connection.query("DROP TABLE IF EXISTS categories__new");
    await connection.query(`
      CREATE TABLE categories__new (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(160) NOT NULL,
        description TEXT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        image_id BIGINT UNSIGNED NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_categories_name (name),
        UNIQUE KEY uq_categories_slug (slug),
        UNIQUE KEY uq_categories_image (image_id),
        KEY idx_categories_active_name (is_active, name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      INSERT INTO categories__new
        (id, name, slug, description, is_active, image_id, created_at, updated_at)
      SELECT mc.new_id, c.name, c.slug, c.description, c.is_active, mi.new_id, c.created_at, c.updated_at
      FROM categories c
      JOIN _id_map_categories mc ON mc.old_id = c.id
      LEFT JOIN _id_map_images mi ON mi.old_id = c.image_id
    `);

    await connection.query("DROP TABLE IF EXISTS tags__new");
    await connection.query(`
      CREATE TABLE tags__new (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(80) NOT NULL,
        slug VARCHAR(140) NOT NULL,
        description TEXT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_tags_name (name),
        UNIQUE KEY uq_tags_slug (slug),
        KEY idx_tags_active_name (is_active, name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      INSERT INTO tags__new (id, name, slug, description, is_active, created_at, updated_at)
      SELECT m.new_id, t.name, t.slug, t.description, t.is_active, t.created_at, t.updated_at
      FROM tags t
      JOIN _id_map_tags m ON m.old_id = t.id
    `);

    await connection.query("DROP TABLE IF EXISTS posts__new");
    await connection.query(`
      CREATE TABLE posts__new (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        author_id BIGINT UNSIGNED NOT NULL,
        category_id BIGINT UNSIGNED NOT NULL,
        featured_image_id BIGINT UNSIGNED NULL,
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
        KEY idx_posts_public (status, published_at),
        KEY idx_posts_author_status_updated (author_id, status, updated_at),
        KEY idx_posts_category_public (category_id, status, published_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      INSERT INTO posts__new
        (id, author_id, category_id, featured_image_id, title, slug, excerpt, content, status,
         submitted_at, reviewed_at, published_at, rejection_reason, deleted_at, created_at, updated_at)
      SELECT mp.new_id, mu.new_id, mc.new_id, mi.new_id, p.title, p.slug, p.excerpt, p.content, p.status,
             p.submitted_at, p.reviewed_at, p.published_at, p.rejection_reason, p.deleted_at, p.created_at, p.updated_at
      FROM posts p
      JOIN _id_map_posts mp ON mp.old_id = p.id
      JOIN _id_map_users mu ON mu.old_id = p.author_id
      JOIN _id_map_categories mc ON mc.old_id = p.category_id
      LEFT JOIN _id_map_images mi ON mi.old_id = p.featured_image_id
    `);

    await connection.query("DROP TABLE IF EXISTS post_tags__new");
    await connection.query(`
      CREATE TABLE post_tags__new (
        post_id BIGINT UNSIGNED NOT NULL,
        tag_id BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (post_id, tag_id),
        KEY idx_post_tags_tag_post (tag_id, post_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      INSERT INTO post_tags__new (post_id, tag_id)
      SELECT mp.new_id, mt.new_id
      FROM post_tags pt
      JOIN _id_map_posts mp ON mp.old_id = pt.post_id
      JOIN _id_map_tags mt ON mt.old_id = pt.tag_id
    `);

    await connection.query("DROP TABLE IF EXISTS post_images__new");
    await connection.query(`
      CREATE TABLE post_images__new (
        post_id BIGINT UNSIGNED NOT NULL,
        image_id BIGINT UNSIGNED NOT NULL,
        position INT NOT NULL DEFAULT 0,
        caption VARCHAR(255) NULL,
        PRIMARY KEY (post_id, image_id),
        KEY idx_post_images_position (post_id, position)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      INSERT INTO post_images__new (post_id, image_id, position, caption)
      SELECT mp.new_id, mi.new_id, pi.position, pi.caption
      FROM post_images pi
      JOIN _id_map_posts mp ON mp.old_id = pi.post_id
      JOIN _id_map_images mi ON mi.old_id = pi.image_id
    `);

    await connection.query("DROP TABLE IF EXISTS comments__new");
    await connection.query(`
      CREATE TABLE comments__new (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        post_id BIGINT UNSIGNED NOT NULL,
        author_id BIGINT UNSIGNED NOT NULL,
        content TEXT NOT NULL,
        status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
        deleted_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        KEY idx_comments_post_status_created (post_id, status, created_at),
        KEY idx_comments_author_created (author_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      INSERT INTO comments__new
        (id, post_id, author_id, content, status, deleted_at, created_at, updated_at)
      SELECT mm.new_id, mp.new_id, mu.new_id, c.content, c.status, c.deleted_at, c.created_at, c.updated_at
      FROM comments c
      JOIN _id_map_comments mm ON mm.old_id = c.id
      JOIN _id_map_posts mp ON mp.old_id = c.post_id
      JOIN _id_map_users mu ON mu.old_id = c.author_id
    `);

    await connection.query("DROP TABLE IF EXISTS post_likes__new");
    await connection.query(`
      CREATE TABLE post_likes__new (
        user_id BIGINT UNSIGNED NOT NULL,
        post_id BIGINT UNSIGNED NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (user_id, post_id),
        KEY idx_post_likes_post_created (post_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      INSERT INTO post_likes__new (user_id, post_id, created_at)
      SELECT mu.new_id, mp.new_id, l.created_at
      FROM post_likes l
      JOIN _id_map_users mu ON mu.old_id = l.user_id
      JOIN _id_map_posts mp ON mp.old_id = l.post_id
    `);

    await connection.query("DROP TABLE IF EXISTS post_views__new");
    await connection.query(`
      CREATE TABLE post_views__new (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        post_id BIGINT UNSIGNED NOT NULL,
        user_id BIGINT UNSIGNED NULL,
        visitor_key VARCHAR(128) NULL,
        viewed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        viewed_on DATE GENERATED ALWAYS AS (DATE(viewed_at)) STORED,
        UNIQUE KEY uq_post_views_daily_visitor (post_id, visitor_key, viewed_on),
        KEY idx_post_views_post_viewed (post_id, viewed_at),
        KEY idx_post_views_user_viewed (user_id, viewed_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      INSERT INTO post_views__new (id, post_id, user_id, visitor_key, viewed_at)
      SELECT mv.new_id, mp.new_id, mu.new_id, v.visitor_key, v.viewed_at
      FROM post_views v
      JOIN _id_map_post_views mv ON mv.old_id = v.id
      JOIN _id_map_posts mp ON mp.old_id = v.post_id
      LEFT JOIN _id_map_users mu ON mu.old_id = v.user_id
    `);

    const hasOgImageId = await hasColumn(connection, "seo_metadata", "og_image_id");
    await connection.query("DROP TABLE IF EXISTS seo_metadata__new");
    await connection.query(`
      CREATE TABLE seo_metadata__new (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        post_id BIGINT UNSIGNED NULL,
        category_id BIGINT UNSIGNED NULL,
        tag_id BIGINT UNSIGNED NULL,
        page_key VARCHAR(100) NULL,
        title VARCHAR(200) NULL,
        description VARCHAR(320) NULL,
        keywords VARCHAR(500) NULL,
        canonical_url VARCHAR(2048) NULL,
        og_title VARCHAR(200) NULL,
        og_description VARCHAR(320) NULL,
        og_image_url VARCHAR(2048) NULL,
        og_image_id BIGINT UNSIGNED NULL,
        twitter_title VARCHAR(200) NULL,
        twitter_description VARCHAR(320) NULL,
        twitter_image_url VARCHAR(2048) NULL,
        twitter_image_id BIGINT UNSIGNED NULL,
        robots_index BOOLEAN NOT NULL DEFAULT TRUE,
        robots_follow BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_seo_post (post_id),
        UNIQUE KEY uq_seo_category (category_id),
        UNIQUE KEY uq_seo_tag (tag_id),
        UNIQUE KEY uq_seo_page (page_key),
        KEY idx_seo_og_image (og_image_id),
        KEY idx_seo_twitter_image (twitter_image_id),
        CONSTRAINT chk_seo_single_owner CHECK (
          (post_id IS NOT NULL) + (category_id IS NOT NULL) +
          (tag_id IS NOT NULL) + (page_key IS NOT NULL) = 1
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    const ogSelect = hasOgImageId ? "mog.new_id" : "NULL";
    await connection.query(`
      INSERT INTO seo_metadata__new
        (id, post_id, category_id, tag_id, page_key, title, description, keywords, canonical_url,
         og_title, og_description, og_image_url, og_image_id, twitter_title, twitter_description,
         twitter_image_url, robots_index, robots_follow, created_at, updated_at)
      SELECT ms.new_id, mp.new_id, mc.new_id, mt.new_id, s.page_key, s.title, s.description, s.keywords,
             s.canonical_url, s.og_title, s.og_description, s.og_image_url, ${ogSelect},
             s.twitter_title, s.twitter_description, s.twitter_image_url, s.robots_index, s.robots_follow,
             s.created_at, s.updated_at
      FROM seo_metadata s
      JOIN _id_map_seo_metadata ms ON ms.old_id = s.id
      LEFT JOIN _id_map_posts mp ON mp.old_id = s.post_id
      LEFT JOIN _id_map_categories mc ON mc.old_id = s.category_id
      LEFT JOIN _id_map_tags mt ON mt.old_id = s.tag_id
      ${hasOgImageId ? "LEFT JOIN _id_map_images mog ON mog.old_id = s.og_image_id" : ""}
    `);

    await connection.query("DROP TABLE IF EXISTS contact_messages__new");
    await connection.query(`
      CREATE TABLE contact_messages__new (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        email VARCHAR(254) NOT NULL,
        subject VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        status ENUM('NEW', 'READ', 'RESOLVED') NOT NULL DEFAULT 'NEW',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        KEY idx_contact_status_created (status, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      INSERT INTO contact_messages__new (id, name, email, subject, message, status, created_at, updated_at)
      SELECT m.new_id, c.name, c.email, c.subject, c.message, c.status, c.created_at, c.updated_at
      FROM contact_messages c
      JOIN _id_map_contact_messages m ON m.old_id = c.id
    `);

    await connection.query("DROP TABLE IF EXISTS auth_sessions__new");
    await connection.query(`
      CREATE TABLE auth_sessions__new (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        refresh_token_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME(3) NOT NULL,
        revoked_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_auth_sessions_refresh_hash (refresh_token_hash),
        KEY idx_auth_sessions_user_expiry (user_id, expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      INSERT INTO auth_sessions__new (id, user_id, refresh_token_hash, expires_at, revoked_at, created_at)
      SELECT ms.new_id, mu.new_id, s.refresh_token_hash, s.expires_at, s.revoked_at, s.created_at
      FROM auth_sessions s
      JOIN _id_map_auth_sessions ms ON ms.old_id = s.id
      JOIN _id_map_users mu ON mu.old_id = s.user_id
    `);

    await connection.query("DROP TABLE IF EXISTS post_reviews__new");
    await connection.query(`
      CREATE TABLE post_reviews__new (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        post_id BIGINT UNSIGNED NOT NULL,
        reviewer_id BIGINT UNSIGNED NOT NULL,
        decision ENUM('APPROVED', 'REJECTED') NOT NULL,
        reason VARCHAR(1000) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        KEY idx_post_reviews_post_created (post_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      INSERT INTO post_reviews__new (id, post_id, reviewer_id, decision, reason, created_at)
      SELECT mr.new_id, mp.new_id, mu.new_id, r.decision, r.reason, r.created_at
      FROM post_reviews r
      JOIN _id_map_post_reviews mr ON mr.old_id = r.id
      JOIN _id_map_posts mp ON mp.old_id = r.post_id
      JOIN _id_map_users mu ON mu.old_id = r.reviewer_id
    `);

    await connection.query("DROP TABLE IF EXISTS comment_reviews__new");
    await connection.query(`
      CREATE TABLE comment_reviews__new (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        comment_id BIGINT UNSIGNED NOT NULL,
        reviewer_id BIGINT UNSIGNED NOT NULL,
        decision ENUM('APPROVED', 'REJECTED') NOT NULL,
        reason VARCHAR(1000) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        KEY idx_comment_reviews_comment_created (comment_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      INSERT INTO comment_reviews__new (id, comment_id, reviewer_id, decision, reason, created_at)
      SELECT mr.new_id, mc.new_id, mu.new_id, r.decision, r.reason, r.created_at
      FROM comment_reviews r
      JOIN _id_map_comment_reviews mr ON mr.old_id = r.id
      JOIN _id_map_comments mc ON mc.old_id = r.comment_id
      JOIN _id_map_users mu ON mu.old_id = r.reviewer_id
    `);

    await connection.query("DROP TABLE IF EXISTS slug_redirects__new");
    await connection.query(`
      CREATE TABLE slug_redirects__new (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        entity_type ENUM('POST', 'CATEGORY', 'TAG') NOT NULL,
        old_slug VARCHAR(220) NOT NULL,
        new_slug VARCHAR(220) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_slug_redirect_source (entity_type, old_slug),
        KEY idx_slug_redirect_target (entity_type, new_slug)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      INSERT INTO slug_redirects__new (id, entity_type, old_slug, new_slug, created_at)
      SELECT m.new_id, s.entity_type, s.old_slug, s.new_slug, s.created_at
      FROM slug_redirects s
      JOIN _id_map_slug_redirects m ON m.old_id = s.id
    `);

    await connection.query("DROP TABLE IF EXISTS password_resets__new");
    await connection.query(`
      CREATE TABLE password_resets__new (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME(3) NOT NULL,
        used_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_password_resets_token_hash (token_hash),
        KEY idx_password_resets_user_expires (user_id, expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      INSERT INTO password_resets__new (id, user_id, token_hash, expires_at, used_at, created_at)
      SELECT mr.new_id, mu.new_id, p.token_hash, p.expires_at, p.used_at, p.created_at
      FROM password_resets p
      JOIN _id_map_password_resets mr ON mr.old_id = p.id
      JOIN _id_map_users mu ON mu.old_id = p.user_id
    `);

    const dropOrder = [
      "password_resets",
      "comment_reviews",
      "post_reviews",
      "auth_sessions",
      "slug_redirects",
      "seo_metadata",
      "contact_messages",
      "post_views",
      "post_likes",
      "post_images",
      "post_tags",
      "comments",
      "posts",
      "user_profile_images",
      "categories",
      "tags",
      "images",
      "users",
    ];
    for (const table of dropOrder) {
      await connection.query(`DROP TABLE ${quote(table)}`);
    }

    const renames = [
      "users",
      "images",
      "user_profile_images",
      "categories",
      "tags",
      "posts",
      "post_tags",
      "post_images",
      "comments",
      "post_likes",
      "post_views",
      "seo_metadata",
      "contact_messages",
      "auth_sessions",
      "post_reviews",
      "comment_reviews",
      "slug_redirects",
      "password_resets",
    ];
    for (const table of renames) {
      await connection.query(`RENAME TABLE ${quote(`${table}__new`)} TO ${quote(table)}`);
    }

    await connection.query(`
      ALTER TABLE images
        ADD CONSTRAINT fk_images_uploader FOREIGN KEY (uploaded_by_id)
        REFERENCES users (id) ON DELETE RESTRICT
    `);
    await connection.query(`
      ALTER TABLE user_profile_images
        ADD CONSTRAINT fk_profile_images_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE,
        ADD CONSTRAINT fk_profile_images_image FOREIGN KEY (image_id)
        REFERENCES images (id) ON DELETE RESTRICT
    `);
    await connection.query(`
      ALTER TABLE categories
        ADD CONSTRAINT fk_categories_image FOREIGN KEY (image_id)
        REFERENCES images (id) ON DELETE SET NULL
    `);
    await connection.query(`
      ALTER TABLE posts
        ADD CONSTRAINT fk_posts_author FOREIGN KEY (author_id)
        REFERENCES users (id) ON DELETE RESTRICT,
        ADD CONSTRAINT fk_posts_category FOREIGN KEY (category_id)
        REFERENCES categories (id) ON DELETE RESTRICT,
        ADD CONSTRAINT fk_posts_featured_image FOREIGN KEY (featured_image_id)
        REFERENCES images (id) ON DELETE SET NULL
    `);
    await connection.query(`
      ALTER TABLE post_tags
        ADD CONSTRAINT fk_post_tags_post FOREIGN KEY (post_id)
        REFERENCES posts (id) ON DELETE CASCADE,
        ADD CONSTRAINT fk_post_tags_tag FOREIGN KEY (tag_id)
        REFERENCES tags (id) ON DELETE CASCADE
    `);
    await connection.query(`
      ALTER TABLE post_images
        ADD CONSTRAINT fk_post_images_post FOREIGN KEY (post_id)
        REFERENCES posts (id) ON DELETE CASCADE,
        ADD CONSTRAINT fk_post_images_image FOREIGN KEY (image_id)
        REFERENCES images (id) ON DELETE CASCADE
    `);
    await connection.query(`
      ALTER TABLE comments
        ADD CONSTRAINT fk_comments_post FOREIGN KEY (post_id)
        REFERENCES posts (id) ON DELETE CASCADE,
        ADD CONSTRAINT fk_comments_author FOREIGN KEY (author_id)
        REFERENCES users (id) ON DELETE RESTRICT
    `);
    await connection.query(`
      ALTER TABLE post_likes
        ADD CONSTRAINT fk_post_likes_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE,
        ADD CONSTRAINT fk_post_likes_post FOREIGN KEY (post_id)
        REFERENCES posts (id) ON DELETE CASCADE
    `);
    await connection.query(`
      ALTER TABLE post_views
        ADD CONSTRAINT fk_post_views_post FOREIGN KEY (post_id)
        REFERENCES posts (id) ON DELETE CASCADE,
        ADD CONSTRAINT fk_post_views_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE SET NULL
    `);
    await connection.query(`
      ALTER TABLE seo_metadata
        ADD CONSTRAINT fk_seo_post FOREIGN KEY (post_id)
        REFERENCES posts (id) ON DELETE CASCADE,
        ADD CONSTRAINT fk_seo_category FOREIGN KEY (category_id)
        REFERENCES categories (id) ON DELETE CASCADE,
        ADD CONSTRAINT fk_seo_tag FOREIGN KEY (tag_id)
        REFERENCES tags (id) ON DELETE CASCADE,
        ADD CONSTRAINT fk_seo_og_image FOREIGN KEY (og_image_id)
        REFERENCES images (id) ON DELETE SET NULL,
        ADD CONSTRAINT fk_seo_twitter_image FOREIGN KEY (twitter_image_id)
        REFERENCES images (id) ON DELETE SET NULL
    `);
    await connection.query(`
      ALTER TABLE auth_sessions
        ADD CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE
    `);
    await connection.query(`
      ALTER TABLE post_reviews
        ADD CONSTRAINT fk_post_reviews_post FOREIGN KEY (post_id)
        REFERENCES posts (id) ON DELETE CASCADE,
        ADD CONSTRAINT fk_post_reviews_reviewer FOREIGN KEY (reviewer_id)
        REFERENCES users (id) ON DELETE RESTRICT
    `);
    await connection.query(`
      ALTER TABLE comment_reviews
        ADD CONSTRAINT fk_comment_reviews_comment FOREIGN KEY (comment_id)
        REFERENCES comments (id) ON DELETE CASCADE,
        ADD CONSTRAINT fk_comment_reviews_reviewer FOREIGN KEY (reviewer_id)
        REFERENCES users (id) ON DELETE RESTRICT
    `);
    await connection.query(`
      ALTER TABLE password_resets
        ADD CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE
    `);

    for (const table of ENTITY_TABLES) {
      await setAutoIncrement(connection, table);
      await connection.query(`DROP TABLE IF EXISTS ${quote(`_id_map_${table}`)}`);
    }

    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    logger.info("UUID primary keys remapped to BIGINT AUTO_INCREMENT");
  } else if (usersIdType) {
    throw new Error(`Unsupported users.id data type: ${usersIdType}`);
  }

  if (!(await hasColumn(connection, "users", "status"))) {
    await connection.query(`
      ALTER TABLE users
        ADD COLUMN status ENUM('active', 'inactive', 'blocked') NOT NULL DEFAULT 'active' AFTER is_active
    `);
    await connection.query(`
      UPDATE users SET status = CASE WHEN is_active = TRUE THEN 'active' ELSE 'inactive' END
    `);
  }

  await connection.query(`
    UPDATE users
    SET is_active = (status = 'active')
    WHERE (status = 'active' AND is_active = FALSE)
       OR (status <> 'active' AND is_active = TRUE)
  `);

  if (!(await hasColumn(connection, "seo_metadata", "og_image_id"))) {
    await connection.query(`
      ALTER TABLE seo_metadata
        ADD COLUMN og_image_id BIGINT UNSIGNED NULL AFTER og_image_url
    `);
  }
  if (!(await hasColumn(connection, "seo_metadata", "twitter_image_id"))) {
    await connection.query(`
      ALTER TABLE seo_metadata
        ADD COLUMN twitter_image_id BIGINT UNSIGNED NULL AFTER twitter_image_url
    `);
  }

  const { database } = parseDatabaseUrl();
  const [twitterFk] = await connection.execute<Array<RowDataPacket & { CONSTRAINT_NAME: string }>>(
    `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'seo_metadata' AND CONSTRAINT_NAME = 'fk_seo_twitter_image'
     LIMIT 1`,
    [database],
  );
  if (!twitterFk[0] && (await hasColumn(connection, "seo_metadata", "twitter_image_id"))) {
    await connection.query(`
      ALTER TABLE seo_metadata
        ADD CONSTRAINT fk_seo_twitter_image FOREIGN KEY (twitter_image_id)
        REFERENCES images (id) ON DELETE SET NULL
    `);
  }
}
