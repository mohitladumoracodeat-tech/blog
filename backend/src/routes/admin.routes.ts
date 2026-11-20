import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { Router, type Request, type Response, type RequestHandler } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { z } from "zod";
import { requireRole } from "../middleware/authenticate";
import { pool } from "../config/mysql";
import { env, uploadDir } from "../config/env";
import { logger } from "../config/logger";
import { AppError } from "../errors/app-error";
import { createUniqueSlug, recordSlugRedirect } from "../services/slug.service";
import { dateRangeSchema, formatPagination, paginationOffset, paginationSchema, parseOrThrow, slugify } from "../utils/request-validation";

interface CountRow extends RowDataPacket {
  total: number;
}

interface CategoryRow extends RowDataPacket {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: number | boolean;
  image_id: string | null;
  image_path?: string | null;
  created_at: Date;
  updated_at: Date;
}

interface TagRow extends RowDataPacket {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: number | boolean;
  created_at: Date;
  updated_at: Date;
}

const uuidSchema = z.string().uuid();

const categoryInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  imageId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
}).strict();

const tagInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  isActive: z.boolean().optional(),
}).strict();

const reviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]).optional(),
  status: z.enum(["APPROVED", "REJECTED", "PENDING", "DRAFT"]).optional(),
  reason: z.string().trim().max(1000).nullable().optional(),
}).strict().refine((v) => v.decision !== undefined || v.status !== undefined);

const userUpdateSchema = z.object({
  role: z.enum(["USER", "ADMIN"]).optional(),
  isActive: z.boolean().optional(),
  status: z.enum(["active", "inactive", "blocked"]).optional(),
}).strict().refine((value) => value.role !== undefined || value.isActive !== undefined || value.status !== undefined);

const commentStatusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  decision: z.enum(["APPROVED", "REJECTED"]).optional(),
  reason: z.string().trim().max(1000).nullable().optional(),
}).strict();

const listQuerySchema = paginationSchema.merge(dateRangeSchema).extend({
  search: z.string().trim().max(100).default(""),
  status: z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED"]).optional(),
});

const adminPostSchema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z.string().trim().min(1).max(220).optional(),
  excerpt: z.string().trim().max(500).nullable().optional(),
  content: z.string().trim().min(1).max(16000000),
  categoryId: z.string().uuid(),
  authorId: z.string().uuid().optional(),
  featuredImageId: z.string().uuid().nullable().optional(),
  tagIds: z.array(z.string().uuid()).max(30).default([]),
  imageIds: z.array(z.string().uuid()).max(20).default([]),
  rejectionReason: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED"]).default("DRAFT"),
  seoTitle: z.string().trim().max(200).nullable().optional(),
  seoDescription: z.string().trim().max(320).nullable().optional(),
  seoKeywords: z.string().trim().max(500).nullable().optional(),
}).strict();

const adminPostUpdateSchema = adminPostSchema.partial().extend({
  status: z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED"]).optional(),
  tagIds: z.array(z.string().uuid()).max(30).optional(),
  imageIds: z.array(z.string().uuid()).max(20).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

const adminSeoInputSchema = z.object({
  title: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(320).nullable().optional(),
  keywords: z.string().trim().max(500).nullable().optional(),
  canonicalUrl: z.string().url().max(2048).nullable().optional(),
  ogTitle: z.string().trim().max(200).nullable().optional(),
  ogDescription: z.string().trim().max(320).nullable().optional(),
  ogImageUrl: z.string().url().max(2048).nullable().optional(),
  twitterTitle: z.string().trim().max(200).nullable().optional(),
  twitterDescription: z.string().trim().max(320).nullable().optional(),
  twitterImageUrl: z.string().url().max(2048).nullable().optional(),
  robotsIndex: z.boolean().optional(),
  robotsFollow: z.boolean().optional(),
}).strict();

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function mapCategory(row: CategoryRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    isActive: Boolean(row.is_active),
    imageId: row.image_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTag(row: TagRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ensureImageExists(imageId: string | null | undefined): Promise<void> {
  if (!imageId) return;
  const [rows] = await pool.execute<Array<RowDataPacket & { id: string }>>(
    "SELECT id FROM images WHERE id = ? LIMIT 1",
    [imageId],
  );
  if (!rows[0]) {
    throw new AppError(400, "Selected image does not exist.", "INVALID_IMAGE");
  }
}

export const adminRouter = Router();
adminRouter.use(requireRole("ADMIN"));

/* =========================================================================
   1. ADMIN DASHBOARD STATISTICS
   ========================================================================= */
adminRouter.get("/dashboard", async (_request, response) => {
  const [statsRows] = await pool.query<RowDataPacket[]>(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) AS totalUsers,
      (SELECT COUNT(*) FROM posts WHERE deleted_at IS NULL) AS totalPosts,
      (SELECT COUNT(*) FROM posts WHERE status = 'APPROVED' AND deleted_at IS NULL) AS publishedPosts,
      (SELECT COUNT(*) FROM posts WHERE status = 'PENDING' AND deleted_at IS NULL) AS pendingPosts,
      (SELECT COUNT(*) FROM posts WHERE status = 'REJECTED' AND deleted_at IS NULL) AS rejectedPosts,
      (SELECT COUNT(*) FROM categories) AS totalCategories,
      (SELECT COUNT(*) FROM tags) AS totalTags,
      (SELECT COUNT(*) FROM comments WHERE deleted_at IS NULL) AS totalComments,
      (SELECT COUNT(*) FROM comments WHERE status = 'PENDING' AND deleted_at IS NULL) AS pendingComments,
      (SELECT COUNT(*) FROM post_likes) AS totalLikes
  `);
  const [recentPosts] = await pool.query<RowDataPacket[]>(`
    SELECT p.id, p.title, p.slug, p.status, p.created_at AS createdAt,
           u.username AS author, c.name AS category
    FROM posts p JOIN users u ON u.id = p.author_id JOIN categories c ON c.id = p.category_id
    WHERE p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT 10
  `);
  const [recentUsers] = await pool.query<RowDataPacket[]>(`
    SELECT id, username, email, role, created_at AS createdAt
    FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 10
  `);
  const [recentComments] = await pool.query<RowDataPacket[]>(`
    SELECT c.id, c.content, c.status, c.created_at AS createdAt,
           u.username AS author, p.title AS postTitle, p.slug AS postSlug
    FROM comments c JOIN users u ON u.id = c.author_id JOIN posts p ON p.id = c.post_id
    WHERE c.deleted_at IS NULL ORDER BY c.created_at DESC LIMIT 10
  `);
  const [popularPosts] = await pool.query<RowDataPacket[]>(`
    SELECT p.id, p.title, p.slug, COUNT(l.post_id) AS likeCount
    FROM posts p LEFT JOIN post_likes l ON l.post_id = p.id
    WHERE p.status = 'APPROVED' AND p.deleted_at IS NULL
    GROUP BY p.id, p.title, p.slug
    ORDER BY likeCount DESC, p.published_at DESC LIMIT 10
  `);
  const [monthlyPosts] = await pool.query<RowDataPacket[]>(`
    SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
    FROM posts WHERE created_at >= DATE_SUB(DATE_FORMAT(UTC_DATE(), '%Y-%m-01'), INTERVAL 11 MONTH)
    GROUP BY DATE_FORMAT(created_at, '%Y-%m') ORDER BY month
  `);
  const [monthlyUsers] = await pool.query<RowDataPacket[]>(`
    SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
    FROM users WHERE created_at >= DATE_SUB(DATE_FORMAT(UTC_DATE(), '%Y-%m-01'), INTERVAL 11 MONTH)
    GROUP BY DATE_FORMAT(created_at, '%Y-%m') ORDER BY month
  `);

  response.status(200).json({
    data: {
      stats: statsRows[0],
      recentPosts,
      recentUsers,
      recentComments,
      pendingApprovals: {
        posts: Number((statsRows[0] as RowDataPacket).pendingPosts),
        comments: Number((statsRows[0] as RowDataPacket).pendingComments),
      },
      popularPosts,
      monthlyPosts,
      monthlyUsers,
    },
  });
});

/* =========================================================================
   2. CATEGORY MANAGEMENT
   ========================================================================= */
adminRouter.get("/categories", async (request, response) => {
  const query = parseOrThrow(listQuerySchema.omit({ status: true }), request.query);
  const pattern = `%${escapeLike(query.search)}%`;
  const [countRows] = await pool.execute<CountRow[]>(
    "SELECT COUNT(*) AS total FROM categories WHERE name LIKE ? OR slug LIKE ?",
    [pattern, pattern],
  );
  const [rows] = await pool.execute<CategoryRow[]>(
    `SELECT c.id, c.name, c.slug, c.description, c.is_active, c.image_id,
            c.created_at, c.updated_at, i.file_path AS image_path
     FROM categories c LEFT JOIN images i ON i.id = c.image_id
     WHERE c.name LIKE ? OR c.slug LIKE ?
     ORDER BY c.name LIMIT ? OFFSET ?`,
    [pattern, pattern, query.limit, paginationOffset(query.page, query.limit)],
  );
  response.status(200).json({
    data: rows.map((row) => ({ ...mapCategory(row), imagePath: row.image_path ?? null })),
    pagination: formatPagination(query.page, query.limit, countRows[0].total),
  });
});

adminRouter.post("/categories", async (request, response) => {
  const input = parseOrThrow(categoryInputSchema, request.body);
  await ensureImageExists(input.imageId);
  const id = randomUUID();
  const slug = await createUniqueSlug("categories", input.slug ?? input.name, 160);
  try {
    await pool.execute(
      `INSERT INTO categories (id, name, slug, description, image_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.name, slug, input.description ?? null, input.imageId ?? null, input.isActive ?? true],
    );
  } catch (error) {
    if (isDuplicateEntry(error)) {
      throw new AppError(409, "Category name or slug already exists.", "CATEGORY_CONFLICT");
    }
    throw error;
  }
  response.status(201).json({ data: { id, ...input, slug, isActive: input.isActive ?? true } });
});

const updateCategoryHandler: RequestHandler = async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id);
  const input = parseOrThrow(categoryInputSchema.partial(), request.body);
  if (Object.keys(input).length === 0) {
    throw new AppError(400, "Provide at least one field to update.", "EMPTY_UPDATE");
  }
  await ensureImageExists(input.imageId);
  const [existingRows] = await pool.execute<CategoryRow[]>(
    `SELECT id, name, slug, description, is_active, image_id, created_at, updated_at
     FROM categories WHERE id = ? LIMIT 1`,
    [id],
  );
  if (!existingRows[0]) throw new AppError(404, "Category not found.", "CATEGORY_NOT_FOUND");
  const current = existingRows[0];
  const slug = input.slug === undefined
    ? current.slug
    : await createUniqueSlug("categories", input.slug, 160, id);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE categories
       SET name = ?, slug = ?, description = ?, image_id = ?, is_active = ?
       WHERE id = ?`,
      [
        input.name ?? current.name,
        slug,
        input.description === undefined ? current.description : input.description,
        input.imageId === undefined ? current.image_id : input.imageId,
        input.isActive === undefined ? current.is_active : input.isActive,
        id,
      ],
    );
    await recordSlugRedirect(connection, "CATEGORY", current.slug, slug);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (isDuplicateEntry(error)) {
      throw new AppError(409, "Category name or slug already exists.", "CATEGORY_CONFLICT");
    }
    throw error;
  } finally {
    connection.release();
  }
  response.status(200).json({ data: { ...mapCategory(current), ...input, slug, id } });
};

adminRouter.put("/categories/:id", updateCategoryHandler);
adminRouter.patch("/categories/:id", updateCategoryHandler);

adminRouter.delete("/categories/:id", async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id);
  const [dependencies] = await pool.execute<Array<RowDataPacket & { total: number }>>(
    "SELECT COUNT(*) AS total FROM posts WHERE category_id = ?",
    [id],
  );
  if (Number(dependencies[0].total) > 0) {
    throw new AppError(409, "Category is assigned to posts; reassign them before deleting it.", "CATEGORY_IN_USE");
  }
  const [result] = await pool.execute<ResultSetHeader>("DELETE FROM categories WHERE id = ?", [id]);
  if (result.affectedRows === 0) throw new AppError(404, "Category not found.", "CATEGORY_NOT_FOUND");
  response.status(204).end();
});

/* =========================================================================
   3. TAG MANAGEMENT
   ========================================================================= */
adminRouter.get("/tags", async (request, response) => {
  const query = parseOrThrow(listQuerySchema.omit({ status: true }), request.query);
  const pattern = `%${escapeLike(query.search)}%`;
  const [countRows] = await pool.execute<CountRow[]>(
    "SELECT COUNT(*) AS total FROM tags WHERE name LIKE ? OR slug LIKE ?",
    [pattern, pattern],
  );
  const [rows] = await pool.execute<TagRow[]>(
    `SELECT id, name, slug, description, is_active, created_at, updated_at
     FROM tags WHERE name LIKE ? OR slug LIKE ?
     ORDER BY name LIMIT ? OFFSET ?`,
    [pattern, pattern, query.limit, paginationOffset(query.page, query.limit)],
  );
  response.status(200).json({
    data: rows.map(mapTag),
    pagination: formatPagination(query.page, query.limit, countRows[0].total),
  });
});

adminRouter.post("/tags", async (request, response) => {
  const input = parseOrThrow(tagInputSchema, request.body);
  const id = randomUUID();
  const slug = await createUniqueSlug("tags", input.slug ?? input.name, 140);
  try {
    await pool.execute(
      "INSERT INTO tags (id, name, slug, description, is_active) VALUES (?, ?, ?, ?, ?)",
      [id, input.name, slug, input.description ?? null, input.isActive ?? true],
    );
  } catch (error) {
    if (isDuplicateEntry(error)) {
      throw new AppError(409, "Tag name or slug already exists.", "TAG_CONFLICT");
    }
    throw error;
  }
  response.status(201).json({ data: { id, ...input, slug, isActive: input.isActive ?? true } });
});

const updateTagHandler: RequestHandler = async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id);
  const input = parseOrThrow(tagInputSchema.partial(), request.body);
  if (Object.keys(input).length === 0) {
    throw new AppError(400, "Provide at least one field to update.", "EMPTY_UPDATE");
  }
  const [rows] = await pool.execute<TagRow[]>(
    "SELECT id, name, slug, description, is_active, created_at, updated_at FROM tags WHERE id = ?",
    [id],
  );
  const current = rows[0];
  if (!current) throw new AppError(404, "Tag not found.", "TAG_NOT_FOUND");
  const slug = input.slug === undefined ? current.slug : await createUniqueSlug("tags", input.slug, 140, id);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE tags SET name = ?, slug = ?, description = ?, is_active = ? WHERE id = ?`,
      [
        input.name ?? current.name,
        slug,
        input.description === undefined ? current.description : input.description,
        input.isActive === undefined ? current.is_active : input.isActive,
        id,
      ],
    );
    await recordSlugRedirect(connection, "TAG", current.slug, slug);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (isDuplicateEntry(error)) {
      throw new AppError(409, "Tag name or slug already exists.", "TAG_CONFLICT");
    }
    throw error;
  } finally {
    connection.release();
  }
  response.status(200).json({ data: { ...mapTag(current), ...input, slug, id } });
};

adminRouter.put("/tags/:id", updateTagHandler);
adminRouter.patch("/tags/:id", updateTagHandler);

adminRouter.delete("/tags/:id", async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id);
  const [result] = await pool.execute<ResultSetHeader>("DELETE FROM tags WHERE id = ?", [id]);
  if (result.affectedRows === 0) throw new AppError(404, "Tag not found.", "TAG_NOT_FOUND");
  response.status(204).end();
});

/* =========================================================================
   4. POST MANAGEMENT
   ========================================================================= */
adminRouter.get("/posts", async (request, response) => {
  const query = parseOrThrow(listQuerySchema, request.query);
  const pattern = `%${escapeLike(query.search)}%`;
  const conditions = [
    "p.deleted_at IS NULL",
    "(p.title LIKE ? OR p.slug LIKE ? OR u.username LIKE ?)",
  ];
  const values: Array<string | number> = [pattern, pattern, pattern];
  if (query.status) {
    conditions.push("p.status = ?");
    values.push(query.status);
  }
  if (query.startDate) {
    conditions.push("p.created_at >= ?");
    values.push(`${query.startDate} 00:00:00`);
  }
  if (query.endDate) {
    conditions.push("p.created_at <= ?");
    values.push(`${query.endDate} 23:59:59.999`);
  }
  const where = conditions.join(" AND ");
  const [countRows] = await pool.execute<CountRow[]>(
    `SELECT COUNT(*) AS total FROM posts p JOIN users u ON u.id = p.author_id WHERE ${where}`,
    values,
  );
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id, p.title, p.slug, p.excerpt, p.status, p.published_at AS publishedAt,
            p.submitted_at AS submittedAt, p.reviewed_at AS reviewedAt, p.rejection_reason AS rejectionReason,
            p.created_at AS createdAt, p.updated_at AS updatedAt,
            u.id AS authorId, u.username AS authorUsername,
            c.id AS categoryId, c.name AS categoryName, c.slug AS categorySlug,
            i.id AS featuredImageId, i.file_path AS featuredImagePath,
            (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.deleted_at IS NULL) AS commentCount,
            (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.status = 'PENDING' AND cm.deleted_at IS NULL) AS pendingCommentCount,
            (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.status = 'APPROVED' AND cm.deleted_at IS NULL) AS approvedCommentCount,
            (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likeCount,
            (SELECT COUNT(*) FROM post_views v WHERE v.post_id = p.id) AS viewCount
     FROM posts p
     JOIN users u ON u.id = p.author_id
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN images i ON i.id = p.featured_image_id
     WHERE ${where}
     ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [...values, query.limit, paginationOffset(query.page, query.limit)],
  );
  response.status(200).json({
    data: rows,
    pagination: formatPagination(query.page, query.limit, countRows[0].total),
  });
});



adminRouter.get("/posts/:id", async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id);
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id, p.title, p.slug, p.excerpt, p.content, p.status, p.published_at AS publishedAt,
            p.submitted_at AS submittedAt, p.reviewed_at AS reviewedAt, p.rejection_reason AS rejectionReason,
            p.created_at AS createdAt, p.updated_at AS updatedAt,
            u.id AS authorId, u.username AS authorUsername, u.email AS authorEmail,
            upi_img.file_path AS authorProfileImagePath,
            c.id AS categoryId, c.name AS categoryName, c.slug AS categorySlug,
            i.id AS featuredImageId, i.file_path AS featuredImagePath,
            seo.id AS seoId, seo.title AS seoTitle, seo.description AS seoDescription,
            seo.keywords AS seoKeywords, seo.canonical_url AS seoCanonicalUrl,
            (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.deleted_at IS NULL) AS commentCount,
            (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.status = 'PENDING' AND cm.deleted_at IS NULL) AS pendingCommentCount,
            (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.status = 'APPROVED' AND cm.deleted_at IS NULL) AS approvedCommentCount,
            (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likeCount,
            (SELECT COUNT(*) FROM post_views v WHERE v.post_id = p.id) AS viewCount
     FROM posts p
     JOIN users u ON u.id = p.author_id
     LEFT JOIN user_profile_images upi ON upi.user_id = u.id
     LEFT JOIN images upi_img ON upi_img.id = upi.image_id
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN images i ON i.id = p.featured_image_id
     LEFT JOIN seo_metadata seo ON seo.post_id = p.id
     WHERE p.id = ? AND p.deleted_at IS NULL LIMIT 1`,
    [id],
  );
  if (!rows[0]) throw new AppError(404, "Post not found.", "POST_NOT_FOUND");

  const [tags] = await pool.execute<RowDataPacket[]>(
    `SELECT t.id, t.name, t.slug FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id = ? ORDER BY t.name`,
    [id],
  );
  const [images] = await pool.execute<RowDataPacket[]>(
    `SELECT pi.image_id AS id, i.file_path AS path, pi.position, pi.caption
     FROM post_images pi JOIN images i ON i.id = pi.image_id
     WHERE pi.post_id = ? ORDER BY pi.position`,
    [id],
  );
  const [reviews] = await pool.execute<RowDataPacket[]>(
    `SELECT r.id, r.decision, r.reason, r.created_at AS createdAt, u.username AS reviewer
     FROM post_reviews r JOIN users u ON u.id = r.reviewer_id
     WHERE r.post_id = ? ORDER BY r.created_at DESC`,
    [id],
  );
  response.status(200).json({ data: { ...rows[0], tags, images, reviews } });
});

const postReviewStatusHandler: RequestHandler = async (request, response) => {
  const postId = parseOrThrow(uuidSchema, request.params.id);
  const input = parseOrThrow(reviewSchema, request.body);
  const decision = input.decision ?? input.status!;
  const reviewerId = request.user!.id;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [postRows] = await connection.execute<Array<RowDataPacket & { status: string }>>(
      "SELECT status FROM posts WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
      [postId],
    );
    if (!postRows[0]) throw new AppError(404, "Post not found.", "POST_NOT_FOUND");

    const publishedAt = decision === "APPROVED" ? new Date() : null;
    const rejectionReason = decision === "REJECTED" ? input.reason ?? null : null;

    await connection.execute(
      `UPDATE posts SET status = ?, reviewed_at = UTC_TIMESTAMP(3),
       published_at = COALESCE(?, published_at), rejection_reason = ? WHERE id = ?`,
      [decision, publishedAt, rejectionReason, postId],
    );
    if (decision === "APPROVED" || decision === "REJECTED") {
      await connection.execute(
        "INSERT INTO post_reviews (id, post_id, reviewer_id, decision, reason) VALUES (?, ?, ?, ?, ?)",
        [randomUUID(), postId, reviewerId, decision, input.reason ?? null],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  response.status(200).json({ data: { id: postId, status: decision } });
};

adminRouter.post("/posts/:id/review", postReviewStatusHandler);
adminRouter.put("/posts/:id/status", postReviewStatusHandler);
adminRouter.patch("/posts/:id/status", postReviewStatusHandler);

adminRouter.post("/posts", async (request, response) => {
  const input = parseOrThrow(adminPostSchema, request.body);
  const authorId = input.authorId ?? request.user!.id;
  const [authors] = await pool.execute<Array<RowDataPacket & { id: string }>>(
    "SELECT id FROM users WHERE id = ? AND is_active = TRUE AND deleted_at IS NULL LIMIT 1",
    [authorId],
  );
  if (!authors[0]) throw new AppError(400, "Post author is unavailable.", "INVALID_AUTHOR");
  const [categories] = await pool.execute<Array<RowDataPacket & { id: string }>>(
    "SELECT id FROM categories WHERE id = ? AND is_active = TRUE LIMIT 1",
    [input.categoryId],
  );
  if (!categories[0]) throw new AppError(400, "Category is unavailable.", "INVALID_CATEGORY");
  if (input.featuredImageId) {
    const [images] = await pool.execute<Array<RowDataPacket & { id: string }>>(
      "SELECT id FROM images WHERE id = ? LIMIT 1",
      [input.featuredImageId],
    );
    if (!images[0]) throw new AppError(400, "Featured image is unavailable.", "INVALID_IMAGE");
  }
  const uniqueTags = [...new Set(input.tagIds)];
  if (uniqueTags.length > 0) {
    const [tags] = await pool.execute<Array<RowDataPacket & { id: string }>>(
      `SELECT id FROM tags WHERE id IN (${uniqueTags.map(() => "?").join(",")})`,
      uniqueTags,
    );
    if (tags.length !== uniqueTags.length) throw new AppError(400, "One or more tags are unavailable.", "INVALID_TAG");
  }
  const uniqueGalleryIds = [...new Set(input.imageIds)];
  if (uniqueGalleryIds.length > 0) {
    const placeholders = uniqueGalleryIds.map(() => "?").join(",");
    const [galleryImages] = await pool.execute<Array<RowDataPacket & { id: string }>>(
      `SELECT id FROM images WHERE id IN (${placeholders})`,
      uniqueGalleryIds,
    );
    if (galleryImages.length !== uniqueGalleryIds.length) {
      throw new AppError(400, "One or more selected images are unavailable.", "INVALID_IMAGE");
    }
  }
  const id = randomUUID();
  const slug = await createUniqueSlug("posts", input.slug ?? input.title, 220);
  const publishedAt = input.status === "APPROVED" ? new Date() : null;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO posts
        (id, author_id, category_id, featured_image_id, title, slug, excerpt, content,
        status, submitted_at, reviewed_at, published_at, rejection_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, authorId, input.categoryId, input.featuredImageId ?? null,
        input.title, slug, input.excerpt ?? null, input.content, input.status,
        input.status === "PENDING" || input.status === "APPROVED" ? new Date() : null,
        input.status === "APPROVED" || input.status === "REJECTED" ? new Date() : null,
        publishedAt,
        input.status === "REJECTED" ? input.rejectionReason ?? null : null,
      ],
    );
    for (const tagId of uniqueTags) {
      await connection.execute("INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)", [id, tagId]);
    }
    for (let position = 0; position < uniqueGalleryIds.length; position++) {
      await connection.execute(
        "INSERT INTO post_images (post_id, image_id, position) VALUES (?, ?, ?)",
        [id, uniqueGalleryIds[position], position],
      );
    }
    if (input.seoTitle || input.seoDescription || input.seoKeywords) {
      await connection.execute(
        `INSERT INTO seo_metadata (id, post_id, title, description, keywords, canonical_url, robots_index, robots_follow)
         VALUES (?, ?, ?, ?, ?, ?, TRUE, TRUE)
         ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), keywords = VALUES(keywords)`,
        [
          randomUUID(),
          id,
          input.seoTitle ?? null,
          input.seoDescription ?? null,
          input.seoKeywords ?? null,
          `${env.PUBLIC_SITE_URL}/blogs/${slug}`,
        ],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (isDuplicateEntry(error)) throw new AppError(409, "Post slug already exists.", "SLUG_CONFLICT");
    throw error;
  } finally {
    connection.release();
  }
  response.status(201).json({ data: { id, ...input, authorId, slug, publishedAt } });
});

const updatePostHandler: RequestHandler = async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id);
  const input = parseOrThrow(adminPostUpdateSchema, request.body);
  const [rows] = await pool.execute<Array<RowDataPacket & {
    author_id: string; category_id: string; featured_image_id: string | null;
    title: string; slug: string; excerpt: string | null; content: string; status: string;
  }>>(
    `SELECT author_id, category_id, featured_image_id, title, slug, excerpt, content, status
     FROM posts WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );
  const current = rows[0];
  if (!current) throw new AppError(404, "Post not found.", "POST_NOT_FOUND");
  const authorId = input.authorId ?? current.author_id;
  const categoryId = input.categoryId ?? current.category_id;
  const featuredImageId = input.featuredImageId === undefined
    ? current.featured_image_id
    : input.featuredImageId;
  const status = input.status ?? current.status;
  const [authors] = await pool.execute<Array<RowDataPacket & { id: string }>>(
    "SELECT id FROM users WHERE id = ? AND is_active = TRUE AND deleted_at IS NULL",
    [authorId],
  );
  const [categories] = await pool.execute<Array<RowDataPacket & { id: string }>>(
    "SELECT id FROM categories WHERE id = ? AND is_active = TRUE",
    [categoryId],
  );
  if (!authors[0]) throw new AppError(400, "Post author is unavailable.", "INVALID_AUTHOR");
  if (!categories[0]) throw new AppError(400, "Category is unavailable.", "INVALID_CATEGORY");
  if (featuredImageId) {
    const [images] = await pool.execute<Array<RowDataPacket & { id: string }>>(
      "SELECT id FROM images WHERE id = ? LIMIT 1",
      [featuredImageId],
    );
    if (!images[0]) throw new AppError(400, "Featured image is unavailable.", "INVALID_IMAGE");
  }
  const tagIds = input.tagIds ? [...new Set(input.tagIds)] : null;
  if (tagIds && tagIds.length > 0) {
    const [tags] = await pool.execute<Array<RowDataPacket & { id: string }>>(
      `SELECT id FROM tags WHERE id IN (${tagIds.map(() => "?").join(",")})`,
      tagIds,
    );
    if (tags.length !== tagIds.length) throw new AppError(400, "One or more tags are unavailable.", "INVALID_TAG");
  }
  const galleryIds = input.imageIds ? [...new Set(input.imageIds)] : null;
  if (galleryIds && galleryIds.length > 0) {
    const [gallery] = await pool.execute<Array<RowDataPacket & { id: string }>>(
      `SELECT id FROM images WHERE id IN (${galleryIds.map(() => "?").join(",")})`,
      galleryIds,
    );
    if (gallery.length !== galleryIds.length) throw new AppError(400, "One or more images are unavailable.", "INVALID_IMAGE");
  }
  const title = input.title ?? current.title;
  const slug = input.slug === undefined
    ? current.slug
    : await createUniqueSlug("posts", input.slug, 220, id);
  const publishedAt = status === "APPROVED" ? new Date() : null;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE posts
       SET author_id = ?, category_id = ?, featured_image_id = ?,
           title = ?, slug = ?, excerpt = ?, content = ?, status = ?,
           published_at = COALESCE(?, published_at),
           rejection_reason = ?
       WHERE id = ?`,
      [
        authorId, categoryId, featuredImageId,
        title, slug,
        input.excerpt === undefined ? current.excerpt : input.excerpt,
        input.content ?? current.content,
        status,
        publishedAt,
        status === "REJECTED"
          ? input.rejectionReason ?? null
          : null,
        id,
      ],
    );
    if (tagIds) {
      await connection.execute("DELETE FROM post_tags WHERE post_id = ?", [id]);
      for (const tagId of tagIds) {
        await connection.execute("INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)", [id, tagId]);
      }
    }
    if (galleryIds) {
      await connection.execute("DELETE FROM post_images WHERE post_id = ?", [id]);
      for (let position = 0; position < galleryIds.length; position++) {
        await connection.execute(
          "INSERT INTO post_images (post_id, image_id, position) VALUES (?, ?, ?)",
          [id, galleryIds[position], position],
        );
      }
    }
    if (input.seoTitle !== undefined || input.seoDescription !== undefined || input.seoKeywords !== undefined) {
      const [existingSeo] = await connection.execute<Array<RowDataPacket & {
        id: string;
        title: string | null;
        description: string | null;
        keywords: string | null;
      }>>(
        "SELECT id, title, description, keywords FROM seo_metadata WHERE post_id = ? LIMIT 1",
        [id],
      );

      if (existingSeo[0]) {
        const nextTitle = input.seoTitle !== undefined ? input.seoTitle : existingSeo[0].title;
        const nextDescription = input.seoDescription !== undefined ? input.seoDescription : existingSeo[0].description;
        const nextKeywords = input.seoKeywords !== undefined ? input.seoKeywords : existingSeo[0].keywords;

        await connection.execute(
          "UPDATE seo_metadata SET title = ?, description = ?, keywords = ? WHERE post_id = ?",
          [nextTitle, nextDescription, nextKeywords, id],
        );
      } else if (input.seoTitle || input.seoDescription || input.seoKeywords) {
        await connection.execute(
          `INSERT INTO seo_metadata (id, post_id, title, description, keywords, canonical_url, robots_index, robots_follow)
           VALUES (?, ?, ?, ?, ?, ?, TRUE, TRUE)`,
          [
            randomUUID(),
            id,
            input.seoTitle ?? null,
            input.seoDescription ?? null,
            input.seoKeywords ?? null,
            `${env.PUBLIC_SITE_URL}/blogs/${slug}`,
          ],
        );
      }
    }
    await recordSlugRedirect(connection, "POST", current.slug, slug);
    if (status !== current.status && (status === "APPROVED" || status === "REJECTED")) {
      await connection.execute(
        `INSERT INTO post_reviews (id, post_id, reviewer_id, decision, reason)
         VALUES (?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          id,
          request.user!.id,
          status,
          status === "REJECTED" ? input.rejectionReason ?? null : null,
        ],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (isDuplicateEntry(error)) throw new AppError(409, "Post slug already exists.", "SLUG_CONFLICT");
    throw error;
  } finally {
    connection.release();
  }
  response.status(200).json({ data: { id, authorId, categoryId, featuredImageId, title, slug, status } });
};

adminRouter.put("/posts/:id", updatePostHandler);
adminRouter.patch("/posts/:id", updatePostHandler);

adminRouter.delete("/posts/:id", async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id);
  const [result] = await pool.execute<ResultSetHeader>(
    "UPDATE posts SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ? AND deleted_at IS NULL",
    [id],
  );
  if (result.affectedRows === 0) throw new AppError(404, "Post not found.", "POST_NOT_FOUND");
  response.status(204).end();
});

/* =========================================================================
   5. COMMENT MANAGEMENT
   ========================================================================= */
adminRouter.get("/comments", async (request, response) => {
  const query = parseOrThrow(
    paginationSchema.merge(dateRangeSchema).extend({
      status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
      search: z.string().trim().max(100).default(""),
    }),
    request.query,
  );
  const conditions = ["c.deleted_at IS NULL"];
  const values: Array<string | number> = [];
  if (query.status) {
    conditions.push("c.status = ?");
    values.push(query.status);
  }
  if (query.search) {
    const pattern = `%${escapeLike(query.search)}%`;
    conditions.push("(c.content LIKE ? OR u.username LIKE ? OR p.title LIKE ?)");
    values.push(pattern, pattern, pattern);
  }
  if (query.startDate) {
    conditions.push("c.created_at >= ?");
    values.push(`${query.startDate} 00:00:00`);
  }
  if (query.endDate) {
    conditions.push("c.created_at <= ?");
    values.push(`${query.endDate} 23:59:59.999`);
  }
  const where = conditions.join(" AND ");
  const [countRows] = await pool.execute<CountRow[]>(
    `SELECT COUNT(*) AS total FROM comments c
     JOIN users u ON u.id = c.author_id
     JOIN posts p ON p.id = c.post_id
     WHERE ${where}`,
    values,
  );
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id, c.content, c.status, c.created_at AS createdAt,
            u.id AS authorId, u.username AS authorUsername,
            p.id AS postId, p.title AS postTitle, p.slug AS postSlug
     FROM comments c JOIN users u ON u.id = c.author_id JOIN posts p ON p.id = c.post_id
     WHERE ${where} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
    [...values, query.limit, paginationOffset(query.page, query.limit)],
  );
  response.status(200).json({
    data: rows,
    pagination: formatPagination(query.page, query.limit, countRows[0].total),
  });
});



const commentModerationHandler: RequestHandler = async (request, response) => {
  const commentId = parseOrThrow(uuidSchema, request.params.id);
  const input = parseOrThrow(commentStatusSchema, request.body);
  const decision = input.decision ?? input.status;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<Array<RowDataPacket & { status: string }>>(
      "SELECT status FROM comments WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
      [commentId],
    );
    if (!rows[0]) throw new AppError(404, "Comment not found.", "COMMENT_NOT_FOUND");

    await connection.execute("UPDATE comments SET status = ? WHERE id = ?", [decision, commentId]);
    await connection.execute(
      "INSERT INTO comment_reviews (id, comment_id, reviewer_id, decision, reason) VALUES (?, ?, ?, ?, ?)",
      [randomUUID(), commentId, request.user!.id, decision, input.reason ?? null],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  response.status(200).json({ data: { id: commentId, status: decision } });
};

adminRouter.put("/comments/:id/status", commentModerationHandler);
adminRouter.patch("/comments/:id/status", commentModerationHandler);
adminRouter.patch("/comments/:id/moderation", commentModerationHandler);

adminRouter.delete("/comments/:id", async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id);
  const [result] = await pool.execute<ResultSetHeader>(
    "UPDATE comments SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ? AND deleted_at IS NULL",
    [id],
  );
  if (result.affectedRows === 0) throw new AppError(404, "Comment not found.", "COMMENT_NOT_FOUND");
  response.status(204).end();
});

/* =========================================================================
   6. USER MANAGEMENT
   ========================================================================= */
adminRouter.get("/users", async (request, response) => {
  const query = parseOrThrow(
    paginationSchema.merge(dateRangeSchema).extend({
      search: z.string().trim().max(100).default(""),
      role: z.enum(["USER", "ADMIN"]).optional(),
      status: z.enum(["active", "inactive"]).optional(),
    }),
    request.query,
  );
  const pattern = `%${escapeLike(query.search)}%`;
  const conditions = [
    "u.deleted_at IS NULL",
    "(u.username LIKE ? OR u.email LIKE ?)",
  ];
  const values: Array<string | number> = [pattern, pattern];

  if (query.role) {
    conditions.push("u.role = ?");
    values.push(query.role);
  }
  if (query.status) {
    conditions.push("u.is_active = ?");
    values.push(query.status === "active" ? 1 : 0);
  }
  if (query.startDate) {
    conditions.push("u.created_at >= ?");
    values.push(`${query.startDate} 00:00:00`);
  }
  if (query.endDate) {
    conditions.push("u.created_at <= ?");
    values.push(`${query.endDate} 23:59:59.999`);
  }

  const where = conditions.join(" AND ");
  const [countRows] = await pool.execute<CountRow[]>(
    `SELECT COUNT(*) AS total FROM users u WHERE ${where}`,
    values,
  );
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.id, u.username, u.email, u.role, u.is_active AS isActive, u.created_at AS createdAt,
            i.file_path AS profileImagePath,
            (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id AND p.deleted_at IS NULL) AS totalPosts,
            (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id AND p.status = 'APPROVED' AND p.deleted_at IS NULL) AS publishedPosts,
            (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id AND p.status = 'PENDING' AND p.deleted_at IS NULL) AS pendingPosts,
            (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id AND p.status = 'REJECTED' AND p.deleted_at IS NULL) AS rejectedPosts,
            (SELECT COUNT(*) FROM comments c WHERE c.author_id = u.id AND c.deleted_at IS NULL) AS totalComments,
            (SELECT COUNT(*) FROM post_likes l JOIN posts p ON p.id = l.post_id WHERE p.author_id = u.id) AS totalLikesReceived
     FROM users u
     LEFT JOIN user_profile_images upi ON upi.user_id = u.id
     LEFT JOIN images i ON i.id = upi.image_id
     WHERE ${where}
     ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    [...values, query.limit, paginationOffset(query.page, query.limit)],
  );
  response.status(200).json({
    data: rows,
    pagination: formatPagination(query.page, query.limit, countRows[0].total),
  });
});



adminRouter.get("/users/:id", async (request, response) => {
  const userId = parseOrThrow(uuidSchema, request.params.id);
  const [users] = await pool.execute<RowDataPacket[]>(
    `SELECT u.id, u.username, u.email, u.role, u.bio, u.is_active AS isActive, u.created_at AS createdAt,
            i.file_path AS profileImagePath,
            (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id AND p.deleted_at IS NULL) AS totalPosts,
            (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id AND p.status = 'APPROVED' AND p.deleted_at IS NULL) AS publishedPosts,
            (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id AND p.status = 'PENDING' AND p.deleted_at IS NULL) AS pendingPosts,
            (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id AND p.status = 'REJECTED' AND p.deleted_at IS NULL) AS rejectedPosts,
            (SELECT COUNT(*) FROM comments c WHERE c.author_id = u.id AND c.deleted_at IS NULL) AS totalComments,
            (SELECT COUNT(*) FROM post_likes l JOIN posts p ON p.id = l.post_id WHERE p.author_id = u.id) AS totalLikesReceived
     FROM users u
     LEFT JOIN user_profile_images upi ON upi.user_id = u.id
     LEFT JOIN images i ON i.id = upi.image_id
     WHERE u.id = ? AND u.deleted_at IS NULL LIMIT 1`,
    [userId],
  );
  if (!users[0]) throw new AppError(404, "User not found.", "USER_NOT_FOUND");

  const [recentPosts] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id, p.title, p.slug, p.status, p.created_at AS createdAt, c.name AS category
     FROM posts p JOIN categories c ON c.id = p.category_id
     WHERE p.author_id = ? AND p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT 10`,
    [userId],
  );

  const [recentComments] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id, c.content, c.status, c.created_at AS createdAt, p.title AS postTitle, p.slug AS postSlug
     FROM comments c JOIN posts p ON p.id = c.post_id
     WHERE c.author_id = ? AND c.deleted_at IS NULL ORDER BY c.created_at DESC LIMIT 10`,
    [userId],
  );

  response.status(200).json({
    data: {
      user: users[0],
      recentPosts,
      recentComments,
    },
  });
});

const userStatusHandler: RequestHandler = async (request, response) => {
  const userId = parseOrThrow(uuidSchema, request.params.id);
  const input = parseOrThrow(userUpdateSchema, request.body);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<Array<RowDataPacket & {
      role: "USER" | "ADMIN";
      is_active: number | boolean;
    }>>(
      "SELECT role, is_active FROM users WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
      [userId],
    );
    const target = rows[0];
    if (!target) throw new AppError(404, "User not found.", "USER_NOT_FOUND");

    let nextActive = Boolean(target.is_active);
    if (input.isActive !== undefined) nextActive = input.isActive;
    if (input.status !== undefined) nextActive = input.status === "active";

    const nextRole = input.role ?? target.role;

    if (
      userId === request.user!.id &&
      (nextRole !== "ADMIN" || !nextActive)
    ) {
      throw new AppError(400, "You cannot remove your own admin access.", "SELF_DEMOTION_DENIED");
    }

    if (target.role === "ADMIN" && target.is_active && (nextRole !== "ADMIN" || !nextActive)) {
      const [admins] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE role = 'ADMIN' AND is_active = TRUE AND deleted_at IS NULL FOR UPDATE",
      );
      if (admins.length <= 1) {
        throw new AppError(409, "At least one active administrator must remain.", "LAST_ADMIN");
      }
    }

    await connection.execute(
      "UPDATE users SET role = ?, is_active = ? WHERE id = ?",
      [nextRole, nextActive, userId],
    );
    if (!nextActive) {
      await connection.execute(
        "UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP(3) WHERE user_id = ? AND revoked_at IS NULL",
        [userId],
      );
    }
    await connection.commit();
    response.status(200).json({ data: { id: userId, role: nextRole, isActive: nextActive } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

adminRouter.put("/users/:id/status", userStatusHandler);
adminRouter.patch("/users/:id/status", userStatusHandler);
adminRouter.put("/users/:id", userStatusHandler);
adminRouter.patch("/users/:id", userStatusHandler);

adminRouter.delete("/users/:id", async (request, response) => {
  const userId = parseOrThrow(uuidSchema, request.params.id);
  if (userId === request.user!.id) {
    throw new AppError(400, "You cannot delete your own account.", "SELF_DELETE_DENIED");
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.execute<Array<RowDataPacket & {
      role: "USER" | "ADMIN";
      is_active: number | boolean;
    }>>(
      "SELECT role, is_active FROM users WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
      [userId],
    );
    const target = users[0];
    if (!target) throw new AppError(404, "User not found.", "USER_NOT_FOUND");
    if (target.role === "ADMIN" && target.is_active) {
      const [admins] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE role = 'ADMIN' AND is_active = TRUE AND deleted_at IS NULL FOR UPDATE",
      );
      if (admins.length <= 1) {
        throw new AppError(409, "At least one active administrator must remain.", "LAST_ADMIN");
      }
    }
    await connection.execute(
      "UPDATE users SET is_active = FALSE, deleted_at = UTC_TIMESTAMP(3) WHERE id = ?",
      [userId],
    );
    await connection.execute(
      "UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP(3) WHERE user_id = ? AND revoked_at IS NULL",
      [userId],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  response.status(204).end();
});

/* =========================================================================
   7. CONTACT MESSAGES
   ========================================================================= */
adminRouter.get("/contacts", async (request, response) => {
  const query = parseOrThrow(
    paginationSchema.merge(dateRangeSchema).extend({
      status: z.enum(["NEW", "READ", "RESOLVED"]).optional(),
      search: z.string().trim().max(100).default(""),
    }),
    request.query,
  );
  const conditions: string[] = [];
  const values: Array<string | number> = [];
  if (query.status) {
    conditions.push("status = ?");
    values.push(query.status);
  }
  if (query.search) {
    const pattern = `%${escapeLike(query.search)}%`;
    conditions.push("(name LIKE ? OR email LIKE ? OR subject LIKE ? OR message LIKE ?)");
    values.push(pattern, pattern, pattern, pattern);
  }
  if (query.startDate) {
    conditions.push("created_at >= ?");
    values.push(`${query.startDate} 00:00:00`);
  }
  if (query.endDate) {
    conditions.push("created_at <= ?");
    values.push(`${query.endDate} 23:59:59.999`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [countRows] = await pool.execute<CountRow[]>(
    `SELECT COUNT(*) AS total FROM contact_messages ${where}`,
    values,
  );
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, name, email, subject, message, status, created_at AS createdAt
     FROM contact_messages ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, query.limit, paginationOffset(query.page, query.limit)],
  );
  response.status(200).json({
    data: rows,
    pagination: formatPagination(query.page, query.limit, countRows[0].total),
  });
});



const updateContactStatusHandler: RequestHandler = async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id);
  const input = parseOrThrow(z.object({ status: z.enum(["NEW", "READ", "RESOLVED"]) }).strict(), request.body);
  const [result] = await pool.execute<ResultSetHeader>(
    "UPDATE contact_messages SET status = ? WHERE id = ?",
    [input.status, id],
  );
  if (result.affectedRows === 0) {
    const [rows] = await pool.execute<Array<RowDataPacket & { id: string }>>(
      "SELECT id FROM contact_messages WHERE id = ?",
      [id],
    );
    if (!rows[0]) throw new AppError(404, "Contact message not found.", "CONTACT_NOT_FOUND");
  }
  response.status(200).json({ data: { id, status: input.status } });
};

adminRouter.put("/contacts/:id/status", updateContactStatusHandler);
adminRouter.patch("/contacts/:id/status", updateContactStatusHandler);

/* =========================================================================
   8. MEDIA / IMAGES DIRECTORY
   ========================================================================= */
adminRouter.get("/images", async (request, response) => {
  const query = parseOrThrow(
    paginationSchema.merge(dateRangeSchema).extend({ search: z.string().trim().max(100).default("") }),
    request.query,
  );
  const pattern = `%${escapeLike(query.search)}%`;
  const conditions = [
    "(i.file_name LIKE ? OR i.original_file_name LIKE ? OR u.username LIKE ?)",
  ];
  const values: Array<string | number> = [pattern, pattern, pattern];
  if (query.startDate) {
    conditions.push("i.created_at >= ?");
    values.push(`${query.startDate} 00:00:00`);
  }
  if (query.endDate) {
    conditions.push("i.created_at <= ?");
    values.push(`${query.endDate} 23:59:59.999`);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;
  const [countRows] = await pool.execute<CountRow[]>(
    `SELECT COUNT(*) AS total FROM images i
     JOIN users u ON u.id = i.uploaded_by_id
     ${where}`,
    values,
  );
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT i.id, i.file_name AS fileName, i.original_file_name AS originalFileName,
            i.file_path AS path, i.mime_type AS mimeType, i.file_size AS fileSize,
            i.created_at AS createdAt, u.id AS uploadedById, u.username AS uploadedBy
     FROM images i JOIN users u ON u.id = i.uploaded_by_id
     ${where}
     ORDER BY i.created_at DESC LIMIT ? OFFSET ?`,
    [...values, query.limit, paginationOffset(query.page, query.limit)],
  );
  response.status(200).json({
    data: rows,
    pagination: formatPagination(query.page, query.limit, countRows[0].total),
  });
});

adminRouter.delete("/images/:id", async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [images] = await connection.execute<Array<RowDataPacket & {
      id: string;
      file_name: string;
      file_path: string;
    }>>(
      "SELECT id, file_name, file_path FROM images WHERE id = ? FOR UPDATE",
      [id],
    );
    const image = images[0];
    if (!image) {
      throw new AppError(404, "Image not found.", "IMAGE_NOT_FOUND");
    }

    // 1. Check if used as featured image in posts
    const [featuredPosts] = await connection.execute<Array<RowDataPacket & { title: string }>>(
      "SELECT title FROM posts WHERE featured_image_id = ? AND deleted_at IS NULL LIMIT 1",
      [id],
    );
    if (featuredPosts[0]) {
      throw new AppError(
        409,
        `Cannot delete image because it is used as the featured image for post "${featuredPosts[0].title}".`,
        "IMAGE_IN_USE",
      );
    }

    // 2. Check if used in post gallery images
    const [galleryPosts] = await connection.execute<Array<RowDataPacket & { title: string }>>(
      `SELECT p.title FROM post_images pi
       JOIN posts p ON p.id = pi.post_id
       WHERE pi.image_id = ? AND p.deleted_at IS NULL LIMIT 1`,
      [id],
    );
    if (galleryPosts[0]) {
      throw new AppError(
        409,
        `Cannot delete image because it is used in the gallery of post "${galleryPosts[0].title}".`,
        "IMAGE_IN_USE",
      );
    }

    // 3. Check if used as category cover image
    const [categories] = await connection.execute<Array<RowDataPacket & { name: string }>>(
      "SELECT name FROM categories WHERE image_id = ? LIMIT 1",
      [id],
    );
    if (categories[0]) {
      throw new AppError(
        409,
        `Cannot delete image because it is used as the cover image for category "${categories[0].name}".`,
        "IMAGE_IN_USE",
      );
    }

    // 4. Check if used as user profile image
    const [users] = await connection.execute<Array<RowDataPacket & { username: string }>>(
      `SELECT u.username FROM user_profile_images upi
       JOIN users u ON u.id = upi.user_id
       WHERE upi.image_id = ? AND u.deleted_at IS NULL LIMIT 1`,
      [id],
    );
    if (users[0]) {
      throw new AppError(
        409,
        `Cannot delete image because it is used as the profile picture for user "${users[0].username}".`,
        "IMAGE_IN_USE",
      );
    }

    // Delete image database record
    await connection.execute("DELETE FROM images WHERE id = ?", [id]);
    await connection.commit();

    // Safely remove physical file from disk
    const safeFileName = path.basename(image.file_name);
    const physicalPath = path.resolve(uploadDir, safeFileName);
    if (physicalPath.startsWith(uploadDir)) {
      try {
        await unlink(physicalPath);
      } catch (fileError) {
        logger.warn({ err: fileError, physicalPath }, "Physical image file was not found on disk during deletion");
      }
    }

    response.status(204).end();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});



/* =========================================================================
   9. SEO MANAGEMENT
   ========================================================================= */
adminRouter.get("/seo", async (request, response) => {
  const query = parseOrThrow(
    paginationSchema.extend({
      search: z.string().trim().max(100).default(""),
      type: z.string().trim().default("all"),
    }),
    request.query,
  );

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (query.type === "page") {
    conditions.push("s.page_key IS NOT NULL");
  } else if (query.type === "post") {
    conditions.push("s.post_id IS NOT NULL");
  } else if (query.type === "category") {
    conditions.push("s.category_id IS NOT NULL");
  } else if (query.type === "tag") {
    conditions.push("s.tag_id IS NOT NULL");
  }

  if (query.search) {
    const pattern = `%${escapeLike(query.search)}%`;
    conditions.push(
      "(s.title LIKE ? OR s.description LIKE ? OR s.page_key LIKE ? OR p.title LIKE ? OR c.name LIKE ? OR t.name LIKE ?)",
    );
    params.push(pattern, pattern, pattern, pattern, pattern, pattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const [countRows] = await pool.execute<CountRow[]>(`
    SELECT COUNT(*) AS total
    FROM seo_metadata s
    LEFT JOIN posts p ON p.id = s.post_id
    LEFT JOIN categories c ON c.id = s.category_id
    LEFT JOIN tags t ON t.id = s.tag_id
    ${whereClause}
  `, params);

  const [rows] = await pool.execute<RowDataPacket[]>(`
    SELECT s.id, s.post_id AS postId, s.category_id AS categoryId, s.tag_id AS tagId, s.page_key AS pageKey,
           s.title, s.description, s.keywords, s.canonical_url AS canonicalUrl,
           s.og_title AS ogTitle, s.og_description AS ogDescription, s.og_image_url AS ogImageUrl,
           s.twitter_title AS twitterTitle, s.twitter_description AS twitterDescription, s.twitter_image_url AS twitterImageUrl,
           s.robots_index AS robotsIndex, s.robots_follow AS robotsFollow, s.updated_at AS updatedAt,
           p.title AS postTitle, p.slug AS postSlug,
           c.name AS categoryName, c.slug AS categorySlug,
           t.name AS tagName, t.slug AS tagSlug
    FROM seo_metadata s
    LEFT JOIN posts p ON p.id = s.post_id
    LEFT JOIN categories c ON c.id = s.category_id
    LEFT JOIN tags t ON t.id = s.tag_id
    ${whereClause}
    ORDER BY s.page_key IS NOT NULL DESC, s.updated_at DESC
    LIMIT ? OFFSET ?
  `, [...params, query.limit, paginationOffset(query.page, query.limit)]);

  response.status(200).json({
    data: rows,
    pagination: formatPagination(query.page, query.limit, countRows[0].total),
  });
});

adminRouter.get("/seo/:ownerType/:ownerId", async (request, response) => {
  const ownerType = parseOrThrow(z.enum(["post", "category", "tag", "page"]), request.params.ownerType);
  const ownerId = ownerType === "page" ? null : parseOrThrow(uuidSchema, request.params.ownerId);
  const pageKey = ownerType === "page"
    ? parseOrThrow(z.string().trim().min(1).max(100), request.params.ownerId)
    : null;
  const column = ownerType === "post" ? "post_id"
    : ownerType === "category" ? "category_id"
      : ownerType === "tag" ? "tag_id" : "page_key";
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, title, description, keywords, canonical_url AS canonicalUrl,
            og_title AS ogTitle, og_description AS ogDescription, og_image_url AS ogImageUrl,
            twitter_title AS twitterTitle, twitter_description AS twitterDescription, twitter_image_url AS twitterImageUrl,
            robots_index AS robotsIndex, robots_follow AS robotsFollow
     FROM seo_metadata WHERE ${column} = ? LIMIT 1`,
    [ownerId ?? pageKey],
  );
  response.status(200).json({ data: rows[0] ?? null });
});

adminRouter.put("/seo/:ownerType/:ownerId", async (request, response) => {
  const ownerType = parseOrThrow(z.enum(["post", "category", "tag", "page"]), request.params.ownerType);
  const ownerId = ownerType === "page" ? null : parseOrThrow(uuidSchema, request.params.ownerId);
  const pageKey = ownerType === "page"
    ? parseOrThrow(z.string().trim().min(1).max(100), request.params.ownerId)
    : null;
  const input = parseOrThrow(adminSeoInputSchema, request.body);
  const column = ownerType === "post" ? "post_id"
    : ownerType === "category" ? "category_id"
      : ownerType === "tag" ? "tag_id" : "page_key";

  if (ownerId) {
    const table = ownerType === "post" ? "posts" : ownerType === "category" ? "categories" : "tags";
    const [owners] = await pool.execute<Array<RowDataPacket & { id: string }>>(
      `SELECT id FROM ${table} WHERE id = ? LIMIT 1`,
      [ownerId],
    );
    if (!owners[0]) throw new AppError(404, `${ownerType} not found.`, "SEO_OWNER_NOT_FOUND");
  }

  const [existing] = await pool.execute<Array<RowDataPacket & { id: string }>>(
    `SELECT id FROM seo_metadata WHERE ${column} = ? LIMIT 1`,
    [ownerId ?? pageKey],
  );

  if (existing[0]) {
    await pool.execute(
      `UPDATE seo_metadata
       SET title = ?, description = ?, keywords = ?, canonical_url = ?,
           og_title = ?, og_description = ?, og_image_url = ?,
           twitter_title = ?, twitter_description = ?, twitter_image_url = ?,
           robots_index = COALESCE(?, robots_index),
           robots_follow = COALESCE(?, robots_follow),
           updated_at = UTC_TIMESTAMP(3)
       WHERE id = ?`,
      [
        input.title ?? null,
        input.description ?? null,
        input.keywords ?? null,
        input.canonicalUrl ?? null,
        input.ogTitle ?? null,
        input.ogDescription ?? null,
        input.ogImageUrl ?? null,
        input.twitterTitle ?? null,
        input.twitterDescription ?? null,
        input.twitterImageUrl ?? null,
        input.robotsIndex ?? null,
        input.robotsFollow ?? null,
        existing[0].id,
      ],
    );
    response.status(200).json({ data: { id: existing[0].id, ownerType, ownerId: ownerId ?? pageKey, ...input } });
    return;
  }

  const seoId = randomUUID();
  const ownerColumns = {
    post: ["post_id", ownerId, null, null, null],
    category: ["category_id", null, ownerId, null, null],
    tag: ["tag_id", null, null, ownerId, null],
    page: ["page_key", null, null, null, pageKey],
  } as const;
  const [ownerColumn, postId, categoryId, tagId, seoPageKey] = ownerColumns[ownerType];
  await pool.execute(
    `INSERT INTO seo_metadata
      (id, post_id, category_id, tag_id, page_key, title, description, keywords, canonical_url,
       og_title, og_description, og_image_url, twitter_title, twitter_description, twitter_image_url,
       robots_index, robots_follow)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      seoId,
      ownerColumn === "post_id" ? postId : null,
      ownerColumn === "category_id" ? categoryId : null,
      ownerColumn === "tag_id" ? tagId : null,
      ownerColumn === "page_key" ? seoPageKey : null,
      input.title ?? null,
      input.description ?? null,
      input.keywords ?? null,
      input.canonicalUrl ?? null,
      input.ogTitle ?? null,
      input.ogDescription ?? null,
      input.ogImageUrl ?? null,
      input.twitterTitle ?? null,
      input.twitterDescription ?? null,
      input.twitterImageUrl ?? null,
      input.robotsIndex ?? true,
      input.robotsFollow ?? true,
    ],
  );
  response.status(201).json({ data: { id: seoId, ownerType, ownerId: ownerId ?? pageKey, ...input } });
});

/* =========================================================================
   10. SITE SETTINGS
   ========================================================================= */
adminRouter.get("/settings", async (_request, response) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT `key`, `value`, updated_at AS updatedAt FROM site_settings ORDER BY `key`",
  );
  response.status(200).json({
    data: rows.map((row) => ({ key: row.key, value: row.value, updatedAt: row.updatedAt })),
  });
});

adminRouter.put("/settings/:key", async (request, response) => {
  const key = parseOrThrow(z.string().trim().regex(/^[a-z][a-z0-9_]{1,99}$/), request.params.key);
  const input = parseOrThrow(z.object({ value: z.string().max(10000) }).strict(), request.body);
  await pool.execute(
    `INSERT INTO site_settings (\`key\`, \`value\`) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`,
    [key, input.value],
  );
  response.status(200).json({ data: { key, value: input.value } });
});

function isDuplicateEntry(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY";
}
