import axios from "axios";
import { Dispatch, SetStateAction } from "react";
import { MiddlecatUser } from "./types";

/**
 *
 * @param access_token
 * @param refresh_token
 * @param storeToken
 * @param setUser        includes setUser so that it can set state to undefined if refresh fails or session is killed
 * @returns
 */
export function createGuestUser(
  resource: string,
  setUser: Dispatch<SetStateAction<MiddlecatUser | undefined>>,
  middlecat_url?: string
): MiddlecatUser | undefined {
  if (!resource) return undefined;

  const api = axios.create({
    baseURL: resource,
  });

  const killSession = async (signOutMiddlecat: boolean) => setUser(undefined);

  return {
    email: "",
    name: "",
    image: "",
    authenticated: false,
    api,
    resource: resource || "",
    middlecat: middlecat_url || "",
    killSession,
  };
}
