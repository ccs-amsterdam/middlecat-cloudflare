import { Dispatch, SetStateAction } from "react";
import axios from "axios";
import { AccessTokenPayload, MiddlecatUser } from "./types";
import jwtDecode from "jwt-decode";
import { refreshToken } from "./middlecatOauth";

interface Tokens {
  access_token: string;
  refresh_token: string;
}

/**
 * Creates an axios instance for making api requests to the AmCAT server.
 * The tokens are stored in the closure, and are automatically refreshed
 * when a request is made and the access token is about to expire.
 *
 * @param middlecat
 * @param resource
 * @param access_token
 * @param refresh_token
 * @returns
 */
export default function selfRefreshingAxios(
  resource: string,
  access_token: string,
  refresh_token: string,
  storeToken: boolean,
  bff: string | undefined,
  setUser: Dispatch<SetStateAction<MiddlecatUser | undefined>>
) {
  const api = axios.create();

  // use in intercepter as closure
  let currentAccessToken = access_token;
  let currentRefreshToken = refresh_token;
  let getTokensPromise: Promise<Tokens> | undefined;
  if (storeToken) localStorage.setItem(`${resource}_refresh`, currentRefreshToken);

  async function requestInterceptor(config: any) {
    // ensure that resource is the base url, so that its not easy to
    // to send a request with the tokens somewhere else
    config.baseURL = resource;

    // If there is no access_token, this is a guest session
    if (!currentAccessToken) return config;

    // If there is an access_token, see if it's still valid and if not refresh
    try {
      // to prevent parallel calls to the refresh token endpoint, we store the
      // promise in getTokensPromise and return that promise if it exists.
      if (!getTokensPromise)
        getTokensPromise = getTokens(currentAccessToken, currentRefreshToken, resource, storeToken, bff);
      const { access_token, refresh_token } = await getTokensPromise;
      getTokensPromise = undefined;

      currentAccessToken = access_token;
      currentRefreshToken = refresh_token;
      if (!currentAccessToken) {
        setUser(undefined);
        throw new Error("Could not refresh token");
      }

      config.headers.Authorization = `Bearer ${currentAccessToken}`;
    } catch (e) {
      console.error(e);
    }

    return config;
  }

  api.interceptors.request.use(requestInterceptor, function (error) {
    Promise.reject(error);
  });

  return api;
}

/**
 * Checks if access token is about to expire. If so, we first refresh the tokens.
 */
async function getTokens(
  access_token: string,
  refresh_token: string,
  resource: string,
  storeToken: boolean,
  bff?: string
): Promise<Tokens> {
  // We need to prevent multiple calls to the refresh token endpoint. So if
  // there is already a call to the refresh token endpoint ongoing, we return
  // that promise.

  const payload: AccessTokenPayload = jwtDecode(access_token);

  const now = Date.now() / 1000;
  const nearfuture = now + 10; // refresh x seconds before expires
  if (payload.exp != null && payload.exp < nearfuture) {
    const tokens = await refreshToken(payload.middlecat, refresh_token, resource, bff);
    if (storeToken && !bff) localStorage.setItem(`${resource}_refresh`, tokens.refresh_token);
    return tokens;
  } else {
    return { access_token, refresh_token };
  }
}
