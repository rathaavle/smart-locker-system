// smart_locker/functions/src/seed.ts
// Script untuk seed data locker ke Firestore emulator
// Jalankan: npx ts-node src/seed.ts

import * as admin from "firebase-admin";

// Gunakan emulator
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_DATABASE_EMULATOR_HOST = "localhost:9000";

admin.initializeApp({
  projectId: "smart-locker-dev",
  databaseURL: "http://localhost:9000/?ns=smart-locker-dev",
});

const db = admin.firestore();
const rtdb = admin.database();

// Ubah nilai ini untuk seed lebih banyak locker (misal: 12, 24, 100)
const LOCKER_COUNT = 6;

/**
 * Menghasilkan lockerId dengan zero-padding yang benar untuk jumlah locker berapa pun.
 * Contoh: LOCKER_COUNT=6  → locker-1..locker-6
 *         LOCKER_COUNT=10 → locker-01..locker-10
 *         LOCKER_COUNT=100 → locker-001..locker-100
 */
function makeDeviceId(index: number): string {
  const digits = String(LOCKER_COUNT).length; // lebar padding sesuai total locker
  const padded = String(index).padStart(digits, "0");
  return `locker-${padded}`;
}

async function seedLockers() {
  console.log(`Seeding ${LOCKER_COUNT} lockers...`);
  const batch = db.batch();

  for (let i = 1; i <= LOCKER_COUNT; i++) {
    const lockerId = makeDeviceId(i);
    const ref = db.collection("lockers").doc(lockerId);
    batch.set(ref, {
      lockerId,
      state: "EMPTY",
      doorStatus: "CLOSED",
      isOnline: false,
      lastHeartbeat: admin.firestore.Timestamp.fromDate(new Date(0)),
      activeTransactionId: null,
      failedOtpAttempts: 0,
      otpLockedUntil: null,
    });
  }

  await batch.commit();
  console.log(`✓ ${LOCKER_COUNT} lockers seeded to Firestore`);
}

async function seedRtdbDevices() {
  console.log("Seeding RTDB device nodes...");
  for (let i = 1; i <= LOCKER_COUNT; i++) {
    const deviceId = makeDeviceId(i);
    await rtdb.ref(`devices/${deviceId}`).set({
      command: "",
      commandAt: 0,
      doorStatus: "CLOSED",
      heartbeat: 0,
    });
  }
  console.log(`✓ ${LOCKER_COUNT} device nodes seeded to RTDB`);
}

async function main() {
  await seedLockers();
  await seedRtdbDevices();
  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
