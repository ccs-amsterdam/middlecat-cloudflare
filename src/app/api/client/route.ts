import { getDb } from "@/drizzle/db";
import { NextResponse } from "next/server";
import z from "zod";

const db = getDb();

const bodySchema = z.object({
  client_id: z.string().max(200),
  client_secret: z.string().max(200).nullish(),
});

/**
 * Creates an AmCAT session.
 * if oauth is true, returns the authCode and state.
 * Otherwise, immediately returns the tokens
 */
export async function POST(req: Request) {
  const bodyValidator = bodySchema.safeParse(await req.json());
  if (!bodyValidator.success) {
    return NextResponse.json(
      { error: "Invalid request body", zod: bodyValidator.error },
      { status: 400 },
    );
  }
  const { client_id, client_secret } = bodyValidator.data;

  // Look up client in database.
  // If record has secret, also check secret

  const res = { registered: true, resource: "resource_url", redirect_uris: [] };
}
