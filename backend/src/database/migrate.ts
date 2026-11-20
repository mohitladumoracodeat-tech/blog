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

const MIGRATIONS_DIR = path.resolve(process.cwd(), "database", "migrations");

interface MigrationRow extends RowDataPacket {
  name: string;
}

export function splitSqlStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => {
      if (!statement) {
        return false;
      }

      const withoutComments = statement
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("--"))
        .join("\n");

      return withoutComments.length > 0;
    });
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

async function applyMigration(connection: Connection, file: string): Promise<void> {
  const filePath = path.join(MIGRATIONS_DIR, file);
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
    await connection.query(statement);
  }
}

export async function runMigrations(): Promise<{ applied: string[]; skipped: string[] }> {
  const connection = await createServerConnection();
  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    const databaseName = await ensureDatabaseExists(connection);
    await ensureMigrationsTable(connection);

    const [rows] = await connection.query<MigrationRow[]>(
      "SELECT name FROM schema_migrations ORDER BY name ASC",
    );
    const alreadyApplied = new Set(rows.map((row) => row.name));

    const files = (await readdir(MIGRATIONS_DIR))
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
