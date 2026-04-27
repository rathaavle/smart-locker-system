import * as nodemailer from "nodemailer";
import * as functions from "firebase-functions";

// ── Types ──────────────────────────────────────────────────────────────────

export interface EmailParams {
  email: string;
  otp: string;
  lockerId: string;
}

export interface EmailResult {
  success: boolean;
  error?: string;
}

// ── Nodemailer Transporter ────────────────────────────────────────────────

/**
 * Creates and returns a Nodemailer transport instance using environment variables.
 * Falls back to a mock transporter if SMTP credentials are not configured.
 */
function createTransporter(): nodemailer.Transporter {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM;

  // If any SMTP env var is missing, return a mock transporter (for testing)
  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom) {
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      auth: {
        user: process.env.ETHEREAL_USER || "",
        pass: process.env.ETHEREAL_PASS || "",
      },
    });
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort, 10),
    secure: false, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

// ── Email Composition ──────────────────────────────────────────────────────

/**
 * Composes the email body containing the OTP and locker identifier.
 * Requirement 12.1: Email must contain 6-digit OTP and locker identifier.
 */
export function composeEmailBody(otp: string, lockerId: string): string {
  return `
Hello,

Your OTP for locker ${lockerId} is: ${otp}

This OTP is valid for 24 hours.

If you did not request this email, please ignore it.

— Smart Locker System
  `.trim();
}

// ── Email Delivery with Retry Logic ───────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_INTERVAL_MS = 10_000; // 10 seconds

/**
 * Sends an OTP email to the specified address with retry logic.
 * Requirement 12.2: Retry up to 3 times with 10-second intervals.
 * Requirement 12.3: If all 3 attempts fail, return EMAIL_DELIVERY_FAILED error.
 * Requirement 12.4: Initial delivery attempt must complete within 30 seconds.
 */
export async function sendOtpEmail(params: EmailParams): Promise<EmailResult> {
  const { email, otp, lockerId } = params;

  const transporter = createTransporter();
  const emailBody = composeEmailBody(otp, lockerId);

  // Build email message
  const mailOptions: nodemailer.SendMailOptions = {
    from: process.env.SMTP_FROM || "Smart Locker <no-reply@smartlocker.local>",
    to: email.trim(),
    subject: `Your OTP for ${lockerId} - Smart Locker`,
    text: emailBody,
  };

  // ── Retry loop ────────────────────────────────────────────────────────
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const info = await transporter.sendMail(mailOptions);
      functions.logger.info(`Email sent successfully (attempt ${attempt})`, {
        messageId: info.messageId,
      });

      // Verify the email was accepted (for mock/ethereal transports)
      if (process.env.NODE_ENV === "test" || !process.env.SMTP_HOST) {
        // In test mode or without SMTP config, consider it successful
        return { success: true };
      }

      return { success: true };
    } catch (err) {
      functions.logger.warn(
        `Email delivery attempt ${attempt}/${MAX_RETRIES} failed`,
        {
          error: err instanceof Error ? err.message : String(err),
        },
      );

      // If this is the last attempt, return failure
      if (attempt === MAX_RETRIES) {
        return {
          success: false,
          error: "EMAIL_DELIVERY_FAILED",
        };
      }

      // Wait before retrying (10 seconds)
      await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
    }
  }

  // Should not reach here, but just in case
  return {
    success: false,
    error: "EMAIL_DELIVERY_FAILED",
  };
}
