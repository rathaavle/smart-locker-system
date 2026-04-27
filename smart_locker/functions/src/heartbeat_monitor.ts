import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

export function isDeviceOffline(lastHeartbeat: number, now: number): boolean {
  // TODO: implement in Task 8
  throw new Error("Not implemented");
}

export const checkHeartbeats = functions.pubsub
  .schedule("every 1 minutes")
  .onRun(async (context) => {
    // TODO: implement in Task 8
  });
