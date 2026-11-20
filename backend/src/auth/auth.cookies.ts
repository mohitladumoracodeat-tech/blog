import type { CookieOptions, Response } from "express";
import { env } from "../config/env";

export const ACCESS_COOKIE = "blog_access";
export const REFRESH_COOKIE = "blog_refresh";
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE ?? env.NODE_ENV === "production",
  sameSite: env.COOKIE_SAME_SITE,
  domain: env.COOKIE_DOMAIN || undefined,
};

export function setAuthCookies(
  response: Response,
  accessToken: string,
  refreshToken: string,
): void {
  response.cookie(ACCESS_COOKIE, accessToken, {
    ...baseCookieOptions,
    path: "/api/v1",
    maxAge: env.ACCESS_TOKEN_TTL_MINUTES * 60 * 1000,
  });
  response.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookieOptions,
    path: REFRESH_COOKIE_PATH,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(response: Response): void {
  response.clearCookie(ACCESS_COOKIE, {
    ...baseCookieOptions,
    path: "/api/v1",
  });
  response.clearCookie(REFRESH_COOKIE, {
    ...baseCookieOptions,
    path: REFRESH_COOKIE_PATH,
  });
}
