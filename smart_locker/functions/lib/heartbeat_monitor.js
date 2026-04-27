"use strict";
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
exports.checkHeartbeats = void 0;
exports.isDeviceOffline = isDeviceOffline;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
/**
 * Helper function to determine if a device is offline based on its last heartbeat.
 * A device is considered offline if the last heartbeat was more than 60 seconds ago.
 *
 * @param lastHeartbeat - Unix timestamp in milliseconds of the last heartbeat
 * @param now - Current Unix timestamp in milliseconds
 * @returns true if device is offline (lastHeartbeat > 60 seconds ago), false otherwise
 */
function isDeviceOffline(lastHeartbeat, now) {
    const HEARTBEAT_TIMEOUT_MS = 60 * 1000; // 60 seconds
    return now - lastHeartbeat > HEARTBEAT_TIMEOUT_MS;
}
/**
 * Scheduled Cloud Function that runs every 60 seconds to check all locker heartbeats.
 * Marks lockers as offline if they haven't sent a heartbeat within 60 seconds.
 *
 * Requirements: 8.1
 */
exports.checkHeartbeats = functions.pubsub
    .schedule("every 1 minutes")
    .onRun(async (context) => {
    const db = admin.firestore();
    const now = Date.now();
    try {
        // Query all lockers from Firestore
        const lockersSnapshot = await db.collection("lockers").get();
        // Batch update for efficiency
        const batch = db.batch();
        let offlineCount = 0;
        for (const doc of lockersSnapshot.docs) {
            const locker = doc.data();
            const lastHeartbeat = locker.lastHeartbeat?.toMillis() || 0;
            // Check if device is offline
            if (isDeviceOffline(lastHeartbeat, now)) {
                // Only update if currently marked as online to avoid unnecessary writes
                if (locker.isOnline !== false) {
                    batch.update(doc.ref, { isOnline: false });
                    offlineCount++;
                }
            }
        }
        // Commit all updates
        if (offlineCount > 0) {
            await batch.commit();
            console.log(`Marked ${offlineCount} locker(s) as offline`);
        }
        else {
            console.log("All lockers are online or already marked offline");
        }
    }
    catch (error) {
        console.error("Error checking heartbeats:", error);
        throw error;
    }
});
//# sourceMappingURL=heartbeat_monitor.js.map