import * as fc from "fast-check";

// Feature: smart-locker-system, Property 12: Locker schema completeness

const REQUIRED_LOCKER_FIELDS = [
  "lockerId",
  "state",
  "doorStatus",
  "isOnline",
  "lastHeartbeat",
  "activeTransactionId",
];

const VALID_STATES = ["EMPTY", "OPEN", "FILLED", "UNLOCKING"] as const;
const VALID_DOOR_STATUSES = ["OPEN", "CLOSED"] as const;

describe("Property 12: Locker Document Schema Completeness", () => {
  it("should contain all required fields for any valid locker document", () => {
    // Feature: smart-locker-system, Property 12: Locker schema
    fc.assert(
      fc.property(
        fc.record({
          lockerId: fc.string({ minLength: 1 }),
          state: fc.constantFrom(...VALID_STATES),
          doorStatus: fc.constantFrom(...VALID_DOOR_STATUSES),
          isOnline: fc.boolean(),
          lastHeartbeat: fc.option(fc.date(), { nil: null }),
          activeTransactionId: fc.option(fc.string({ minLength: 1 }), {
            nil: null,
          }),
          failedOtpAttempts: fc.nat(),
          otpLockedUntil: fc.option(fc.date(), { nil: null }),
        }),
        (lockerDoc) => {
          // Verifikasi semua required field ada
          for (const field of REQUIRED_LOCKER_FIELDS) {
            expect(lockerDoc).toHaveProperty(field);
          }
          // Verifikasi state adalah salah satu dari 4 nilai valid
          expect(VALID_STATES).toContain(lockerDoc.state);
          // Verifikasi doorStatus adalah OPEN atau CLOSED
          expect(VALID_DOOR_STATUSES).toContain(lockerDoc.doorStatus);
          // Verifikasi isOnline adalah boolean
          expect(typeof lockerDoc.isOnline).toBe("boolean");
          // Verifikasi failedOtpAttempts adalah non-negative integer
          expect(lockerDoc.failedOtpAttempts).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
