/**
 * Integration Test: Full Check-Out Flow
 *
 * Tests the complete check-out workflow from OTP submission through locker state transitions.
 * Uses Firebase Local Emulator Suite for realistic end-to-end testing.
 *
 * Flow:
 *   1. Setup: Create active transaction with OTP
 *   2. User submits OTP → submitOtp callable
 *   3. OTP validated against hash
 *   4. UNLOCK command written to RTDB
 *   5. Simulate sensor OPEN → locker state becomes OPEN
 *   6. Simulate sensor CLOSED → locker state becomes EMPTY
 *   7. Transaction status becomes COMPLETED
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */

import * as admin from "firebase-admin";
import test from "firebase-functions-test";
import { generateOtp, hashOtp } from "../../src/otp_service";

// Initialize Firebase Functions Test SDK
const testEnv = test();

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "demo-smart-locker",
    databaseURL: "http://127.0.0.1:9000?ns=demo-smart-locker",
  });
}

// Import functions after initialization
import { submitOtp } from "../../src/otp_service";
import { onDoorStatusChange, onLockerWrite } from "../../src/state_manager";

const db = admin.firestore();
const rtdb = admin.database();

// Use emulator
if (process.env.FIRESTORE_EMULATOR_HOST === undefined) {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
}
if (process.env.FIREBASE_DATABASE_EMULATOR_HOST === undefined) {
  process.env.FIREBASE_DATABASE_EMULATOR_HOST = "127.0.0.1:9000";
}

describe("Integration Test: Full Check-Out Flow", () => {
  const TEST_LOCKER_ID = "locker-checkout-01";
  const TEST_USER_EMAIL = "checkout-test@example.com";
  const TEST_TRANSACTION_ID = "txn-checkout-test-001";

  let testOtp: string;
  let testOtpHash: string;

  beforeEach(async () => {
    // Clear Firestore collections
    const lockersSnapshot = await db.collection("lockers").get();
    const deleteLockerPromises = lockersSnapshot.docs.map((doc) =>
      doc.ref.delete(),
    );
    await Promise.all(deleteLockerPromises);

    const transactionsSnapshot = await db.collection("transactions").get();
    const deleteTransactionPromises = transactionsSnapshot.docs.map((doc) =>
      doc.ref.delete(),
    );
    await Promise.all(deleteTransactionPromises);

    // Clear RTDB devices node
    await rtdb.ref("devices").remove();

    // Generate test OTP and hash
    testOtp = generateOtp();
    testOtpHash = await hashOtp(testOtp);

    const now = admin.firestore.Timestamp.now();
    const otpExpiresAt = admin.firestore.Timestamp.fromMillis(
      now.toMillis() + 24 * 60 * 60 * 1000,
    );

    // Seed test locker in FILLED state with active transaction
    await db.collection("lockers").doc(TEST_LOCKER_ID).set({
      lockerId: TEST_LOCKER_ID,
      state: "FILLED",
      doorStatus: "CLOSED",
      isOnline: true,
      lastHeartbeat: now,
      activeTransactionId: TEST_TRANSACTION_ID,
      failedOtpAttempts: 0,
      otpLockedUntil: null,
    });

    // Seed active transaction
    await db.collection("transactions").doc(TEST_TRANSACTION_ID).set({
      transactionId: TEST_TRANSACTION_ID,
      lockerId: TEST_LOCKER_ID,
      userEmail: TEST_USER_EMAIL,
      otpHash: testOtpHash,
      otpExpiresAt: otpExpiresAt,
      checkInAt: now,
      checkOutAt: null,
      status: "ACTIVE",
      openAlertSentAt: null,
    });
  });

  afterAll(async () => {
    // Cleanup
    await db.collection("lockers").doc(TEST_LOCKER_ID).delete();
    await db.collection("transactions").doc(TEST_TRANSACTION_ID).delete();
    await rtdb.ref(`devices/${TEST_LOCKER_ID}`).remove();
    testEnv.cleanup();
  });

  it("should complete full check-out flow: OTP submit → validate → RTDB command → sensor OPEN → sensor CLOSED → EMPTY → transaction COMPLETED", async () => {
    // ── Step 1: User submits OTP via submitOtp ────────────────────────────
    // Requirement 3.1: User enters OTP for FILLED locker
    const checkOutRequest = {
      lockerId: TEST_LOCKER_ID,
      otp: testOtp,
    };

    const wrapped = testEnv.wrap(submitOtp);
    const result = await wrapped(checkOutRequest);

    // Requirement 3.2: OTP validated successfully
    expect(result.success).toBe(true);
    expect(result.message).toContain("Check-out successful");

    // ── Step 2: Verify UNLOCK command written to RTDB ─────────────────────
    // Requirement 3.3: UNLOCK command sent to device
    const commandSnap = await rtdb
      .ref(`devices/${TEST_LOCKER_ID}/command`)
      .once("value");
    const command = commandSnap.val();
    expect(command).toBe("UNLOCK");

    const commandAtSnap = await rtdb
      .ref(`devices/${TEST_LOCKER_ID}/commandAt`)
      .once("value");
    const commandAt = commandAtSnap.val();
    expect(commandAt).toBeGreaterThan(0);

    // ── Step 3: Verify transaction updated and locker cleared ─────────────
    // Requirement 3.7: Transaction marked as COMPLETED, otpHash cleared
    const transactionSnap = await db
      .collection("transactions")
      .doc(TEST_TRANSACTION_ID)
      .get();
    const transaction = transactionSnap.data()!;

    expect(transaction.status).toBe("COMPLETED");
    expect(transaction.checkOutAt).not.toBeNull();
    expect(transaction.otpHash).toBeNull(); // OTP hash cleared after use

    // Locker activeTransactionId cleared
    const lockerSnap = await db.collection("lockers").doc(TEST_LOCKER_ID).get();
    const locker = lockerSnap.data()!;
    expect(locker.activeTransactionId).toBeNull();
    expect(locker.failedOtpAttempts).toBe(0);
    expect(locker.otpLockedUntil).toBeNull();

    // ── Step 4: Simulate sensor OPEN (device activates relay) ─────────────
    // Requirement 3.4: Device activates relay (simulated by sensor change)
    // Requirement 3.5: Sensor reports OPEN → locker state becomes OPEN
    await rtdb.ref(`devices/${TEST_LOCKER_ID}/doorStatus`).set("OPEN");

    // Wait for RTDB trigger
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Trigger onDoorStatusChange
    const doorStatusChange = testEnv.makeChange(
      testEnv.database.makeDataSnapshot(
        "CLOSED",
        `devices/${TEST_LOCKER_ID}/doorStatus`,
      ),
      testEnv.database.makeDataSnapshot(
        "OPEN",
        `devices/${TEST_LOCKER_ID}/doorStatus`,
      ),
    );
    const wrappedDoorStatusChange = testEnv.wrap(onDoorStatusChange);
    await wrappedDoorStatusChange(doorStatusChange, {
      params: { deviceId: TEST_LOCKER_ID },
    });

    // Wait for Firestore trigger
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Trigger onLockerWrite
    const lockerSnapBefore = await db
      .collection("lockers")
      .doc(TEST_LOCKER_ID)
      .get();
    const lockerChange = testEnv.makeChange(
      testEnv.firestore.makeDocumentSnapshot(
        { ...lockerSnapBefore.data()!, doorStatus: "CLOSED" },
        `lockers/${TEST_LOCKER_ID}`,
      ),
      testEnv.firestore.makeDocumentSnapshot(
        { ...lockerSnapBefore.data()!, doorStatus: "OPEN" },
        `lockers/${TEST_LOCKER_ID}`,
      ),
    );
    const wrappedLockerWrite = testEnv.wrap(onLockerWrite);
    await wrappedLockerWrite(lockerChange, {
      params: { lockerId: TEST_LOCKER_ID },
    });

    // Verify locker state is OPEN
    const lockerSnapAfterOpen = await db
      .collection("lockers")
      .doc(TEST_LOCKER_ID)
      .get();
    const lockerAfterOpen = lockerSnapAfterOpen.data()!;
    expect(lockerAfterOpen.doorStatus).toBe("OPEN");
    expect(lockerAfterOpen.state).toBe("OPEN");

    // ── Step 5: Simulate sensor CLOSED (user retrieves item and closes door) ──
    // Requirement 3.6: Sensor reports CLOSED + no active transaction → locker state becomes EMPTY
    await rtdb.ref(`devices/${TEST_LOCKER_ID}/doorStatus`).set("CLOSED");

    // Wait for RTDB trigger
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Trigger onDoorStatusChange
    const doorStatusChangeClosed = testEnv.makeChange(
      testEnv.database.makeDataSnapshot(
        "OPEN",
        `devices/${TEST_LOCKER_ID}/doorStatus`,
      ),
      testEnv.database.makeDataSnapshot(
        "CLOSED",
        `devices/${TEST_LOCKER_ID}/doorStatus`,
      ),
    );
    await wrappedDoorStatusChange(doorStatusChangeClosed, {
      params: { deviceId: TEST_LOCKER_ID },
    });

    // Wait for Firestore trigger
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Trigger onLockerWrite
    const lockerSnapBeforeClosed = await db
      .collection("lockers")
      .doc(TEST_LOCKER_ID)
      .get();
    const lockerChangeClosed = testEnv.makeChange(
      testEnv.firestore.makeDocumentSnapshot(
        { ...lockerSnapBeforeClosed.data()!, doorStatus: "OPEN" },
        `lockers/${TEST_LOCKER_ID}`,
      ),
      testEnv.firestore.makeDocumentSnapshot(
        { ...lockerSnapBeforeClosed.data()!, doorStatus: "CLOSED" },
        `lockers/${TEST_LOCKER_ID}`,
      ),
    );
    await wrappedLockerWrite(lockerChangeClosed, {
      params: { lockerId: TEST_LOCKER_ID },
    });

    // Verify locker state is EMPTY (no active transaction)
    const lockerSnapFinal = await db
      .collection("lockers")
      .doc(TEST_LOCKER_ID)
      .get();
    const lockerFinal = lockerSnapFinal.data()!;
    expect(lockerFinal.doorStatus).toBe("CLOSED");
    expect(lockerFinal.state).toBe("EMPTY");
    expect(lockerFinal.activeTransactionId).toBeNull();

    // Verify transaction is still COMPLETED
    const transactionSnapFinal = await db
      .collection("transactions")
      .doc(TEST_TRANSACTION_ID)
      .get();
    const transactionFinal = transactionSnapFinal.data()!;
    expect(transactionFinal.status).toBe("COMPLETED");
    expect(transactionFinal.checkOutAt).not.toBeNull();
    expect(transactionFinal.otpHash).toBeNull();
  }, 30000); // 30-second timeout for integration test

  it("should reject invalid OTP", async () => {
    // Requirement 3.2: Invalid OTP rejected
    const checkOutRequest = {
      lockerId: TEST_LOCKER_ID,
      otp: "999999", // Wrong OTP
    };

    const wrapped = testEnv.wrap(submitOtp);
    const result = await wrapped(checkOutRequest);

    expect(result.success).toBe(false);
    expect(result.error).toBe("OTP_INVALID");

    // Verify failed attempt incremented
    const lockerSnap = await db.collection("lockers").doc(TEST_LOCKER_ID).get();
    const locker = lockerSnap.data()!;
    expect(locker.failedOtpAttempts).toBe(1);

    // Transaction should still be ACTIVE
    const transactionSnap = await db
      .collection("transactions")
      .doc(TEST_TRANSACTION_ID)
      .get();
    const transaction = transactionSnap.data()!;
    expect(transaction.status).toBe("ACTIVE");
  });

  it("should reject expired OTP", async () => {
    // Requirement 3.2: Expired OTP rejected
    // Set transaction OTP to expired (25 hours ago)
    const expiredTime = admin.firestore.Timestamp.fromMillis(
      Date.now() - 25 * 60 * 60 * 1000,
    );
    await db.collection("transactions").doc(TEST_TRANSACTION_ID).update({
      otpExpiresAt: expiredTime,
    });

    const checkOutRequest = {
      lockerId: TEST_LOCKER_ID,
      otp: testOtp,
    };

    const wrapped = testEnv.wrap(submitOtp);
    const result = await wrapped(checkOutRequest);

    expect(result.success).toBe(false);
    expect(result.error).toBe("OTP_EXPIRED");
  });

  it("should lock OTP after 5 consecutive failures", async () => {
    // Requirement 7.3: OTP locked after 5 failures
    const wrapped = testEnv.wrap(submitOtp);

    // Submit wrong OTP 5 times
    for (let i = 0; i < 5; i++) {
      const result = await wrapped({
        lockerId: TEST_LOCKER_ID,
        otp: "000000", // Wrong OTP
      });

      if (i < 4) {
        expect(result.success).toBe(false);
        expect(result.error).toBe("OTP_INVALID");
      } else {
        // 5th attempt should trigger lockout
        expect(result.success).toBe(false);
        expect(result.error).toBe("OTP_LOCKED");
        expect(result.lockedUntil).toBeGreaterThan(Date.now());
      }
    }

    // Verify locker is locked
    const lockerSnap = await db.collection("lockers").doc(TEST_LOCKER_ID).get();
    const locker = lockerSnap.data()!;
    expect(locker.otpLockedUntil).not.toBeNull();
    expect(locker.otpLockedUntil!.toMillis()).toBeGreaterThan(Date.now());

    // 6th attempt should be rejected immediately
    const result6 = await wrapped({
      lockerId: TEST_LOCKER_ID,
      otp: testOtp, // Even correct OTP should be rejected
    });
    expect(result6.success).toBe(false);
    expect(result6.error).toBe("OTP_LOCKED");
  });

  it("should reject OTP submission when no active transaction exists", async () => {
    // Requirement 3.7: OTP cannot be used after transaction completed
    // Clear active transaction
    await db.collection("lockers").doc(TEST_LOCKER_ID).update({
      activeTransactionId: null,
    });

    const checkOutRequest = {
      lockerId: TEST_LOCKER_ID,
      otp: testOtp,
    };

    const wrapped = testEnv.wrap(submitOtp);
    const result = await wrapped(checkOutRequest);

    expect(result.success).toBe(false);
    expect(result.error).toBe("OTP_USED");
  });

  it("should reject OTP submission when transaction is already COMPLETED", async () => {
    // Requirement 4.4: OTP single-use - cannot reuse after completion
    // Set transaction to COMPLETED
    await db.collection("transactions").doc(TEST_TRANSACTION_ID).update({
      status: "COMPLETED",
      checkOutAt: admin.firestore.Timestamp.now(),
      otpHash: null,
    });

    const checkOutRequest = {
      lockerId: TEST_LOCKER_ID,
      otp: testOtp,
    };

    const wrapped = testEnv.wrap(submitOtp);
    const result = await wrapped(checkOutRequest);

    expect(result.success).toBe(false);
    expect(result.error).toBe("OTP_USED");
  });
});
