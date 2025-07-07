import { Dispatch, SetStateAction } from "react";
import { MiddlecatUser } from "./types";
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
export default function selfRefreshingAxios(resource: string, access_token: string, refresh_token: string, storeToken: boolean, bff: string | undefined, setUser: Dispatch<SetStateAction<MiddlecatUser | undefined>>): import("axios").AxiosInstance;
