import { randomUUID } from "node:crypto";
import { mkdir, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { pool } from "../config/mysql";
import { logger } from "../config/logger";
import { uploadDir } from "../config/env";
import { AppError } from "../errors/app-error";
import { authenticate } from "../middleware/authenticate";
import { formatPagination, paginationOffset, paginationSchema, parseOrThrow } from "../utils/request-validation";
import type { RowDataPacket } from "mysql2";

const uploadDirectory = uploadDir;
const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
]);

const upload = multer({
  storage: multer.diskStorage({
    destination(_request, _file, callback) {
      void mkdir(uploadDirectory, { recursive: true })
        .then(() => callback(null, uploadDirectory))
        .catch((error: unknown) => callback(
          error instanceof Error ? error : new Error("Could not prepare image storage."),
          uploadDirectory,
        ));
    },
    filename(_request, _file, callback) {
      callback(null, `${randomUUID()}.upload`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(_request, file, callback) {
    if (!allowedTypes.has(file.mimetype)) {
      callback(new AppError(400, "Upload a JPEG, PNG, WebP, GIF, or AVIF image.", "INVALID_IMAGE_TYPE"));
      return;
    }
    callback(null, true);
  },
});

export const uploadRouter = Router();
uploadRouter.use(authenticate);

uploadRouter.get("/", async (request, response) => {
  const query = parseOrThrow(paginationSchema, request.query);
  const [counts] = await pool.execute<Array<RowDataPacket & { total: number }>>(
    "SELECT COUNT(*) AS total FROM images WHERE uploaded_by_id = ?",
    [request.user!.id],
  );
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, file_name AS fileName, original_file_name AS originalFileName,
            file_path AS path, mime_type AS mimeType, file_size AS fileSize,
            created_at AS createdAt
     FROM images WHERE uploaded_by_id = ?
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [request.user!.id, query.limit, paginationOffset(query.page, query.limit)],
  );
  response.status(200).json({
    data: rows,
    pagination: formatPagination(query.page, query.limit, counts[0].total),
  });
});

uploadRouter.post("/", (request, response, next) => {
  upload.single("image")(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(new AppError(400, error.code === "LIMIT_FILE_SIZE"
        ? "Image size must not exceed 5 MB."
        : "Invalid image upload.", "UPLOAD_REJECTED"));
      return;
    }
    if (error) {
      next(error);
      return;
    }
    next();
  });
}, async (request, response) => {
  const file = request.file;
  if (!file) {
    throw new AppError(400, "Choose an image to upload.", "IMAGE_REQUIRED");
  }

  const { fileTypeFromFile } = await import("file-type");
  const detected = await fileTypeFromFile(file.path);
  const extension = detected && allowedTypes.get(detected.mime);
  if (!detected || !extension || detected.mime !== file.mimetype) {
    await unlink(file.path);
    throw new AppError(400, "The uploaded file is not a supported image.", "INVALID_IMAGE_CONTENT");
  }

  const id = randomUUID();
  const fileName = `${id}.${extension}`;
  const filePath = path.join(uploadDirectory, fileName);
  const publicPath = `/uploads/${fileName}`;
  try {
    await rename(file.path, filePath);
    await pool.execute(
      `INSERT INTO images
        (id, file_name, original_file_name, file_path, mime_type, file_size, uploaded_by_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        fileName,
        path.basename(file.originalname).slice(0, 255),
        publicPath,
        detected.mime,
        file.size,
        request.user!.id,
      ],
    );
  } catch (error) {
    try {
      await unlink(filePath);
    } catch (cleanupError) {
      logger.error({ err: cleanupError, filePath }, "Failed to clean up image after database error");
    }
    throw error;
  }

  response.status(201).json({
    data: {
      id,
      fileName,
      originalFileName: path.basename(file.originalname).slice(0, 255),
      path: publicPath,
      mimeType: detected.mime,
      fileSize: file.size,
    },
  });
});
