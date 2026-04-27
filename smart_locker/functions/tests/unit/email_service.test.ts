import { composeEmailBody, sendOtpEmail } from "../../src/email_service";

// Mock nodemailer for unit tests
const mockSendMail = jest.fn();

jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSendMail.mockReset();
  // Reset environment variables
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.SMTP_FROM;
});

describe("composeEmailBody", () => {
  it("should include the 6-digit OTP in the email body", () => {
    const emailBody = composeEmailBody("123456", "locker-01");
    expect(emailBody).toContain("123456");
  });

  it("should include the locker identifier in the email body", () => {
    const emailBody = composeEmailBody("123456", "locker-01");
    expect(emailBody).toContain("locker-01");
  });

  it("should include a greeting and expiration notice", () => {
    const emailBody = composeEmailBody("000000", "locker-abc");
    expect(emailBody).toContain("Hello");
    expect(emailBody).toContain("24 hours");
  });

  it("should handle OTPs with leading zeros correctly", () => {
    const emailBody = composeEmailBody("001234", "locker-07");
    expect(emailBody).toContain("001234");
    expect(emailBody).toContain("locker-07");
  });
});

describe("sendOtpEmail", () => {
  // Increase timeout for retry tests (10 seconds per retry * 3 retries = 30 seconds)
  jest.setTimeout(35000);

  it("should return success when email is sent on first attempt", async () => {
    mockSendMail.mockResolvedValue({ messageId: "msg-123" });

    const result = await sendOtpEmail({
      email: "user@example.com",
      otp: "123456",
      lockerId: "locker-01",
    });

    expect(result).toEqual({ success: true });
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it("should retry up to 3 times on failure and succeed on second attempt", async () => {
    // First call fails, second call succeeds
    mockSendMail
      .mockRejectedValueOnce(new Error("SMTP connection failed"))
      .mockResolvedValueOnce({ messageId: "msg-123" });

    const result = await sendOtpEmail({
      email: "user@example.com",
      otp: "123456",
      lockerId: "locker-01",
    });

    expect(result).toEqual({ success: true });
    expect(mockSendMail).toHaveBeenCalledTimes(2);
  });

  it("should retry up to 3 times on failure and succeed on third attempt", async () => {
    // First two calls fail, third call succeeds
    mockSendMail
      .mockRejectedValueOnce(new Error("SMTP connection failed"))
      .mockRejectedValueOnce(new Error("SMTP timeout"))
      .mockResolvedValueOnce({ messageId: "msg-123" });

    const result = await sendOtpEmail({
      email: "user@example.com",
      otp: "123456",
      lockerId: "locker-01",
    });

    expect(result).toEqual({ success: true });
    expect(mockSendMail).toHaveBeenCalledTimes(3);
  });

  it("should return EMAIL_DELIVERY_FAILED after 3 consecutive failures", async () => {
    // All three attempts fail
    mockSendMail
      .mockRejectedValueOnce(new Error("SMTP connection failed"))
      .mockRejectedValueOnce(new Error("SMTP timeout"))
      .mockRejectedValueOnce(new Error("SMTP authentication error"));

    const result = await sendOtpEmail({
      email: "user@example.com",
      otp: "123456",
      lockerId: "locker-01",
    });

    expect(result).toEqual({
      success: false,
      error: "EMAIL_DELIVERY_FAILED",
    });
    expect(mockSendMail).toHaveBeenCalledTimes(3);
  });

  it("should wait 10 seconds between retry attempts", async () => {
    jest.useFakeTimers();

    mockSendMail
      .mockRejectedValueOnce(new Error("SMTP connection failed"))
      .mockResolvedValueOnce({ messageId: "msg-123" });

    const sendOtpEmailPromise = sendOtpEmail({
      email: "user@example.com",
      otp: "123456",
      lockerId: "locker-01",
    });

    // Wait for the first attempt to fail
    await Promise.resolve();

    // Fast-forward time to skip the 10-second delay
    await jest.advanceTimersByTimeAsync(10_000);

    // Wait for the promise to resolve
    const result = await sendOtpEmailPromise;

    expect(result).toEqual({ success: true });
    expect(mockSendMail).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  it("should compose email with correct OTP and lockerId", async () => {
    mockSendMail.mockResolvedValue({ messageId: "msg-123" });

    await sendOtpEmail({
      email: "user@example.com",
      otp: "654321",
      lockerId: "locker-abc",
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringMatching(/654321.*locker-abc|locker-abc.*654321/s),
      }),
    );
  });

  it("should trim email address before sending", async () => {
    mockSendMail.mockResolvedValue({ messageId: "msg-123" });

    await sendOtpEmail({
      email: "  user@example.com  ",
      otp: "123456",
      lockerId: "locker-01",
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
      }),
    );
  });
});
