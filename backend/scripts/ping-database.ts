import { logger } from "../src/config/logger";
import { parseDatabaseUrl, pingDatabase } from "../src/config/mysql";

void pingDatabase()
  .then(() => {
    const { host, port, database } = parseDatabaseUrl();
    logger.info({ host, port, database }, "MySQL connection successful");
  })
  .catch((error: unknown) => {
    logger.fatal({ err: error }, "MySQL connection failed");
    process.exitCode = 1;
  });
