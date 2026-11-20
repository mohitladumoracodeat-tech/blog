import { randomUUID } from "node:crypto";
import { Router, type Request, type Response, type RequestHandler } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { z } from "zod";
import { clearAuthCookies } from "../auth/auth.cookies";
import { hashPassword, verifyPassword } from "../auth/auth.service";
import { env } from "../config/env";
import { pool } from "../config/mysql";
import { AppError } from "../errors/app-error";
import { authenticate } from "../middleware/authenticate";
import { createUniqueSlug } from "../services/slug.service";
import { paginationOffset, paginationSchema, parseOrThrow } from "../utils/request-validation";

interface CountRow extends RowDataPacket {
  total: number;
}

const uuidSchema = z.string().uuid();

const profileSchema = z.object({
  username: z.string().trim().min(3).max(50).regex(/^[A-Za-z0-9_-]+$/).optional(),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)).optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  profileImageId: z.string().uuid().nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

const postBodySchema = z.object({
  title: z.string().trim().min(3).max(200),
  excerpt: z.string().trim().max(500).nullable().optional(),
  content: z.string().trim().min(1).max(16000000),
  categoryId: z.string().uuid(),
  featuredImageId: z.string().uuid().nullable().optional(),
  tagIds: z.array(z.string().uuid()).max(30).default([]),
  imageIds: z.array(z.string().uuid()).max(20).default([]),
  status: z.enum(["DRAFT", "PENDING"]).optional(),
  action: z.enum(["draft", "submit", "DRAFT", "SUBMIT"]).optional(),
  seoTitle: z.string().trim().max(200).nullable().optional(),
  seoDescription: z.string().trim().max(320).nullable().optional(),
  seoKeywords: z.string().trim().max(500).nullable().optional(),
}).strict();

const updatePostSchema = postBodySchema.partial().extend({
  tagIds: z.array(z.string().uuid()).max(30).optional(),
  imageIds: z.array(z.string().uuid()).max(20).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

function isDuplicateEntry(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY";
}

async function validatePostRelations(
  userId: string,
  categoryId: string,
  featuredImageId?: string | null,
  tagIds: string[] = [],
  imageIds: string[] = [],
): Promise<void> {
  const [categories] = await pool.execute<Array<RowDataPacket & { id: string }>>(
    "SELECT id FROM categories WHERE id = ? AND is_active = TRUE LIMIT 1",
    [categoryId],
  );
  if (!categories[0]) {
    throw new AppError(400, "Selected category is not available.", "INVALID_CATEGORY");
  }

  if (featuredImageId) {
    const [images] = await pool.execute<Array<RowDataPacket & { id: string }>>(
      "SELECT id FROM images WHERE id = ? AND uploaded_by_id = ? LIMIT 1",
      [featuredImageId, userId],
    );
    if (!images[0]) {
      throw new AppError(400, "Featured image is not available.", "INVALID_IMAGE");
    }
  }

  const uniqueImageIds = [...new Set(imageIds)];
  if (uniqueImageIds.length > 0) {
    const placeholders = uniqueImageIds.map(() => "?").join(",");
    const [images] = await pool.execute<Array<RowDataPacket & { id: string }>>(
      `SELECT id FROM images WHERE uploaded_by_id = ? AND id IN (${placeholders})`,
      [userId, ...uniqueImageIds],
    );
    if (images.length !== uniqueImageIds.length) {
      throw new AppError(400, "One or more selected gallery images are unavailable.", "INVALID_IMAGE");
    }
  }

  const uniqueIds = [...new Set(tagIds)];
  if (uniqueIds.length > 0) {
    const placeholders = uniqueIds.map(() => "?").join(",");
    const [tags] = await pool.execute<Array<RowDataPacket & { id: string }>>(
      `SELECT id FROM tags WHERE is_active = TRUE AND id IN (${placeholders})`,
      uniqueIds,
    );
    if (tags.length !== uniqueIds.length) {
      throw new AppError(400, "One or more selected tags are unavailable.", "INVALID_TAG");
    }
  }
}

export const userRouter = Router();
userRouter.use(authenticate);

/* =========================================================================
   1. USER DASHBOARD
   ========================================================================= */
userRouter.get("/dashboard", async (request, response) => {
  const userId = request.user!.id;
  const [stats] = await pool.execute<RowDataPacket[]>(
    `SELECT
      (SELECT COUNT(*) FROM posts WHERE author_id = ? AND deleted_at IS NULL) AS totalPosts,
      (SELECT COUNT(*) FROM posts WHERE author_id = ? AND status = 'APPROVED' AND deleted_at IS NULL) AS publishedPosts,
      (SELECT COUNT(*) FROM posts WHERE author_id = ? AND status = 'PENDING' AND deleted_at IS NULL) AS pendingPosts,
      (SELECT COUNT(*) FROM posts WHERE author_id = ? AND status = 'REJECTED' AND deleted_at IS NULL) AS rejectedPosts,
      (SELECT COUNT(*) FROM comments WHERE author_id = ? AND deleted_at IS NULL) AS totalComments,
      (SELECT COUNT(*) FROM comments WHERE author_id = ? AND status = 'PENDING' AND deleted_at IS NULL) AS pendingComments,
      (SELECT COUNT(*) FROM post_likes l JOIN posts p ON p.id = l.post_id
        WHERE p.author_id = ? AND p.deleted_at IS NULL) AS receivedLikes,
      (SELECT COUNT(*) FROM comments cm JOIN posts p ON p.id = cm.post_id
        WHERE p.author_id = ? AND cm.deleted_at IS NULL) AS receivedComments`,
    [userId, userId, userId, userId, userId, userId, userId, userId],
  );
  const [recentPosts] = await pool.execute<RowDataPacket[]>(
    `SELECT id, title, slug, status, created_at AS createdAt, updated_at AS updatedAt
     FROM posts WHERE author_id = ? AND deleted_at IS NULL
     ORDER BY updated_at DESC LIMIT 8`,
    [userId],
  );
  response.status(200).json({ data: { stats: stats[0], recentPosts } });
});

userRouter.get("/post-options", async (_request, response) => {
  const [categories] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, slug FROM categories WHERE is_active = TRUE ORDER BY name`,
  );
  const [tags] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, slug FROM tags WHERE is_active = TRUE ORDER BY name`,
  );
  response.status(200).json({ data: { categories, tags } });
});

/* =========================================================================
   2. USER PROFILE & PASSWORD
   ========================================================================= */
userRouter.get("/profile", async (request, response) => {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.id, u.username, u.email, u.role, u.bio, u.created_at AS createdAt,
            i.id AS profileImageId, i.file_path AS profileImagePath
     FROM users u
     LEFT JOIN user_profile_images upi ON upi.user_id = u.id
     LEFT JOIN images i ON i.id = upi.image_id
     WHERE u.id = ? AND u.deleted_at IS NULL LIMIT 1`,
    [request.user!.id],
  );
  if (!rows[0]) throw new AppError(404, "User not found.", "USER_NOT_FOUND");
  response.status(200).json({ data: { user: rows[0] } });
});

const updateProfileHandler: RequestHandler = async (request, response) => {
  const input = parseOrThrow(profileSchema, request.body);
  const userId = request.user!.id;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.execute<Array<RowDataPacket & { username: string; email: string; bio: string | null }>>(
      "SELECT username, email, bio FROM users WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
      [userId],
    );
    if (!users[0]) throw new AppError(404, "User not found.", "USER_NOT_FOUND");
    if (input.profileImageId) {
      const [images] = await connection.execute<Array<RowDataPacket & { id: string }>>(
        "SELECT id FROM images WHERE id = ? AND uploaded_by_id = ? LIMIT 1",
        [input.profileImageId, userId],
      );
      if (!images[0]) throw new AppError(400, "Profile image is unavailable.", "INVALID_IMAGE");
    }
    await connection.execute(
      "UPDATE users SET username = ?, email = ?, bio = ? WHERE id = ?",
      [
        input.username ?? users[0].username,
        input.email ?? users[0].email,
        input.bio === undefined ? users[0].bio : input.bio,
        userId,
      ],
    );
    if (input.profileImageId !== undefined) {
      if (input.profileImageId === null) {
        await connection.execute("DELETE FROM user_profile_images WHERE user_id = ?", [userId]);
      } else {
        await connection.execute(
          `INSERT INTO user_profile_images (user_id, image_id) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE image_id = VALUES(image_id)`,
          [userId, input.profileImageId],
        );
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (isDuplicateEntry(error)) {
      throw new AppError(409, "Username or email is already in use.", "ACCOUNT_CONFLICT");
    }
    throw error;
  } finally {
    connection.release();
  }
  const [updatedUsers] = await pool.execute<RowDataPacket[]>(
    `SELECT u.id, u.username, u.email, u.role, u.bio, u.created_at AS createdAt,
            i.id AS profileImageId, i.file_path AS profileImagePath
     FROM users u LEFT JOIN user_profile_images upi ON upi.user_id = u.id
     LEFT JOIN images i ON i.id = upi.image_id WHERE u.id = ? LIMIT 1`,
    [userId],
  );
  response.status(200).json({ data: { user: updatedUsers[0] } });
};

userRouter.put("/profile", updateProfileHandler);
userRouter.patch("/profile", updateProfileHandler);

const changePasswordHandler: RequestHandler = async (request, response) => {
  const input = parseOrThrow(z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string(),
  }).strict().refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  }), request.body);
  const [rows] = await pool.execute<Array<RowDataPacket & { password_hash: string }>>(
    "SELECT password_hash FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1",
    [request.user!.id],
  );
  if (!rows[0] || !(await verifyPassword(rows[0].password_hash, input.currentPassword))) {
    throw new AppError(401, "Current password is incorrect.", "INVALID_CURRENT_PASSWORD");
  }
  if (input.currentPassword === input.newPassword) {
    throw new AppError(400, "New password must be different.", "PASSWORD_UNCHANGED");
  }
  const hash = await hashPassword(input.newPassword);
  await pool.execute(
    "UPDATE users SET password_hash = ? WHERE id = ?",
    [hash, request.user!.id],
  );
  await pool.execute(
    "UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP(3) WHERE user_id = ? AND revoked_at IS NULL",
    [request.user!.id],
  );
  clearAuthCookies(response);
  response.status(204).end();
};

userRouter.post("/change-password", changePasswordHandler);
userRouter.put("/change-password", changePasswordHandler);

/* =========================================================================
   3. MY POSTS (USER POST MANAGEMENT & AUTHORING)
   ========================================================================= */
userRouter.get("/posts", async (request, response) => {
  const query = parseOrThrow(
    paginationSchema.extend({ status: z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED"]).optional() }),
    request.query,
  );
  const userId = request.user!.id;
  const condition = query.status ? " AND status = ?" : "";
  const values = query.status ? [userId, query.status] : [userId];
  const [counts] = await pool.execute<CountRow[]>(
    `SELECT COUNT(*) AS total FROM posts WHERE author_id = ? AND deleted_at IS NULL${condition}`,
    values,
  );
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id, p.title, p.slug, p.excerpt, p.status, p.created_at AS createdAt,
            p.published_at AS publishedAt, p.rejection_reason AS rejectionReason,
            c.id AS categoryId, c.name AS categoryName, c.slug AS categorySlug,
            i.file_path AS featuredImagePath,
            (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.deleted_at IS NULL) AS commentCount,
            (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likeCount,
            (SELECT COUNT(*) FROM post_views v WHERE v.post_id = p.id) AS viewCount
     FROM posts p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN images i ON i.id = p.featured_image_id
     WHERE p.author_id = ? AND p.deleted_at IS NULL${condition}
     ORDER BY p.updated_at DESC LIMIT ? OFFSET ?`,
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

  response.status(200).json({
    data: postsWithTags,
    pagination: { page: query.page, limit: query.limit, total: Number(counts[0].total) },
  });
});

userRouter.get("/posts/:id", async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id);
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id, p.title, p.slug, p.excerpt, p.content, p.status,
            p.rejection_reason AS rejectionReason, p.category_id AS categoryId,
            p.featured_image_id AS featuredImageId, p.submitted_at AS submittedAt,
            p.published_at AS publishedAt, p.created_at AS createdAt,
            p.updated_at AS updatedAt,
            seo.title AS seoTitle, seo.description AS seoDescription, seo.keywords AS seoKeywords
     FROM posts p
     LEFT JOIN seo_metadata seo ON seo.post_id = p.id
     WHERE p.id = ? AND p.author_id = ? AND p.deleted_at IS NULL LIMIT 1`,
    [id, request.user!.id],
  );
  if (!rows[0]) throw new AppError(404, "Post not found.", "POST_NOT_FOUND");
  const [tags] = await pool.execute<RowDataPacket[]>(
    `SELECT t.id, t.name, t.slug FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
     WHERE pt.post_id = ? ORDER BY t.name`,
    [id],
  );
  const [images] = await pool.execute<RowDataPacket[]>(
    `SELECT pi.image_id AS id, i.file_path AS path, pi.position AS position
     FROM post_images pi JOIN images i ON i.id = pi.image_id
     WHERE pi.post_id = ? ORDER BY pi.position`,
    [id],
  );
  response.status(200).json({ data: { ...rows[0], tags, images } });
});

userRouter.post("/posts", async (request, response) => {
  const input = parseOrThrow(postBodySchema, request.body);
  const userId = request.user!.id;
  await validatePostRelations(userId, input.categoryId, input.featuredImageId, input.tagIds, input.imageIds);
  const id = randomUUID();
  const slug = await createUniqueSlug("posts", input.title, 220);

  const initialStatus =
    input.action === "submit" || input.action === "SUBMIT" || input.status === "PENDING"
      ? "PENDING"
      : "DRAFT";
  const submittedAt = initialStatus === "PENDING" ? new Date() : null;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO posts (id, author_id, category_id, featured_image_id, title, slug, excerpt, content, status, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        input.categoryId,
        input.featuredImageId ?? null,
        input.title,
        slug,
        input.excerpt ?? null,
        input.content,
        initialStatus,
        submittedAt,
      ],
    );
    for (const tagId of [...new Set(input.tagIds)]) {
      await connection.execute("INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)", [id, tagId]);
    }
    const galleryIds = [...new Set(input.imageIds)];
    for (let position = 0; position < galleryIds.length; position++) {
      await connection.execute(
        "INSERT INTO post_images (post_id, image_id, position) VALUES (?, ?, ?)",
        [id, galleryIds[position], position],
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
  response.status(201).json({ data: { id, ...input, slug, status: initialStatus } });
});

const updatePostHandler: RequestHandler = async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id);
  const input = parseOrThrow(updatePostSchema, request.body);
  const userId = request.user!.id;
  const [posts] = await pool.execute<Array<RowDataPacket & {
    title: string; slug: string; category_id: string; featured_image_id: string | null;
    excerpt: string | null; content: string; status: string;
  }>>(
    `SELECT title, slug, category_id, featured_image_id, excerpt, content, status
     FROM posts WHERE id = ? AND author_id = ? AND deleted_at IS NULL LIMIT 1`,
    [id, userId],
  );
  const post = posts[0];
  if (!post) throw new AppError(404, "Post not found.", "POST_NOT_FOUND");
  const next = {
    title: input.title ?? post.title,
    categoryId: input.categoryId ?? post.category_id,
    featuredImageId: input.featuredImageId === undefined ? post.featured_image_id : input.featuredImageId,
    excerpt: input.excerpt === undefined ? post.excerpt : input.excerpt,
    content: input.content ?? post.content,
  };
  await validatePostRelations(userId, next.categoryId, next.featuredImageId, input.tagIds, input.imageIds);

  // Business Rule: If a user edits an already published post, change status to Pending
  let status = post.status;
  if (post.status === "APPROVED") {
    status = "PENDING";
  } else if (input.action === "submit" || input.action === "SUBMIT" || input.status === "PENDING") {
    status = "PENDING";
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `UPDATE posts SET title = ?, category_id = ?,
       featured_image_id = ?, excerpt = ?, content = ?, status = ?,
       submitted_at = IF(? = 'PENDING', UTC_TIMESTAMP(3), submitted_at),
       published_at = IF(? = 'PENDING', NULL, published_at), reviewed_at = NULL,
       rejection_reason = NULL
       WHERE id = ? AND author_id = ?`,
      [next.title, next.categoryId, next.featuredImageId, next.excerpt, next.content, status, status, status, id, userId],
    );
    if (input.tagIds !== undefined) {
      await connection.execute("DELETE FROM post_tags WHERE post_id = ?", [id]);
      for (const tagId of [...new Set(input.tagIds)]) {
        await connection.execute("INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)", [id, tagId]);
      }
    }
    if (input.imageIds !== undefined) {
      await connection.execute("DELETE FROM post_images WHERE post_id = ?", [id]);
      const galleryIds = [...new Set(input.imageIds)];
      for (let position = 0; position < galleryIds.length; position++) {
        await connection.execute(
          "INSERT INTO post_images (post_id, image_id, position) VALUES (?, ?, ?)",
          [id, galleryIds[position], position],
        );
      }
    }
    if (input.seoTitle !== undefined || input.seoDescription !== undefined || input.seoKeywords !== undefined) {
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
          `${env.PUBLIC_SITE_URL}/blogs/${post.slug}`,
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
  response.status(200).json({ data: { id, ...next, slug: post.slug, status } });
};

userRouter.put("/posts/:id", updatePostHandler);
userRouter.patch("/posts/:id", updatePostHandler);

userRouter.post("/posts/:id/submit", async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id);
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE posts SET status = 'PENDING', submitted_at = UTC_TIMESTAMP(3),
     reviewed_at = NULL, rejection_reason = NULL
     WHERE id = ? AND author_id = ? AND deleted_at IS NULL AND status IN ('DRAFT', 'REJECTED')`,
    [id, request.user!.id],
  );
  if (result.affectedRows === 0) {
    const [rows] = await pool.execute<Array<RowDataPacket & { status: string }>>(
      "SELECT status FROM posts WHERE id = ? AND author_id = ? AND deleted_at IS NULL",
      [id, request.user!.id],
    );
    if (!rows[0]) throw new AppError(404, "Post not found.", "POST_NOT_FOUND");
    throw new AppError(409, "Only draft or rejected posts can be submitted.", "POST_NOT_SUBMITTABLE");
  }
  response.status(200).json({ data: { id, status: "PENDING" } });
});

userRouter.delete("/posts/:id", async (request, response) => {
  const id = parseOrThrow(uuidSchema, request.params.id);
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE posts SET deleted_at = UTC_TIMESTAMP(3)
     WHERE id = ? AND author_id = ? AND deleted_at IS NULL AND status <> 'PENDING'`,
    [id, request.user!.id],
  );
  if (result.affectedRows === 0) {
    const [rows] = await pool.execute<Array<RowDataPacket & { status: string }>>(
      "SELECT status FROM posts WHERE id = ? AND author_id = ? AND deleted_at IS NULL",
      [id, request.user!.id],
    );
    if (!rows[0]) throw new AppError(404, "Post not found.", "POST_NOT_FOUND");
    throw new AppError(409, "A pending post cannot be deleted while it is under review.", "POST_PENDING");
  }
  response.status(204).end();
});

/* =========================================================================
   4. MY COMMENTS
   ========================================================================= */
userRouter.get("/comments", async (request, response) => {
  const query = parseOrThrow(
    paginationSchema.extend({ status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional() }),
    request.query,
  );
  const condition = query.status ? " AND c.status = ?" : "";
  const values = query.status ? [request.user!.id, query.status] : [request.user!.id];
  const [counts] = await pool.execute<CountRow[]>(
    `SELECT COUNT(*) AS total FROM comments c WHERE c.author_id = ? AND c.deleted_at IS NULL${condition}`,
    values,
  );
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id, c.content, c.status, c.created_at AS createdAt,
            p.id AS postId, p.title AS postTitle, p.slug AS postSlug
     FROM comments c JOIN posts p ON p.id = c.post_id
     WHERE c.author_id = ? AND c.deleted_at IS NULL${condition}
     ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
    [...values, query.limit, paginationOffset(query.page, query.limit)],
  );
  response.status(200).json({
    data: rows,
    pagination: { page: query.page, limit: query.limit, total: Number(counts[0].total) },
  });
});

/* =========================================================================
   5. LIKE & UNLIKE SYSTEM
   ========================================================================= */
userRouter.post("/posts/:id/like", async (request, response) => {
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

userRouter.get("/posts/:id/like", async (request, response) => {
  const postId = parseOrThrow(uuidSchema, request.params.id);
  const [rows] = await pool.execute<Array<RowDataPacket & { liked: number; likeCount: number }>>(
    `SELECT EXISTS(
       SELECT 1 FROM post_likes WHERE user_id = ? AND post_id = ?
     ) AS liked, (SELECT COUNT(*) FROM post_likes WHERE post_id = ?) AS likeCount`,
    [request.user!.id, postId, postId],
  );
  response.status(200).json({
    data: { liked: Boolean(rows[0].liked), likeCount: Number(rows[0].likeCount) },
  });
});

userRouter.delete("/posts/:id/like", async (request, response) => {
  const postId = parseOrThrow(uuidSchema, request.params.id);
  await pool.execute("DELETE FROM post_likes WHERE user_id = ? AND post_id = ?", [request.user!.id, postId]);
  const [counts] = await pool.execute<Array<RowDataPacket & { likeCount: number }>>(
    "SELECT COUNT(*) AS likeCount FROM post_likes WHERE post_id = ?",
    [postId],
  );
  response.status(200).json({ data: { liked: false, likeCount: Number(counts[0].likeCount) } });
});

userRouter.post("/posts/:id/comments", async (request, response) => {
  const postId = parseOrThrow(uuidSchema, request.params.id);
  const input = parseOrThrow(z.object({ content: z.string().trim().min(1).max(5000) }).strict(), request.body);
  const [posts] = await pool.execute<Array<RowDataPacket & { id: string }>>(
    "SELECT id FROM posts WHERE id = ? AND status = 'APPROVED' AND deleted_at IS NULL LIMIT 1",
    [postId],
  );
  if (!posts[0]) throw new AppError(404, "Published post not found.", "POST_NOT_FOUND");
  const id = randomUUID();
  await pool.execute(
    "INSERT INTO comments (id, post_id, author_id, content, status) VALUES (?, ?, ?, ?, 'PENDING')",
    [id, postId, request.user!.id, input.content],
  );
  response.status(201).json({ data: { id, postId, content: input.content, status: "PENDING" } });
});

userRouter.post("/posts/:id/view", async (request, response) => {
  const postId = parseOrThrow(uuidSchema, request.params.id);
  const [posts] = await pool.execute<Array<RowDataPacket & { id: string }>>(
    "SELECT id FROM posts WHERE id = ? AND status = 'APPROVED' AND deleted_at IS NULL LIMIT 1",
    [postId],
  );
  if (!posts[0]) throw new AppError(404, "Published post not found.", "POST_NOT_FOUND");
  const visitorKey = request.user
    ? `user:${request.user.id}`
    : `guest:${request.ip}:${request.get("user-agent") ?? "unknown"}`.slice(0, 128);
  await pool.execute(
    `INSERT IGNORE INTO post_views (id, post_id, user_id, visitor_key)
     VALUES (?, ?, ?, ?)`,
    [randomUUID(), postId, request.user?.id ?? null, visitorKey],
  );
  response.status(204).end();
});
