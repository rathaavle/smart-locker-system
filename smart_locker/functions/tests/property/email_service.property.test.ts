import * as fc from "fast-check";
import { composeEmailBody } from "../../src/email_service";

// ── Property 22: Email Content Completeness ───────────────────────────────

// Feature: smart-locker-system, Property 22: Email content

describe("Property 22: Email Content Completeness", () => {
  it("should contain both OTP and lockerId for any (otp, lockerId) pair", () => {
    // Feature: smart-locker-system, Property 22: Email content
    // Validates: Requirements 12.1
    //
    // For any arbitrary (otp, lockerId) pair passed to composeEmailBody,
    // the resulting email body MUST contain both the OTP string and the
    // locker identifier string.
    fc.assert(
      fc.property(
        fc.record({
          otp: fc
            .integer({ min: 0, max: 999_999 })
            .map((n) => n.toString().padStart(6, "0")),
          lockerId: fc
            .string({ minLength: 1, maxLength: 20 })
            .map((s) => `locker-${s.replace(/[^a-z0-9]/gi, "x").slice(0, 10)}`),
        }),
        ({ otp, lockerId }) => {
          const emailBody = composeEmailBody(otp, lockerId);

          // Email body must contain the OTP
          expect(emailBody).toContain(otp);

          // Email body must contain the locker identifier
          expect(emailBody).toContain(lockerId);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should contain the OTP in a clearly marked section for any 6-digit value", () => {
    // Feature: smart-locker-system, Property 22: Email content
    // Validates: Requirements 12.1
    //
    // The OTP should appear in a predictable format (e.g., "Your OTP is: 123456")
    // so that users can easily identify it.
    fc.assert(
      fc.property(
        fc
          .integer({ min: 0, max: 999_999 })
          .map((n) => n.toString().padStart(6, "0")),
        (otp) => {
          const emailBody = composeEmailBody(otp, "locker-01");

          // OTP should appear after "OTP is:" or similar marker
          expect(emailBody).toMatch(/OTP.*?:.*?\d{6}/i);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should contain the lockerId in a descriptive context for any locker identifier", () => {
    // Feature: smart-locker-system, Property 22: Email content
    // Validates: Requirements 12.1
    //
    // The lockerId should appear in a readable context (e.g., "for locker ABC123")
    // so users know which locker the OTP is for.
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: 20 })
          .map((s) => `locker-${s.replace(/[^a-z0-9]/gi, "x").slice(0, 10)}`),
        (lockerId) => {
          const emailBody = composeEmailBody("123456", lockerId);

          // Locker ID should appear in a context like "for locker XXX"
          expect(emailBody).toMatch(/locker.*?:?.*?[\s-]?\d+/i);
        },
      ),
      { numRuns: 100 },
    );
  });
});
