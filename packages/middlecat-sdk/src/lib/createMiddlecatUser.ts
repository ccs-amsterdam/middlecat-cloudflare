import jwtDecode from "jwt-decode";
import { Dispatch, SetStateAction } from "react";
import { killMiddlecatSession } from "./middlecatOauth";
import selfRefreshingAxios from "./selfRefreshingAxios";
import { AccessTokenPayload, MiddlecatUser } from "./types";

/**
 *
 * @param access_token
 * @param refresh_token
 * @param storeToken
 * @param setUser        includes setUser so that it can set state to undefined if refresh fails or session is killed
 * @returns
 */
export function createMiddlecatUser(
  access_token: string,
  refresh_token: string,
  storeToken: boolean,
  bff: string | undefined,
  resource: string | undefined,
  setUser: Dispatch<SetStateAction<MiddlecatUser | undefined>>
): MiddlecatUser | undefined {
  if (!access_token) return undefined;
  const payload: AccessTokenPayload = jwtDecode(access_token);

  const api = selfRefreshingAxios(
    payload.resource,
    access_token,
    refresh_token,
    storeToken,
    bff,
    setUser
  );
  const killSession = async (signOutMiddlecat: boolean) =>
    killMiddlecatSession(
      payload.middlecat,
      refresh_token,
      signOutMiddlecat,
      payload.resource,
      bff,
      setUser
    );

  return {
    email: payload.email || "",
    name: payload.name || "",
    image: payload.image || "",
    authenticated: payload.email ? true : false,
    api,
    resource: resource || "",
    middlecat: payload.middlecat,
    killSession,
  };
}
