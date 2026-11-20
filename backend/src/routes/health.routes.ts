import { Router } from "express";
import { logger } from "../config/logger";
import { pool } from "../config/mysql";

export const healthRouter = Router();

healthRouter.get("/", async (_request, response) => {
  try {
    await pool.query("SELECT 1");
  } catch (error) {
    logger.warn({ err: error }, "Readiness check failed: MySQL is unavailable");
    response.status(503).json({
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "The API is running, but the database connection is unavailable.",
      },
    });
    return;
  }
  response.status(200).json({ data: { status: "ok" } });
});
