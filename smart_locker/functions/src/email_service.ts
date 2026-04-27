// nodemailer import will be used in Task 6 implementation
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as _nodemailer from "nodemailer";

export interface EmailParams {
  email: string;
  otp: string;
  lockerId: string;
}

export interface EmailResult {
  success: boolean;
  error?: string;
}

export function composeEmailBody(otp: string, lockerId: string): string {
  // TODO: implement in Task 6
  throw new Error("Not implemented");
}

export async function sendOtpEmail(params: EmailParams): Promise<EmailResult> {
  // TODO: implement in Task 6
  throw new Error("Not implemented");
}
