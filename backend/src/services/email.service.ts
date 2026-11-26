import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env";
import { logger } from "../config/logger";

export interface EmailDeliveryResult {
  delivered: boolean;
  providerConfigured: boolean;
  messageId?: string;
  error?: string;
  previewUrl?: string;
  devToken?: string;
}

let cachedTransporter: Transporter | null = null;
let mockTransporter: Transporter | null = null;

/**
 * Sets an optional mock transporter for unit & automated regression testing.
 */
export function setMockEmailTransport(transporter: Transporter | null): void {
  mockTransporter = transporter;
}

/**
 * Masks an email for safe, privacy-conscious logging (e.g. j***e@example.com).
 * Never logs plaintext emails in production logs.
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Resolves the primary public website URL.
 */
export function getPublicSiteUrl(): string {
  const siteUrl = env.APP_URL || env.PUBLIC_SITE_URL || "http://localhost:5173";
  return siteUrl.replace(/\/+$/, "");
}

/**
 * Returns whether an SMTP provider is configured with required credentials.
 */
export function isSmtpConfigured(): boolean {
  if (mockTransporter) return true;
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);
}

/**
 * Initializes or returns the cached Nodemailer SMTP transporter.
 */
function getTransporter(): Transporter | null {
  if (mockTransporter) return mockTransporter;
  if (!isSmtpConfigured()) return null;

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE ?? env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
  }
  return cachedTransporter;
}

/**
 * Dispatches a password reset email to a registered user.
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
): Promise<EmailDeliveryResult> {
  const siteUrl = getPublicSiteUrl();
  const resetUrl = `${siteUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;
  const transporter = getTransporter();

  const subject = "Reset Your Password — Fieldnotes Journal";
  const textContent = [
    "Hello,",
    "",
    "We received a request to reset your password for your Fieldnotes Journal account.",
    "",
    `Reset your password here: ${resetUrl}`,
    "",
    "This link is valid for 30 minutes and can only be used once.",
    "If you did not request a password reset, you can safely ignore this email.",
    "",
    "— The Fieldnotes Journal Editorial Team",
  ].join("\n");

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #242824; background-color: #F8F7F3; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 28px;">
        <span style="font-family: 'Playfair Display', Georgia, serif; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; color: #263C35;">Fieldnotes Journal</span>
      </div>
      <div style="background-color: #FFFFFF; padding: 32px; border-radius: 12px; border: 1px solid rgba(36,40,36,0.08); box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
        <h2 style="font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 700; color: #242824; margin-top: 0; margin-bottom: 16px;">Password Reset Request</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #5E6660; margin-bottom: 24px;">
          We received a request to reset the password associated with your account. Click the button below to choose a new, secure password:
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="background-color: #263C35; color: #FFFFFF; padding: 14px 28px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 9999px; display: inline-block; letter-spacing: 0.05em; text-transform: uppercase;">Reset Password</a>
        </div>
        <p style="font-size: 13px; line-height: 1.5; color: #828E85; margin-bottom: 12px;">
          This link will expire in <strong>30 minutes</strong> and is strictly single-use. If you did not make this request, your account remains secure and no action is required.
        </p>
        <p style="font-size: 12px; line-height: 1.5; color: #828E85; margin-top: 24px; border-top: 1px solid rgba(36,40,36,0.08); padding-top: 16px;">
          Or copy and paste this link into your browser:<br />
          <a href="${resetUrl}" style="color: #263C35; word-break: break-all;">${resetUrl}</a>
        </p>
      </div>
    </div>
  `;

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: env.SMTP_FROM,
        to: email,
        subject,
        text: textContent,
        html: htmlContent,
      });
      logger.info({ email: maskEmail(email), messageId: info.messageId }, "Dispatched password reset email via SMTP");
      return {
        delivered: true,
        providerConfigured: true,
        messageId: info.messageId,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "SMTP transport failure";
      logger.error({ err, email: maskEmail(email) }, "Failed to deliver password reset email via SMTP");
      return {
        delivered: false,
        providerConfigured: true,
        error: errorMessage,
      };
    }
  }

  // Fallback: SMTP unconfigured
  logger.info(
    {
      email: maskEmail(email),
      providerConfigured: false,
      reason: "No SMTP credentials set in environment. Configure SMTP_HOST and SMTP_USER in .env.",
    },
    "Password reset token generated (pending SMTP delivery configuration)",
  );

  return {
    delivered: false,
    providerConfigured: false,
    devToken: env.NODE_ENV !== "production" ? resetToken : undefined,
  };
}

/**
 * Dispatches a double opt-in verification email to a newsletter subscriber.
 */
export async function sendNewsletterVerificationEmail(
  email: string,
  rawVerificationToken: string,
  rawUnsubscribeToken?: string,
): Promise<EmailDeliveryResult> {
  const siteUrl = getPublicSiteUrl();
  const verificationUrl = `${siteUrl}/newsletter/verify?token=${encodeURIComponent(rawVerificationToken)}`;
  const unsubscribeUrl = rawUnsubscribeToken
    ? `${siteUrl}/newsletter/unsubscribe?token=${encodeURIComponent(rawUnsubscribeToken)}`
    : undefined;
  const transporter = getTransporter();

  const subject = "Confirm Your Subscription — Fieldnotes Journal";
  const textContent = [
    "Welcome to Fieldnotes Journal,",
    "",
    "Please confirm your subscription to receive our weekly editorial perspectives and essays.",
    "",
    `Confirm your subscription: ${verificationUrl}`,
    "",
    "This link is valid for 24 hours. If you did not sign up, please ignore this email.",
    unsubscribeUrl ? `Unsubscribe anytime: ${unsubscribeUrl}` : "",
  ].join("\n");

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #242824; background-color: #F8F7F3; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 28px;">
        <span style="font-family: 'Playfair Display', Georgia, serif; font-size: 26px; font-weight: 800; color: #263C35;">Fieldnotes Journal</span>
      </div>
      <div style="background-color: #FFFFFF; padding: 32px; border-radius: 12px; border: 1px solid rgba(36,40,36,0.08); box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
        <h2 style="font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 700; color: #242824; margin-top: 0;">Confirm Your Subscription</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #5E6660; margin-bottom: 24px;">
          Thank you for joining Fieldnotes Journal. To complete your subscription and receive our weekly longform stories and cultural essays, please confirm your email address:
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verificationUrl}" style="background-color: #263C35; color: #FFFFFF; padding: 14px 28px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 9999px; display: inline-block; letter-spacing: 0.05em; text-transform: uppercase;">Confirm Subscription</a>
        </div>
        <p style="font-size: 13px; color: #828E85;">
          This link will expire in 24 hours.
        </p>
      </div>
    </div>
  `;

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: env.SMTP_FROM,
        to: email,
        subject,
        text: textContent,
        html: htmlContent,
      });
      logger.info({ email: maskEmail(email), messageId: info.messageId }, "Dispatched newsletter verification email via SMTP");
      return {
        delivered: true,
        providerConfigured: true,
        messageId: info.messageId,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "SMTP transport failure";
      logger.error({ err, email: maskEmail(email) }, "Failed to deliver newsletter verification email via SMTP");
      return {
        delivered: false,
        providerConfigured: true,
        error: errorMessage,
      };
    }
  }

  // Fallback: SMTP unconfigured
  logger.info(
    {
      email: maskEmail(email),
      providerConfigured: false,
      reason: "No SMTP credentials set in environment. Subscription remains PENDING until verified.",
    },
    "Newsletter verification created (pending SMTP delivery configuration)",
  );

  return {
    delivered: false,
    providerConfigured: false,
    devToken: env.NODE_ENV !== "production" ? rawVerificationToken : undefined,
  };
}

/**
 * Dispatches a welcome confirmation email to an active subscriber.
 */
export async function sendNewsletterWelcomeEmail(
  email: string,
  unsubscribeToken?: string,
): Promise<EmailDeliveryResult> {
  const siteUrl = getPublicSiteUrl();
  const unsubscribeUrl = unsubscribeToken
    ? `${siteUrl}/newsletter/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`
    : undefined;
  const transporter = getTransporter();

  const subject = "Welcome to Fieldnotes Journal";
  const textContent = [
    "Welcome to Fieldnotes Journal!",
    "",
    "Your subscription is confirmed. You will now receive our weekly essays, technology deep dives, and cultural reviews.",
    "",
    unsubscribeUrl ? `Unsubscribe anytime: ${unsubscribeUrl}` : "",
  ].join("\n");

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #242824; background-color: #F8F7F3; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 28px;">
        <span style="font-family: 'Playfair Display', Georgia, serif; font-size: 26px; font-weight: 800; color: #263C35;">Fieldnotes Journal</span>
      </div>
      <div style="background-color: #FFFFFF; padding: 32px; border-radius: 12px; border: 1px solid rgba(36,40,36,0.08);">
        <h2 style="font-family: 'Playfair Display', Georgia, serif; font-size: 22px; font-weight: 700; color: #263C35; margin-top: 0;">Subscription Confirmed</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #5E6660;">
          Welcome to our readership. You will now receive our curated weekly dispatches on craft, architecture, and design.
        </p>
      </div>
    </div>
  `;

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: env.SMTP_FROM,
        to: email,
        subject,
        text: textContent,
        html: htmlContent,
      });
      return {
        delivered: true,
        providerConfigured: true,
        messageId: info.messageId,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "SMTP transport failure";
      return {
        delivered: false,
        providerConfigured: true,
        error: errorMessage,
      };
    }
  }

  return {
    delivered: false,
    providerConfigured: false,
  };
}
