import { auth } from "@/auth/auth";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "edge";

const EmailSchema = z.object({
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

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Need to be signed in" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const email = EmailSchema.safeParse(body);

  if (!email.success) {
    return NextResponse.json({ error: "No email provided" }, { status: 400 });
  }
  try {
    await sendEmail(email.data);
  } catch (e) {
    return NextResponse.json({ error: "Server Error", status: 500 });
  }
  return NextResponse.json({ status: 200 });
}

async function sendEmail(email: Email) {
  const resp = await fetch(
    new Request("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(prepareEmail(email)),
    })
  );
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
