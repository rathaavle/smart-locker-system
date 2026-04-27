import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { sendOtpEmail } from "./email_service";

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

export type LockerState = "EMPTY" | "OPEN" | "FILLED" | "UNLOCKING";
export type DoorStatus = "OPEN" | "CLOSED";

export function computeLockerState(
  doorStatus: DoorStatus,
  hasActiveTransaction: boolean,
  pendingCommand: boolean,
): LockerState {
  // Priority 1: If there's a pending UNLOCK command, state is UNLOCKING
  if (pendingCommand) {
    return "UNLOCKING";
  }

  // Priority 2: If door sensor reports OPEN, state is OPEN
  if (doorStatus === "OPEN") {
    return "OPEN";
  }

  // Priority 3: Door is CLOSED - determine FILLED vs EMPTY based on active transaction
  if (hasActiveTransaction) {
    return "FILLED";
  } else {
    return "EMPTY";
  }
}

/**
 * Firestore trigger: onLockerWrite
 * Triggered when a locker document is created or updated.
 * Computes the new locker state and handles door open alerts.
 */
export const onLockerWrite = functions.firestore
  .document("lockers/{lockerId}")
  .onWrite(async (change, context) => {
    const lockerId = context.params.lockerId;

    // If document was deleted, nothing to do
    if (!change.after.exists) {
      return;
    }

    const lockerData = change.after.data();
    if (!lockerData) {
      return;
    }

    const doorStatus = lockerData.doorStatus as DoorStatus;
    const activeTransactionId = lockerData.activeTransactionId;
    const hasActiveTransaction =
      activeTransactionId !== null && activeTransactionId !== undefined;

    // Check if there's a pending command in RTDB
    const rtdb = admin.database();
    const commandSnapshot = await rtdb
      .ref(`devices/${lockerId}/command`)
      .once("value");
    const command = commandSnapshot.val();
    const pendingCommand = command === "UNLOCK";

    // Compute new state
    const newState = computeLockerState(
      doorStatus,
      hasActiveTransaction,
      pendingCommand,
    );

    // Update locker state if it changed
    if (lockerData.state !== newState) {
      await change.after.ref.update({ state: newState });
    }

    // Handle door open alerts (Requirements 6.1, 6.2)
    if (doorStatus === "OPEN" && hasActiveTransaction) {
      const db = admin.firestore();
      const transactionDoc = await db
        .collection("transactions")
        .doc(activeTransactionId)
        .get();

      if (transactionDoc.exists) {
        const transactionData = transactionDoc.data();
        if (!transactionData) {
          return;
        }

        const checkInAt = transactionData.checkInAt?.toDate();
        const openAlertSentAt = transactionData.openAlertSentAt?.toDate();
        const now = new Date();

        if (checkInAt) {
          const minutesOpen =
            (now.getTime() - checkInAt.getTime()) / (1000 * 60);

          // Door open > 30 minutes: set to MANUAL_REVIEW and FILLED
          if (minutesOpen > 30) {
            await transactionDoc.ref.update({
              status: "MANUAL_REVIEW",
            });
            await change.after.ref.update({
              state: "FILLED",
            });
            functions.logger.warn(
              `Locker ${lockerId} door open > 30 minutes, set to MANUAL_REVIEW`,
            );
          }
          // Door open > 5 minutes: send alert email (only once)
          else if (minutesOpen > 5 && !openAlertSentAt) {
            const userEmail = transactionData.userEmail;
            if (userEmail) {
              // Send alert email
              await sendOtpEmail({
                email: userEmail,
                otp: "ALERT",
                lockerId: lockerId,
              }).catch((err) => {
                functions.logger.error(
                  `Failed to send door open alert for ${lockerId}`,
                  err,
                );
              });

              // Mark alert as sent
              await transactionDoc.ref.update({
                openAlertSentAt: admin.firestore.Timestamp.now(),
              });
              functions.logger.info(
                `Sent door open alert for locker ${lockerId}`,
              );
            }
          }
        }
      }
    }
  });

/**
 * RTDB trigger: onDoorStatusChange
 * Triggered when door status changes in Realtime Database.
 * Updates the corresponding Firestore locker document.
 */
export const onDoorStatusChange = functions.database
  .ref("devices/{deviceId}/doorStatus")
  .onWrite(async (change, context) => {
    const deviceId = context.params.deviceId;

    // If the value was deleted, nothing to do
    if (!change.after.exists()) {
      return;
    }

    const newDoorStatus = change.after.val() as DoorStatus;

    // Update Firestore locker document
    const db = admin.firestore();
    const lockerRef = db.collection("lockers").doc(deviceId);

    await lockerRef.update({
      doorStatus: newDoorStatus,
      lastHeartbeat: admin.firestore.Timestamp.now(),
      isOnline: true,
    });

    functions.logger.info(
      `Updated locker ${deviceId} doorStatus to ${newDoorStatus}`,
    );
  });
