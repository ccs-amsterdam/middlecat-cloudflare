import { z } from "zod";

// MiddleCat only signs users in to a server itself: the client is the resource server (e.g. AmCAT, whose
// backend runs the OIDC flow and sets a session cookie for its frontend). So clients don't need to be registered:
//  - the redirect_uri must be on the same origin as the resource, within the resource path
//    (e.g. resource https://amcat.nl/api, redirect_uri https://amcat.nl/api/auth/callback). Codes can therefore
//    only be delivered to the server that the tokens are for.
//  - the client_id is the server's URL (same origin as the resource). It is the audience of the id_token.
//  - URLs must use https, or http on localhost (for development).

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isLoopback(url: URL): boolean {
  return LOOPBACK_HOSTS.has(url.hostname);
}

export class AuthorizeError extends Error {}

/** Parse a URL that we would send codes to or bind tokens to. https, or http on loopback. */
function parseSafeUrl(value: string, name: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AuthorizeError(`${name} is not a valid URL`);
  }
  if (url.username || url.password) throw new AuthorizeError(`${name} cannot contain credentials`);
  if (url.protocol === "https:") return url;
  if (url.protocol === "http:" && isLoopback(url)) return url;
  throw new AuthorizeError(`${name} must use https (or http on localhost)`);
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

/** The redirect_uri must be on the resource's origin, within the resource path */
export function checkRedirectUri(redirectUrl: URL, resourceUrl: URL) {
  if (redirectUrl.origin !== resourceUrl.origin) {
    throw new AuthorizeError(
      "redirect_uri must be on the same origin as the resource (MiddleCat only signs users in to the server itself)",
    );
  }
  const base = resourceUrl.pathname.replace(/\/+$/, "");
  if (base && redirectUrl.pathname !== base && !redirectUrl.pathname.startsWith(base + "/")) {
    throw new AuthorizeError(`redirect_uri must be within the resource path (${base})`);
  }
}

/** The client_id must be the server's URL: same origin as the resource */
export function checkClientId(clientId: string, resourceUrl: URL): string {
  const clientUrl = parseHttpUrl(clientId);
  if (!clientUrl || clientUrl.origin !== resourceUrl.origin) {
    throw new AuthorizeError("client_id must be the URL of the server (same origin as the resource)");
  }
  return clientId;
}

const PROMPT_VALUES = new Set(["none", "login", "consent"]);

const paramsSchema = z.object({
  client_id: z.string().min(1, "client_id is missing").max(200),
  redirect_uri: z.string().min(1, "redirect_uri is missing").max(2000),
  resource: z.string().min(1, "resource is missing").max(200),
  code_challenge: z
    .string()
    .min(43, "code_challenge is missing or too short")
    .max(128)
    .regex(/^[A-Za-z0-9\-._~]+$/, "code_challenge is not valid"),
  code_challenge_method: z.literal("S256", "only the S256 code_challenge_method is supported").optional(),
  response_type: z.literal("code", "only response_type=code is supported").optional(),
  state: z.string().max(1000).optional(),
  nonce: z.string().max(1000).optional(),
  scope: z.string().max(200).optional(),
  prompt: z.string().max(100).optional(),
  max_age: z.string().regex(/^\d+$/, "max_age must be a number of seconds").optional(),
});

export interface AuthorizeRequest {
  /** origin of the server, e.g. https://amcat.nl */
  server: string;
  clientId: string;
  redirectUri: string;
  redirectUrl: URL;
  resource: string;
  resourceUrl: URL;
  codeChallenge: string;
  state?: string;
  nonce?: string;
  scope: string;
  /** OIDC prompt values: none, login, consent */
  prompt: Set<string>;
  /** maximum age of the user's login, in seconds (OIDC max_age) */
  maxAge?: number;
  /** server running on the user's own computer (localhost, during development) */
  localServer: boolean;
}

/**
 * Validate the /authorize query parameters. Throws AuthorizeError with a message
 * that can be shown to the user.
 */
export function parseAuthorizeRequest(query: Record<string, string>): AuthorizeRequest {
  const parsed = paramsSchema.safeParse(query);
  if (!parsed.success) throw new AuthorizeError(parsed.error.issues[0]?.message || "Invalid request");
  const p = parsed.data;

  const redirectUrl = parseSafeUrl(p.redirect_uri, "redirect_uri");
  if (redirectUrl.hash) throw new AuthorizeError("redirect_uri cannot contain a fragment");
  const resourceUrl = parseSafeUrl(p.resource, "resource");
  checkRedirectUri(redirectUrl, resourceUrl);
  const clientId = checkClientId(p.client_id, resourceUrl);

  const prompt = new Set((p.prompt || "").split(" ").filter(Boolean));
  for (const value of prompt) {
    if (!PROMPT_VALUES.has(value)) throw new AuthorizeError(`prompt=${value} is not supported`);
  }
  if (prompt.has("none") && prompt.size > 1) throw new AuthorizeError("prompt=none can't be combined with other values");

  return {
    server: resourceUrl.origin,
    clientId,
    redirectUri: p.redirect_uri,
    redirectUrl,
    resource: p.resource,
    resourceUrl,
    codeChallenge: p.code_challenge,
    state: p.state,
    nonce: p.nonce,
    scope: p.scope || "openid",
    prompt,
    maxAge: p.max_age !== undefined ? Number(p.max_age) : undefined,
    localServer: isLoopback(resourceUrl),
  };
}
