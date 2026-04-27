import * as fc from "fast-check";
import { isDeviceOffline } from "../../src/heartbeat_monitor";

// Feature: smart-locker-system, Property 16: Heartbeat offline

describe("Property 16: Heartbeat Offline Detection", () => {
  it("should mark device as offline when lastHeartbeat is more than 60 seconds ago", () => {
    // Feature: smart-locker-system, Property 16: Heartbeat offline
    // **Validates: Requirements 8.1**
    //
    // For any locker where (currentTime - lastHeartbeat) > 60 seconds,
    // isDeviceOffline MUST return true.
    fc.assert(
      fc.property(
        // Generate arbitrary timestamp T where (now - T) > 60s
        // extraMs ∈ [1, 30 days] — any amount past the 60-second threshold
        fc.integer({ min: 1, max: 30 * 24 * 60 * 60 * 1000 }),
        (extraMs) => {
          const SIXTY_SECONDS_MS = 60 * 1000;
          const now = Date.now();
          const lastHeartbeat = now - SIXTY_SECONDS_MS - extraMs;

          const result = isDeviceOffline(lastHeartbeat, now);

          // Device MUST be marked as offline
          expect(result).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should mark device as online when lastHeartbeat is within 60 seconds", () => {
    // Feature: smart-locker-system, Property 16: Heartbeat offline
    // **Validates: Requirements 8.1**
    //
    // For any locker where (currentTime - lastHeartbeat) <= 60 seconds,
    // isDeviceOffline MUST return false.
    fc.assert(
      fc.property(
        // Generate arbitrary offset within [0, 60s]
        fc.integer({ min: 0, max: 60 * 1000 }),
        (offsetMs) => {
          const now = Date.now();
          const lastHeartbeat = now - offsetMs;

          const result = isDeviceOffline(lastHeartbeat, now);

          // Device MUST be marked as online
          expect(result).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should handle edge case: exactly 60 seconds ago (boundary)", () => {
    // Feature: smart-locker-system, Property 16: Heartbeat offline
    // **Validates: Requirements 8.1**
    //
    // A timestamp exactly 60 seconds ago is NOT yet offline (> 60s is the condition).
    const SIXTY_SECONDS_MS = 60 * 1000;
    const now = Date.now();
    const lastHeartbeat = now - SIXTY_SECONDS_MS;

    const result = isDeviceOffline(lastHeartbeat, now);

    // Device MUST still be online at exactly 60 seconds
    expect(result).toBe(false);
  });

  it("should handle edge case: exactly 60 seconds + 1ms ago (just past boundary)", () => {
    // Feature: smart-locker-system, Property 16: Heartbeat offline
    // **Validates: Requirements 8.1**
    //
    // A timestamp 60s + 1ms ago IS offline.
    const SIXTY_SECONDS_MS = 60 * 1000;
    const now = Date.now();
    const lastHeartbeat = now - SIXTY_SECONDS_MS - 1;

    const result = isDeviceOffline(lastHeartbeat, now);

    // Device MUST be marked as offline
    expect(result).toBe(true);
  });

  it("should handle arbitrary current time values", () => {
    // Feature: smart-locker-system, Property 16: Heartbeat offline
    // **Validates: Requirements 8.1**
    //
    // The offline detection logic should work correctly regardless of the
    // absolute value of the current time (past, present, or future timestamps).
    fc.assert(
      fc.property(
        // Generate arbitrary "now" timestamp (within reasonable range)
        fc.integer({ min: 0, max: Date.now() + 365 * 24 * 60 * 60 * 1000 }),
        // Generate arbitrary offset past the 60-second threshold
        fc.integer({ min: 1, max: 7 * 24 * 60 * 60 * 1000 }),
        (now, extraMs) => {
          const SIXTY_SECONDS_MS = 60 * 1000;
          const lastHeartbeat = now - SIXTY_SECONDS_MS - extraMs;

          const result = isDeviceOffline(lastHeartbeat, now);

          // Device MUST be marked as offline
          expect(result).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: smart-locker-system, Property 17: Heartbeat restoration

describe("Property 17: Heartbeat Online Restoration", () => {
  it("should restore device to online when fresh heartbeat is received", () => {
    // Feature: smart-locker-system, Property 17: Heartbeat restoration
    // **Validates: Requirements 8.3**
    //
    // For any locker currently marked isOnline=false, after the device writes
    // a fresh heartbeat timestamp within the last 60 seconds, isOnline SHALL
    // become true.
    //
    // This property tests the inverse of offline detection: a fresh heartbeat
    // (within 60 seconds) should result in isDeviceOffline returning false,
    // which means the locker should be marked as online.
    fc.assert(
      fc.property(
        // Generate arbitrary offset within [0, 60s] for fresh heartbeat
        fc.integer({ min: 0, max: 60 * 1000 }),
        (offsetMs) => {
          const now = Date.now();
          const freshHeartbeat = now - offsetMs;

          const result = isDeviceOffline(freshHeartbeat, now);

          // Device MUST be marked as online (isDeviceOffline returns false)
          expect(result).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should restore device to online even if it was previously offline for a long time", () => {
    // Feature: smart-locker-system, Property 17: Heartbeat restoration
    // **Validates: Requirements 8.3**
    //
    // Regardless of how long a device was offline, a fresh heartbeat within
    // the last 60 seconds should restore it to online status.
    fc.assert(
      fc.property(
        // Generate arbitrary previous offline duration (1 minute to 30 days)
        fc.integer({ min: 61 * 1000, max: 30 * 24 * 60 * 60 * 1000 }),
        // Generate arbitrary fresh heartbeat offset (0 to 60 seconds)
        fc.integer({ min: 0, max: 60 * 1000 }),
        (previousOfflineDuration, freshOffset) => {
          const now = Date.now();

          // Device was offline (old heartbeat)
          const oldHeartbeat = now - previousOfflineDuration;
          const wasOffline = isDeviceOffline(oldHeartbeat, now);
          expect(wasOffline).toBe(true);

          // Device sends fresh heartbeat
          const freshHeartbeat = now - freshOffset;
          const isNowOffline = isDeviceOffline(freshHeartbeat, now);

          // Device MUST be restored to online
          expect(isNowOffline).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should handle restoration at the exact 60-second boundary", () => {
    // Feature: smart-locker-system, Property 17: Heartbeat restoration
    // **Validates: Requirements 8.3**
    //
    // A heartbeat exactly 60 seconds ago should keep the device online.
    const SIXTY_SECONDS_MS = 60 * 1000;
    const now = Date.now();
    const heartbeatAtBoundary = now - SIXTY_SECONDS_MS;

    const result = isDeviceOffline(heartbeatAtBoundary, now);

    // Device MUST be online at exactly 60 seconds
    expect(result).toBe(false);
  });

  it("should verify restoration logic across different time scales", () => {
    // Feature: smart-locker-system, Property 17: Heartbeat restoration
    // **Validates: Requirements 8.3**
    //
    // Test that restoration works correctly regardless of the absolute time values.
    fc.assert(
      fc.property(
        // Generate arbitrary "now" timestamp
        fc.integer({
          min: 1000000000000,
          max: Date.now() + 365 * 24 * 60 * 60 * 1000,
        }),
        // Generate arbitrary fresh heartbeat offset (0 to 59 seconds)
        fc.integer({ min: 0, max: 59 * 1000 }),
        (now, freshOffset) => {
          const freshHeartbeat = now - freshOffset;

          const result = isDeviceOffline(freshHeartbeat, now);

          // Device MUST be online with fresh heartbeat
          expect(result).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
