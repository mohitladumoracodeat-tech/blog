import dotenv from "dotenv";
import path from "node:path";
import { z } from "zod";

dotenv.config({
  path: [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), "..", ".env")],
});

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    CORS_ORIGINS: z.string().min(1, "CORS_ORIGINS is required"),
    PUBLIC_SITE_URL: z.url().default("http://localhost:5173"),
    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(5).max(60).default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
    ADMIN_EMAIL: z.string().trim().toLowerCase().email().optional(),
    ADMIN_USERNAME: z.string().trim().min(3).max(50).optional(),
    ADMIN_PASSWORD: z.string().min(8).max(200).optional(),
    ADMIN_FORCE_PASSWORD_RESET: z
      .enum(["true", "false", "1", "0", ""])
      .optional()
      .transform((value) => value === "true" || value === "1"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    UPLOAD_DIR: z.string().optional(),
    TRUST_PROXY: z
      .enum(["true", "false", "1", "0"])
      .optional()
      .transform((val) => val === "true" || val === "1"),
    COOKIE_DOMAIN: z.string().optional(),
    COOKIE_SECURE: z
      .enum(["true", "false", "1", "0"])
      .optional()
      .transform((val) => val === "true" || val === "1"),
    COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
    DATABASE_SSL: z
      .enum(["true", "false", "1", "0"])
      .optional()
      .transform((val) => val === "true" || val === "1"),
    // SMTP & Production Email Configuration (DEF-HIGH-01)
    SMTP_HOST: z.string().trim().optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_SECURE: z
      .enum(["true", "false", "1", "0", ""])
      .optional()
      .transform((val) => val === "true" || val === "1"),
    SMTP_USER: z.string().trim().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_FROM: z.string().trim().default("Fieldnotes Journal <no-reply@fieldnotes.journal>"),
    APP_URL: z.string().trim().optional(),
    // Phase 1G: Hindi Translation Service Configuration
    TRANSLATION_PROVIDER: z
      .enum(["none", "gemini", "libretranslate", "deepl", "google-cloud", "mock"])
      .default("none"),
    TRANSLATION_API_KEY: z.string().optional(),
    TRANSLATION_API_URL: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().default("gemini-3.5-flash-lite"),
  })
  .refine(
    (data) => {
      if (data.NODE_ENV !== "production") return true;
      try {
        const url = new URL(data.PUBLIC_SITE_URL);
        return url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
      } catch {
        return false;
      }
    },
    {
      message: "PUBLIC_SITE_URL cannot point to localhost in production. Configure your live domain (e.g. https://yourdomain.com).",
      path: ["PUBLIC_SITE_URL"],
    },
  )
  .refine(
    (data) => {
      if (data.NODE_ENV !== "production") return true;
      const origins = data.CORS_ORIGINS.split(",").map((o) => o.trim());
      return !origins.some((o) => o.includes("localhost") || o.includes("127.0.0.1"));
    },
    {
      message: "CORS_ORIGINS cannot contain localhost in production. Configure your production frontend domain.",
      path: ["CORS_ORIGINS"],
    },
  )
  .refine(
    (data) => {
      if (data.NODE_ENV !== "production") return true;
      return (
        !data.JWT_ACCESS_SECRET.toLowerCase().includes("replace-with") &&
        !data.JWT_ACCESS_SECRET.toLowerCase().includes("example")
      );
    },
    {
      message: "JWT_ACCESS_SECRET must be set to a secure, unique 32+ character random secret in production.",
      path: ["JWT_ACCESS_SECRET"],
    },
  );

export const env = envSchema.parse(process.env);
export const corsOrigins = env.CORS_ORIGINS.split(",").map((origin) => origin.trim());
export const uploadDir = env.UPLOAD_DIR
  ? path.resolve(env.UPLOAD_DIR)
  : path.resolve(__dirname, "../../uploads");
