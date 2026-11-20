import mysql, { type Connection, type Pool } from "mysql2/promise";
import { env } from "./env";

export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export function parseDatabaseUrl(databaseUrl = env.DATABASE_URL): DatabaseConnectionConfig {
  const url = new URL(databaseUrl);
  if (url.protocol !== "mysql:") {
    throw new Error("DATABASE_URL must use the mysql:// scheme.");
  }

  const database = decodeURIComponent(url.pathname.slice(1));
  if (!database) {
    throw new Error("DATABASE_URL must include a database name.");
  }

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  };
}

function quoteIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, "``")}\``;
}

export function quotedDatabaseName(databaseUrl = env.DATABASE_URL): string {
  return quoteIdentifier(parseDatabaseUrl(databaseUrl).database);
}

const config = parseDatabaseUrl();

export const pool: Pool = mysql.createPool({
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  database: config.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  charset: "utf8mb4",
  supportBigNumbers: true,
  bigNumberStrings: true,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: true } : undefined,
});

export async function createServerConnection(): Promise<Connection> {
  const { host, port, user, password } = parseDatabaseUrl();
  return mysql.createConnection({
    host,
    port,
    user,
    password,
    charset: "utf8mb4",
    supportBigNumbers: true,
    bigNumberStrings: true,
  });
}

export async function pingDatabase(): Promise<void> {
  await pool.query("SELECT 1");
}
