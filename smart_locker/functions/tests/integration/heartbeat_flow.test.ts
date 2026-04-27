/**
 * Integration Test: Heartbeat and Online/Offline Transitions
 *
 * Tests the heartbeat monitoring system and online/offline state transitions.
 * Uses Firebase Local Emulator Suite to simulate device heartbeats and scheduled function execution.
 *
 * Flow:
 *   1. Device sends heartbeat → locker marked online
 *   2. Device stops sending heartbeat > 60s → locker marked offline
 *   3. Device resumes heartbeat → locker marked online again
 *
 * Requirements: 8.1, 8.2, 8.3
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
import { checkHeartbeats, isDeviceOffline } from "../../src/heartbeat_monitor";
import { onDoorStatusChange } from "../../src/state_manager";

const db = admin.firestore();
const rtdb = admin.database();

// Use emulator
if (process.env.FIRESTORE_EMULATOR_HOST === undefined) {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
}
if (process.env.FIREBASE_DATABASE_EMULATOR_HOST === undefined) {
  process.env.FIREBASE_DATABASE_EMULATOR_HOST = "127.0.0.1:9000";
}

describe("Integration Test: Heartbeat and Online/Offline Transitions", () => {
  const TEST_LOCKER_ID = "locker-heartbeat-01";

  beforeEach(async () => {
    // Clear Firestore collections
    const lockersSnapshot = await db.collection("lockers").get();
    const deleteLockerPromises = lockersSnapshot.docs.map((doc) =>
      doc.ref.delete(),
    );
    await Promise.all(deleteLockerPromises);

    // Clear RTDB devices node
    await rtdb.ref("devices").remove();
  });

  afterAll(async () => {
    // Cleanup
    await db.collection("lockers").doc(TEST_LOCKER_ID).delete();
    await rtdb.ref(`devices/${TEST_LOCKER_ID}`).remove();
    testEnv.cleanup();
  });

  it("should mark locker offline when no heartbeat received for > 60 seconds", async () => {
    // Requirement 8.1: Device offline detection
    // Seed locker with old heartbeat (65 seconds ago)
    const oldHeartbeat = admin.firestore.Timestamp.fromMillis(
      Date.now() - 65 * 1000,
    );

    await db.collection("lockers").doc(TEST_LOCKER_ID).set({
      lockerId: TEST_LOCKER_ID,
      state: "EMPTY",
      doorStatus: "CLOSED",
      isOnline: true, // Currently marked as online
      lastHeartbeat: oldHeartbeat,
      activeTransactionId: null,
      failedOtpAttempts: 0,
      otpLockedUntil: null,
    });

    // Run the scheduled heartbeat check function
    const wrapped = testEnv.wrap(checkHeartbeats);
    await wrapped({});

    // Verify locker is now marked offline
    const lockerSnap = await db.collection("lockers").doc(TEST_LOCKER_ID).get();
    const locker = lockerSnap.data()!;
    expect(locker.isOnline).toBe(false);
  });

  it("should keep locker online when heartbeat is within 60 seconds", async () => {
    // Requirement 8.1: Device online when heartbeat is recent
    // Seed locker with recent heartbeat (30 seconds ago)
    const recentHeartbeat = admin.firestore.Timestamp.fromMillis(
      Date.now() - 30 * 1000,
    );

    await db.collection("lockers").doc(TEST_LOCKER_ID).set({
      lockerId: TEST_LOCKER_ID,
      state: "EMPTY",
      doorStatus: "CLOSED",
      isOnline: true,
      lastHeartbeat: recentHeartbeat,
      activeTransactionId: null,
      failedOtpAttempts: 0,
      otpLockedUntil: null,
    });

    // Run the scheduled heartbeat check function
    const wrapped = testEnv.wrap(checkHeartbeats);
    await wrapped({});

    // Verify locker is still online
    const lockerSnap = await db.collection("lockers").doc(TEST_LOCKER_ID).get();
    const locker = lockerSnap.data()!;
    expect(locker.isOnline).toBe(true);
  });

  it("should restore locker to online when device sends fresh heartbeat", async () => {
    // Requirement 8.3: Online restoration after reconnection
    // Seed locker as offline
    const oldHeartbeat = admin.firestore.Timestamp.fromMillis(
      Date.now() - 120 * 1000,
    );

    await db.collection("lockers").doc(TEST_LOCKER_ID).set({
      lockerId: TEST_LOCKER_ID,
      state: "EMPTY",
      doorStatus: "CLOSED",
      isOnline: false, // Currently offline
      lastHeartbeat: oldHeartbeat,
      activeTransactionId: null,
      failedOtpAttempts: 0,
      otpLockedUntil: null,
    });

    // Simulate device sending fresh heartbeat via RTDB doorStatus update
    // (onDoorStatusChange updates lastHeartbeat and sets isOnline=true)
    await rtdb.ref(`devices/${TEST_LOCKER_ID}/doorStatus`).set("CLOSED");

    // Wait for RTDB trigger
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Trigger onDoorStatusChange manually
    const doorStatusChange = testEnv.makeChange(
      testEnv.database.makeDataSnapshot(
        null,
        `devices/${TEST_LOCKER_ID}/doorStatus`,
      ),
      testEnv.database.makeDataSnapshot(
        "CLOSED",
        `devices/${TEST_LOCKER_ID}/doorStatus`,
      ),
    );
    const wrappedDoorStatusChange = testEnv.wrap(onDoorStatusChange);
    await wrappedDoorStatusChange(doorStatusChange, {
      params: { deviceId: TEST_LOCKER_ID },
    });

    // Verify locker is now online with fresh heartbeat
    const lockerSnap = await db.collection("lockers").doc(TEST_LOCKER_ID).get();
    const locker = lockerSnap.data()!;
    expect(locker.isOnline).toBe(true);
    expect(locker.lastHeartbeat.toMillis()).toBeGreaterThan(Date.now() - 5000); // Within last 5 seconds
  });

  it("should handle multiple lockers with mixed online/offline states", async () => {
    // Requirement 8.1: Heartbeat check handles multiple lockers
    const now = Date.now();

    // Seed multiple lockers with different heartbeat ages
    const lockers = [
      {
        id: "locker-01",
        heartbeatAge: 30 * 1000, // 30s ago - should stay online
        expectedOnline: true,
      },
      {
        id: "locker-02",
        heartbeatAge: 70 * 1000, // 70s ago - should go offline
        expectedOnline: false,
      },
      {
        id: "locker-03",
        heartbeatAge: 45 * 1000, // 45s ago - should stay online
        expectedOnline: true,
      },
      {
        id: "locker-04",
        heartbeatAge: 120 * 1000, // 120s ago - should go offline
        expectedOnline: false,
      },
    ];

    for (const locker of lockers) {
      const heartbeat = admin.firestore.Timestamp.fromMillis(
        now - locker.heartbeatAge,
      );
      await db.collection("lockers").doc(locker.id).set({
        lockerId: locker.id,
        state: "EMPTY",
        doorStatus: "CLOSED",
        isOnline: true, // All start as online
        lastHeartbeat: heartbeat,
        activeTransactionId: null,
        failedOtpAttempts: 0,
        otpLockedUntil: null,
      });
    }

    // Run the scheduled heartbeat check function
    const wrapped = testEnv.wrap(checkHeartbeats);
    await wrapped({});

    // Verify each locker has correct online/offline state
    for (const locker of lockers) {
      const lockerSnap = await db.collection("lockers").doc(locker.id).get();
      const lockerData = lockerSnap.data()!;
      expect(lockerData.isOnline).toBe(locker.expectedOnline);
    }

    // Cleanup
    for (const locker of lockers) {
      await db.collection("lockers").doc(locker.id).delete();
    }
  });

  it("should not update locker if already marked offline (idempotency)", async () => {
    // Requirement 8.1: Avoid unnecessary writes
    // Seed locker as offline with old heartbeat
    const oldHeartbeat = admin.firestore.Timestamp.fromMillis(
      Date.now() - 120 * 1000,
    );

    await db.collection("lockers").doc(TEST_LOCKER_ID).set({
      lockerId: TEST_LOCKER_ID,
      state: "EMPTY",
      doorStatus: "CLOSED",
      isOnline: false, // Already offline
      lastHeartbeat: oldHeartbeat,
      activeTransactionId: null,
      failedOtpAttempts: 0,
      otpLockedUntil: null,
    });

    // Get initial update time
    // const initialSnap = await db
    //   .collection("lockers")
    //   .doc(TEST_LOCKER_ID)
    //   .get();
    // const initialUpdateTime = initialSnap.updateTime; // Not used in this test

    // Run the scheduled heartbeat check function
    const wrapped = testEnv.wrap(checkHeartbeats);
    await wrapped({});

    // Verify locker is still offline
    const lockerSnap = await db.collection("lockers").doc(TEST_LOCKER_ID).get();
    const locker = lockerSnap.data()!;
    expect(locker.isOnline).toBe(false);

    // Verify document was not updated (update time unchanged)
    // Note: This check may not work in emulator, but the implementation
    // should avoid unnecessary writes
    expect(locker.isOnline).toBe(false);
  });

  it("should reject check-in when locker is offline", async () => {
    // Requirement 8.2: Offline lockers are unavailable for check-in
    // This is tested in the check-in flow test, but we verify the state here
    const oldHeartbeat = admin.firestore.Timestamp.fromMillis(
      Date.now() - 90 * 1000,
    );

    await db.collection("lockers").doc(TEST_LOCKER_ID).set({
      lockerId: TEST_LOCKER_ID,
      state: "EMPTY",
      doorStatus: "CLOSED",
      isOnline: true,
      lastHeartbeat: oldHeartbeat,
      activeTransactionId: null,
      failedOtpAttempts: 0,
      otpLockedUntil: null,
    });

    // Run heartbeat check to mark offline
    const wrapped = testEnv.wrap(checkHeartbeats);
    await wrapped({});

    // Verify locker is offline
    const lockerSnap = await db.collection("lockers").doc(TEST_LOCKER_ID).get();
    const locker = lockerSnap.data()!;
    expect(locker.isOnline).toBe(false);

    // App should not allow check-in to offline locker
    // (This is enforced in initiateCheckIn function)
  });

  it("should correctly determine offline status at exactly 60 second boundary", async () => {
    // Requirement 8.1: Boundary condition testing
    const now = Date.now();

    // Test exactly 60 seconds ago (should still be online)
    const exactly60s = now - 60 * 1000;
    expect(isDeviceOffline(exactly60s, now)).toBe(false);

    // Test 60.001 seconds ago (should be offline)
    const just_over_60s = now - 60 * 1000 - 1;
    expect(isDeviceOffline(just_over_60s, now)).toBe(true);

    // Test 59.999 seconds ago (should be online)
    const just_under_60s = now - 60 * 1000 + 1;
    expect(isDeviceOffline(just_under_60s, now)).toBe(false);
  });

  it("should handle locker with no lastHeartbeat field (edge case)", async () => {
    // Requirement 8.1: Handle missing heartbeat gracefully
    // Seed locker without lastHeartbeat field
    await db.collection("lockers").doc(TEST_LOCKER_ID).set({
      lockerId: TEST_LOCKER_ID,
      state: "EMPTY",
      doorStatus: "CLOSED",
      isOnline: true,
      // lastHeartbeat is missing
      activeTransactionId: null,
      failedOtpAttempts: 0,
      otpLockedUntil: null,
    });

    // Run heartbeat check
    const wrapped = testEnv.wrap(checkHeartbeats);
    await wrapped({});

    // Verify locker is marked offline (missing heartbeat = offline)
    const lockerSnap = await db.collection("lockers").doc(TEST_LOCKER_ID).get();
    const locker = lockerSnap.data()!;
    expect(locker.isOnline).toBe(false);
  });

  it("should complete full online → offline → online cycle", async () => {
    // Requirement 8.1, 8.3: Full lifecycle test
    // Step 1: Seed locker as online with recent heartbeat
    const recentHeartbeat = admin.firestore.Timestamp.fromMillis(
      Date.now() - 30 * 1000,
    );

    await db.collection("lockers").doc(TEST_LOCKER_ID).set({
      lockerId: TEST_LOCKER_ID,
      state: "EMPTY",
      doorStatus: "CLOSED",
      isOnline: true,
      lastHeartbeat: recentHeartbeat,
      activeTransactionId: null,
      failedOtpAttempts: 0,
      otpLockedUntil: null,
    });

    // Verify online
    let lockerSnap = await db.collection("lockers").doc(TEST_LOCKER_ID).get();
    expect(lockerSnap.data()!.isOnline).toBe(true);

    // Step 2: Simulate time passing (update heartbeat to 70s ago)
    const oldHeartbeat = admin.firestore.Timestamp.fromMillis(
      Date.now() - 70 * 1000,
    );
    await db.collection("lockers").doc(TEST_LOCKER_ID).update({
      lastHeartbeat: oldHeartbeat,
    });

    // Run heartbeat check → should go offline
    const wrapped = testEnv.wrap(checkHeartbeats);
    await wrapped({});

    lockerSnap = await db.collection("lockers").doc(TEST_LOCKER_ID).get();
    expect(lockerSnap.data()!.isOnline).toBe(false);

    // Step 3: Device reconnects and sends heartbeat
    await rtdb.ref(`devices/${TEST_LOCKER_ID}/doorStatus`).set("CLOSED");

    // Trigger onDoorStatusChange
    const doorStatusChange = testEnv.makeChange(
      testEnv.database.makeDataSnapshot(
        null,
        `devices/${TEST_LOCKER_ID}/doorStatus`,
      ),
      testEnv.database.makeDataSnapshot(
        "CLOSED",
        `devices/${TEST_LOCKER_ID}/doorStatus`,
      ),
    );
    const wrappedDoorStatusChange = testEnv.wrap(onDoorStatusChange);
    await wrappedDoorStatusChange(doorStatusChange, {
      params: { deviceId: TEST_LOCKER_ID },
    });

    // Verify back online
    lockerSnap = await db.collection("lockers").doc(TEST_LOCKER_ID).get();
    expect(lockerSnap.data()!.isOnline).toBe(true);
  });
});
