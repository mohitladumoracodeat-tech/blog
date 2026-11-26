import { createHash, randomUUID } from "node:crypto";
import { Router, type Request, type Response, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { z } from "zod";
import { authenticate, optionalAuthenticate } from "../middleware/authenticate";
import { pool } from "../config/mysql";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { AppError } from "../errors/app-error";
import { dateRangeSchema, formatPagination, paginationOffset, paginationSchema, parseOrThrow } from "../utils/request-validation";
import {
  generateVerificationToken,
  generateUnsubscribeToken,
  hashToken,
  maskEmail,
  sendNewsletterVerificationEmail,
} from "../services/newsletterEmail.service";
import { sendNewsletterWelcomeEmail } from "../services/email.service";
import { translationService } from "../services/translation/translation.service";
import { TranslationError } from "../services/translation/types";

interface CountRow extends RowDataPacket {
  total: number;
}

const slugSchema = z.string().trim().min(1).max(220);
const uuidSchema = z.string().uuid();

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function requestVisitorKey(request: Request): string {
  return createHash("sha256")
    .update(`${request.ip}|${request.get("user-agent") ?? "unknown"}`)
    .digest("hex");
}

export const publicRouter = Router();

const commentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

/* =========================================================================
   1. HOMEPAGE FEED (Featured Stories & Smart Trending Engine — Phase 2A)
   ========================================================================= */
publicRouter.get("/homepage", async (_request, response) => {
  // 1. Curated Featured Stories (Admin-managed with published date fallback)
  let [featuredPosts] = await pool.query<RowDataPacket[]>(
    `SELECT p.id, p.title, p.slug, p.excerpt, p.published_at AS publishedAt,
            p.is_featured AS isFeatured, p.featured_order AS featuredOrder,
            u.username AS author, upi_img.file_path AS authorProfileImagePath,
            c.name AS category, c.slug AS categorySlug,
            i.file_path AS featuredImagePath,
            (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likeCount,
            (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.status = 'APPROVED' AND cm.deleted_at IS NULL) AS commentCount
     FROM posts p
     JOIN users u ON u.id = p.author_id
     LEFT JOIN user_profile_images upi ON upi.user_id = u.id
     LEFT JOIN images upi_img ON upi_img.id = upi.image_id
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN images i ON i.id = p.featured_image_id
     WHERE p.is_featured = 1 AND p.status = 'APPROVED' AND p.deleted_at IS NULL
       AND p.published_at IS NOT NULL AND c.is_active = TRUE
     ORDER BY p.featured_order ASC, p.published_at DESC LIMIT 5`,
  );

  // Graceful fallback: if no stories are marked featured, use the latest approved stories
  if (featuredPosts.length === 0) {
    const [fallbackFeatured] = await pool.query<RowDataPacket[]>(
      `SELECT p.id, p.title, p.slug, p.excerpt, p.published_at AS publishedAt,
              p.is_featured AS isFeatured, p.featured_order AS featuredOrder,
              u.username AS author, upi_img.file_path AS authorProfileImagePath,
              c.name AS category, c.slug AS categorySlug,
              i.file_path AS featuredImagePath,
              (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likeCount,
              (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.status = 'APPROVED' AND cm.deleted_at IS NULL) AS commentCount
       FROM posts p
       JOIN users u ON u.id = p.author_id
       LEFT JOIN user_profile_images upi ON upi.user_id = u.id
       LEFT JOIN images upi_img ON upi_img.id = upi.image_id
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN images i ON i.id = p.featured_image_id
       WHERE p.status = 'APPROVED' AND p.deleted_at IS NULL
         AND p.published_at IS NOT NULL AND c.is_active = TRUE
       ORDER BY p.published_at DESC LIMIT 5`,
    );
    featuredPosts = fallbackFeatured;
  }

  // 2. Smart Trending Stories (Time-Decay Engagement Model)
  // Score = (V_7d * 1.0 + L * 4.0 + C * 8.0) / (T + 2)^1.4
  // Exclude featured stories to avoid duplicate rendering on the homepage
  const featuredIds = featuredPosts.map((p) => p.id);
  const excludeFeaturedClause = featuredIds.length > 0
    ? `AND p.id NOT IN (${featuredIds.map(() => "?").join(",")})`
    : "";

  let [trendingPosts] = await pool.query<RowDataPacket[]>(
    `SELECT p.id, p.title, p.slug, p.excerpt, p.published_at AS publishedAt,
            p.is_featured AS isFeatured,
            u.username AS author, upi_img.file_path AS authorProfileImagePath,
            c.name AS category, c.slug AS categorySlug,
            i.file_path AS featuredImagePath,
            (SELECT COUNT(*) FROM post_views pv WHERE pv.post_id = p.id AND pv.viewed_at >= NOW() - INTERVAL 7 DAY) AS views7d,
            (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likeCount,
            (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.status = 'APPROVED' AND cm.deleted_at IS NULL) AS commentCount,
            ROUND(
              (
                (SELECT COUNT(*) FROM post_views pv WHERE pv.post_id = p.id AND pv.viewed_at >= NOW() - INTERVAL 7 DAY) * 1.0 +
                (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) * 4.0 +
                (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.status = 'APPROVED' AND cm.deleted_at IS NULL) * 8.0
              ) / POW(GREATEST(TIMESTAMPDIFF(HOUR, p.published_at, NOW()) / 24.0, 0) + 2, 1.4),
              4
            ) AS trendingScore
     FROM posts p
     JOIN users u ON u.id = p.author_id
     LEFT JOIN user_profile_images upi ON upi.user_id = u.id
     LEFT JOIN images upi_img ON upi_img.id = upi.image_id
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN images i ON i.id = p.featured_image_id
     WHERE p.status = 'APPROVED' AND p.deleted_at IS NULL
       AND p.published_at IS NOT NULL AND c.is_active = TRUE
       ${excludeFeaturedClause}
     ORDER BY trendingScore DESC, p.published_at DESC LIMIT 6`,
    featuredIds,
  );

  // If excluding featured posts leaves fewer than 3 trending items, query without exclusion
  if (trendingPosts.length < 3) {
    const [allTrending] = await pool.query<RowDataPacket[]>(
      `SELECT p.id, p.title, p.slug, p.excerpt, p.published_at AS publishedAt,
              p.is_featured AS isFeatured,
              u.username AS author, upi_img.file_path AS authorProfileImagePath,
              c.name AS category, c.slug AS categorySlug,
              i.file_path AS featuredImagePath,
              (SELECT COUNT(*) FROM post_views pv WHERE pv.post_id = p.id AND pv.viewed_at >= NOW() - INTERVAL 7 DAY) AS views7d,
              (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likeCount,
              (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.status = 'APPROVED' AND cm.deleted_at IS NULL) AS commentCount,
              ROUND(
                (
                  (SELECT COUNT(*) FROM post_views pv WHERE pv.post_id = p.id AND pv.viewed_at >= NOW() - INTERVAL 7 DAY) * 1.0 +
                  (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) * 4.0 +
                  (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.status = 'APPROVED' AND cm.deleted_at IS NULL) * 8.0
                ) / POW(GREATEST(TIMESTAMPDIFF(HOUR, p.published_at, NOW()) / 24.0, 0) + 2, 1.4),
                4
              ) AS trendingScore
       FROM posts p
       JOIN users u ON u.id = p.author_id
       LEFT JOIN user_profile_images upi ON upi.user_id = u.id
       LEFT JOIN images upi_img ON upi_img.id = upi.image_id
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN images i ON i.id = p.featured_image_id
       WHERE p.status = 'APPROVED' AND p.deleted_at IS NULL
         AND p.published_at IS NOT NULL AND c.is_active = TRUE
       ORDER BY trendingScore DESC, p.published_at DESC LIMIT 6`,
    );
    trendingPosts = allTrending;
  }

  // 3. Latest Published Stories
  const [latestPosts] = await pool.query<RowDataPacket[]>(
    `SELECT p.id, p.title, p.slug, p.excerpt, p.published_at AS publishedAt,
            p.is_featured AS isFeatured,
            u.username AS author, upi_img.file_path AS authorProfileImagePath,
            c.name AS category, c.slug AS categorySlug,
            i.file_path AS featuredImagePath,
            (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likeCount,
            (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.status = 'APPROVED' AND cm.deleted_at IS NULL) AS commentCount
     FROM posts p
     JOIN users u ON u.id = p.author_id
     LEFT JOIN user_profile_images upi ON upi.user_id = u.id
     LEFT JOIN images upi_img ON upi_img.id = upi.image_id
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN images i ON i.id = p.featured_image_id
     WHERE p.status = 'APPROVED' AND p.deleted_at IS NULL
       AND p.published_at IS NOT NULL AND c.is_active = TRUE
     ORDER BY p.published_at DESC LIMIT 9`,
  );
  const [popularPosts] = await pool.query<RowDataPacket[]>(
    `SELECT p.id, p.title, p.slug, p.excerpt, p.published_at AS publishedAt,
            u.username AS author, c.name AS category, c.slug AS categorySlug,
            i.file_path AS featuredImagePath,
            (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likeCount
     FROM posts p
     JOIN users u ON u.id = p.author_id
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN images i ON i.id = p.featured_image_id
     WHERE p.status = 'APPROVED' AND p.deleted_at IS NULL
       AND p.published_at IS NOT NULL AND c.is_active = TRUE
     ORDER BY likeCount DESC, p.published_at DESC LIMIT 6`,
  );
  const [categories] = await pool.query<RowDataPacket[]>(`
    SELECT c.id, c.name, c.slug, c.description, i.file_path AS imagePath, COUNT(p.id) AS postCount
    FROM categories c
    LEFT JOIN images i ON i.id = c.image_id
    LEFT JOIN posts p ON p.category_id = c.id
      AND p.status = 'APPROVED'
      AND p.deleted_at IS NULL
      AND p.published_at IS NOT NULL
    WHERE c.is_active = TRUE
    GROUP BY c.id, i.id
    ORDER BY postCount DESC, c.name
    LIMIT 8
  `);
  const [tags] = await pool.query<RowDataPacket[]>(`
    SELECT t.id, t.name, t.slug, COUNT(pt.post_id) AS postCount
    FROM tags t
    JOIN post_tags pt ON pt.tag_id = t.id
    JOIN posts p ON p.id = pt.post_id
    WHERE t.is_active = TRUE AND p.status = 'APPROVED' AND p.deleted_at IS NULL
      AND p.published_at IS NOT NULL
    GROUP BY t.id HAVING postCount > 0
    ORDER BY postCount DESC, t.name LIMIT 12
  `);
  const [seo] = await pool.execute<RowDataPacket[]>(
    `SELECT title, description, keywords, canonical_url AS canonicalUrl,
            og_title AS ogTitle, og_description AS ogDescription, og_image_url AS ogImageUrl,
            twitter_title AS twitterTitle, twitter_description AS twitterDescription, twitter_image_url AS twitterImageUrl,
            robots_index AS robotsIndex, robots_follow AS robotsFollow
     FROM seo_metadata WHERE page_key = 'home' LIMIT 1`,
  );
  response.status(200).json({
    data: {
      featuredPosts,
      trendingPosts,
      latestPosts,
      popularPosts: trendingPosts,
      categories,
      tags,
      seo: seo[0] ?? null,
    },
  });
});

/* =========================================================================
   2. BLOG LISTING (SEARCH, FILTER BY CATEGORY/TAG, SORT BY LATEST/POPULAR)
   ========================================================================= */

/**
 * Phase 3B: Record search analytics asynchronously without storing sensitive user credentials or IPs.
 */
export async function recordSearchAnalytics(params: {
  searchQuery: string;
  categoryScope?: string | null;
  resultsCount: number;
  userId?: string | null;
}) {
  const clean = params.searchQuery.trim();
  if (!clean || clean.length < 2) return;

  const normalized = clean.toLowerCase().replace(/\s+/g, " ").slice(0, 160);
  const id = randomUUID();
  const hasResults = params.resultsCount > 0;
  const category = params.categoryScope ? params.categoryScope.trim().slice(0, 160) : null;

  try {
    await pool.execute(
      `INSERT INTO search_analytics (id, search_query, normalized_query, category_scope, results_count, has_results, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))`,
      [
        id,
        clean.slice(0, 160),
        normalized,
        category,
        params.resultsCount,
        hasResults ? 1 : 0,
        params.userId || null,
      ],
    );
  } catch (err) {
    // Fail-safe: analytics logging failures must never break search responses
  }
}

publicRouter.get("/posts", async (request, response) => {
  const query = parseOrThrow(
    paginationSchema.merge(dateRangeSchema).extend({
      search: z.string().trim().max(100).default(""),
      q: z.string().trim().max(100).optional(),
      category: z.string().trim().max(160).optional(),
      tag: z.string().trim().max(140).optional(),
      sort: z.enum(["latest", "popular"]).default("latest"),
      autocomplete: z.string().optional(),
    }),
    request.query,
  );
  const searchTerm = query.q ?? query.search;
  const conditions = [
    "p.status = 'APPROVED'",
    "p.deleted_at IS NULL",
    "p.published_at IS NOT NULL",
    "c.is_active = TRUE",
  ];
  const values: Array<string | number> = [];
  if (searchTerm) {
    const pattern = `%${escapeLike(searchTerm)}%`;
    conditions.push("(p.title LIKE ? OR p.excerpt LIKE ? OR p.content LIKE ?)");
    values.push(pattern, pattern, pattern);
  }
  if (query.category) {
    conditions.push("c.slug = ?");
    values.push(query.category);
  }
  if (query.tag) {
    conditions.push(
      "EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id = p.id AND t.slug = ? AND t.is_active = TRUE)",
    );
    values.push(query.tag);
  }
  if (query.startDate) {
    conditions.push("p.published_at >= ?");
    values.push(`${query.startDate} 00:00:00`);
  }
  if (query.endDate) {
    conditions.push("p.published_at <= ?");
    values.push(`${query.endDate} 23:59:59.999`);
  }
  const where = conditions.join(" AND ");
  const orderBy = query.sort === "popular" ? "likeCount DESC, p.published_at DESC" : "p.published_at DESC";

  const [counts] = await pool.execute<CountRow[]>(
    `SELECT COUNT(DISTINCT p.id) AS total
     FROM posts p
     JOIN users u ON u.id = p.author_id
     JOIN categories c ON c.id = p.category_id
     WHERE ${where}`,
    values,
  );
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id, p.title, p.slug, p.excerpt, p.published_at AS publishedAt,
            u.username AS author, upi_img.file_path AS authorProfileImagePath,
            c.id AS categoryId, c.name AS category, c.slug AS categorySlug,
            i.file_path AS featuredImagePath,
            (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likeCount,
            (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.status = 'APPROVED' AND cm.deleted_at IS NULL) AS commentCount
     FROM posts p
     JOIN users u ON u.id = p.author_id
     LEFT JOIN user_profile_images upi ON upi.user_id = u.id
     LEFT JOIN images upi_img ON upi_img.id = upi.image_id
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN images i ON i.id = p.featured_image_id
     WHERE ${where}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...values, query.limit, paginationOffset(query.page, query.limit)],
  );

  const postIds = rows.map((r) => r.id);
  const tagsByPostId: Record<string, Array<{ id: string; name: string; slug: string }>> = {};
  if (postIds.length > 0) {
    const placeholders = postIds.map(() => "?").join(",");
    const [tagRows] = await pool.query<RowDataPacket[]>(
      `SELECT pt.post_id AS postId, t.id, t.name, t.slug
       FROM post_tags pt
       JOIN tags t ON t.id = pt.tag_id
       WHERE pt.post_id IN (${placeholders}) AND t.is_active = TRUE
       ORDER BY t.name`,
      postIds,
    );
    for (const t of tagRows) {
      if (!tagsByPostId[t.postId]) tagsByPostId[t.postId] = [];
      tagsByPostId[t.postId].push({ id: t.id, name: t.name, slug: t.slug });
    }
  }

  const postsWithTags = rows.map((r) => ({
    ...r,
    tags: tagsByPostId[r.id] ?? [],
  }));

  // Phase 3B: Record search analytics asynchronously if this is an actual user search (not an autocomplete probe)
  if (
    searchTerm &&
    searchTerm.trim().length >= 2 &&
    query.autocomplete !== "true" &&
    query.autocomplete !== "1"
  ) {
    const totalResults = Number(counts[0]?.total ?? 0);
    recordSearchAnalytics({
      searchQuery: searchTerm,
      categoryScope: query.category || null,
      resultsCount: totalResults,
      userId: (request as any).user?.id || null,
    }).catch(() => {
      // Ignored: fail-safe
    });
  }

  response.status(200).json({
    data: postsWithTags,
    pagination: formatPagination(query.page, query.limit, counts[0].total),
  });
});

/**
 * Phase 3B: Explicit search event logging endpoint (e.g. for user clicking a suggestion or trending search)
 */
const searchEventRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { message: "Too many search analytics events. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

publicRouter.post(
  "/search-events",
  searchEventRateLimiter,
  optionalAuthenticate,
  async (request, response) => {
    const payload = parseOrThrow(
      z.object({
        query: z.string().trim().min(2).max(160),
        category: z.string().trim().max(160).optional(),
        resultsCount: z.coerce.number().int().min(0).optional(),
      }),
      request.body,
    );

    let resultsCount = payload.resultsCount;
    if (resultsCount === undefined) {
      const pattern = `%${escapeLike(payload.query)}%`;
      const [countRows] = await pool.execute<CountRow[]>(
        `SELECT COUNT(DISTINCT p.id) AS total
         FROM posts p
         JOIN categories c ON c.id = p.category_id
         WHERE p.status = 'APPROVED' AND p.deleted_at IS NULL AND p.published_at IS NOT NULL AND c.is_active = TRUE
           AND (p.title LIKE ? OR p.excerpt LIKE ? OR p.content LIKE ?)
           ${payload.category ? "AND c.slug = ?" : ""}`,
        payload.category ? [pattern, pattern, pattern, payload.category] : [pattern, pattern, pattern],
      );
      resultsCount = Number(countRows[0]?.total ?? 0);
    }

    await recordSearchAnalytics({
      searchQuery: payload.query,
      categoryScope: payload.category || null,
      resultsCount,
      userId: (request as any).user?.id || null,
    });

    response.status(201).json({
      data: { recorded: true },
    });
  },
);

/* =========================================================================
   3. SINGLE BLOG DETAILS (SLUG BASED, WITH LIKES, VIEWS, COMMENTS & SEO)
   ========================================================================= */
publicRouter.get("/posts/:slug", optionalAuthenticate, async (request, response) => {
  const slug = parseOrThrow(slugSchema, request.params.slug);
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id, p.title, p.slug, p.excerpt, p.content,
            p.published_at AS publishedAt, p.created_at AS createdAt,
            u.id AS authorId, u.username AS author, u.bio AS authorBio,
            upi_img.file_path AS authorProfileImagePath,
            c.id AS categoryId, c.name AS categoryName, c.slug AS categorySlug,
            i.file_path AS featuredImagePath,
            seo.title AS seoTitle, seo.description AS seoDescription,
            seo.keywords AS seoKeywords, seo.canonical_url AS canonicalUrl,
            seo.og_title AS ogTitle, seo.og_description AS ogDescription,
            seo.og_image_url AS ogImageUrl, seo.twitter_title AS twitterTitle,
            seo.twitter_description AS twitterDescription, seo.twitter_image_url AS twitterImageUrl,
            seo.robots_index AS robotsIndex, seo.robots_follow AS robotsFollow,
            (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS likeCount,
            (SELECT COUNT(*) FROM post_views WHERE post_id = p.id) AS viewCount
     FROM posts p
     JOIN users u ON u.id = p.author_id
     LEFT JOIN user_profile_images upi ON upi.user_id = u.id
     LEFT JOIN images upi_img ON upi_img.id = upi.image_id
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN images i ON i.id = p.featured_image_id
     LEFT JOIN seo_metadata seo ON seo.post_id = p.id
     WHERE p.slug = ? AND p.status = 'APPROVED' AND p.deleted_at IS NULL
       AND p.published_at IS NOT NULL AND c.is_active = TRUE
     LIMIT 1`,
    [slug],
  );
  const post = rows[0];
  if (!post) {
    const [redirects] = await pool.execute<Array<RowDataPacket & { new_slug: string }>>(
      `SELECT new_slug FROM slug_redirects
       WHERE entity_type = 'POST' AND old_slug = ? LIMIT 1`,
      [slug],
    );
    if (redirects[0]) {
      response.redirect(301, `/blogs/${encodeURIComponent(redirects[0].new_slug)}`);
      return;
    }
    throw new AppError(404, "Published post not found.", "POST_NOT_FOUND");
  }

  const [tags] = await pool.execute<RowDataPacket[]>(
    `SELECT t.id, t.name, t.slug FROM post_tags pt
     JOIN tags t ON t.id = pt.tag_id
     WHERE pt.post_id = ? AND t.is_active = TRUE ORDER BY t.name`,
    [post.id],
  );
  const [comments] = await pool.execute<RowDataPacket[]>(
    `SELECT cm.id, cm.content, cm.created_at AS createdAt,
            u.username, i.file_path AS profileImagePath
     FROM comments cm JOIN users u ON u.id = cm.author_id
     LEFT JOIN user_profile_images upi ON upi.user_id = u.id
     LEFT JOIN images i ON i.id = upi.image_id
     WHERE cm.post_id = ? AND cm.status = 'APPROVED' AND cm.deleted_at IS NULL
     ORDER BY cm.created_at ASC LIMIT 100`,
    [post.id],
  );
  const [images] = await pool.execute<RowDataPacket[]>(
    `SELECT pi.image_id AS id, i.file_path AS path, pi.caption AS caption
     FROM post_images pi JOIN images i ON i.id = pi.image_id
     WHERE pi.post_id = ? ORDER BY pi.position`,
    [post.id],
  );

  // Check if visitor has liked or bookmarked the post (if logged in)
  let isLiked = false;
  let isBookmarked = false;
  if (request.user) {
    const [likeCheck] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ? LIMIT 1`,
      [post.id, request.user.id],
    );
    isLiked = likeCheck.length > 0;

    const [bookmarkCheck] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM post_bookmarks WHERE post_id = ? AND user_id = ? LIMIT 1`,
      [post.id, request.user.id],
    );
    isBookmarked = bookmarkCheck.length > 0;
  }

  // Deduplicated Daily View Counting
  const visitorKey = request.user
    ? `user:${request.user.id}`
    : `guest:${requestVisitorKey(request)}`;
  const [viewResult] = await pool.execute<ResultSetHeader>(
    `INSERT IGNORE INTO post_views (id, post_id, user_id, visitor_key)
     VALUES (?, ?, ?, ?)`,
    [randomUUID(), post.id, request.user?.id ?? null, visitorKey],
  );
  if (viewResult.affectedRows === 1) {
    post.viewCount = Number(post.viewCount) + 1;
  }

  // Recommended posts (prioritizing 1. shared tags, 2. same category, 3. recent published stories)
  const tagIds = (tags as Array<{ id: string }>).map((t) => t.id);
  const recParams: Array<string | number> = [post.id];
  let tagMatchesSql = "0";

  if (tagIds.length > 0) {
    const placeholders = tagIds.map(() => "?").join(",");
    tagMatchesSql = `(SELECT COUNT(*) FROM post_tags pt WHERE pt.post_id = p.id AND pt.tag_id IN (${placeholders}))`;
    recParams.push(...tagIds);
  }

  recParams.push(post.categoryId);

  const [relatedPosts] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id, p.title, p.slug, p.excerpt, p.published_at AS publishedAt,
            u.username AS author, upi_img.file_path AS authorProfileImagePath,
            c.id AS categoryId, c.name AS category, c.slug AS categorySlug,
            i.file_path AS featuredImagePath,
            (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likeCount,
            (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.status = 'APPROVED' AND cm.deleted_at IS NULL) AS commentCount
     FROM posts p
     JOIN users u ON u.id = p.author_id
     LEFT JOIN user_profile_images upi ON upi.user_id = u.id
     LEFT JOIN images upi_img ON upi_img.id = upi.image_id
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN images i ON i.id = p.featured_image_id
     WHERE p.id <> ? AND p.status = 'APPROVED' AND p.deleted_at IS NULL
       AND p.published_at IS NOT NULL AND c.is_active = TRUE
     ORDER BY ${tagMatchesSql} DESC, (CASE WHEN p.category_id = ? THEN 1 ELSE 0 END) DESC, p.published_at DESC
     LIMIT 4`,
    recParams,
  );

  response.status(200).json({
    data: {
      ...post,
      isLiked,
      isBookmarked,
      tags,
      comments,
      images,
      relatedPosts,
    },
  });
});

/* =========================================================================
   4. COMMENTS (SUBMISSION REQUIRES LOGIN, STATUS -> PENDING)
   ========================================================================= */
const commentSubmitHandler = async (request: Request, response: Response) => {
  const target = parseOrThrow(z.string().trim().min(1).max(220), request.params.target || request.params.slug || request.params.id);
  const input = parseOrThrow(z.object({ content: z.string().trim().min(1).max(5000) }).strict(), request.body);

  const [posts] = await pool.execute<Array<RowDataPacket & { id: string }>>(
    `SELECT p.id FROM posts p JOIN categories c ON c.id = p.category_id
     WHERE (p.slug = ? OR p.id = ?) AND p.status = 'APPROVED' AND p.deleted_at IS NULL
       AND p.published_at IS NOT NULL AND c.is_active = TRUE LIMIT 1`,
    [target, target],
  );
  if (!posts[0]) throw new AppError(404, "Published post not found.", "POST_NOT_FOUND");

  const id = randomUUID();
  await pool.execute(
    `INSERT INTO comments (id, post_id, author_id, content, status)
     VALUES (?, ?, ?, ?, 'PENDING')`,
    [id, posts[0].id, request.user!.id, input.content],
  );
  response.status(201).json({ data: { id, content: input.content, status: "PENDING" } });
};

publicRouter.post("/posts/:slug/comments", authenticate, commentRateLimit, commentSubmitHandler);
publicRouter.post("/posts/:id/comments", authenticate, commentRateLimit, commentSubmitHandler);

/* =========================================================================
   5. LIKE & UNLIKE FOR LOGGED-IN USERS
   ========================================================================= */
publicRouter.post("/posts/:id/like", authenticate, async (request, response) => {
  const postId = parseOrThrow(uuidSchema, request.params.id);
  const [posts] = await pool.execute<Array<RowDataPacket & { id: string }>>(
    "SELECT id FROM posts WHERE id = ? AND status = 'APPROVED' AND deleted_at IS NULL LIMIT 1",
    [postId],
  );
  if (!posts[0]) throw new AppError(404, "Published post not found.", "POST_NOT_FOUND");
  await pool.execute(
    "INSERT IGNORE INTO post_likes (user_id, post_id) VALUES (?, ?)",
    [request.user!.id, postId],
  );
  const [counts] = await pool.execute<Array<RowDataPacket & { likeCount: number }>>(
    "SELECT COUNT(*) AS likeCount FROM post_likes WHERE post_id = ?",
    [postId],
  );
  response.status(200).json({ data: { liked: true, likeCount: Number(counts[0].likeCount) } });
});

publicRouter.delete("/posts/:id/like", authenticate, async (request, response) => {
  const postId = parseOrThrow(uuidSchema, request.params.id);
  await pool.execute("DELETE FROM post_likes WHERE user_id = ? AND post_id = ?", [request.user!.id, postId]);
  const [counts] = await pool.execute<Array<RowDataPacket & { likeCount: number }>>(
    "SELECT COUNT(*) AS likeCount FROM post_likes WHERE post_id = ?",
    [postId],
  );
  response.status(200).json({ data: { liked: false, likeCount: Number(counts[0].likeCount) } });
});

/* =========================================================================
   6. CATEGORIES & TAGS (LISTING & DETAILS WITH PUBLISHED POSTS)
   ========================================================================= */
publicRouter.get("/categories", async (request, response) => {
  const query = parseOrThrow(paginationSchema, request.query);
  const [counts] = await pool.query<CountRow[]>(`
    SELECT COUNT(*) AS total FROM categories c WHERE c.is_active = TRUE
  `);
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id, c.name, c.slug, c.description, i.file_path AS imagePath,
            COUNT(p.id) AS postCount
     FROM categories c LEFT JOIN images i ON i.id = c.image_id
     LEFT JOIN posts p ON p.category_id = c.id AND p.status = 'APPROVED'
       AND p.deleted_at IS NULL AND p.published_at IS NOT NULL
     WHERE c.is_active = TRUE
     GROUP BY c.id, i.id
     ORDER BY c.name LIMIT ? OFFSET ?`,
    [query.limit, paginationOffset(query.page, query.limit)],
  );
  response.status(200).json({
    data: rows,
    pagination: formatPagination(query.page, query.limit, counts[0].total),
  });
});

const categoryPostsHandler = async (request: Request, response: Response) => {
  const slug = parseOrThrow(z.string().trim().min(1).max(160), request.params.slug);
  const query = parseOrThrow(paginationSchema, request.query);
  const [categories] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id, c.name, c.slug, c.description, i.file_path AS imagePath,
            seo.title AS seoTitle, seo.description AS seoDescription, seo.keywords AS seoKeywords
     FROM categories c LEFT JOIN images i ON i.id = c.image_id
     LEFT JOIN seo_metadata seo ON seo.category_id = c.id
     WHERE c.slug = ? AND c.is_active = TRUE LIMIT 1`,
    [slug],
  );
  const category = categories[0];
  if (!category) {
    const [redirects] = await pool.execute<Array<RowDataPacket & { new_slug: string }>>(
      `SELECT new_slug FROM slug_redirects
       WHERE entity_type = 'CATEGORY' AND old_slug = ? LIMIT 1`,
      [slug],
    );
    if (redirects[0]) {
      response.redirect(301, `/category/${encodeURIComponent(redirects[0].new_slug)}`);
      return;
    }
    throw new AppError(404, "Category not found.", "CATEGORY_NOT_FOUND");
  }
  const [counts] = await pool.execute<CountRow[]>(
    `SELECT COUNT(*) AS total FROM posts
     WHERE category_id = ? AND status = 'APPROVED' AND deleted_at IS NULL AND published_at IS NOT NULL`,
    [category.id],
  );
  const [posts] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id, p.title, p.slug, p.excerpt, p.published_at AS publishedAt,
            u.username AS author, i.file_path AS featuredImagePath,
            (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS likeCount,
            (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.status = 'APPROVED' AND cm.deleted_at IS NULL) AS commentCount
     FROM posts p JOIN users u ON u.id = p.author_id
     LEFT JOIN images i ON i.id = p.featured_image_id
     WHERE p.category_id = ? AND p.status = 'APPROVED'
       AND p.deleted_at IS NULL AND p.published_at IS NOT NULL
     ORDER BY p.published_at DESC LIMIT ? OFFSET ?`,
    [category.id, query.limit, paginationOffset(query.page, query.limit)],
  );
  response.status(200).json({
    data: { category, posts },
    pagination: formatPagination(query.page, query.limit, counts[0].total),
  });
};

publicRouter.get("/categories/:slug/posts", categoryPostsHandler);
publicRouter.get("/category/:slug", categoryPostsHandler);

publicRouter.get("/tags", async (request, response) => {
  const query = parseOrThrow(paginationSchema, request.query);
  const [counts] = await pool.query<CountRow[]>(`
    SELECT COUNT(*) AS total FROM tags t WHERE t.is_active = TRUE AND EXISTS (
      SELECT 1 FROM post_tags pt JOIN posts p ON p.id = pt.post_id
      WHERE pt.tag_id = t.id AND p.status = 'APPROVED' AND p.deleted_at IS NULL
        AND p.published_at IS NOT NULL
    )
  `);
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT t.id, t.name, t.slug, t.description, COUNT(p.id) AS postCount
     FROM tags t JOIN post_tags pt ON pt.tag_id = t.id
     JOIN posts p ON p.id = pt.post_id AND p.status = 'APPROVED'
       AND p.deleted_at IS NULL AND p.published_at IS NOT NULL
     WHERE t.is_active = TRUE
     GROUP BY t.id HAVING postCount > 0
     ORDER BY t.name LIMIT ? OFFSET ?`,
    [query.limit, paginationOffset(query.page, query.limit)],
  );
  response.status(200).json({
    data: rows,
    pagination: formatPagination(query.page, query.limit, counts[0].total),
  });
});

const tagPostsHandler = async (request: Request, response: Response) => {
  const slug = parseOrThrow(z.string().trim().min(1).max(140), request.params.slug);
  const query = parseOrThrow(paginationSchema, request.query);
  const [tags] = await pool.execute<RowDataPacket[]>(
    `SELECT t.id, t.name, t.slug, t.description, seo.title AS seoTitle,
            seo.description AS seoDescription, seo.keywords AS seoKeywords
     FROM tags t LEFT JOIN seo_metadata seo ON seo.tag_id = t.id
     WHERE t.slug = ? AND t.is_active = TRUE LIMIT 1`,
    [slug],
  );
  const tag = tags[0];
  if (!tag) {
    const [redirects] = await pool.execute<Array<RowDataPacket & { new_slug: string }>>(
      `SELECT new_slug FROM slug_redirects
       WHERE entity_type = 'TAG' AND old_slug = ? LIMIT 1`,
      [slug],
    );
    if (redirects[0]) {
      response.redirect(301, `/tag/${encodeURIComponent(redirects[0].new_slug)}`);
      return;
    }
    throw new AppError(404, "Tag not found.", "TAG_NOT_FOUND");
  }
  const [counts] = await pool.execute<CountRow[]>(
    `SELECT COUNT(*) AS total FROM post_tags pt JOIN posts p ON p.id = pt.post_id
     WHERE pt.tag_id = ? AND p.status = 'APPROVED' AND p.deleted_at IS NULL
       AND p.published_at IS NOT NULL`,
    [tag.id],
  );
  const [posts] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id, p.title, p.slug, p.excerpt, p.published_at AS publishedAt,
            u.username AS author, i.file_path AS featuredImagePath,
            (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) AS likeCount,
            (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.status = 'APPROVED' AND cm.deleted_at IS NULL) AS commentCount
     FROM post_tags pt JOIN posts p ON p.id = pt.post_id
     JOIN users u ON u.id = p.author_id LEFT JOIN images i ON i.id = p.featured_image_id
     WHERE pt.tag_id = ? AND p.status = 'APPROVED'
       AND p.deleted_at IS NULL AND p.published_at IS NOT NULL
     ORDER BY p.published_at DESC LIMIT ? OFFSET ?`,
    [tag.id, query.limit, paginationOffset(query.page, query.limit)],
  );
  response.status(200).json({
    data: { tag, posts },
    pagination: formatPagination(query.page, query.limit, counts[0].total),
  });
};

publicRouter.get("/tags/:slug/posts", tagPostsHandler);
publicRouter.get("/tag/:slug", tagPostsHandler);

/* =========================================================================
   7. AUTHOR PROFILES & CONTRIBUTOR STORIES
   ========================================================================= */
const authorProfileHandler = async (request: Request, response: Response) => {
  const username = parseOrThrow(z.string().trim().min(1).max(50), request.params.username);
  const query = parseOrThrow(paginationSchema, request.query);

  const [authors] = await pool.execute<RowDataPacket[]>(
    `SELECT u.id, u.username, u.bio, u.created_at AS createdAt,
            upi_img.file_path AS profileImagePath,
            (
              SELECT COUNT(*) FROM posts p
              JOIN categories c ON c.id = p.category_id
              WHERE p.author_id = u.id AND p.status = 'APPROVED'
                AND p.deleted_at IS NULL AND p.published_at IS NOT NULL
                AND c.is_active = TRUE
            ) AS publishedStoryCount
     FROM users u
     LEFT JOIN user_profile_images upi ON upi.user_id = u.id
     LEFT JOIN images upi_img ON upi_img.id = upi.image_id
     WHERE u.username = ? AND u.deleted_at IS NULL AND u.is_active = 1
     LIMIT 1`,
    [username],
  );

  const author = authors[0];
  if (!author) {
    throw new AppError(404, `Author "${username}" was not found.`, "AUTHOR_NOT_FOUND");
  }

  const total = Number(author.publishedStoryCount) || 0;
  const offset = paginationOffset(query.page, query.limit);

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id, p.title, p.slug, p.excerpt, p.published_at AS publishedAt,
            u.username AS author, upi_img.file_path AS authorProfileImagePath,
            c.name AS category, c.slug AS categorySlug,
            i.file_path AS featuredImagePath,
            (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likeCount,
            (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.status = 'APPROVED' AND cm.deleted_at IS NULL) AS commentCount
     FROM posts p
     JOIN users u ON u.id = p.author_id
     LEFT JOIN user_profile_images upi ON upi.user_id = u.id
     LEFT JOIN images upi_img ON upi_img.id = upi.image_id
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN images i ON i.id = p.featured_image_id
     WHERE p.author_id = ? AND p.status = 'APPROVED'
       AND p.deleted_at IS NULL AND p.published_at IS NOT NULL
       AND c.is_active = TRUE
     ORDER BY p.published_at DESC, p.created_at DESC
     LIMIT ? OFFSET ?`,
    [author.id, query.limit, offset],
  );

  const postIds = rows.map((r) => r.id);
  const tagsByPostId: Record<string, Array<{ id: string; name: string; slug: string }>> = {};
  if (postIds.length > 0) {
    const placeholders = postIds.map(() => "?").join(",");
    const [tagRows] = await pool.query<RowDataPacket[]>(
      `SELECT pt.post_id AS postId, t.id, t.name, t.slug
       FROM post_tags pt
       JOIN tags t ON t.id = pt.tag_id
       WHERE pt.post_id IN (${placeholders}) AND t.is_active = TRUE
       ORDER BY t.name`,
      postIds,
    );
    for (const t of tagRows) {
      if (!tagsByPostId[t.postId]) tagsByPostId[t.postId] = [];
      tagsByPostId[t.postId].push({ id: t.id, name: t.name, slug: t.slug });
    }
  }

  const posts = rows.map((r) => ({
    ...r,
    tags: tagsByPostId[r.id] ?? [],
  }));

  const pagination = formatPagination(query.page, query.limit, total);

  response.status(200).json({
    data: {
      author: {
        id: author.id,
        username: author.username,
        displayName: author.username,
        bio: author.bio,
        profileImagePath: author.profileImagePath,
        createdAt: author.createdAt,
        publishedStoryCount: total,
      },
      posts,
      pagination,
    },
    pagination,
  });
};

publicRouter.get("/authors/:username", authorProfileHandler);
publicRouter.get("/author/:username", authorProfileHandler);

/* =========================================================================
   7. SEO METADATA & STATIC PAGES
   ========================================================================= */
const staticSeoHandler = async (request: Request, response: Response) => {
  const pageKey = parseOrThrow(z.string().trim().min(1).max(100), request.params.pageKey);
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT title, description, keywords, canonical_url AS canonicalUrl,
            og_title AS ogTitle, og_description AS ogDescription, og_image_url AS ogImageUrl,
            twitter_title AS twitterTitle, twitter_description AS twitterDescription, twitter_image_url AS twitterImageUrl,
            robots_index AS robotsIndex, robots_follow AS robotsFollow
     FROM seo_metadata WHERE page_key = ? LIMIT 1`,
    [pageKey],
  );
  response.status(200).json({ data: rows[0] ?? null });
};

publicRouter.get("/seo/pages/:pageKey", staticSeoHandler);
publicRouter.get("/seo/:pageKey", staticSeoHandler);

/* =========================================================================
   8. CONTACT FORM SUBMISSION
   ========================================================================= */
publicRouter.post("/contact", rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
}), async (request, response) => {
  const input = parseOrThrow(z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    subject: z.string().trim().min(3).max(200),
    message: z.string().trim().min(10).max(10000),
  }).strict(), request.body);
  const id = randomUUID();
  await pool.execute(
    `INSERT INTO contact_messages (id, name, email, subject, message)
     VALUES (?, ?, ?, ?, ?)`,
    [id, input.name, input.email, input.subject, input.message],
  );
  response.status(201).json({ data: { id, message: "Your message has been received." } });
});

/* =========================================================================
   9. ROBOTS.TXT & XML SITEMAP
   ========================================================================= */
export function robotsHandler(_request: Request, response: Response): void {
  const origin = env.PUBLIC_SITE_URL.replace(/\/+$/, "");
  const lines = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin/",
    "Disallow: /user/",
    "Disallow: /dashboard/",
    "Disallow: /api/",
    "Disallow: /login",
    "Disallow: /register",
    "Disallow: /forgot-password",
    "Disallow: /reset-password",
    "Disallow: /settings",
    "Disallow: /profile",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ];
  response.status(200).type("text/plain; charset=utf-8").send(lines.join("\n"));
}

export async function sitemapHandler(_request: Request, response: Response): Promise<void> {
  const origin = env.PUBLIC_SITE_URL.replace(/\/+$/, "");

  // 1. Only published, non-deleted posts in active categories where indexing is allowed
  const [posts] = await pool.query<RowDataPacket[]>(
    `SELECT p.slug, COALESCE(p.updated_at, p.published_at) AS updatedAt, seo.canonical_url AS canonicalUrl
     FROM posts p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN seo_metadata seo ON seo.post_id = p.id
     WHERE p.status = 'APPROVED'
       AND p.deleted_at IS NULL
       AND p.published_at IS NOT NULL
       AND c.is_active = TRUE
       AND (seo.robots_index IS NULL OR seo.robots_index = TRUE)
     ORDER BY p.published_at DESC`,
  );

  // 2. Active categories that have published posts where indexing is allowed
  const [categories] = await pool.query<RowDataPacket[]>(
    `SELECT c.slug, COALESCE(c.updated_at, c.created_at) AS updatedAt, seo.canonical_url AS canonicalUrl
     FROM categories c
     LEFT JOIN seo_metadata seo ON seo.category_id = c.id
     WHERE c.is_active = TRUE
       AND (seo.robots_index IS NULL OR seo.robots_index = TRUE)
       AND EXISTS (
         SELECT 1 FROM posts p WHERE p.category_id = c.id AND p.status = 'APPROVED'
           AND p.deleted_at IS NULL AND p.published_at IS NOT NULL
       )
     ORDER BY c.name`,
  );

  // 3. Active tags that have published posts in active categories where indexing is allowed
  const [tags] = await pool.query<RowDataPacket[]>(
    `SELECT t.slug, COALESCE(t.updated_at, t.created_at) AS updatedAt, seo.canonical_url AS canonicalUrl
     FROM tags t
     LEFT JOIN seo_metadata seo ON seo.tag_id = t.id
     WHERE t.is_active = TRUE
       AND (seo.robots_index IS NULL OR seo.robots_index = TRUE)
       AND EXISTS (
         SELECT 1 FROM post_tags pt
         JOIN posts p ON p.id = pt.post_id
         JOIN categories c ON c.id = p.category_id
         WHERE pt.tag_id = t.id AND p.status = 'APPROVED'
           AND p.deleted_at IS NULL AND p.published_at IS NOT NULL
           AND c.is_active = TRUE
       )
     ORDER BY t.name`,
  );

  // 4. Page metadata for static public pages
  const [pageSeo] = await pool.query<RowDataPacket[]>(
    `SELECT page_key AS pageKey, updated_at AS updatedAt, canonical_url AS canonicalUrl, robots_index AS robotsIndex
     FROM seo_metadata
     WHERE page_key IS NOT NULL`,
  );
  const pageSeoMap = new Map<string, { updatedAt: Date; canonicalUrl?: string | null; robotsIndex: boolean }>();
  for (const page of pageSeo) {
    pageSeoMap.set(page.pageKey, {
      updatedAt: page.updatedAt,
      canonicalUrl: page.canonicalUrl,
      robotsIndex: page.robotsIndex !== 0 && page.robotsIndex !== false,
    });
  }

  const urlMap = new Map<string, { loc: string; lastmod: string }>();

  function registerUrl(defaultLoc: string, updatedAt: string | Date | null | undefined, canonicalUrl?: string | null) {
    const loc = (canonicalUrl && canonicalUrl.startsWith(origin)) ? canonicalUrl : defaultLoc;
    const normalizedKey = loc === `${origin}/` ? loc : loc.replace(/\/+$/, "");
    if (!urlMap.has(normalizedKey)) {
      let isoDate: string;
      try {
        isoDate = updatedAt ? new Date(updatedAt).toISOString() : new Date().toISOString();
      } catch {
        isoDate = new Date().toISOString();
      }
      urlMap.set(normalizedKey, { loc: normalizedKey, lastmod: isoDate });
    }
  }

  // Core static public pages
  const staticPages = [
    { key: "home", path: "/" },
    { key: "blogs", path: "/blogs" },
    { key: "categories", path: "/categories" },
    { key: "tags", path: "/tags" },
    { key: "about", path: "/about" },
    { key: "contact", path: "/contact" },
  ];

  for (const { key, path } of staticPages) {
    const meta = pageSeoMap.get(key);
    if (meta && !meta.robotsIndex) continue;
    registerUrl(`${origin}${path}`, meta?.updatedAt, meta?.canonicalUrl);
  }

  // Dynamic published blogs
  for (const post of posts) {
    registerUrl(`${origin}/blogs/${encodeURIComponent(post.slug)}`, post.updatedAt, post.canonicalUrl);
  }

  // Dynamic public categories
  for (const category of categories) {
    registerUrl(`${origin}/category/${encodeURIComponent(category.slug)}`, category.updatedAt, category.canonicalUrl);
  }

  // Dynamic public tags
  for (const tag of tags) {
    registerUrl(`${origin}/tag/${encodeURIComponent(tag.slug)}`, tag.updatedAt, tag.canonicalUrl);
  }

  const xmlEntries = Array.from(urlMap.values())
    .map(({ loc, lastmod }) => `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${xmlEntries}\n</urlset>\n`;

  response.status(200).type("application/xml; charset=utf-8").send(body);
}

publicRouter.get("/robots.txt", robotsHandler);
publicRouter.get("/sitemap.xml", sitemapHandler);

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]!);
}

/* =========================================================================
   10. NEWSLETTER SUBSCRIPTION SYSTEM (Phase 2C)
   ========================================================================= */

const newsletterRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
}).strict();

const tokenQuerySchema = z.object({
  token: z.string().trim().min(32).max(128),
});

// POST /api/v1/public/newsletter/subscribe
publicRouter.post("/newsletter/subscribe", newsletterRateLimit, async (request, response) => {
  const input = parseOrThrow(subscribeSchema, request.body);
  const normalizedEmail = input.email;

  // Check if subscriber already exists
  const [existing] = await pool.execute<RowDataPacket[]>(
    "SELECT id, email, status, verification_expires_at FROM newsletter_subscribers WHERE email = ?",
    [normalizedEmail],
  );

  const { rawToken: verificationToken, tokenHash: verificationHash, expiresAt: verificationExpiresAt } =
    generateVerificationToken(24);
  const { rawToken: unsubscribeToken, tokenHash: unsubscribeHash } = generateUnsubscribeToken();

  if (existing.length === 0) {
    const id = randomUUID();
    await pool.execute(
      `INSERT INTO newsletter_subscribers
       (id, email, status, verification_token_hash, verification_expires_at, unsubscribe_token_hash)
       VALUES (?, ?, 'PENDING', ?, ?, ?)`,
      [id, normalizedEmail, verificationHash, verificationExpiresAt, unsubscribeHash],
    );

    const emailResult = await sendNewsletterVerificationEmail(normalizedEmail, verificationToken, unsubscribeToken);

    return response.status(201).json({
      data: {
        message: "Thank you for subscribing! Please check your email to verify your subscription.",
        status: "PENDING",
        emailDelivered: emailResult.delivered,
        providerConfigured: emailResult.providerConfigured,
        devVerificationToken: emailResult.devVerificationToken,
      },
    });
  }

  const subscriber = existing[0];

  if (subscriber.status === "SUBSCRIBED") {
    return response.status(200).json({
      data: {
        message: "You are already subscribed to Fieldnotes Journal.",
        status: "SUBSCRIBED",
        emailDelivered: false,
        providerConfigured: false,
      },
    });
  }

  // If currently PENDING or UNSUBSCRIBED, re-issue a fresh verification token
  await pool.execute(
    `UPDATE newsletter_subscribers
     SET status = 'PENDING',
         verification_token_hash = ?,
         verification_expires_at = ?,
         unsubscribed_at = NULL
     WHERE id = ?`,
    [verificationHash, verificationExpiresAt, subscriber.id],
  );

  const emailResult = await sendNewsletterVerificationEmail(normalizedEmail, verificationToken);

  return response.status(200).json({
    data: {
      message: subscriber.status === "UNSUBSCRIBED"
        ? "Welcome back! Please verify your email to reactivate your subscription."
        : "A verification link has already been sent. We've re-issued your verification email.",
      status: "PENDING",
      emailDelivered: emailResult.delivered,
      providerConfigured: emailResult.providerConfigured,
      devVerificationToken: emailResult.devVerificationToken,
    },
  });
});

// GET & POST /api/v1/public/newsletter/verify
const verifyHandler: RequestHandler = async (request, response) => {
  const token = request.method === "GET"
    ? parseOrThrow(tokenQuerySchema, request.query).token
    : parseOrThrow(tokenQuerySchema, request.body).token;

  const tokenHash = hashToken(token);

  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, email, status, verification_expires_at FROM newsletter_subscribers WHERE verification_token_hash = ?",
    [tokenHash],
  );

  if (rows.length === 0) {
    throw new AppError(400, "Invalid or expired verification token.", "INVALID_TOKEN");
  }

  const subscriber = rows[0];

  if (subscriber.verification_expires_at && new Date(subscriber.verification_expires_at).getTime() < Date.now()) {
    throw new AppError(400, "This verification link has expired. Please subscribe again.", "TOKEN_EXPIRED");
  }

  // Update subscriber to SUBSCRIBED and clear verification token
  await pool.execute(
    `UPDATE newsletter_subscribers
     SET status = 'SUBSCRIBED',
         subscribed_at = UTC_TIMESTAMP(3),
         verification_token_hash = NULL,
         verification_expires_at = NULL
     WHERE id = ?`,
    [subscriber.id],
  );

  // Send welcome confirmation email (fire-and-forget, non-blocking)
  sendNewsletterWelcomeEmail(subscriber.email).catch((err) => {
    logger.warn({ err, email: maskEmail(subscriber.email) }, "Failed to deliver welcome email");
  });

  response.status(200).json({
    data: {
      message: "Your subscription has been confirmed! Welcome to Fieldnotes Journal.",
      status: "SUBSCRIBED",
      email: maskEmail(subscriber.email),
    },
  });
};

publicRouter.get("/newsletter/verify", verifyHandler);
publicRouter.post("/newsletter/verify", verifyHandler);

// GET & POST /api/v1/public/newsletter/unsubscribe
const unsubscribeHandler: RequestHandler = async (request, response) => {
  const token = request.method === "GET"
    ? parseOrThrow(tokenQuerySchema, request.query).token
    : parseOrThrow(tokenQuerySchema, request.body).token;

  const tokenHash = hashToken(token);

  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, email, status FROM newsletter_subscribers WHERE unsubscribe_token_hash = ?",
    [tokenHash],
  );

  if (rows.length === 0) {
    throw new AppError(400, "Invalid unsubscribe link.", "INVALID_TOKEN");
  }

  const subscriber = rows[0];

  if (subscriber.status === "UNSUBSCRIBED") {
    return response.status(200).json({
      data: {
        message: "You have already unsubscribed from Fieldnotes Journal.",
        status: "UNSUBSCRIBED",
      },
    });
  }

  await pool.execute(
    `UPDATE newsletter_subscribers
     SET status = 'UNSUBSCRIBED',
         unsubscribed_at = UTC_TIMESTAMP(3)
     WHERE id = ?`,
    [subscriber.id],
  );

  response.status(200).json({
    data: {
      message: "You have been successfully unsubscribed from Fieldnotes Journal.",
      status: "UNSUBSCRIBED",
    },
  });
};

publicRouter.get("/newsletter/unsubscribe", unsubscribeHandler);
publicRouter.post("/newsletter/unsubscribe", unsubscribeHandler);

/* =========================================================================
   11. ARTICLE TRANSLATION API (Phase 1G - Hindi Translation)
   ========================================================================= */

const translateRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many translation requests. Please wait a few minutes before trying again." },
});

const translateSchema = z.object({
  targetLanguage: z.literal("hi"),
  sourceLanguage: z.string().optional().default("en"),
  title: z.string().max(500).optional(),
  excerpt: z.string().max(2000).optional().nullable(),
  content: z.string().min(1, "Article content is required").max(50000, "Content cannot exceed 50,000 characters"),
});

publicRouter.get("/translate/status", (_request, response) => {
  const status = translationService.getStatus();
  response.status(200).json({ data: status });
});

publicRouter.post("/translate", translateRateLimit, async (request, response) => {
  const input = parseOrThrow(translateSchema, request.body);
  try {
    const result = await translationService.translate(input);
    response.status(200).json({ data: result });
  } catch (err: unknown) {
    if (err instanceof TranslationError) {
      return response.status(err.statusCode).json({
        error: {
          message: err.message,
          code: err.code,
          details: err.details,
        },
      });
    }
    throw err;
  }
});


