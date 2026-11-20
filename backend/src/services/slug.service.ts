import type { PoolConnection } from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { pool } from "../config/mysql";
import { AppError } from "../errors/app-error";
import { slugify } from "../utils/request-validation";

type SlugTable = "categories" | "tags" | "posts";
export type SlugEntity = "POST" | "CATEGORY" | "TAG";

export async function recordSlugRedirect(
  connection: PoolConnection,
  entity: SlugEntity,
  oldSlug: string,
  newSlug: string,
): Promise<void> {
  if (oldSlug === newSlug) return;
  await connection.execute(
    "UPDATE slug_redirects SET new_slug = ? WHERE entity_type = ? AND new_slug = ?",
    [newSlug, entity, oldSlug],
  );
  await connection.execute(
    `INSERT INTO slug_redirects (id, entity_type, old_slug, new_slug)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE new_slug = VALUES(new_slug)`,
    [randomUUID(), entity, oldSlug, newSlug],
  );
}

export async function createUniqueSlug(
  table: SlugTable,
  source: string,
  maxLength: number,
  excludeId?: string,
  connection?: PoolConnection,
): Promise<string> {
  const db = connection ?? pool;
  const base = slugify(source, maxLength);

  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const tail = suffix === 0 ? "" : `-${suffix + 1}`;
    const candidate = `${base.slice(0, maxLength - tail.length).replace(/-+$/g, "")}${tail}`;
    const [rows] = await db.execute<Array<{ id: string } & import("mysql2").RowDataPacket>>(
      `SELECT id FROM ${table} WHERE slug = ?${excludeId ? " AND id <> ?" : ""} LIMIT 1`,
      excludeId ? [candidate, excludeId] : [candidate],
    );
    if (rows.length === 0) {
      return candidate;
    }
  }

  throw new AppError(409, "Could not generate a unique slug.", "SLUG_COLLISION");
}
