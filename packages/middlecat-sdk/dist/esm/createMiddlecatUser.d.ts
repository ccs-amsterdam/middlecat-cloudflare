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
export declare function createMiddlecatUser(access_token: string, refresh_token: string, storeToken: boolean, bff: string | undefined, resource: string | undefined, setUser: Dispatch<SetStateAction<MiddlecatUser | undefined>>): MiddlecatUser | undefined;
