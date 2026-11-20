import type { ResultSetHeader } from "mysql2";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BIGINT_ID_PATTERN = /^[1-9]\d{0,18}$/;

export function lastInsertId(result: ResultSetHeader): string {
  const insertId = result.insertId;
  if (insertId === undefined || insertId === null || Number(insertId) <= 0) {
    throw new Error("Insert did not return an auto-increment id.");
  }
  return String(insertId);
}

export function isEntityId(value: string): boolean {
  return BIGINT_ID_PATTERN.test(value) || UUID_PATTERN.test(value);
}
