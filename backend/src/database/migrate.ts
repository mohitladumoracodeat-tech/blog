import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { logger } from "../config/logger";
import {
  createServerConnection,
  parseDatabaseUrl,
  quotedDatabaseName,
} from "../config/mysql";
import { backupExistingDatabase } from "./backup";

export function getMigrationsDir(): string {
  const candidates = [
    path.resolve(__dirname, "../../database/migrations"),
    path.resolve(__dirname, "../../../database/migrations"),
    path.resolve(process.cwd(), "backend", "database", "migrations"),
    path.resolve(process.cwd(), "database", "migrations"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return path.resolve(process.cwd(), "backend", "database", "migrations");
}

interface MigrationRow extends RowDataPacket {
  name: string;
}

export function splitSqlStatements(sql: string): string[] {
  // Strip single-line comments (-- ...) first so semicolons inside comments do not break statement boundaries
  const withoutComments = sql
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      return trimmed.startsWith("--") ? "" : line;
    })
    .join("\n");

  return withoutComments
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

export async function ensureDatabaseExists(connection: Connection): Promise<string> {
  const { database } = parseDatabaseUrl();
  const quoted = quotedDatabaseName();
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS ${quoted} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await connection.query(`USE ${quoted}`);
  return database;
}

async function ensureMigrationsTable(connection: Connection): Promise<void> {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_schema_migrations_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function baselineExistingSchema(connection: Connection, databaseName: string): Promise<void> {
  const [rows] = await connection.query<MigrationRow[]>(
    "SELECT name FROM schema_migrations ORDER BY name ASC",
  );
  if (rows.length > 0) {
    return;
  }

  const [tables] = await connection.query<Array<RowDataPacket & { TABLE_NAME: string }>>(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?",
    [databaseName],
  );
  const tableNames = new Set(tables.map((t) => t.TABLE_NAME));

  const toBaseline: string[] = [];
  if (tableNames.has("users") && tableNames.has("posts")) {
    toBaseline.push("001_initial_schema.sql");
  }

  if (tableNames.has("users")) {
    const [cols] = await connection.query<RowDataPacket[]>(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'status'",
      [databaseName],
    );
    if (cols.length > 0) {
      toBaseline.push("002_user_status_and_seo_image.sql");
    }
  }

  if (tableNames.has("users") && tableNames.has("posts")) {
    toBaseline.push("003_bigint_primary_keys.ts");
  }

  if (tableNames.has("post_bookmarks")) {
    toBaseline.push("004_post_bookmarks.sql");
  }

  if (tableNames.has("posts")) {
    const [cols] = await connection.query<RowDataPacket[]>(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'posts' AND COLUMN_NAME = 'is_featured'",
      [databaseName],
    );
    if (cols.length > 0) {
      toBaseline.push("005_featured_posts.sql");
    }
  }

  if (tableNames.has("newsletter_subscribers")) {
    toBaseline.push("006_newsletter_subscribers.sql");
  }

  if (tableNames.has("search_analytics")) {
    toBaseline.push("007_search_analytics.sql");
  }

  for (const name of toBaseline) {
    await connection.execute("INSERT IGNORE INTO schema_migrations (name) VALUES (?)", [name]);
    logger.info({ migration: name, databaseName }, "Baselined pre-existing migration into schema_migrations");
  }
}

async function applyMigration(connection: Connection, file: string): Promise<void> {
  const filePath = path.join(getMigrationsDir(), file);
  if (file.endsWith(".ts") || file.endsWith(".js")) {
    const moduleExports = (await import(pathToFileURL(filePath).href)) as {
      up?: (connection: Connection) => Promise<void>;
    };
    if (typeof moduleExports.up !== "function") {
      throw new Error(`Migration ${file} must export an async up(connection) function.`);
    }
    await moduleExports.up(connection);
    return;
  }

  const sql = await readFile(filePath, "utf8");
  const statements = splitSqlStatements(sql);
  for (const statement of statements) {
    try {
      await connection.query(statement);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      // If column or index already exists, allow idempotent progression
      if (error && (error.code === "ER_DUP_FIELDNAME" || error.code === "ER_DUP_KEYNAME")) {
        logger.warn({ statement, err: error.message }, "Column or key already exists, continuing migration idempotently");
        continue;
      }
      throw err;
    }
  }
}

export async function runMigrations(): Promise<{ applied: string[]; skipped: string[] }> {
  const connection = await createServerConnection();
  const applied: string[] = [];
  const skipped: string[] = [];
  const migrationsDir = getMigrationsDir();

  try {
    const databaseName = await ensureDatabaseExists(connection);
    await ensureMigrationsTable(connection);
    await baselineExistingSchema(connection, databaseName);

    const [rows] = await connection.query<MigrationRow[]>(
      "SELECT name FROM schema_migrations ORDER BY name ASC",
    );
    const alreadyApplied = new Set(rows.map((row) => row.name));

    const files = (await readdir(migrationsDir))
      .filter((file) => /^\d+_.*\.(sql|ts|js)$/u.test(file))
      .sort((left, right) => left.localeCompare(right, "en"));

    const pending = files.filter((file) => !alreadyApplied.has(file));
    if (pending.length > 0) {
      await backupExistingDatabase(connection);
      await connection.query(`USE ${quotedDatabaseName()}`);
    }

    for (const file of files) {
      if (alreadyApplied.has(file)) {
        skipped.push(file);
        continue;
      }

      await applyMigration(connection, file);
      await connection.execute("INSERT INTO schema_migrations (name) VALUES (?)", [file]);
      applied.push(file);
      logger.info({ migration: file, databaseName }, "Applied database migration");
    }

    logger.info(
      { databaseName, applied: applied.length, skipped: skipped.length },
      "Database migrations complete",
    );

    return { applied, skipped };
  } finally {
    await connection.end();
  }
}
