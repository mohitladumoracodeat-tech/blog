import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import path from "node:path";
import pinoHttp from "pino-http";
import { corsOrigins, env, uploadDir } from "./config/env";
import { logger } from "./config/logger";
import { AppError } from "./errors/app-error";
import { authenticate } from "./middleware/authenticate";
import { errorHandler } from "./middleware/error-handler";
import { notFound } from "./middleware/not-found";
import { verifyOrigin } from "./middleware/verify-origin";
import { adminRouter } from "./routes/admin.routes";
import { authRouter } from "./routes/auth.routes";
import { healthRouter } from "./routes/health.routes";
import { publicRouter, robotsHandler, sitemapHandler } from "./routes/public.routes";
import { uploadRouter } from "./routes/upload.routes";
import { userRouter } from "./routes/user.routes";

export const app = express();

if (env.TRUST_PROXY) {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new AppError(403, "Origin is not allowed.", "CORS_ORIGIN_DENIED"));
    },
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(pinoHttp({ logger }));
app.use(verifyOrigin);
app.use("/uploads", express.static(uploadDir, {
  index: false,
  maxAge: env.NODE_ENV === "production" ? "1d" : 0,
  dotfiles: "ignore",
  setHeaders(res) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'");
  },
}));

app.get("/api/v1/health/live", (_request, response) => {
  response.status(200).json({ data: { status: "ok" } });
});
app.use("/api/v1/health/ready", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/admin", authenticate, adminRouter);
app.use("/api/v1/user", userRouter);
app.use("/api/v1/public", publicRouter);
app.use("/api/v1/uploads", uploadRouter);
app.get("/sitemap.xml", sitemapHandler);
app.get("/robots.txt", robotsHandler);

if (env.NODE_ENV !== "production") {
  app.get("/", (_request, response) => {
    response.status(200).json({ data: { name: "Blog Management API" } });
  });
}

app.use(notFound);
app.use(errorHandler);
