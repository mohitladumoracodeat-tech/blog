import { logger } from "../src/config/logger";
import { runMigrations } from "../src/database/migrate";

async function setupDatabase(): Promise<void> {
  const result = await runMigrations();
  logger.info(result, "MySQL database setup complete");
}

void setupDatabase().catch((error: unknown) => {
  logger.fatal({ err: error }, "MySQL database setup failed");
  process.exitCode = 1;
});
