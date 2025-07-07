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
export default function bffAuthHandler(req: any, res: any, cookies: any, maxAge?: number, // 30 days
secure?: boolean): Promise<any>;
