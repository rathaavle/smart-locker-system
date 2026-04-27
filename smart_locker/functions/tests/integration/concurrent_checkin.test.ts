/**
 * Integration Test: Concurrent Check-In Conflict
 *
 * Tests that the system correctly handles concurrent check-in attempts on the same locker.
 * Uses Firebase Local Emulator Suite with Firestore transactions to ensure atomicity.
 *
 * Flow:
 *   1. Two users attempt to check in to the same EMPTY locker simultaneously
 *   2. Firestore transaction ensures only one succeeds
 *   3. The second request receives a LOCKER_CONFLICT error
 *   4. The locker has exactly one active transaction after both complete
 *
 * Requirements: 9.3
 */

import * as admin from "firebase-admin";
import test from "firebase-functions-test";

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

const db = admin.firestore();
const rtdb = admin.database();

// Use emulator
if (process.env.FIRESTORE_EMULATOR_HOST === undefined) {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
}
if (process.env.FIREBASE_DATABASE_EMULATOR_HOST === undefined) {
  process.env.FIREBASE_DATABASE_EMULATOR_HOST = "127.0.0.1:9000";
}

describe("Integration Test: Concurrent Check-In Conflict", () => {
  const TEST_LOCKER_ID = "locker-concurrent-01";
  const USER_1_EMAIL = "user1@example.com";
  const USER_2_EMAIL = "user2@example.com";

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

  it("should allow exactly one check-in when two requests target the same EMPTY locker simultaneously", async () => {
    // Requirement 9.3: Concurrent check-in conflict resolution
    const wrapped = testEnv.wrap(initiateCheckIn);

    const request1 = {
      lockerId: TEST_LOCKER_ID,
      email: USER_1_EMAIL,
    };

    const request2 = {
      lockerId: TEST_LOCKER_ID,
      email: USER_2_EMAIL,
    };

    // Execute both requests concurrently
    const results = await Promise.allSettled([
      wrapped(request1),
      wrapped(request2),
    ]);

    // Count successes and failures
    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value.success,
    ).length;
    const failureCount = results.filter((r) => r.status === "rejected").length;

    // Exactly one should succeed
    expect(successCount).toBe(1);
    expect(failureCount).toBe(1);

    // The failing one should have LOCKER_CONFLICT or LOCKER_NOT_AVAILABLE error
    const failedResult = results.find((r) => r.status === "rejected") as
      | PromiseRejectedResult
      | undefined;
    expect(failedResult).toBeDefined();
    expect(failedResult!.reason.message).toMatch(
      /LOCKER_CONFLICT|LOCKER_NOT_AVAILABLE/,
    );

    // Verify locker has exactly one active transaction
    const lockerSnap = await db.collection("lockers").doc(TEST_LOCKER_ID).get();
    const locker = lockerSnap.data()!;
    expect(locker.activeTransactionId).not.toBeNull();
    expect(typeof locker.activeTransactionId).toBe("string");

    // Verify exactly one transaction was created
    const transactionsSnapshot = await db
      .collection("transactions")
      .where("lockerId", "==", TEST_LOCKER_ID)
      .where("status", "==", "ACTIVE")
      .get();
    expect(transactionsSnapshot.size).toBe(1);

    // Verify the transaction belongs to one of the two users
    const transaction = transactionsSnapshot.docs[0].data();
    expect([USER_1_EMAIL, USER_2_EMAIL]).toContain(transaction.userEmail);
  }, 30000); // 30-second timeout

  it("should reject both requests if the locker is already occupied (FILLED)", async () => {
    // Requirement 9.3: Cannot check in to occupied locker
    // Set locker to FILLED with existing transaction
    await db.collection("lockers").doc(TEST_LOCKER_ID).update({
      state: "FILLED",
      activeTransactionId: "existing-txn-id",
    });

    const wrapped = testEnv.wrap(initiateCheckIn);

    const request1 = {
      lockerId: TEST_LOCKER_ID,
      email: USER_1_EMAIL,
    };

    const request2 = {
      lockerId: TEST_LOCKER_ID,
      email: USER_2_EMAIL,
    };

    // Execute both requests concurrently
    const results = await Promise.allSettled([
      wrapped(request1),
      wrapped(request2),
    ]);

    // Both should fail
    expect(results[0].status).toBe("rejected");
    expect(results[1].status).toBe("rejected");

    // Both should have LOCKER_NOT_AVAILABLE or LOCKER_CONFLICT error
    for (const result of results) {
      if (result.status === "rejected") {
        expect(result.reason.message).toMatch(
          /LOCKER_NOT_AVAILABLE|LOCKER_CONFLICT/,
        );
      }
    }

    // Verify no new transactions were created
    const transactionsSnapshot = await db
      .collection("transactions")
      .where("lockerId", "==", TEST_LOCKER_ID)
      .where("userEmail", "in", [USER_1_EMAIL, USER_2_EMAIL])
      .get();
    expect(transactionsSnapshot.size).toBe(0);
  });

  it("should reject all requests if the locker is offline", async () => {
    // Requirement 9.3: Cannot check in to offline locker
    // Set locker to offline
    await db.collection("lockers").doc(TEST_LOCKER_ID).update({
      isOnline: false,
    });

    const wrapped = testEnv.wrap(initiateCheckIn);

    const request1 = {
      lockerId: TEST_LOCKER_ID,
      email: USER_1_EMAIL,
    };

    const request2 = {
      lockerId: TEST_LOCKER_ID,
      email: USER_2_EMAIL,
    };

    // Execute both requests concurrently
    const results = await Promise.allSettled([
      wrapped(request1),
      wrapped(request2),
    ]);

    // Both should fail
    expect(results[0].status).toBe("rejected");
    expect(results[1].status).toBe("rejected");

    // Both should have LOCKER_OFFLINE error
    for (const result of results) {
      if (result.status === "rejected") {
        expect(result.reason.message).toContain("LOCKER_OFFLINE");
      }
    }

    // Verify no transactions were created
    const transactionsSnapshot = await db
      .collection("transactions")
      .where("lockerId", "==", TEST_LOCKER_ID)
      .where("userEmail", "in", [USER_1_EMAIL, USER_2_EMAIL])
      .get();
    expect(transactionsSnapshot.size).toBe(0);
  });

  it("should handle three concurrent requests correctly (only one succeeds)", async () => {
    // Requirement 9.3: Concurrent conflict resolution scales to N requests
    const wrapped = testEnv.wrap(initiateCheckIn);

    const request1 = {
      lockerId: TEST_LOCKER_ID,
      email: "user1@example.com",
    };

    const request2 = {
      lockerId: TEST_LOCKER_ID,
      email: "user2@example.com",
    };

    const request3 = {
      lockerId: TEST_LOCKER_ID,
      email: "user3@example.com",
    };

    // Execute all three requests concurrently
    const results = await Promise.allSettled([
      wrapped(request1),
      wrapped(request2),
      wrapped(request3),
    ]);

    // Count successes
    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value.success,
    ).length;

    // Exactly one should succeed
    expect(successCount).toBe(1);

    // The other two should fail
    const failureCount = results.filter((r) => r.status === "rejected").length;
    expect(failureCount).toBe(2);

    // Verify locker has exactly one active transaction
    const lockerSnap = await db.collection("lockers").doc(TEST_LOCKER_ID).get();
    const locker = lockerSnap.data()!;
    expect(locker.activeTransactionId).not.toBeNull();

    // Verify exactly one transaction was created
    const transactionsSnapshot = await db
      .collection("transactions")
      .where("lockerId", "==", TEST_LOCKER_ID)
      .where("status", "==", "ACTIVE")
      .get();
    expect(transactionsSnapshot.size).toBe(1);
  }, 30000);

  it("should maintain locker state consistency after concurrent conflict", async () => {
    // Requirement 9.3: Locker state remains consistent after conflict
    const wrapped = testEnv.wrap(initiateCheckIn);

    const request1 = {
      lockerId: TEST_LOCKER_ID,
      email: USER_1_EMAIL,
    };

    const request2 = {
      lockerId: TEST_LOCKER_ID,
      email: USER_2_EMAIL,
    };

    // Execute both requests concurrently
    await Promise.allSettled([wrapped(request1), wrapped(request2)]);

    // Verify locker state is consistent
    const lockerSnap = await db.collection("lockers").doc(TEST_LOCKER_ID).get();
    const locker = lockerSnap.data()!;

    // State should be UNLOCKING (after successful check-in)
    expect(locker.state).toBe("UNLOCKING");

    // activeTransactionId should match the created transaction
    expect(locker.activeTransactionId).not.toBeNull();

    const transactionSnap = await db
      .collection("transactions")
      .doc(locker.activeTransactionId)
      .get();
    expect(transactionSnap.exists).toBe(true);

    const transaction = transactionSnap.data()!;
    expect(transaction.lockerId).toBe(TEST_LOCKER_ID);
    expect(transaction.status).toBe("ACTIVE");
    expect(transaction.transactionId).toBe(locker.activeTransactionId);
  });
});
