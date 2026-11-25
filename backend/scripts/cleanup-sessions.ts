import { cleanupExpiredSessions } from "../src/auth/auth.service";
import { logger } from "../src/config/logger";
import { pool } from "../src/config/mysql";

async function main(): Promise<void> {
  try {
    logger.info("Executing scheduled session cleanup...");
    const result = await cleanupExpiredSessions();
    logger.info(result, "Session cleanup completed successfully");
  } catch (error: unknown) {
    logger.error({ err: error }, "Session cleanup encountered an error");
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
