import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { env } from "../src/config/env";
import { logger } from "../src/config/logger";
import { pool } from "../src/config/mysql";

interface UserRow extends RowDataPacket {
  id: string;
  role: "USER" | "ADMIN";
}

async function seedDatabase(): Promise<void> {
  if (!env.ADMIN_EMAIL || !env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
    logger.info(
      "Admin bootstrap skipped. Set ADMIN_EMAIL, ADMIN_USERNAME, and ADMIN_PASSWORD to create the first administrator.",
    );
    return;
  }

  const email = env.ADMIN_EMAIL;
  const username = env.ADMIN_USERNAME;
  const password = env.ADMIN_PASSWORD;

  const [emailMatches] = await pool.execute<UserRow[]>(
    "SELECT id, role FROM users WHERE email = ? LIMIT 1",
    [email],
  );
  const [usernameMatches] = await pool.execute<UserRow[]>(
    "SELECT id, role FROM users WHERE username = ? LIMIT 1",
    [username],
  );

  const existing = emailMatches[0] ?? usernameMatches[0];
  if (emailMatches[0] && usernameMatches[0] && emailMatches[0].id !== usernameMatches[0].id) {
    throw new Error("ADMIN_EMAIL and ADMIN_USERNAME belong to different existing accounts.");
  }

  if (existing) {
    if (env.ADMIN_FORCE_PASSWORD_RESET) {
      const passwordHash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
      await pool.execute(
        `UPDATE users
         SET username = ?, email = ?, password_hash = ?, role = 'ADMIN', is_active = TRUE, status = 'active', deleted_at = NULL
         WHERE id = ?`,
        [username, email, passwordHash, existing.id],
      );
      logger.info({ userId: existing.id }, "Existing administrator password was reset from environment variables");
    } else {
      await pool.execute(
        `UPDATE users
         SET username = ?, email = ?, role = 'ADMIN', is_active = TRUE, status = 'active', deleted_at = NULL
         WHERE id = ?`,
        [username, email, existing.id],
      );
      logger.info(
        { userId: existing.id },
        "Existing administrator ensured. Password was not changed (set ADMIN_FORCE_PASSWORD_RESET=true to rotate it).",
      );
    }
    return;
  }

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
  const id = randomUUID();
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO users (id, username, email, password_hash, role, is_active, status)
     VALUES (?, ?, ?, ?, 'ADMIN', TRUE, 'active')`,
    [id, username, email, passwordHash],
  );

  if (result.affectedRows !== 1) {
    throw new Error("Administrator insert did not complete.");
  }

  logger.info({ userId: id, username, email }, "Administrator account created");
}

void seedDatabase()
  .catch((error: unknown) => {
    logger.fatal({ err: error }, "Database seeding failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
