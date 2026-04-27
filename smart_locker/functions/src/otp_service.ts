import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import * as bcrypt from "bcrypt";
import { sendOtpEmail } from "./email_service";

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
  async (data: CheckInRequest, _context) => {
    // ── Input validation ──────────────────────────────────────────────────
    const { lockerId, email } = data;

    if (!lockerId || typeof lockerId !== "string" || lockerId.trim() === "") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "lockerId is required",
      );
    }

    if (!email || typeof email !== "string" || email.trim() === "") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "email is required",
      );
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "email format is invalid",
      );
    }

    const db = admin.firestore();
    const rtdb = admin.database();

    // ── Firestore transaction: atomically check locker and create transaction ──
    let transactionId: string;
    let otp: string;

    try {
      const result = await db.runTransaction(async (txn) => {
        const lockerRef = db.collection("lockers").doc(lockerId);
        const lockerSnap = await txn.get(lockerRef);

        if (!lockerSnap.exists) {
          throw new functions.https.HttpsError("not-found", "Locker not found");
        }

        const locker = lockerSnap.data()!;

        // Check isOnline
        if (!locker.isOnline) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "LOCKER_OFFLINE",
          );
        }

        // Check state === EMPTY
        if (locker.state !== "EMPTY") {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "LOCKER_NOT_AVAILABLE",
          );
        }

        // Check no concurrent transaction (race condition guard)
        if (
          locker.activeTransactionId !== null &&
          locker.activeTransactionId !== undefined
        ) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "LOCKER_CONFLICT",
          );
        }

        // Generate transaction ID, OTP, and hash
        const newTransactionId = db.collection("transactions").doc().id;
        const plainOtp = generateOtp();
        const otpHash = await hashOtp(plainOtp);

        const now = admin.firestore.Timestamp.now();
        const otpExpiresAt = admin.firestore.Timestamp.fromMillis(
          now.toMillis() + OTP_EXPIRY_HOURS * 60 * 60 * 1000,
        );

        // Write transaction document
        const transactionRef = db
          .collection("transactions")
          .doc(newTransactionId);
        txn.set(transactionRef, {
          transactionId: newTransactionId,
          lockerId: lockerId,
          userEmail: email.trim(),
          otpHash: otpHash,
          otpExpiresAt: otpExpiresAt,
          checkInAt: now,
          checkOutAt: null,
          status: "ACTIVE",
          openAlertSentAt: null,
        });

        // Update locker: set activeTransactionId and state to UNLOCKING
        txn.update(lockerRef, {
          activeTransactionId: newTransactionId,
          state: "UNLOCKING",
        });

        return { newTransactionId, plainOtp };
      });

      transactionId = result.newTransactionId;
      otp = result.plainOtp;
    } catch (err) {
      // Re-throw HttpsErrors as-is
      if (err instanceof functions.https.HttpsError) {
        throw err;
      }
      functions.logger.error("Firestore transaction failed", err);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to create transaction",
      );
    }

    // ── Write UNLOCK command to RTDB ──────────────────────────────────────
    // deviceId is the same as lockerId (e.g., "locker-01")
    const commandAt = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
    try {
      await rtdb.ref(`devices/${lockerId}`).update({
        command: "UNLOCK",
        commandAt: commandAt,
      });
    } catch (err) {
      functions.logger.error("Failed to write UNLOCK command to RTDB", err);
      // Non-fatal: transaction is already committed; log and continue
    }

    // ── Send OTP email ────────────────────────────────────────────────────
    const emailResult = await sendOtpEmail({
      email: email.trim(),
      otp: otp,
      lockerId: lockerId,
    });

    if (!emailResult.success) {
      functions.logger.error("Email delivery failed", emailResult.error);
      throw new functions.https.HttpsError("internal", "EMAIL_DELIVERY_FAILED");
    }

    return {
      success: true,
      message: `OTP sent to ${email.trim()}. Transaction ID: ${transactionId}`,
    };
  },
);

export const submitOtp = functions.https.onCall(
  async (data: CheckOutRequest, _context) => {
    const { lockerId, otp } = data;

    // ── 1. Input validation ───────────────────────────────────────────────
    if (!lockerId || typeof lockerId !== "string" || lockerId.trim() === "") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "lockerId is required",
      );
    }

    if (!otp || typeof otp !== "string" || otp.trim() === "") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "otp is required",
      );
    }

    const db = admin.firestore();
    const rtdb = admin.database();

    // ── 2. Get locker document ────────────────────────────────────────────
    const lockerRef = db.collection("lockers").doc(lockerId.trim());
    const lockerSnap = await lockerRef.get();

    if (!lockerSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Locker not found");
    }

    const locker = lockerSnap.data()!;

    // ── 3. Check OTP lockout ──────────────────────────────────────────────
    const now = Date.now();
    if (
      locker.otpLockedUntil != null &&
      locker.otpLockedUntil.toMillis() > now
    ) {
      return {
        success: false,
        error: "OTP_LOCKED",
        lockedUntil: locker.otpLockedUntil.toMillis(),
      };
    }

    // ── 4. Get active transaction ─────────────────────────────────────────
    if (!locker.activeTransactionId) {
      return { success: false, error: "OTP_USED" };
    }

    const transactionRef = db
      .collection("transactions")
      .doc(locker.activeTransactionId);
    const transactionSnap = await transactionRef.get();

    if (!transactionSnap.exists) {
      return { success: false, error: "OTP_USED" };
    }

    const transaction = transactionSnap.data()!;

    if (transaction.status !== "ACTIVE") {
      return { success: false, error: "OTP_USED" };
    }

    // ── 5. Check OTP expiry ───────────────────────────────────────────────
    if (isOtpExpired(transaction.otpExpiresAt)) {
      return { success: false, error: "OTP_EXPIRED" };
    }

    // ── 6. Verify OTP (inside Firestore transaction to avoid race conditions) ──
    const isValid = await verifyOtp(otp.trim(), transaction.otpHash);

    if (!isValid) {
      // Increment failed attempts atomically
      const result = await db.runTransaction(async (txn) => {
        const freshLockerSnap = await txn.get(lockerRef);
        if (!freshLockerSnap.exists) {
          throw new functions.https.HttpsError("not-found", "Locker not found");
        }

        const freshLocker = freshLockerSnap.data()!;
        const newFailedAttempts = (freshLocker.failedOtpAttempts || 0) + 1;

        if (newFailedAttempts >= 5) {
          const lockedUntilMs = Date.now() + 15 * 60 * 1000;
          const lockedUntilTimestamp =
            admin.firestore.Timestamp.fromMillis(lockedUntilMs);
          txn.update(lockerRef, {
            failedOtpAttempts: 0,
            otpLockedUntil: lockedUntilTimestamp,
          });
          return {
            success: false,
            error: "OTP_LOCKED" as const,
            lockedUntil: lockedUntilMs,
          };
        } else {
          txn.update(lockerRef, {
            failedOtpAttempts: newFailedAttempts,
          });
          return { success: false, error: "OTP_INVALID" as const };
        }
      });

      return result;
    }

    // ── 7. OTP is valid — complete checkout ───────────────────────────────
    const checkOutAt = admin.firestore.Timestamp.now();

    // a. Write UNLOCK command to RTDB
    const commandAt = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
    try {
      await rtdb.ref(`devices/${lockerId.trim()}`).update({
        command: "UNLOCK",
        commandAt: commandAt,
      });
    } catch (err) {
      functions.logger.error(
        "Failed to write UNLOCK command to RTDB during check-out",
        err,
      );
      // Non-fatal: continue with Firestore updates
    }

    // b & c. Update transaction and locker atomically
    try {
      await db.runTransaction(async (txn) => {
        // b. Update transaction: status = COMPLETED, checkOutAt = now, otpHash = null
        txn.update(transactionRef, {
          status: "COMPLETED",
          checkOutAt: checkOutAt,
          otpHash: null,
        });

        // c. Update locker: clear activeTransactionId, reset failed attempts and lockout
        txn.update(lockerRef, {
          activeTransactionId: null,
          failedOtpAttempts: 0,
          otpLockedUntil: null,
        });
      });
    } catch (err) {
      functions.logger.error(
        "Failed to update Firestore during check-out",
        err,
      );
      throw new functions.https.HttpsError(
        "internal",
        "Failed to complete check-out",
      );
    }

    // d. Return success
    return {
      success: true,
      message: "Check-out successful. Locker is unlocking.",
    };
  },
);
