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
export declare function createGuestUser(resource: string, setUser: Dispatch<SetStateAction<MiddlecatUser | undefined>>, middlecat_url?: string): MiddlecatUser | undefined;
