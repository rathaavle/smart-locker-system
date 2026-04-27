import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import * as bcrypt from "bcrypt";

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// ── Types ──────────────────────────────────────────────────────────────────

export type LockerState = "EMPTY" | "OPEN" | "FILLED" | "UNLOCKING";

export interface CheckInRequest {
  lockerId: string;
  email: string;
}

export interface CheckOutRequest {
  lockerId: string;
  otp: string;
}

// ── OTP Helpers (exported for testing) ────────────────────────────────────

const SALT_ROUNDS = 10;
const OTP_EXPIRY_HOURS = 24;

/**
 * Generates a cryptographically random 6-digit OTP string.
 * Uses crypto.randomInt to ensure uniform distribution over [0, 1_000_000).
 * Requirement 2.3: cryptographically random 6-digit OTP.
 */
export function generateOtp(): string {
  const value = crypto.randomInt(0, 1_000_000);
  return value.toString().padStart(6, "0");
}

/**
 * Hashes a plain-text OTP using bcrypt with 10 salt rounds.
 * Requirement 4.5: OTPs SHALL be stored in hashed form; plain-text never persisted.
 */
export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, SALT_ROUNDS);
}

/**
 * Verifies a plain-text OTP against a bcrypt hash.
 * Returns true if the OTP matches the hash, false otherwise.
 */
export async function verifyOtp(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}

/**
 * Returns true if the OTP created at `createdAt` has expired (older than 24 hours).
 * Requirement 4.1: OTP expiration time is 24 hours from generation.
 */
export function isOtpExpired(createdAt: admin.firestore.Timestamp): boolean {
  const createdAtMs = createdAt.toMillis();
  const nowMs = Date.now();
  const elapsedHours = (nowMs - createdAtMs) / (1000 * 60 * 60);
  return elapsedHours > OTP_EXPIRY_HOURS;
}

// ── Callable Functions ─────────────────────────────────────────────────────

export const initiateCheckIn = functions.https.onCall(
  async (data: CheckInRequest, context) => {
    // TODO: implement in Task 4
    throw new functions.https.HttpsError(
      "unimplemented",
      "Not implemented yet",
    );
  },
);

export const submitOtp = functions.https.onCall(
  async (data: CheckOutRequest, context) => {
    // TODO: implement in Task 5
    throw new functions.https.HttpsError(
      "unimplemented",
      "Not implemented yet",
    );
  },
);
