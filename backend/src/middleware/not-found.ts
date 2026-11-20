import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error";

export const notFound: RequestHandler = (request, _response, next) => {
  next(new AppError(404, `Route ${request.method} ${request.path} was not found.`, "NOT_FOUND"));
};
