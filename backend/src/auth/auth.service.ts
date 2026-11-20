import { createHash, randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { env } from "../config/env";
import { pool } from "../config/mysql";
import { AppError } from "../errors/app-error";
import type { AuthenticatedUser, UserRole } from "./auth.types";
import type { LoginInput, RegisterInput } from "./auth.validation";

interface UserRow extends RowDataPacket {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: UserRole;
  is_active: number | boolean;
}

interface RefreshSessionRow extends RowDataPacket {
  id: string;
  user_id: string;
  username: string;
  email: string;
  role: UserRole;
  is_active: number | boolean;
}

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  role: "user" | "admin";
}

const issuer = "blog-management-api";
const audience = "blog-management-client";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  if (hash.startsWith("$argon2")) {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }
  return bcrypt.compare(plain, hash);
}

function toPublicUser(user: AuthenticatedUser): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role === "ADMIN" ? "admin" : "user",
  };
}

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

function signAccessToken(user: AuthenticatedUser, sessionId: string): string {
  return jwt.sign(
    { role: user.role },
    env.JWT_ACCESS_SECRET,
    {
      algorithm: "HS256",
      audience,
      expiresIn: env.ACCESS_TOKEN_TTL_MINUTES * 60,
      issuer,
      subject: user.id,
      jwtid: sessionId,
    },
  );
}

export async function registerUserWithSession(input: RegisterInput): Promise<{
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
}> {
  const user: AuthenticatedUser = {
    id: randomUUID(),
    username: input.username,
    email: input.email,
    role: "USER",
    isActive: true,
  };
  const passwordHash = await hashPassword(input.password);
  const sessionId = randomUUID();
  const refreshToken = createRefreshToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO users (id, username, email, password_hash, role)
       VALUES (?, ?, ?, ?, 'USER')`,
      [user.id, user.username, user.email, passwordHash],
    );
    await connection.execute(
      `INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at)
       VALUES (?, ?, ?, ?)`,
      [sessionId, user.id, hashRefreshToken(refreshToken), expiresAt],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ER_DUP_ENTRY"
    ) {
      throw new AppError(409, "Username or email is already registered.", "ACCOUNT_ALREADY_EXISTS");
    }
    throw error;
  } finally {
    connection.release();
  }

  return {
    user,
    accessToken: signAccessToken(user, sessionId),
    refreshToken,
  };
}

export async function authenticateUser(input: LoginInput): Promise<AuthenticatedUser> {
  const [rows] = await pool.execute<UserRow[]>(
    `SELECT id, username, email, password_hash, role, is_active
     FROM users
     WHERE email = ? AND deleted_at IS NULL
     LIMIT 1`,
    [input.email],
  );
  const user = rows[0];
  if (!user || !(user.is_active === true || user.is_active === 1)) {
    throw new AppError(401, "Email or password is incorrect.", "INVALID_CREDENTIALS");
  }

  const passwordMatches = await verifyPassword(user.password_hash, input.password);
  if (!passwordMatches) {
    throw new AppError(401, "Email or password is incorrect.", "INVALID_CREDENTIALS");
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    isActive: Boolean(user.is_active),
  };
}

export async function createSession(user: AuthenticatedUser): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const sessionId = randomUUID();
  const refreshToken = createRefreshToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await pool.execute(
    `INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
    [sessionId, user.id, hashRefreshToken(refreshToken), expiresAt],
  );

  return {
    accessToken: signAccessToken(user, sessionId),
    refreshToken,
  };
}

export async function rotateSession(refreshToken: string): Promise<{
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
}> {
  const connection = await pool.getConnection();
  const presentedHash = hashRefreshToken(refreshToken);
  const nextRefreshToken = createRefreshToken();
  const nextHash = hashRefreshToken(nextRefreshToken);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const [rows] = await connection.execute<RefreshSessionRow[]>(
      `SELECT s.id, u.id AS user_id, u.username, u.email, u.role, u.is_active
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.refresh_token_hash = ?
         AND s.revoked_at IS NULL
         AND s.expires_at > UTC_TIMESTAMP(3)
         AND u.deleted_at IS NULL
       LIMIT 1
       FOR UPDATE`,
      [presentedHash],
    );
    const session = rows[0];
    if (!session || !(session.is_active === true || session.is_active === 1)) {
      throw new AppError(401, "Refresh session is invalid or expired.", "INVALID_SESSION");
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE auth_sessions
       SET refresh_token_hash = ?, expires_at = ?
       WHERE id = ? AND refresh_token_hash = ? AND revoked_at IS NULL`,
      [nextHash, expiresAt, session.id, presentedHash],
    );
    if (result.affectedRows !== 1) {
      throw new AppError(401, "Refresh session is invalid or expired.", "INVALID_SESSION");
    }
    await connection.commit();
    transactionStarted = false;

    const user: AuthenticatedUser = {
      id: session.user_id,
      username: session.username,
      email: session.email,
      role: session.role,
      isActive: Boolean(session.is_active),
    };
    return {
      user,
      accessToken: signAccessToken(user, session.id),
      refreshToken: nextRefreshToken,
    };
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  await pool.execute(
    `UPDATE auth_sessions
     SET revoked_at = UTC_TIMESTAMP(3)
     WHERE refresh_token_hash = ? AND revoked_at IS NULL`,
    [hashRefreshToken(refreshToken)],
  );
}

export async function getAuthenticatedUser(
  accessToken: string,
): Promise<AuthenticatedUser> {
  let subject: string;
  let sessionId: string;
  try {
    const verified = jwt.verify(accessToken, env.JWT_ACCESS_SECRET, {
      algorithms: ["HS256"],
      audience,
      issuer,
    });
    if (typeof verified === "string" || !verified.sub || !verified.jti) {
      throw new Error("Missing token subject or session.");
    }
    subject = verified.sub;
    sessionId = verified.jti;
  } catch {
    throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED");
  }

  const [rows] = await pool.execute<RefreshSessionRow[]>(
    `SELECT s.id, u.id AS user_id, u.username, u.email, u.role, u.is_active
     FROM auth_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ?
       AND s.user_id = ?
       AND s.revoked_at IS NULL
       AND s.expires_at > UTC_TIMESTAMP(3)
       AND u.is_active = TRUE
       AND u.deleted_at IS NULL
     LIMIT 1`,
    [sessionId, subject],
  );
  const session = rows[0];
  if (!session) {
    throw new AppError(401, "Authentication is required.", "UNAUTHENTICATED");
  }

  return {
    id: session.user_id,
    username: session.username,
    email: session.email,
    role: session.role,
    isActive: Boolean(session.is_active),
  };
}

export function toAuthResponseUser(user: AuthenticatedUser): PublicUser {
  return toPublicUser(user);
}

const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

export async function requestPasswordReset(
  email: string,
): Promise<{ resetToken: string | null }> {
  const [rows] = await pool.execute<
    Array<RowDataPacket & { id: string; is_active: number | boolean }>
  >(
    `SELECT id, is_active FROM users
     WHERE email = ? AND deleted_at IS NULL
     LIMIT 1`,
    [email],
  );
  const user = rows[0];
  if (!user || !(user.is_active === true || user.is_active === 1)) {
    return { resetToken: null };
  }

  const token = randomBytes(48).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  await pool.execute(
    `INSERT INTO password_resets (id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
    [randomUUID(), user.id, tokenHash, expiresAt],
  );
  return { resetToken: token };
}

export async function resetPassword(input: {
  token: string;
  password: string;
}): Promise<void> {
  const presentedHash = createHash("sha256").update(input.token).digest("hex");
  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const [rows] = await connection.execute<
      Array<RowDataPacket & { reset_id: string; user_id: string }>
    >(
      `SELECT pr.id AS reset_id, pr.user_id
       FROM password_resets pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.token_hash = ?
         AND pr.used_at IS NULL
         AND pr.expires_at > UTC_TIMESTAMP(3)
         AND u.is_active = TRUE
         AND u.deleted_at IS NULL
       LIMIT 1
       FOR UPDATE`,
      [presentedHash],
    );
    const reset = rows[0];
    if (!reset) {
      throw new AppError(400, "This reset link is invalid or has expired.", "INVALID_RESET_TOKEN");
    }

    const passwordHash = await hashPassword(input.password);
    await connection.execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [
      passwordHash,
      reset.user_id,
    ]);
    await connection.execute(
      `UPDATE password_resets SET used_at = UTC_TIMESTAMP(3) WHERE id = ?`,
      [reset.reset_id],
    );
    await connection.execute(
      `UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP(3)
       WHERE user_id = ? AND revoked_at IS NULL`,
      [reset.user_id],
    );
    await connection.commit();
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
    }
    throw error;
  } finally {
    connection.release();
  }
}
