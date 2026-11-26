import { createHash, randomBytes } from "node:crypto";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { sendNewsletterVerificationEmail as sendEmailServiceVerification } from "./email.service";

export interface VerificationTokenPair {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface UnsubscribeTokenPair {
  rawToken: string;
  tokenHash: string;
}

/**
 * Computes a SHA-256 hash of a raw token string for secure database storage.
 * Raw tokens are never stored in plaintext in the database.
 */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Generates a cryptographically secure random token (64 hex characters) and its SHA-256 hash.
 */
export function generateVerificationToken(expiresInHours = 24): VerificationTokenPair {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
  return { rawToken, tokenHash, expiresAt };
}

/**
 * Generates a cryptographically secure unsubscribe token pair.
 */
export function generateUnsubscribeToken(): UnsubscribeTokenPair {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * Masks an email for safe logging and UI display (e.g. j***n@example.com)
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export interface SendVerificationResult {
  delivered: boolean;
  providerConfigured: boolean;
  verificationUrl: string;
  unsubscribeUrl?: string;
  /** In development/testing environments only, expose token for automated end-to-end verification */
  devVerificationToken?: string;
}

/**
 * Email delivery abstraction for newsletter verification.
 * Checks whether an SMTP provider is configured. If not, safely logs that
 * no provider is configured while generating the exact verification URL.
 */
export async function sendNewsletterVerificationEmail(
  email: string,
  rawVerificationToken: string,
  rawUnsubscribeToken?: string,
): Promise<SendVerificationResult> {
  const siteUrl = env.PUBLIC_SITE_URL.replace(/\/+$/, "");
  const verificationUrl = `${siteUrl}/newsletter/verify?token=${encodeURIComponent(rawVerificationToken)}`;
  const unsubscribeUrl = rawUnsubscribeToken
    ? `${siteUrl}/newsletter/unsubscribe?token=${encodeURIComponent(rawUnsubscribeToken)}`
    : undefined;

  const result = await sendEmailServiceVerification(email, rawVerificationToken, rawUnsubscribeToken);

  return {
    delivered: result.delivered,
    providerConfigured: result.providerConfigured,
    verificationUrl,
    unsubscribeUrl,
    devVerificationToken: result.devToken,
  };
}
