/**
 * If useMiddlecat is used on a client that has a samesite backend, the backend
 * can be used to secure the refresh token. This handler should then be
 * put at an endpoint (like api/bffAuth), and in useMiddlecat the settings
 * bff should be set to this endpoint (e.g., bff = '/api/bffAuth')
 *
 * To secure the refresh_token, this handler intercepts the
 * authorization_code, refresh_token and kill_session grant flows. The refresh
 * token is then not returned directly to the client application, but split into
 * an 'id' and 'secret' component. The refresh_id is returned
 *
 * We didn't properly type the req, res and cookies due to issues with including this as dependencies,
 * but it should work with normal node http handlers and Next handlers.
 *
 * @param req      Node (or Next) request
 * @param res      Node (or Next) response
 * @param cookies  Cookies objects created with new Cookies(req, res) (using the 'cookies' package)
 * @param maxAge   Max age in milliseconds that the cookie stays valid (regardless of expiration date of refresh token)
 * @param secure   secure flag in cookie. By default false (note that cookies are always httpOnly and samesite=strict)
 * @returns
 */
export default async function bffAuthHandler(
  req: any,
  res: any,
  cookies: any,
  maxAge: number = 60 * 60 * 24 * 30 * 1000, // 30 days
  secure: boolean = false
) {
  try {
    // base64 encode resource and middlecat_url so it can be used in cookie name.
    // required so that there can be multiple resource sessions at the same time,
    // and ensures that refresh token is only returned to the middlecat it came from
    const name64 = Buffer.from(req.body.resource + "." + req.body.middlecat_url).toString("base64");
    const refreshCookie = "refresh_" + name64;

    // if bff auth is used, request will not contain the full refresh_token.
    // Middlecat refresh tokens are composed of a unique (cuid) 'id', and
    // a cryptographic random 'secret'. The id is stored in localstorage, and the
    // secret is stored in a httponly samesite cookie. Both parts are needed to
    // get an access token (refresh_token grant) or kill a session.
    if (req.body.grant_type === "refresh_token" || req.body.grant_type === "kill_session")
      req.body.refresh_token = req.body.refresh_id + "." + cookies.get(refreshCookie) || "";

    const tokens_res = await fetch(req.body.middlecat_url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    const tokens = await tokens_res.json();

    const refresh_token = tokens.refresh_token || ".";
    const [refresh_id, refresh_secret] = refresh_token.split(".");

    cookies.set(refreshCookie, refresh_secret, {
      secure,
      httpOnly: true,
      sameSite: "strict",
      maxAge,
    });

    // remove refresh_token from response, so that it is not returned to the client
    tokens.refresh_token = null;
    // return only the 'id' part of the refresh token
    tokens.refresh_id = refresh_id;

    return res.status(200).json(tokens);
  } catch (e: any) {
    console.log(e);
    return res.status(500).json({ error: e.message });
  }
}
