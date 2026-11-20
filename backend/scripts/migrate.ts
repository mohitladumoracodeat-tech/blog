import { logger } from "../src/config/logger";
import { runMigrations } from "../src/database/migrate";

void runMigrations()
  .then(({ applied, skipped }) => {
    logger.info({ applied, skipped }, "Migration runner finished");
  })
  .catch((error: unknown) => {
    logger.fatal({ err: error }, "Database migration failed");
    process.exitCode = 1;
  });
