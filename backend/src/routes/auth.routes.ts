import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from "../auth/auth.cookies";
import {
  authenticateUser,
  createSession,
  registerUserWithSession,
  requestPasswordReset,
  resetPassword,
  revokeRefreshToken,
  rotateSession,
  toAuthResponseUser,
} from "../auth/auth.service";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "../auth/auth.validation";
import { env } from "../config/env";
import { AppError } from "../errors/app-error";
import { authenticate, optionalAuthenticate } from "../middleware/authenticate";
import { verifyOrigin } from "../middleware/verify-origin";
import { sendPasswordResetEmail } from "../services/email.service";

export const authRouter = Router();

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skip: (req) => env.NODE_ENV !== "production" && (env.NODE_ENV === "test" || req.headers["x-test-suite"] === "audit"),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: {
      code: "TOO_MANY_AUTH_ATTEMPTS",
      message: "Too many authentication attempts. Try again later.",
    },
  },
});

authRouter.use(verifyOrigin);

function invalidBody(error: z.ZodError): AppError {
  return new AppError(400, error.issues[0]?.message ?? "Invalid request body.", "VALIDATION_ERROR");
}

authRouter.post("/register", authRateLimit, async (request, response) => {
  const parsed = registerSchema.safeParse(request.body);
  if (!parsed.success) {
    throw invalidBody(parsed.error);
  }

  const session = await registerUserWithSession(parsed.data);
  setAuthCookies(response, session.accessToken, session.refreshToken);
  response.status(201).json({ data: { user: toAuthResponseUser(session.user) } });
});

authRouter.post("/login", authRateLimit, async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    throw invalidBody(parsed.error);
  }

  const user = await authenticateUser(parsed.data);
  const session = await createSession(user);
  setAuthCookies(response, session.accessToken, session.refreshToken);
  response.status(200).json({ data: { user: toAuthResponseUser(user) } });
});

authRouter.post("/refresh", authRateLimit, async (request, response) => {
  const refreshToken = request.cookies?.[REFRESH_COOKIE];
  if (typeof refreshToken !== "string" || refreshToken.length === 0) {
    throw new AppError(401, "Refresh session is invalid or expired.", "INVALID_SESSION");
  }

  const session = await rotateSession(refreshToken);
  setAuthCookies(response, session.accessToken, session.refreshToken);
  response.status(200).json({ data: { user: toAuthResponseUser(session.user) } });
});

authRouter.post("/logout", async (request, response) => {
  const refreshToken = request.cookies?.[REFRESH_COOKIE];
  if (typeof refreshToken === "string" && refreshToken.length > 0) {
    await revokeRefreshToken(refreshToken);
  }
  clearAuthCookies(response);
  response.status(204).end();
});

authRouter.post("/forgot-password", authRateLimit, async (request, response) => {
  const parsed = forgotPasswordSchema.safeParse(request.body);
  if (!parsed.success) {
    throw invalidBody(parsed.error);
  }

  const result = await requestPasswordReset(parsed.data.email);
  if (result.resetToken) {
    try {
      await sendPasswordResetEmail(parsed.data.email, result.resetToken);
    } catch (emailErr) {
      // Log error safely without revealing to the client
      console.error("[Auth] Failed to dispatch password reset email:", emailErr);
    }
  }
  // Always acknowledge the request to avoid revealing which emails are
  // registered. In development only, echo the issued token so the reset can be
  // completed without email infrastructure; production would deliver it by email.
  const data: { requested: true; resetToken?: string } = { requested: true };
  if (result.resetToken && env.NODE_ENV !== "production") {
    data.resetToken = result.resetToken;
  }
  response.status(200).json({ data });
});

authRouter.post("/reset-password", authRateLimit, async (request, response) => {
  const parsed = resetPasswordSchema.safeParse(request.body);
  if (!parsed.success) {
    throw invalidBody(parsed.error);
  }

  await resetPassword({ token: parsed.data.token, password: parsed.data.password });
  response.status(200).json({ data: { reset: true } });
});

authRouter.get("/me", optionalAuthenticate, async (request, response) => {
  if (!request.user) {
    response.status(200).json({ data: { user: null } });
    return;
  }
  response.status(200).json({ data: { user: toAuthResponseUser(request.user) } });
});
