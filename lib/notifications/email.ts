import { Resend } from "resend";
import { getEnv } from "@/lib/env";

let cached: Resend | null = null;

function getResend(): Resend | null {
  const env = getEnv();
  if (!env.RESEND_API_KEY) return null;
  if (cached) return cached;
  cached = new Resend(env.RESEND_API_KEY);
  return cached;
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const env = getEnv();
  const client = getResend();
  if (!client) {
    // Dev fallback: log instead of failing the order flow.
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[email] RESEND_API_KEY missing — would send:", payload.subject, "→", payload.to);
    }
    return;
  }
  await client.emails.send({
    from: env.EMAIL_FROM,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    replyTo: payload.replyTo,
  });
}
