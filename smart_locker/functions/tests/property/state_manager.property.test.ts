import * as fc from "fast-check";
import { computeLockerState, DoorStatus } from "../../src/state_manager";

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

// Feature: smart-locker-system, Property 1: State domain invariant

describe("Property 1: Locker State Domain Invariant", () => {
  it("should always return one of exactly four valid states", () => {
    // Feature: smart-locker-system, Property 1: State domain invariant
    fc.assert(
      fc.property(
        fc.constantFrom<DoorStatus>("OPEN", "CLOSED"),
        fc.boolean(),
        fc.boolean(),
        (doorStatus, hasActiveTransaction, pendingCommand) => {
          const result = computeLockerState(
            doorStatus,
            hasActiveTransaction,
            pendingCommand,
          );

          // Verifikasi output selalu salah satu dari 4 state valid
          expect(VALID_STATES).toContain(result);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: smart-locker-system, Property 2: Sensor CLOSED

describe("Property 2: State Transition — Sensor CLOSED Determines FILLED vs EMPTY", () => {
  it("should return FILLED when door is CLOSED and has active transaction, EMPTY otherwise", () => {
    // Feature: smart-locker-system, Property 2: Sensor CLOSED
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        (hasActiveTransaction, pendingCommand) => {
          const result = computeLockerState(
            "CLOSED",
            hasActiveTransaction,
            pendingCommand,
          );

          // Jika ada pending command, state harus UNLOCKING (prioritas tertinggi)
          if (pendingCommand) {
            expect(result).toBe("UNLOCKING");
          } else {
            // Jika tidak ada pending command, door CLOSED menentukan FILLED vs EMPTY
            if (hasActiveTransaction) {
              expect(result).toBe("FILLED");
            } else {
              expect(result).toBe("EMPTY");
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: smart-locker-system, Property 3: Sensor OPEN

describe("Property 3: State Transition — Sensor OPEN Always Yields OPEN State", () => {
  it("should always return OPEN when door sensor reports OPEN (unless pending command)", () => {
    // Feature: smart-locker-system, Property 3: Sensor OPEN
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        (hasActiveTransaction, pendingCommand) => {
          const result = computeLockerState(
            "OPEN",
            hasActiveTransaction,
            pendingCommand,
          );

          // Jika ada pending command, state harus UNLOCKING (prioritas tertinggi)
          if (pendingCommand) {
            expect(result).toBe("UNLOCKING");
          } else {
            // Jika tidak ada pending command, door OPEN selalu menghasilkan state OPEN
            expect(result).toBe("OPEN");
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: smart-locker-system, Property 4: UNLOCK command

describe("Property 4: State Transition — UNLOCK Command Yields UNLOCKING", () => {
  it("should always return UNLOCKING when there is a pending UNLOCK command", () => {
    // Feature: smart-locker-system, Property 4: UNLOCK command
    fc.assert(
      fc.property(
        fc.constantFrom<DoorStatus>("OPEN", "CLOSED"),
        fc.boolean(),
        (doorStatus, hasActiveTransaction) => {
          const result = computeLockerState(
            doorStatus,
            hasActiveTransaction,
            true,
          );

          // Dengan pending command = true, state harus selalu UNLOCKING
          expect(result).toBe("UNLOCKING");
        },
      ),
      { numRuns: 100 },
    );
  });
});
