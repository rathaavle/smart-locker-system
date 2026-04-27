import * as fc from "fast-check";
import * as admin from "firebase-admin";
import {
  generateOtp,
  hashOtp,
  verifyOtp,
  isOtpExpired,
} from "../../src/otp_service";

// Feature: smart-locker-system, Property 5: OTP format

const OTP_REGEX = /^\d{6}$/;

describe("Property 5: OTP Format Invariant", () => {
  it("should always return a string of exactly 6 decimal digits", () => {
    // Feature: smart-locker-system, Property 5: OTP format
    // Validates: Requirements 2.3
    // Verifikasi setiap output generateOtp() match /^\d{6}$/ selama 100+ iterasi
    fc.assert(
      fc.property(
        // Use a dummy arbitrary — we only care about running the property
        // 100+ times, not about the input itself
        fc.constant(null),
        (_) => {
          const otp = generateOtp();

          // Must be a string
          expect(typeof otp).toBe("string");

          // Must be exactly 6 characters
          expect(otp).toHaveLength(6);

          // Must consist entirely of decimal digits (0–9)
          expect(otp).toMatch(OTP_REGEX);

          // Numeric value must be in range [0, 999999]
          const numericValue = parseInt(otp, 10);
          expect(numericValue).toBeGreaterThanOrEqual(0);
          expect(numericValue).toBeLessThanOrEqual(999_999);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should produce OTPs with leading zeros preserved (e.g. '000042')", () => {
    // Feature: smart-locker-system, Property 5: OTP format
    // Validates: Requirements 2.3
    // Ensures that OTPs with numeric value < 100000 are still 6 digits via zero-padding
    //
    // We cannot force generateOtp() to produce a specific value, so we verify
    // the format invariant holds across a large sample and trust that the
    // padStart(6, "0") implementation handles low values correctly.
    const samples = Array.from({ length: 200 }, () => generateOtp());
    for (const otp of samples) {
      expect(otp).toMatch(OTP_REGEX);
      expect(otp).toHaveLength(6);
    }
  });
});

// ── Property 6: OTP Expiry Logic Correctness ──────────────────────────────

// Feature: smart-locker-system, Property 6: OTP expiry logic

/**
 * Helper: create a Firestore-compatible Timestamp from a Unix millisecond value.
 * We use admin.firestore.Timestamp.fromMillis so the test exercises the same
 * type that the production code receives.
 */
function makeTimestamp(ms: number): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.fromMillis(ms);
}

describe("Property 6: OTP Expiry Logic Correctness", () => {
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

  it("should return false for any timestamp within the last 24 hours", () => {
    // Feature: smart-locker-system, Property 6: OTP expiry logic
    // Validates: Requirements 4.1, 4.2
    //
    // Generate an arbitrary offset in (0, 24h) ms before now.
    // isOtpExpired(T) MUST return false — the OTP is still valid.
    fc.assert(
      fc.property(
        // offsetMs ∈ [1, 24h - 1ms] — strictly within the valid window
        fc.integer({ min: 1, max: TWENTY_FOUR_HOURS_MS - 1 }),
        (offsetMs) => {
          const createdAtMs = Date.now() - offsetMs;
          const timestamp = makeTimestamp(createdAtMs);
          expect(isOtpExpired(timestamp)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should return true for any timestamp more than 24 hours in the past", () => {
    // Feature: smart-locker-system, Property 6: OTP expiry logic
    // Validates: Requirements 4.1, 4.2
    //
    // Generate an arbitrary extra offset > 0 beyond the 24-hour boundary.
    // isOtpExpired(T) MUST return true — the OTP has expired.
    fc.assert(
      fc.property(
        // extraMs ∈ [1, 30 days] — any amount past the 24h window
        fc.integer({ min: 1, max: 30 * 24 * 60 * 60 * 1000 }),
        (extraMs) => {
          const createdAtMs = Date.now() - TWENTY_FOUR_HOURS_MS - extraMs;
          const timestamp = makeTimestamp(createdAtMs);
          expect(isOtpExpired(timestamp)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should return false for a timestamp exactly at the 24-hour boundary (edge case)", () => {
    // Feature: smart-locker-system, Property 6: OTP expiry logic
    // Validates: Requirements 4.1, 4.2
    //
    // A timestamp exactly 24 hours ago is NOT yet expired (> 24h is the condition).
    // We allow a small tolerance (±500 ms) for test execution time.
    const createdAtMs = Date.now() - TWENTY_FOUR_HOURS_MS + 500;
    const timestamp = makeTimestamp(createdAtMs);
    expect(isOtpExpired(timestamp)).toBe(false);
  });

  it("should return true for a timestamp exactly 1 ms past the 24-hour boundary", () => {
    // Feature: smart-locker-system, Property 6: OTP expiry logic
    // Validates: Requirements 4.1, 4.2
    //
    // A timestamp 24h + 1ms ago IS expired.
    const createdAtMs = Date.now() - TWENTY_FOUR_HOURS_MS - 1;
    const timestamp = makeTimestamp(createdAtMs);
    expect(isOtpExpired(timestamp)).toBe(true);
  });
});

// ── Property 7: OTP Verification Round-Trip ───────────────────────────────

// Feature: smart-locker-system, Property 7: OTP verification round-trip

describe("Property 7: OTP Verification Round-Trip", () => {
  it("should return true when verifying an OTP against its own hash", async () => {
    // Feature: smart-locker-system, Property 7: OTP verification round-trip
    // Validates: Requirements 3.2, 7.1
    //
    // For any 6-digit OTP string, hashing it and then verifying the same OTP
    // against that hash MUST return true.
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary 6-digit OTP strings (zero-padded)
        fc
          .integer({ min: 0, max: 999_999 })
          .map((n) => n.toString().padStart(6, "0")),
        async (otp) => {
          const hash = await hashOtp(otp);
          const result = await verifyOtp(otp, hash);
          expect(result).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should return false when verifying a different OTP against the hash", async () => {
    // Feature: smart-locker-system, Property 7: OTP verification round-trip
    // Validates: Requirements 3.2, 7.1
    //
    // For any two distinct 6-digit OTP strings otp1 and otp2, verifying otp2
    // against the hash of otp1 MUST return false.
    await fc.assert(
      fc.asyncProperty(
        // Generate two distinct 6-digit OTP integers
        fc
          .tuple(
            fc.integer({ min: 0, max: 999_999 }),
            fc.integer({ min: 0, max: 999_999 }),
          )
          .filter(([a, b]) => a !== b),
        async ([n1, n2]) => {
          const otp1 = n1.toString().padStart(6, "0");
          const otp2 = n2.toString().padStart(6, "0");

          const hash = await hashOtp(otp1);
          const result = await verifyOtp(otp2, hash);
          expect(result).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
