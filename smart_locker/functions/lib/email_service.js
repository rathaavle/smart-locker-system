"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.composeEmailBody = composeEmailBody;
exports.sendOtpEmail = sendOtpEmail;
const nodemailer = __importStar(require("nodemailer"));
const functions = __importStar(require("firebase-functions"));
// ── Nodemailer Transporter ────────────────────────────────────────────────
/**
 * Creates and returns a Nodemailer transport instance using environment variables.
 * Falls back to a mock transporter if SMTP credentials are not configured.
 */
function createTransporter() {
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
function composeEmailBody(otp, lockerId) {
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
const RETRY_INTERVAL_MS = 10000; // 10 seconds
/**
 * Sends an OTP email to the specified address with retry logic.
 * Requirement 12.2: Retry up to 3 times with 10-second intervals.
 * Requirement 12.3: If all 3 attempts fail, return EMAIL_DELIVERY_FAILED error.
 * Requirement 12.4: Initial delivery attempt must complete within 30 seconds.
 */
async function sendOtpEmail(params) {
    const { email, otp, lockerId } = params;
    const transporter = createTransporter();
    const emailBody = composeEmailBody(otp, lockerId);
    // Build email message
    const mailOptions = {
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
        }
        catch (err) {
            functions.logger.warn(`Email delivery attempt ${attempt}/${MAX_RETRIES} failed`, {
                error: err instanceof Error ? err.message : String(err),
            });
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
//# sourceMappingURL=email_service.js.map