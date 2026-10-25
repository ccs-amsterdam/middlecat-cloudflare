import { Resend } from "resend";
import { Bindings } from "../env";

// Sends email with Cloudflare Email Service (the EMAIL send_email binding) if configured, otherwise with Resend.

const DEFAULT_FROM = "MiddleCat <signin@middlecat.net>";

export function emailConfigured(env: Bindings) {
  return !!(env.EMAIL && env.EMAIL_FROM) || !!env.RESEND_API_KEY;
}

export async function sendEmail(env: Bindings, message: { to: string; subject: string; html: string; text: string }) {
  if (env.EMAIL && env.EMAIL_FROM) {
    await env.EMAIL.send({ from: env.EMAIL_FROM, ...message });
    return;
  }
  if (env.RESEND_API_KEY) {
    const response = await new Resend(env.RESEND_API_KEY).emails.send({
      from: env.EMAIL_FROM || DEFAULT_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    if (response.error) throw new Error(`Could not send email: ${response.error.name}`);
    return;
  }
  throw new Error("No email provider configured");
}
