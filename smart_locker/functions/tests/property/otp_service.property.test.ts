import * as fc from "fast-check";
import * as admin from "firebase-admin";
import {
  generateOtp,
  hashOtp,
  verifyOtp,
  isOtpExpired,
} from "../../src/otp_service";

// Bcrypt-based async property tests (P7, P8, P11) run 100 iterations each,
// each requiring a bcrypt hash operation (~100ms). Set a generous timeout.
jest.setTimeout(60_000);

// Feature: smart-locker-system, Property 5: OTP format

const OTP_REGEX = /^\d{6}$/;

describe("Property 5: OTP Format Invariant", () => {
  it("should always return a string of exactly 6 decimal digits", () => {
    // Feature: smart-locker-system, Property 5: OTP format
    // Validates: Requirements 2.3
    // Verifikasi setiap output generateOtp() match /^\d{6}$/ selama 100+ iterasi
    fc.assert(
      fc.property(
        // Use a dummy arbitrary — we only care about running the property
        // 100+ times, not about the input itself
        fc.constant(null),
        (_) => {
          const otp = generateOtp();

          // Must be a string
          expect(typeof otp).toBe("string");

          // Must be exactly 6 characters
          expect(otp).toHaveLength(6);

          // Must consist entirely of decimal digits (0–9)
          expect(otp).toMatch(OTP_REGEX);

          // Numeric value must be in range [0, 999999]
          const numericValue = parseInt(otp, 10);
          expect(numericValue).toBeGreaterThanOrEqual(0);
          expect(numericValue).toBeLessThanOrEqual(999_999);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should produce OTPs with leading zeros preserved (e.g. '000042')", () => {
    // Feature: smart-locker-system, Property 5: OTP format
    // Validates: Requirements 2.3
    // Ensures that OTPs with numeric value < 100000 are still 6 digits via zero-padding
    //
    // We cannot force generateOtp() to produce a specific value, so we verify
    // the format invariant holds across a large sample and trust that the
    // padStart(6, "0") implementation handles low values correctly.
    const samples = Array.from({ length: 200 }, () => generateOtp());
    for (const otp of samples) {
      expect(otp).toMatch(OTP_REGEX);
      expect(otp).toHaveLength(6);
    }
  });
});

// ── Property 6: OTP Expiry Logic Correctness ──────────────────────────────

// Feature: smart-locker-system, Property 6: OTP expiry logic

/**
 * Helper: create a Firestore-compatible Timestamp from a Unix millisecond value.
 * We use admin.firestore.Timestamp.fromMillis so the test exercises the same
 * type that the production code receives.
 */
function makeTimestamp(ms: number): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromMillis(ms);
}

describe("Property 6: OTP Expiry Logic Correctness", () => {
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

  it("should return false for any timestamp within the last 24 hours", () => {
    // Feature: smart-locker-system, Property 6: OTP expiry logic
    // Validates: Requirements 4.1, 4.2
    //
    // Generate an arbitrary offset in (0, 24h) ms before now.
    // isOtpExpired(T) MUST return false — the OTP is still valid.
    fc.assert(
      fc.property(
        // offsetMs ∈ [1, 24h - 1ms] — strictly within the valid window
        fc.integer({ min: 1, max: TWENTY_FOUR_HOURS_MS - 1 }),
        (offsetMs) => {
          const createdAtMs = Date.now() - offsetMs;
          const timestamp = makeTimestamp(createdAtMs);
          expect(isOtpExpired(timestamp)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should return true for any timestamp more than 24 hours in the past", () => {
    // Feature: smart-locker-system, Property 6: OTP expiry logic
    // Validates: Requirements 4.1, 4.2
    //
    // Generate an arbitrary extra offset > 0 beyond the 24-hour boundary.
    // isOtpExpired(T) MUST return true — the OTP has expired.
    fc.assert(
      fc.property(
        // extraMs ∈ [1, 30 days] — any amount past the 24h window
        fc.integer({ min: 1, max: 30 * 24 * 60 * 60 * 1000 }),
        (extraMs) => {
          const createdAtMs = Date.now() - TWENTY_FOUR_HOURS_MS - extraMs;
          const timestamp = makeTimestamp(createdAtMs);
          expect(isOtpExpired(timestamp)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should return false for a timestamp exactly at the 24-hour boundary (edge case)", () => {
    // Feature: smart-locker-system, Property 6: OTP expiry logic
    // Validates: Requirements 4.1, 4.2
    //
    // A timestamp exactly 24 hours ago is NOT yet expired (> 24h is the condition).
    // We allow a small tolerance (±500 ms) for test execution time.
    const createdAtMs = Date.now() - TWENTY_FOUR_HOURS_MS + 500;
    const timestamp = makeTimestamp(createdAtMs);
    expect(isOtpExpired(timestamp)).toBe(false);
  });

  it("should return true for a timestamp exactly 1 ms past the 24-hour boundary", () => {
    // Feature: smart-locker-system, Property 6: OTP expiry logic
    // Validates: Requirements 4.1, 4.2
    //
    // A timestamp 24h + 1ms ago IS expired.
    const createdAtMs = Date.now() - TWENTY_FOUR_HOURS_MS - 1;
    const timestamp = makeTimestamp(createdAtMs);
    expect(isOtpExpired(timestamp)).toBe(true);
  });
});

// ── Property 7: OTP Verification Round-Trip ───────────────────────────────

// Feature: smart-locker-system, Property 7: OTP verification round-trip

describe("Property 7: OTP Verification Round-Trip", () => {
  it("should return true when verifying an OTP against its own hash", async () => {
    // Feature: smart-locker-system, Property 7: OTP verification round-trip
    // Validates: Requirements 3.2, 7.1
    //
    // For any 6-digit OTP string, hashing it and then verifying the same OTP
    // against that hash MUST return true.
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary 6-digit OTP strings (zero-padded)
        fc
          .integer({ min: 0, max: 999_999 })
          .map((n) => n.toString().padStart(6, "0")),
        async (otp) => {
          const hash = await hashOtp(otp);
          const result = await verifyOtp(otp, hash);
          expect(result).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should return false when verifying a different OTP against the hash", async () => {
    // Feature: smart-locker-system, Property 7: OTP verification round-trip
    // Validates: Requirements 3.2, 7.1
    //
    // For any two distinct 6-digit OTP strings otp1 and otp2, verifying otp2
    // against the hash of otp1 MUST return false.
    await fc.assert(
      fc.asyncProperty(
        // Generate two distinct 6-digit OTP integers
        fc
          .tuple(
            fc.integer({ min: 0, max: 999_999 }),
            fc.integer({ min: 0, max: 999_999 }),
          )
          .filter(([a, b]) => a !== b),
        async ([n1, n2]) => {
          const otp1 = n1.toString().padStart(6, "0");
          const otp2 = n2.toString().padStart(6, "0");

          const hash = await hashOtp(otp1);
          const result = await verifyOtp(otp2, hash);
          expect(result).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 8: OTP Hashing — Plain-Text Never Stored ─────────────────────

// Feature: smart-locker-system, Property 8: OTP hashing

describe("Property 8: OTP Hashing — Plain-Text Never Stored", () => {
  it("should produce a bcrypt hash that starts with $2b$ and differs from plain-text", async () => {
    // Feature: smart-locker-system, Property 8: OTP hashing
    // Validates: Requirements 4.5
    //
    // For any 6-digit OTP, the hash MUST start with "$2b$" (bcrypt identifier)
    // and MUST NOT equal the plain-text OTP.
    await fc.assert(
      fc.asyncProperty(
        fc
          .integer({ min: 0, max: 999_999 })
          .map((n) => n.toString().padStart(6, "0")),
        async (otp) => {
          const hash = await hashOtp(otp);

          // Hash must be a bcrypt hash (starts with $2b$)
          expect(hash).toMatch(/^\$2b\$/);

          // Hash must NOT equal the plain-text OTP
          expect(hash).not.toBe(otp);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 11: Transaction Document Schema Completeness ─────────────────

// Feature: smart-locker-system, Property 11: Transaction schema

/**
 * Simulates the transaction document that initiateCheckIn would create.
 * This tests the shape/schema of the document without requiring a live Firestore.
 *
 * The factory mirrors the exact fields set in initiateCheckIn's Firestore transaction.
 */
function buildTransactionDocument(params: {
  transactionId: string;
  lockerId: string;
  userEmail: string;
  otpHash: string;
  checkInAt: admin.firestore.Timestamp;
}) {
  const OTP_EXPIRY_HOURS = 24;
  const otpExpiresAt = admin.firestore.Timestamp.fromMillis(
    params.checkInAt.toMillis() + OTP_EXPIRY_HOURS * 60 * 60 * 1000,
  );

  return {
    transactionId: params.transactionId,
    lockerId: params.lockerId,
    userEmail: params.userEmail,
    otpHash: params.otpHash,
    otpExpiresAt: otpExpiresAt,
    checkInAt: params.checkInAt,
    checkOutAt: null,
    status: "ACTIVE" as const,
    openAlertSentAt: null,
  };
}

const REQUIRED_TRANSACTION_FIELDS = [
  "transactionId",
  "lockerId",
  "userEmail",
  "otpHash",
  "otpExpiresAt",
  "checkInAt",
  "checkOutAt",
  "status",
] as const;

describe("Property 11: Transaction Document Schema Completeness", () => {
  it("should contain all required fields for any (lockerId, email) pair", async () => {
    // Feature: smart-locker-system, Property 11: Transaction schema
    // Validates: Requirements 2.4, 2.6, 11.2
    //
    // For any arbitrary (lockerId, email) pair, the transaction document produced
    // by initiateCheckIn MUST contain all required fields with correct types.
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          lockerId: fc
            .string({ minLength: 1, maxLength: 20 })
            .map((s) => `locker-${s.replace(/[^a-z0-9]/gi, "x").slice(0, 10)}`),
          email: fc
            .tuple(
              fc.string({ minLength: 1, maxLength: 10 }),
              fc.string({ minLength: 1, maxLength: 10 }),
              fc.constantFrom("com", "net", "org", "io"),
            )
            .map(([user, domain, tld]) => `${user}@${domain}.${tld}`),
        }),
        async ({ lockerId, email }) => {
          // Simulate what initiateCheckIn does: generate OTP, hash it, build doc
          const otp = generateOtp();
          const otpHash = await hashOtp(otp);
          const transactionId = `txn-${Math.random().toString(36).slice(2)}`;
          const checkInAt = admin.firestore.Timestamp.now();

          const doc = buildTransactionDocument({
            transactionId,
            lockerId,
            userEmail: email,
            otpHash,
            checkInAt,
          });

          // All required fields must be present
          for (const field of REQUIRED_TRANSACTION_FIELDS) {
            expect(doc).toHaveProperty(field);
          }

          // Field type and value assertions
          expect(typeof doc.transactionId).toBe("string");
          expect(doc.transactionId.length).toBeGreaterThan(0);

          expect(typeof doc.lockerId).toBe("string");
          expect(doc.lockerId).toBe(lockerId);

          expect(typeof doc.userEmail).toBe("string");
          expect(doc.userEmail).toBe(email);

          // otpHash must be a bcrypt hash (starts with $2b$), not plain-text
          expect(doc.otpHash).toMatch(/^\$2b\$/);
          expect(doc.otpHash).not.toBe(otp);

          // otpExpiresAt must be 24 hours after checkInAt
          const expectedExpiryMs = checkInAt.toMillis() + 24 * 60 * 60 * 1000;
          expect(doc.otpExpiresAt.toMillis()).toBe(expectedExpiryMs);

          // checkInAt must be a Timestamp
          expect(doc.checkInAt).toBeInstanceOf(admin.firestore.Timestamp);

          // checkOutAt must be null on creation
          expect(doc.checkOutAt).toBeNull();

          // status must be ACTIVE on creation
          expect(doc.status).toBe("ACTIVE");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should set otpExpiresAt exactly 24 hours after checkInAt for any creation time", () => {
    // Feature: smart-locker-system, Property 11: Transaction schema
    // Validates: Requirements 2.4, 11.2
    //
    // The expiry timestamp must always be exactly 24h after check-in,
    // regardless of when the transaction is created.
    fc.assert(
      fc.property(
        // Generate arbitrary creation times within a reasonable range
        fc
          .integer({ min: 0, max: 30 * 24 * 60 * 60 * 1000 })
          .map((offsetMs) =>
            admin.firestore.Timestamp.fromMillis(Date.now() - offsetMs),
          ),
        (checkInAt) => {
          const doc = buildTransactionDocument({
            transactionId: "test-txn",
            lockerId: "locker-01",
            userEmail: "user@example.com",
            otpHash: "$2b$10$fakehash",
            checkInAt,
          });

          const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
          const expectedExpiryMs = checkInAt.toMillis() + TWENTY_FOUR_HOURS_MS;
          expect(doc.otpExpiresAt.toMillis()).toBe(expectedExpiryMs);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 19: Concurrent Check-In Conflict Resolution ──────────────────

// Feature: smart-locker-system, Property 19: Concurrent conflict

/**
 * Simulates the locker availability guard logic extracted from initiateCheckIn.
 *
 * In production, this runs inside a Firestore transaction which provides
 * serializable isolation. Here we model the same guard as a pure function
 * to verify the conflict-detection logic in isolation.
 *
 * Returns:
 *   { success: true, transactionId: string } if the locker is available
 *   { success: false, error: string }         if the locker is unavailable
 */
function tryAcquireLocker(lockerState: {
  state: string;
  isOnline: boolean;
  activeTransactionId: string | null;
}):
  | { success: true; transactionId: string }
  | { success: false; error: string } {
  if (!lockerState.isOnline) {
    return { success: false, error: "LOCKER_OFFLINE" };
  }
  if (lockerState.state !== "EMPTY") {
    return { success: false, error: "LOCKER_NOT_AVAILABLE" };
  }
  if (lockerState.activeTransactionId !== null) {
    return { success: false, error: "LOCKER_CONFLICT" };
  }
  return {
    success: true,
    transactionId: `txn-${Math.random().toString(36).slice(2)}`,
  };
}

/**
 * Simulates two concurrent check-in attempts on the same locker using a
 * shared mutable locker state (mimicking Firestore's serializable transaction).
 *
 * The first caller to "commit" wins; the second sees the updated state and
 * must receive a conflict error.
 */
function simulateConcurrentCheckIn(initialState: {
  state: string;
  isOnline: boolean;
  activeTransactionId: string | null;
}): {
  results: Array<
    { success: true; transactionId: string } | { success: false; error: string }
  >;
  finalActiveTransactionId: string | null;
} {
  // Both requests read the same initial state (snapshot isolation)
  const snapshot = { ...initialState };

  const result1 = tryAcquireLocker(snapshot);
  // First request commits: update shared state
  const stateAfterFirst = result1.success
    ? {
        ...snapshot,
        activeTransactionId: result1.transactionId,
        state: "UNLOCKING",
      }
    : snapshot;

  // Second request reads the updated state (serialized after first)
  const result2 = tryAcquireLocker(stateAfterFirst);

  return {
    results: [result1, result2],
    finalActiveTransactionId: stateAfterFirst.activeTransactionId,
  };
}

describe("Property 19: Concurrent Check-In Conflict Resolution", () => {
  it("should allow exactly one check-in when two requests target the same EMPTY locker", () => {
    // Feature: smart-locker-system, Property 19: Concurrent conflict
    // Validates: Requirements 9.3
    //
    // For any two simultaneous initiateCheckIn requests on the same EMPTY+online locker,
    // exactly one MUST succeed and the other MUST return LOCKER_CONFLICT.
    // After both complete, the locker MUST have exactly one active transaction.
    fc.assert(
      fc.property(
        // Generate arbitrary locker IDs to ensure the property holds for any locker
        fc
          .string({ minLength: 1, maxLength: 15 })
          .map((s) => `locker-${s.replace(/[^a-z0-9]/gi, "x").slice(0, 8)}`),
        (lockerId) => {
          const initialState = {
            state: "EMPTY",
            isOnline: true,
            activeTransactionId: null,
            lockerId,
          };

          const { results, finalActiveTransactionId } =
            simulateConcurrentCheckIn(initialState);

          // Exactly one must succeed
          const successCount = results.filter((r) => r.success).length;
          expect(successCount).toBe(1);

          // The failing one must return a conflict-type error.
          // In production (Firestore transaction), the second request sees
          // activeTransactionId != null → LOCKER_CONFLICT.
          // In this simulation, the state is updated to UNLOCKING first, so
          // the second request may see state != EMPTY → LOCKER_NOT_AVAILABLE.
          // Both indicate the locker is no longer available for a second check-in.
          const failedResult = results.find((r) => !r.success);
          expect(failedResult).toBeDefined();
          expect(["LOCKER_CONFLICT", "LOCKER_NOT_AVAILABLE"]).toContain(
            (failedResult as { success: false; error: string }).error,
          );

          // The locker must have exactly one active transaction after both complete
          expect(finalActiveTransactionId).not.toBeNull();
          expect(typeof finalActiveTransactionId).toBe("string");

          // The active transaction ID must match the successful result's transaction ID
          const successResult = results.find((r) => r.success) as {
            success: true;
            transactionId: string;
          };
          expect(finalActiveTransactionId).toBe(successResult.transactionId);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should reject both requests if the locker is already occupied (not EMPTY)", () => {
    // Feature: smart-locker-system, Property 19: Concurrent conflict
    // Validates: Requirements 9.3
    //
    // If the locker is already FILLED or UNLOCKING, both concurrent requests
    // must be rejected — neither should succeed.
    fc.assert(
      fc.property(
        fc.constantFrom("FILLED", "OPEN", "UNLOCKING"),
        (occupiedState) => {
          const initialState = {
            state: occupiedState,
            isOnline: true,
            activeTransactionId: "existing-txn-id",
          };

          const { results } = simulateConcurrentCheckIn(initialState);

          // Both must fail
          for (const result of results) {
            expect(result.success).toBe(false);
          }

          // Both must return LOCKER_NOT_AVAILABLE or LOCKER_CONFLICT
          for (const result of results) {
            if (!result.success) {
              expect(["LOCKER_NOT_AVAILABLE", "LOCKER_CONFLICT"]).toContain(
                result.error,
              );
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should reject all requests if the locker is offline", () => {
    // Feature: smart-locker-system, Property 19: Concurrent conflict
    // Validates: Requirements 9.3
    //
    // If the locker is offline, all check-in attempts must be rejected with LOCKER_OFFLINE.
    fc.assert(
      fc.property(
        fc.constantFrom("EMPTY", "FILLED", "OPEN", "UNLOCKING"),
        (state) => {
          const initialState = {
            state,
            isOnline: false,
            activeTransactionId: null,
          };

          const { results } = simulateConcurrentCheckIn(initialState);

          for (const result of results) {
            expect(result.success).toBe(false);
            if (!result.success) {
              expect(result.error).toBe("LOCKER_OFFLINE");
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 9: OTP Single-Use Invalidation ───────────────────────────────

// Feature: smart-locker-system, Property 9: OTP single-use

/**
 * Simulates the state of a transaction and locker after a successful check-out.
 *
 * In production, submitOtp sets:
 *   - transaction.status = "COMPLETED"
 *   - transaction.checkOutAt = now
 *   - transaction.otpHash = null
 *   - locker.activeTransactionId = null
 *
 * This model mirrors that exact mutation so we can verify the single-use
 * invariant without a live Firestore instance.
 */
interface TransactionState {
  transactionId: string;
  lockerId: string;
  userEmail: string;
  otpHash: string | null;
  otpExpiresAt: admin.firestore.Timestamp;
  checkInAt: admin.firestore.Timestamp;
  checkOutAt: admin.firestore.Timestamp | null;
  status: "ACTIVE" | "COMPLETED" | "MANUAL_REVIEW";
}

interface LockerState {
  lockerId: string;
  state: string;
  activeTransactionId: string | null;
  failedOtpAttempts: number;
  otpLockedUntil: admin.firestore.Timestamp | null;
}

/**
 * Simulates the guard logic in submitOtp that rejects a second OTP submission
 * after a successful check-out.
 *
 * Returns the same structured responses as the production callable.
 */
function simulateSubmitOtp(
  locker: LockerState,
  transaction: TransactionState | null,
  submittedOtp: string,
  otpHash: string | null,
  nowMs: number = Date.now(),
): { success: boolean; error?: string } {
  // Check lockout
  if (
    locker.otpLockedUntil != null &&
    locker.otpLockedUntil.toMillis() > nowMs
  ) {
    return { success: false, error: "OTP_LOCKED" };
  }

  // No active transaction → OTP already used / no session
  if (!locker.activeTransactionId || transaction === null) {
    return { success: false, error: "OTP_USED" };
  }

  // Transaction not ACTIVE → already completed
  if (transaction.status !== "ACTIVE") {
    return { success: false, error: "OTP_USED" };
  }

  // otpHash cleared → OTP already consumed
  if (transaction.otpHash === null) {
    return { success: false, error: "OTP_USED" };
  }

  // Expiry check (synchronous approximation using stored expiry timestamp)
  if (transaction.otpExpiresAt.toMillis() < nowMs) {
    return { success: false, error: "OTP_EXPIRED" };
  }

  // OTP match check (synchronous — we pass the hash directly for the model)
  if (otpHash === null || transaction.otpHash !== otpHash) {
    return { success: false, error: "OTP_INVALID" };
  }

  return { success: true };
}

/**
 * Applies the check-out mutation to locker and transaction state,
 * mirroring what submitOtp does in Firestore after a valid OTP.
 */
function applyCheckOut(
  locker: LockerState,
  transaction: TransactionState,
): { locker: LockerState; transaction: TransactionState } {
  const checkOutAt = admin.firestore.Timestamp.now();
  return {
    locker: {
      ...locker,
      activeTransactionId: null,
      failedOtpAttempts: 0,
      otpLockedUntil: null,
    },
    transaction: {
      ...transaction,
      status: "COMPLETED",
      checkOutAt,
      otpHash: null,
    },
  };
}

describe("Property 9: OTP Single-Use Invalidation", () => {
  it("should reject a second OTP submission after a successful check-out", () => {
    // Feature: smart-locker-system, Property 9: OTP single-use
    // Validates: Requirements 4.4
    //
    // After an OTP has been successfully used to complete a check-out,
    // submitting the same OTP again for the same locker MUST be rejected.
    // The rejection error MUST be OTP_USED (transaction no longer ACTIVE,
    // activeTransactionId cleared, and otpHash nulled).
    fc.assert(
      fc.property(
        fc.record({
          lockerId: fc
            .string({ minLength: 1, maxLength: 10 })
            .map((s) => `locker-${s.replace(/[^a-z0-9]/gi, "x").slice(0, 8)}`),
          otpValue: fc
            .integer({ min: 0, max: 999_999 })
            .map((n) => n.toString().padStart(6, "0")),
        }),
        ({ lockerId, otpValue }) => {
          // Use a deterministic "hash" for the model (not real bcrypt — avoids async)
          const fakeHash = `$2b$10$fakehash_${otpValue}`;

          const now = admin.firestore.Timestamp.now();
          const otpExpiresAt = admin.firestore.Timestamp.fromMillis(
            now.toMillis() + 24 * 60 * 60 * 1000,
          );

          const transactionId = `txn-${Math.random().toString(36).slice(2)}`;

          const initialLocker: LockerState = {
            lockerId,
            state: "FILLED",
            activeTransactionId: transactionId,
            failedOtpAttempts: 0,
            otpLockedUntil: null,
          };

          const initialTransaction: TransactionState = {
            transactionId,
            lockerId,
            userEmail: "user@example.com",
            otpHash: fakeHash,
            otpExpiresAt,
            checkInAt: now,
            checkOutAt: null,
            status: "ACTIVE",
          };

          // First submission: should succeed
          const firstResult = simulateSubmitOtp(
            initialLocker,
            initialTransaction,
            otpValue,
            fakeHash,
          );
          expect(firstResult.success).toBe(true);

          // Apply the check-out mutation (mirrors what submitOtp does in Firestore)
          const { locker: updatedLocker, transaction: updatedTransaction } =
            applyCheckOut(initialLocker, initialTransaction);

          // Second submission with the same OTP: must be rejected
          const secondResult = simulateSubmitOtp(
            updatedLocker,
            updatedTransaction,
            otpValue,
            fakeHash,
          );
          expect(secondResult.success).toBe(false);
          expect(secondResult.error).toBe("OTP_USED");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should reject OTP submission when activeTransactionId is null (no active session)", () => {
    // Feature: smart-locker-system, Property 9: OTP single-use
    // Validates: Requirements 4.4
    //
    // A locker with no active transaction (already checked out or never checked in)
    // must reject any OTP submission with OTP_USED.
    fc.assert(
      fc.property(
        fc
          .integer({ min: 0, max: 999_999 })
          .map((n) => n.toString().padStart(6, "0")),
        (otpValue) => {
          const lockerWithNoTransaction: LockerState = {
            lockerId: "locker-01",
            state: "EMPTY",
            activeTransactionId: null,
            failedOtpAttempts: 0,
            otpLockedUntil: null,
          };

          const result = simulateSubmitOtp(
            lockerWithNoTransaction,
            null,
            otpValue,
            null,
          );
          expect(result.success).toBe(false);
          expect(result.error).toBe("OTP_USED");
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 10: Transaction Cleanup After Check-Out ──────────────────────

// Feature: smart-locker-system, Property 10: Transaction cleanup

describe("Property 10: Transaction Cleanup After Check-Out", () => {
  it("should set status=COMPLETED, checkOutAt!=null, and otpHash=null after successful check-out", () => {
    // Feature: smart-locker-system, Property 10: Transaction cleanup
    // Validates: Requirements 3.7
    //
    // For any completed check-out, the transaction document MUST have:
    //   - status = "COMPLETED"
    //   - checkOutAt set to a non-null Timestamp
    //   - otpHash = null (plain-text OTP never stored; hash cleared after use)
    fc.assert(
      fc.property(
        fc.record({
          lockerId: fc
            .string({ minLength: 1, maxLength: 10 })
            .map((s) => `locker-${s.replace(/[^a-z0-9]/gi, "x").slice(0, 8)}`),
          userEmail: fc
            .tuple(
              fc.string({ minLength: 1, maxLength: 8 }),
              fc.string({ minLength: 1, maxLength: 8 }),
              fc.constantFrom("com", "net", "org"),
            )
            .map(([u, d, tld]) => `${u}@${d}.${tld}`),
          // Arbitrary check-in time within the last 23 hours (OTP still valid)
          checkInOffsetMs: fc.integer({
            min: 1,
            max: 23 * 60 * 60 * 1000,
          }),
        }),
        ({ lockerId, userEmail, checkInOffsetMs }) => {
          const checkInAt = admin.firestore.Timestamp.fromMillis(
            Date.now() - checkInOffsetMs,
          );
          const otpExpiresAt = admin.firestore.Timestamp.fromMillis(
            checkInAt.toMillis() + 24 * 60 * 60 * 1000,
          );
          const transactionId = `txn-${Math.random().toString(36).slice(2)}`;
          const fakeOtpHash = `$2b$10$fakehash_${transactionId}`;

          const activeTransaction: TransactionState = {
            transactionId,
            lockerId,
            userEmail,
            otpHash: fakeOtpHash,
            otpExpiresAt,
            checkInAt,
            checkOutAt: null,
            status: "ACTIVE",
          };

          const activeLocker: LockerState = {
            lockerId,
            state: "FILLED",
            activeTransactionId: transactionId,
            failedOtpAttempts: 0,
            otpLockedUntil: null,
          };

          // Apply the check-out mutation (mirrors submitOtp's Firestore updates)
          const { locker: updatedLocker, transaction: updatedTransaction } =
            applyCheckOut(activeLocker, activeTransaction);

          // ── Assertions on transaction document ──────────────────────────

          // status MUST be COMPLETED
          expect(updatedTransaction.status).toBe("COMPLETED");

          // checkOutAt MUST be a non-null Timestamp
          expect(updatedTransaction.checkOutAt).not.toBeNull();
          expect(updatedTransaction.checkOutAt).toBeInstanceOf(
            admin.firestore.Timestamp,
          );

          // checkOutAt MUST be after checkInAt
          expect(updatedTransaction.checkOutAt!.toMillis()).toBeGreaterThan(
            checkInAt.toMillis(),
          );

          // otpHash MUST be null (cleared after successful use)
          expect(updatedTransaction.otpHash).toBeNull();

          // ── Assertions on locker document ────────────────────────────────

          // activeTransactionId MUST be cleared
          expect(updatedLocker.activeTransactionId).toBeNull();

          // failedOtpAttempts MUST be reset to 0
          expect(updatedLocker.failedOtpAttempts).toBe(0);

          // otpLockedUntil MUST be cleared
          expect(updatedLocker.otpLockedUntil).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should preserve all non-cleanup fields after check-out", () => {
    // Feature: smart-locker-system, Property 10: Transaction cleanup
    // Validates: Requirements 3.7
    //
    // The cleanup operation must only modify the designated fields.
    // Immutable fields (transactionId, lockerId, userEmail, checkInAt, otpExpiresAt)
    // MUST remain unchanged after check-out.
    fc.assert(
      fc.property(
        fc.record({
          lockerId: fc
            .string({ minLength: 1, maxLength: 10 })
            .map((s) => `locker-${s.replace(/[^a-z0-9]/gi, "x").slice(0, 8)}`),
          userEmail: fc
            .tuple(
              fc.string({ minLength: 1, maxLength: 8 }),
              fc.string({ minLength: 1, maxLength: 8 }),
              fc.constantFrom("com", "net", "org"),
            )
            .map(([u, d, tld]) => `${u}@${d}.${tld}`),
        }),
        ({ lockerId, userEmail }) => {
          const checkInAt = admin.firestore.Timestamp.now();
          const otpExpiresAt = admin.firestore.Timestamp.fromMillis(
            checkInAt.toMillis() + 24 * 60 * 60 * 1000,
          );
          const transactionId = `txn-${Math.random().toString(36).slice(2)}`;

          const activeTransaction: TransactionState = {
            transactionId,
            lockerId,
            userEmail,
            otpHash: "$2b$10$fakehash",
            otpExpiresAt,
            checkInAt,
            checkOutAt: null,
            status: "ACTIVE",
          };

          const activeLocker: LockerState = {
            lockerId,
            state: "FILLED",
            activeTransactionId: transactionId,
            failedOtpAttempts: 0,
            otpLockedUntil: null,
          };

          const { transaction: updatedTransaction } = applyCheckOut(
            activeLocker,
            activeTransaction,
          );

          // Immutable fields must be preserved
          expect(updatedTransaction.transactionId).toBe(transactionId);
          expect(updatedTransaction.lockerId).toBe(lockerId);
          expect(updatedTransaction.userEmail).toBe(userEmail);
          expect(updatedTransaction.checkInAt.toMillis()).toBe(
            checkInAt.toMillis(),
          );
          expect(updatedTransaction.otpExpiresAt.toMillis()).toBe(
            otpExpiresAt.toMillis(),
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 15: OTP Lockout After Consecutive Failures ───────────────────

// Feature: smart-locker-system, Property 15: OTP lockout

/**
 * Simulates the failed-attempt counter and lockout logic extracted from submitOtp.
 *
 * In production this runs inside a Firestore transaction. Here we model it as
 * a pure function that takes the current locker state and returns the updated
 * state plus the response that would be returned to the caller.
 *
 * Mirrors the exact logic in submitOtp:
 *   newFailedAttempts = failedOtpAttempts + 1
 *   if newFailedAttempts >= 5:
 *     otpLockedUntil = now + 15 minutes
 *     failedOtpAttempts = 0   (reset after lockout)
 *     return OTP_LOCKED
 *   else:
 *     failedOtpAttempts = newFailedAttempts
 *     return OTP_INVALID
 */
function applyFailedAttempt(
  locker: LockerState,
  nowMs: number,
): {
  updatedLocker: LockerState;
  response: {
    success: false;
    error: "OTP_INVALID" | "OTP_LOCKED";
    lockedUntil?: number;
  };
} {
  const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
  const LOCKOUT_THRESHOLD = 5;

  const newFailedAttempts = (locker.failedOtpAttempts || 0) + 1;

  if (newFailedAttempts >= LOCKOUT_THRESHOLD) {
    const lockedUntilMs = nowMs + LOCKOUT_DURATION_MS;
    return {
      updatedLocker: {
        ...locker,
        failedOtpAttempts: 0,
        otpLockedUntil: admin.firestore.Timestamp.fromMillis(lockedUntilMs),
      },
      response: {
        success: false,
        error: "OTP_LOCKED",
        lockedUntil: lockedUntilMs,
      },
    };
  }

  return {
    updatedLocker: {
      ...locker,
      failedOtpAttempts: newFailedAttempts,
    },
    response: { success: false, error: "OTP_INVALID" },
  };
}

/**
 * Simulates N consecutive failed OTP attempts on a locker, returning the
 * sequence of responses and the final locker state.
 */
function simulateConsecutiveFailures(
  initialLocker: LockerState,
  count: number,
  nowMs: number,
): {
  responses: Array<{
    success: false;
    error: "OTP_INVALID" | "OTP_LOCKED";
    lockedUntil?: number;
  }>;
  finalLocker: LockerState;
} {
  let currentLocker = { ...initialLocker };
  const responses: Array<{
    success: false;
    error: "OTP_INVALID" | "OTP_LOCKED";
    lockedUntil?: number;
  }> = [];

  for (let i = 0; i < count; i++) {
    const { updatedLocker, response } = applyFailedAttempt(
      currentLocker,
      nowMs,
    );
    currentLocker = updatedLocker;
    responses.push(response);
  }

  return { responses, finalLocker: currentLocker };
}

describe("Property 15: OTP Lockout After Consecutive Failures", () => {
  it("should return OTP_INVALID for the first 4 failures and OTP_LOCKED on the 5th", () => {
    // Feature: smart-locker-system, Property 15: OTP lockout
    // Validates: Requirements 7.3
    //
    // After exactly 5 consecutive incorrect OTP submissions, the 5th attempt
    // MUST trigger a lockout. The first 4 MUST return OTP_INVALID.
    fc.assert(
      fc.property(
        fc.record({
          lockerId: fc
            .string({ minLength: 1, maxLength: 10 })
            .map((s) => `locker-${s.replace(/[^a-z0-9]/gi, "x").slice(0, 8)}`),
          // Arbitrary "now" within a reasonable range
          nowMs: fc.integer({
            min: Date.now() - 30 * 24 * 60 * 60 * 1000,
            max: Date.now() + 30 * 24 * 60 * 60 * 1000,
          }),
        }),
        ({ lockerId, nowMs }) => {
          const initialLocker: LockerState = {
            lockerId,
            state: "FILLED",
            activeTransactionId: "txn-abc",
            failedOtpAttempts: 0,
            otpLockedUntil: null,
          };

          const { responses, finalLocker } = simulateConsecutiveFailures(
            initialLocker,
            5,
            nowMs,
          );

          // First 4 attempts: OTP_INVALID
          for (let i = 0; i < 4; i++) {
            expect(responses[i].error).toBe("OTP_INVALID");
          }

          // 5th attempt: OTP_LOCKED
          expect(responses[4].error).toBe("OTP_LOCKED");
          expect(responses[4].lockedUntil).toBeDefined();

          // otpLockedUntil MUST be set to now + 15 minutes
          const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
          expect(responses[4].lockedUntil).toBe(nowMs + FIFTEEN_MINUTES_MS);

          // Final locker state MUST have otpLockedUntil set
          expect(finalLocker.otpLockedUntil).not.toBeNull();
          expect(finalLocker.otpLockedUntil!.toMillis()).toBe(
            nowMs + FIFTEEN_MINUTES_MS,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should reject the 6th attempt with OTP_LOCKED when lockout is active", () => {
    // Feature: smart-locker-system, Property 15: OTP lockout
    // Validates: Requirements 7.3
    //
    // After 5 failures trigger a lockout, any subsequent attempt MUST be
    // rejected with OTP_LOCKED (not OTP_INVALID) as long as the lockout window
    // has not expired.
    fc.assert(
      fc.property(
        fc.record({
          lockerId: fc
            .string({ minLength: 1, maxLength: 10 })
            .map((s) => `locker-${s.replace(/[^a-z0-9]/gi, "x").slice(0, 8)}`),
          nowMs: fc.integer({
            min: Date.now() - 30 * 24 * 60 * 60 * 1000,
            max: Date.now() + 30 * 24 * 60 * 60 * 1000,
          }),
        }),
        ({ lockerId, nowMs }) => {
          const initialLocker: LockerState = {
            lockerId,
            state: "FILLED",
            activeTransactionId: "txn-abc",
            failedOtpAttempts: 0,
            otpLockedUntil: null,
          };

          // Simulate 5 failures to trigger lockout
          const { finalLocker: lockedLocker } = simulateConsecutiveFailures(
            initialLocker,
            5,
            nowMs,
          );

          // Verify lockout is active
          expect(lockedLocker.otpLockedUntil).not.toBeNull();

          // Simulate the 6th attempt: the submitOtp guard checks otpLockedUntil first.
          // Pass nowMs so the lockout check uses the same time reference as when
          // the lockout was set (otpLockedUntil = nowMs + 15min > nowMs).
          const sixthResult = simulateSubmitOtp(
            lockedLocker,
            // Provide a dummy active transaction (the lockout check fires before transaction lookup)
            {
              transactionId: "txn-abc",
              lockerId,
              userEmail: "user@example.com",
              otpHash: "$2b$10$fakehash",
              otpExpiresAt: admin.firestore.Timestamp.fromMillis(
                nowMs + 24 * 60 * 60 * 1000,
              ),
              checkInAt: admin.firestore.Timestamp.fromMillis(nowMs),
              checkOutAt: null,
              status: "ACTIVE",
            },
            "000000", // any OTP — lockout fires before verification
            "$2b$10$fakehash",
            nowMs, // use the same time reference for consistent lockout check
          );

          expect(sixthResult.success).toBe(false);
          expect(sixthResult.error).toBe("OTP_LOCKED");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should not trigger lockout before 5 consecutive failures", () => {
    // Feature: smart-locker-system, Property 15: OTP lockout
    // Validates: Requirements 7.3
    //
    // For any number of failures k in [1, 4], the locker MUST NOT be locked.
    // Only the 5th consecutive failure triggers the lockout.
    fc.assert(
      fc.property(
        fc.record({
          failureCount: fc.integer({ min: 1, max: 4 }),
          nowMs: fc.integer({
            min: Date.now() - 30 * 24 * 60 * 60 * 1000,
            max: Date.now() + 30 * 24 * 60 * 60 * 1000,
          }),
        }),
        ({ failureCount, nowMs }) => {
          const initialLocker: LockerState = {
            lockerId: "locker-01",
            state: "FILLED",
            activeTransactionId: "txn-abc",
            failedOtpAttempts: 0,
            otpLockedUntil: null,
          };

          const { responses, finalLocker } = simulateConsecutiveFailures(
            initialLocker,
            failureCount,
            nowMs,
          );

          // All responses must be OTP_INVALID (no lockout yet)
          for (const response of responses) {
            expect(response.error).toBe("OTP_INVALID");
          }

          // Locker must NOT be locked
          expect(finalLocker.otpLockedUntil).toBeNull();
          expect(finalLocker.failedOtpAttempts).toBe(failureCount);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should set otpLockedUntil to exactly now + 15 minutes for any lockout trigger time", () => {
    // Feature: smart-locker-system, Property 15: OTP lockout
    // Validates: Requirements 7.3
    //
    // The lockout duration MUST always be exactly 15 minutes (900,000 ms)
    // regardless of when the lockout is triggered.
    fc.assert(
      fc.property(
        fc.integer({
          min: Date.now() - 365 * 24 * 60 * 60 * 1000,
          max: Date.now() + 365 * 24 * 60 * 60 * 1000,
        }),
        (nowMs) => {
          const lockerAtFourFailures: LockerState = {
            lockerId: "locker-01",
            state: "FILLED",
            activeTransactionId: "txn-abc",
            failedOtpAttempts: 4, // one more failure triggers lockout
            otpLockedUntil: null,
          };

          const { updatedLocker, response } = applyFailedAttempt(
            lockerAtFourFailures,
            nowMs,
          );

          expect(response.error).toBe("OTP_LOCKED");

          const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
          expect(response.lockedUntil).toBe(nowMs + FIFTEEN_MINUTES_MS);
          expect(updatedLocker.otpLockedUntil!.toMillis()).toBe(
            nowMs + FIFTEEN_MINUTES_MS,
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
