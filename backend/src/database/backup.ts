import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { logger } from "../config/logger";
import { parseDatabaseUrl, quotedDatabaseName } from "../config/mysql";

const BACKUPS_DIR = path.resolve(process.cwd(), "database", "backups");

function quoteIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, "``")}\``;
}

function backupDatabaseName(source: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z").replace("T", "_");
  const safeSource = source.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 40);
  return `${safeSource}_backup_${stamp}`.slice(0, 64);
}

interface TableNameRow extends RowDataPacket {
  tableName: string;
}

export async function backupExistingDatabase(
  connection: Connection,
): Promise<{ backupDatabase?: string; backupDirectory?: string }> {
  const { database } = parseDatabaseUrl();
  const quotedSource = quotedDatabaseName();
  await connection.query(`USE ${quotedSource}`);

  const [tables] = await connection.query<TableNameRow[]>(
    `SELECT TABLE_NAME AS tableName
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME <> 'schema_migrations'
     ORDER BY TABLE_NAME`,
    [database],
  );

  if (tables.length === 0) {
    logger.info({ database }, "No application tables to back up");
    return {};
  }

  const backupName = backupDatabaseName(database);
  try {
    await connection.query(
      `CREATE DATABASE ${quoteIdentifier(backupName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    for (const table of tables) {
      const sourceTable = `${quotedSource}.${quoteIdentifier(table.tableName)}`;
      const targetTable = `${quoteIdentifier(backupName)}.${quoteIdentifier(table.tableName)}`;
      await connection.query(`CREATE TABLE ${targetTable} AS SELECT * FROM ${sourceTable}`);
    }
    logger.info({ database, backupName, tables: tables.length }, "Created MySQL snapshot database");
    return { backupDatabase: backupName };
  } catch (error) {
    logger.warn({ err: error, database }, "Could not create a MySQL snapshot database; writing JSON backup files");
  }

  const backupDirectory = path.join(BACKUPS_DIR, backupName);
  await mkdir(backupDirectory, { recursive: true });
  for (const table of tables) {
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM ${quotedSource}.${quoteIdentifier(table.tableName)}`,
    );
    await writeFile(
      path.join(backupDirectory, `${table.tableName}.json`),
      `${JSON.stringify(rows, null, 2)}\n`,
      "utf8",
    );
  }
  logger.info({ database, backupDirectory, tables: tables.length }, "Wrote JSON table backups");
  return { backupDirectory };
}
