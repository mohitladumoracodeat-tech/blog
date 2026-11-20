import type { RequestHandler } from "express";
import { corsOrigins } from "../config/env";
import { AppError } from "../errors/app-error";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export const verifyOrigin: RequestHandler = (request, _response, next) => {
  const origin = request.get("origin");
  if (!safeMethods.has(request.method) && origin && !corsOrigins.includes(origin)) {
    next(new AppError(403, "Request origin is not allowed.", "CSRF_ORIGIN_DENIED"));
    return;
  }
  next();
};
