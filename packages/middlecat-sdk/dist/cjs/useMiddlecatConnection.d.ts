import { Middlecat } from "./types";
/**
 * Log in to MiddleCat and create a user to accessing the specified resource.
 * The MiddlecatUser object contains basic user info (name, email, image) and
 * an axios instance called "api" that can be used to make requests to the
 * resource api. Requests already have the resource set as the baseURL, and
 * access_tokens are automatically added.
 *
 * Authentication at the API works with bearer tokens (it is not certain that the
 * client and server are on the same site, so we cannot use secure samesite cookies).
 * In the current flow, a connection has to be made on every new login or page refresh,
 * because we do not want to store tokens in localstorage. We do still need to keep
 * the tokens in memory, but to mitigate risks the tokens are kept in a closure and
 * added to the axios call. Also, we use short-lived access tokens with
 * rotating refresh tokens and re-use detection.
 *
 * The securest option is to use a backend-for-frontend (BFF) to intercept the refresh
 * token and store it in a secure httpOnly cookie. This requires a backend server that
 * is on same domain (more specifically, samesite) as the client.
 *
 * @param onFinishOauth Callback function to be called when the oauth flow is finished. can be used to cleanup the "code" and "state" paramaters
 * @param autoConnect If user did not log out, automatically reconnect on next visit. default is true
 * @param storeToken    If TRUE, store the refresh token. This is less secure, but lets users persist connection across sessions.
 * @param bff           If a samesite BFF is available, provide the endpoint url here to intercept the refresh token.
 * @param fixedResource If you want to use a fixed resource, provide it here. Otherwise, the user will be asked to choose a resource.
 * @returns
 */
interface useMiddlecatParams {
    onFinishOauth: () => void;
    autoConnect?: boolean;
    storeToken?: boolean;
    bff?: string;
    fixedResource?: string;
}
export default function useMiddlecatConnection({ onFinishOauth, autoConnect, // If user did not log out, automatically reconnect on next visit
storeToken, // Stores refresh token in localstorage to persist across sessions, at the cost of making them more vulnerable to XSS
bff, // use backend-for-frontend to intercept refresh token for better security. Requires setting up a bff endpoint,
fixedResource, }: useMiddlecatParams): Middlecat;
export {};
