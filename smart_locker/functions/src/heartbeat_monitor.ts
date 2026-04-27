import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * Helper function to determine if a device is offline based on its last heartbeat.
 * A device is considered offline if the last heartbeat was more than 60 seconds ago.
 *
 * @param lastHeartbeat - Unix timestamp in milliseconds of the last heartbeat
 * @param now - Current Unix timestamp in milliseconds
 * @returns true if device is offline (lastHeartbeat > 60 seconds ago), false otherwise
 */
export function isDeviceOffline(lastHeartbeat: number, now: number): boolean {
  const HEARTBEAT_TIMEOUT_MS = 60 * 1000; // 60 seconds
  return now - lastHeartbeat > HEARTBEAT_TIMEOUT_MS;
}

/**
 * Scheduled Cloud Function that runs every 60 seconds to check all locker heartbeats.
 * Marks lockers as offline if they haven't sent a heartbeat within 60 seconds.
 *
 * Requirements: 8.1
 */
export const checkHeartbeats = functions.pubsub
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
      } else {
        console.log("All lockers are online or already marked offline");
      }
    } catch (error) {
      console.error("Error checking heartbeats:", error);
      throw error;
    }
  });
