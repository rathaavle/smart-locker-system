import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import * as bcrypt from "bcrypt";

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const rtdb = admin.database();

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

export function generateOtp(): string {
  // TODO: implement in Task 3
  throw new Error("Not implemented");
}

export async function hashOtp(otp: string): Promise<string> {
  // TODO: implement in Task 3
  throw new Error("Not implemented");
}

export async function verifyOtp(otp: string, hash: string): Promise<boolean> {
  // TODO: implement in Task 3
  throw new Error("Not implemented");
}

export function isOtpExpired(createdAt: admin.firestore.Timestamp): boolean {
  // TODO: implement in Task 3
  throw new Error("Not implemented");
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
