import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { pool } from "./config/mysql";

async function startServer(): Promise<void> {
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "API server listening");
  });

  try {
    await pool.query("SELECT 1");
    logger.info("MySQL connection established");
  } catch (error) {
    logger.warn({ err: error }, "MySQL is unavailable; database-backed requests will fail until it is configured");
  }

  let isShuttingDown = false;
  const shutdown = (signal: string): void => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    logger.info({ signal }, "Shutting down API server");
    server.close((error) => {
      if (error) {
        logger.error({ err: error }, "HTTP server shutdown failed");
        process.exitCode = 1;
      }

      void pool.end().catch((disconnectError: unknown) => {
        logger.error({ err: disconnectError }, "Database disconnect failed");
        process.exitCode = 1;
      });
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

void startServer().catch(async (error: unknown) => {
  logger.fatal({ err: error }, "API startup failed");
  await pool.end();
  process.exitCode = 1;
});
