import type { RequestHandler } from "express";
import { ACCESS_COOKIE } from "../auth/auth.cookies";
import { getAuthenticatedUser } from "../auth/auth.service";
import { AppError } from "../errors/app-error";

function extractToken(request: import("express").Request): string | null {
  const authHeader = request.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  const cookieToken = request.cookies?.[ACCESS_COOKIE];
  if (typeof cookieToken === "string" && cookieToken.length > 0) {
    return cookieToken.trim();
  }
  return null;
}

export const authenticate: RequestHandler = async (request, _response, next) => {
  const accessToken = extractToken(request);
  if (!accessToken) {
    next(new AppError(401, "Authentication is required.", "UNAUTHENTICATED"));
    return;
  }

  try {
    request.user = await getAuthenticatedUser(accessToken);
    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuthenticate: RequestHandler = async (request, _response, next) => {
  const accessToken = extractToken(request);
  if (!accessToken) {
    next();
    return;
  }

  try {
    request.user = await getAuthenticatedUser(accessToken);
  } catch {
    // Silently continue for optional authentication
  }
  next();
};

export function requireRole(role: "USER" | "ADMIN"): RequestHandler {
  return (request, _response, next) => {
    if (!request.user) {
      next(new AppError(401, "Authentication is required.", "UNAUTHENTICATED"));
      return;
    }
    if (request.user.role !== role) {
      next(new AppError(403, "You do not have permission to access this resource.", "FORBIDDEN"));
      return;
    }
    next();
  };
}
