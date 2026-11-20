import { z } from "zod";
import { AppError } from "../errors/app-error";
import { isEntityId } from "./ids";

export const entityIdSchema = z
  .union([z.string().trim().min(1), z.number().int().positive()])
  .transform((value) => String(value))
  .refine((value) => isEntityId(value), { message: "Invalid id." });

export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues[0]?.message ?? "Invalid request.", "VALIDATION_ERROR");
  }
  return parsed.data;
}

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function paginationOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

export function slugify(value: string, maxLength: number): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");

  if (!slug) {
    throw new AppError(400, "Name must contain at least one letter or number.", "INVALID_SLUG_SOURCE");
  }
  return slug;
}
