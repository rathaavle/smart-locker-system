import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

export type LockerState = "EMPTY" | "OPEN" | "FILLED" | "UNLOCKING";
export type DoorStatus = "OPEN" | "CLOSED";

export function computeLockerState(
  doorStatus: DoorStatus,
  hasActiveTransaction: boolean,
  pendingCommand: boolean,
): LockerState {
  // TODO: implement in Task 7
  throw new Error("Not implemented");
}

export const onLockerWrite = functions.firestore
  .document("lockers/{lockerId}")
  .onWrite(async (change, context) => {
    // TODO: implement in Task 7
  });

export const onDoorStatusChange = functions.database
  .ref("devices/{deviceId}/doorStatus")
  .onWrite(async (change, context) => {
    // TODO: implement in Task 7
  });
