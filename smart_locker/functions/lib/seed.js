"use strict";
// smart_locker/functions/src/seed.ts
// Script untuk seed data locker ke Firestore emulator
// Jalankan: npx ts-node src/seed.ts
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
const admin = __importStar(require("firebase-admin"));
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
function makeDeviceId(index) {
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
//# sourceMappingURL=seed.js.map