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
exports.onDoorStatusChange = exports.onLockerWrite = void 0;
exports.computeLockerState = computeLockerState;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const email_service_1 = require("./email_service");
// Initialize admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
function computeLockerState(doorStatus, hasActiveTransaction, pendingCommand) {
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
    }
    else {
        return "EMPTY";
    }
}
/**
 * Firestore trigger: onLockerWrite
 * Triggered when a locker document is created or updated.
 * Computes the new locker state and handles door open alerts.
 */
exports.onLockerWrite = functions.firestore
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
    const doorStatus = lockerData.doorStatus;
    const activeTransactionId = lockerData.activeTransactionId;
    const hasActiveTransaction = activeTransactionId !== null && activeTransactionId !== undefined;
    // Check if there's a pending command in RTDB
    const rtdb = admin.database();
    const commandSnapshot = await rtdb
        .ref(`devices/${lockerId}/command`)
        .once("value");
    const command = commandSnapshot.val();
    const pendingCommand = command === "UNLOCK";
    // Compute new state
    const newState = computeLockerState(doorStatus, hasActiveTransaction, pendingCommand);
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
                const minutesOpen = (now.getTime() - checkInAt.getTime()) / (1000 * 60);
                // Door open > 30 minutes: set to MANUAL_REVIEW and FILLED
                if (minutesOpen > 30) {
                    await transactionDoc.ref.update({
                        status: "MANUAL_REVIEW",
                    });
                    await change.after.ref.update({
                        state: "FILLED",
                    });
                    functions.logger.warn(`Locker ${lockerId} door open > 30 minutes, set to MANUAL_REVIEW`);
                }
                // Door open > 5 minutes: send alert email (only once)
                else if (minutesOpen > 5 && !openAlertSentAt) {
                    const userEmail = transactionData.userEmail;
                    if (userEmail) {
                        // Send alert email
                        await (0, email_service_1.sendOtpEmail)({
                            email: userEmail,
                            otp: "ALERT",
                            lockerId: lockerId,
                        }).catch((err) => {
                            functions.logger.error(`Failed to send door open alert for ${lockerId}`, err);
                        });
                        // Mark alert as sent
                        await transactionDoc.ref.update({
                            openAlertSentAt: admin.firestore.Timestamp.now(),
                        });
                        functions.logger.info(`Sent door open alert for locker ${lockerId}`);
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
exports.onDoorStatusChange = functions.database
    .ref("devices/{deviceId}/doorStatus")
    .onWrite(async (change, context) => {
    const deviceId = context.params.deviceId;
    // If the value was deleted, nothing to do
    if (!change.after.exists()) {
        return;
    }
    const newDoorStatus = change.after.val();
    // Update Firestore locker document
    const db = admin.firestore();
    const lockerRef = db.collection("lockers").doc(deviceId);
    await lockerRef.update({
        doorStatus: newDoorStatus,
        lastHeartbeat: admin.firestore.Timestamp.now(),
        isOnline: true,
    });
    functions.logger.info(`Updated locker ${deviceId} doorStatus to ${newDoorStatus}`);
});
//# sourceMappingURL=state_manager.js.map