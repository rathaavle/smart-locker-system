/**
 * Integration Test: Full Check-In Flow
 *
 * Tests the complete check-in workflow from email submission through locker state transitions.
 * Uses Firebase Local Emulator Suite for realistic end-to-end testing.
 *
 * Flow:
 *   1. User submits email → initiateCheckIn callable
 *   2. OTP generated and hashed
 *   3. Transaction created in Firestore
 *   4. UNLOCK command written to RTDB
 *   5. Simulate sensor OPEN → locker state becomes OPEN
 *   6. Simulate sensor CLOSED → locker state becomes FILLED
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10
 */

import * as admin from "firebase-admin";
import * as test from "firebase-functions-test";

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
import { initiateCheckIn } from "../../src/otp_service";
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

describe("Integration Test: Full Check-In Flow", () => {
  const TEST_LOCKER_ID = "locker-integration-01";
  const TEST_USER_EMAIL = "integration-test@example.com";

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

    // Seed test locker in EMPTY state
    await db.collection("lockers").doc(TEST_LOCKER_ID).set({
      lockerId: TEST_LOCKER_ID,
      state: "EMPTY",
      doorStatus: "CLOSED",
      isOnline: true,
      lastHeartbeat: admin.firestore.Timestamp.now(),
      activeTransactionId: null,
      failedOtpAttempts: 0,
      otpLockedUntil: null,
    });
  });

  afterAll(async () => {
    // Cleanup
    await db.collection("lockers").doc(TEST_LOCKER_ID).delete();
    await rtdb.ref(`devices/${TEST_LOCKER_ID}`).remove();
    testEnv.cleanup();
  });

  it("should complete full check-in flow: email → OTP → RTDB command → sensor OPEN → sensor CLOSED → FILLED", async () => {
    // ── Step 1: User submits email via initiateCheckIn ────────────────────
    const checkInRequest = {
      lockerId: TEST_LOCKER_ID,
      email: TEST_USER_EMAIL,
    };

    const wrapped = testEnv.wrap(initiateCheckIn);
    const result = await wrapped(checkInRequest);

    // Requirement 2.2: Check-in should succeed
    expect(result.success).toBe(true);
    expect(result.message).toContain("OTP sent");

    // ── Step 2: Verify OTP was generated and transaction created ──────────
    // Requirement 2.3: OTP generated (we can't see plain-text, but hash exists)
    // Requirement 2.4: Transaction created with all required fields
    const lockerSnap = await db.collection("lockers").doc(TEST_LOCKER_ID).get();
    const locker = lockerSnap.data()!;

    expect(locker.activeTransactionId).not.toBeNull();
    expect(locker.state).toBe("UNLOCKING"); // Requirement 2.7: state set to UNLOCKING

    const transactionId = locker.activeTransactionId;
    const transactionSnap = await db
      .collection("transactions")
      .doc(transactionId)
      .get();
    const transaction = transactionSnap.data()!;

    // Requirement 2.4: Transaction document contains all required fields
    expect(transaction.transactionId).toBe(transactionId);
    expect(transaction.lockerId).toBe(TEST_LOCKER_ID);
    expect(transaction.userEmail).toBe(TEST_USER_EMAIL);
    expect(transaction.otpHash).toMatch(/^\$2b\$/); // bcrypt hash
    expect(transaction.otpExpiresAt).toBeDefined();
    expect(transaction.checkInAt).toBeDefined();
    expect(transaction.checkOutAt).toBeNull();
    expect(transaction.status).toBe("ACTIVE");

    // Requirement 2.6: OTP stored in hashed form
    expect(transaction.otpHash).not.toMatch(/^\d{6}$/); // not plain-text

    // ── Step 3: Verify UNLOCK command written to RTDB ─────────────────────
    // Requirement 2.7: UNLOCK command sent to device
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

    // ── Step 4: Simulate sensor OPEN (device writes doorStatus) ───────────
    // Requirement 2.8: Device activates relay (simulated by sensor change)
    // Requirement 2.9: Sensor reports OPEN → locker state becomes OPEN
    await rtdb.ref(`devices/${TEST_LOCKER_ID}/doorStatus`).set("OPEN");

    // Wait for RTDB trigger to propagate
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Trigger the onDoorStatusChange function manually (emulator may not auto-trigger)
    const doorStatusChange = testEnv.makeChange(
      testEnv.database.makeDataSnapshot(
        null,
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

    // Wait for Firestore trigger to propagate
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Trigger the onLockerWrite function manually
    const lockerSnapBefore = await db
      .collection("lockers")
      .doc(TEST_LOCKER_ID)
      .get();
    const lockerChange = testEnv.makeChange(
      testEnv.firestore.makeDocumentSnapshot(
        lockerSnapBefore.data()!,
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

    // ── Step 5: Simulate sensor CLOSED (user closes door) ─────────────────
    // Requirement 2.10: Sensor reports CLOSED + active transaction → locker state becomes FILLED
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

    // Verify locker state is FILLED
    const lockerSnapFinal = await db
      .collection("lockers")
      .doc(TEST_LOCKER_ID)
      .get();
    const lockerFinal = lockerSnapFinal.data()!;
    expect(lockerFinal.doorStatus).toBe("CLOSED");
    expect(lockerFinal.state).toBe("FILLED");
    expect(lockerFinal.activeTransactionId).toBe(transactionId);

    // Verify transaction is still ACTIVE
    const transactionSnapFinal = await db
      .collection("transactions")
      .doc(transactionId)
      .get();
    const transactionFinal = transactionSnapFinal.data()!;
    expect(transactionFinal.status).toBe("ACTIVE");
  }, 30000); // 30-second timeout for integration test

  it("should reject check-in when locker is offline", async () => {
    // Requirement 2.1: Only EMPTY and online lockers are selectable
    // Set locker to offline
    await db.collection("lockers").doc(TEST_LOCKER_ID).update({
      isOnline: false,
    });

    const checkInRequest = {
      lockerId: TEST_LOCKER_ID,
      email: TEST_USER_EMAIL,
    };

    const wrapped = testEnv.wrap(initiateCheckIn);

    await expect(wrapped(checkInRequest)).rejects.toThrow("LOCKER_OFFLINE");
  });

  it("should reject check-in when locker is not EMPTY", async () => {
    // Requirement 2.1: Only EMPTY lockers are selectable
    // Set locker to FILLED
    await db.collection("lockers").doc(TEST_LOCKER_ID).update({
      state: "FILLED",
      activeTransactionId: "existing-txn-id",
    });

    const checkInRequest = {
      lockerId: TEST_LOCKER_ID,
      email: TEST_USER_EMAIL,
    };

    const wrapped = testEnv.wrap(initiateCheckIn);

    await expect(wrapped(checkInRequest)).rejects.toThrow(
      "LOCKER_NOT_AVAILABLE",
    );
  });

  it("should reject check-in with invalid email format", async () => {
    // Requirement 2.2: Valid email address required
    const checkInRequest = {
      lockerId: TEST_LOCKER_ID,
      email: "invalid-email",
    };

    const wrapped = testEnv.wrap(initiateCheckIn);

    await expect(wrapped(checkInRequest)).rejects.toThrow(
      "email format is invalid",
    );
  });
});
