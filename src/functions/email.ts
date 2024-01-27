import { z } from "zod";
export const runtime = "edge";

// Send email via MailChannels. Only works from within a CloudFlare Worker.

export const EmailSchema = z.object({
  toName: z.string().optional(),
  toEmail: z.string().email(),
  subject: z.string(),
  text: z.string().optional(),
  html: z.string().optional(),
});
type Email = z.infer<typeof EmailSchema>;

type Address = { email: string; name?: string };
type Content = { type: "text/plain" | "text/html"; value: string };

interface MailChannelsEmail {
  personalizations: { to: Address }[];
  from: Address;
  subject: string;
  content: Content[];
}

export async function sendEmail(email: Email) {
  const resp = await fetch(
    new Request("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(prepareEmail(email)),
    })
  );

  if (Math.floor(resp.status / 100) !== 2) {
    throw new Error(`Error sending email: ${resp.status} ${resp.statusText}`);
  }
}

function prepareEmail(email: Email): MailChannelsEmail {
  const content: Content[] = [];
  if (email.text) content.push({ type: "text/plain", value: email.text });
  if (email.html) content.push({ type: "text/html", value: email.html });

  return {
    personalizations: [{ to: { email: email.toEmail, name: email.toName } }],
    from: { email: "noreplay@middlecat.net", name: "MiddleCat" },
    subject: email.subject,
    content,
  };
}
