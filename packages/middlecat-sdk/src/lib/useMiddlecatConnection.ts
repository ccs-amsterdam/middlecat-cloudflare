import {
  useCallback,
  useState,
  Dispatch,
  SetStateAction,
  useEffect,
  useRef,
} from "react";
import { prepareURL } from "./util";
import { authorizationCode, authorize } from "./middlecatOauth";
import { Middlecat, MiddlecatUser } from "./types";
import { createMiddlecatUser } from "./createMiddlecatUser";
import { refreshToken } from "./middlecatOauth";
import { createGuestUser } from "./createGuestUser";
import axios from "axios";

// This hook is to be used in React applications using middlecat

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

export default function useMiddlecatConnection({
  onFinishOauth,
  autoConnect = true, // If user did not log out, automatically reconnect on next visit
  storeToken = false, // Stores refresh token in localstorage to persist across sessions, at the cost of making them more vulnerable to XSS
  bff = undefined, // use backend-for-frontend to intercept refresh token for better security. Requires setting up a bff endpoint,
  fixedResource = undefined, // If you want to use a fixed resource, provide it here. Otherwise, the user will be asked to choose a resource.
}: useMiddlecatParams): Middlecat {
  const runOnce = useRef(true);
  const [user, setUser] = useState<MiddlecatUser>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const signIn = useCallback(
    async (resource?: string, middlecat_url?: string) => {
      // OAuth action 1. Redirects to middlecat, which will redirect back with code and state
      // parameters. This triggers the authorizationCode flow.
      setError("");

      if (!resource && !fixedResource) {
        setError("No resource specified");
        return;
      }

      let r = prepareURL(resource || fixedResource || "");
      if (!r) return;
      setLoading(true);
      return authorize(r, middlecat_url)
        .then((middlecat_redirect) => {
          localStorage.setItem("resource", r);
          localStorage.setItem("awaiting_oauth_redirect", "true");
          window.location.href = middlecat_redirect;
        })
        .catch((e) => {
          setError(
            e.message.includes("timeout")
              ? "Timeout exceeded"
              : "Could not connect to server"
          );
          setTimeout(() => setError(""), 3000);
          console.error(e);
          setLoading(false);
        });
    },
    [fixedResource]
  );

  const signInGuest = useCallback(
    async (resource?: string, middlecat_url?: string) => {
      setError("");

      if (!resource && !fixedResource) {
        setError("No resource specified");
        return;
      }

      let r = prepareURL(resource || fixedResource || "");
      localStorage.setItem("resource", r);

      if (middlecat_url) {
        setUser(createGuestUser(r, setUser, middlecat_url));
        return;
      }

      setLoading(true);
      return axios
        .get(`${r}/config`, { timeout: 5000 })
        .then((res) => {
          setUser(createGuestUser(r, setUser, res.data.middlecat_url));
        })
        .catch((e) => {
          console.error(e);
          setError("Could not connect to server");
        })
        .finally(() => setLoading(false));
    },
    [fixedResource]
  );

  const signOut = useCallback(
    async (signOutMiddlecat: boolean = false) => {
      setLoading(true);
      const resource = localStorage.getItem("resource");
      localStorage.removeItem(resource + "_refresh");
      localStorage.removeItem("resource");
      if (!user) return;

      user
        .killSession(signOutMiddlecat)
        .catch((e: Error) => console.error(e))
        .finally(() => {
          setLoading(false);
          if (fixedResource) {
            setUser(createGuestUser(fixedResource, setUser, user.middlecat));
          } else {
            setUser(undefined);
          }
        });
    },
    [user, fixedResource]
  );

  useEffect(() => {
    // This runs once on mount, and can do two things:
    // - resume an OAuth flow
    // - resume an existing connection to a resource
    if (!runOnce.current) return;
    runOnce.current = false;

    const resource = prepareURL(
      fixedResource || localStorage.getItem("resource") || ""
    );
    if (!resource) {
      setLoading(false);
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const inFlow = localStorage.getItem("awaiting_oauth_redirect") === "true";
    localStorage.setItem("awaiting_oauth_redirect", "false");

    // If in oauth flow and code and state parameters are given, complete the oauth flow.
    // (the inFlow shouldn't be needed since we remove the URL parameters, but this somehow
    //  doesn't work when useMiddlecat is imported in nextJS. so this is just to be sure)
    if (inFlow && code && state) {
      //silentDeleteSearchParams(["code", "state"]);
      connectWithAuthGrant(
        resource,
        code,
        state,
        storeToken,
        bff,
        setUser,
        setLoading
      ).then(onFinishOauth);
      return;
    }

    if (!autoConnect) {
      setLoading(false);
      return;
    }

    resumeConnection(resource, storeToken, bff, setUser)
      .catch((e) => {
        console.error(e);
        setError(`could not connect to ${resource}`);
      })
      .finally(() => setLoading(false));
  }, [autoConnect, storeToken, signIn, bff, fixedResource, onFinishOauth]);

  return {
    user,
    loading,
    error,
    fixedResource,
    signIn,
    signInGuest,
    signOut,
  };
}

async function connectWithAuthGrant(
  resource: string,
  code: string,
  state: string,
  storeToken: boolean,
  bff: string | undefined,
  setUser: Dispatch<SetStateAction<MiddlecatUser | undefined>>,
  setLoading: Dispatch<SetStateAction<boolean>>
) {
  await authorizationCode(resource, code, state, bff)
    .then(({ access_token, refresh_token }) => {
      const user = createMiddlecatUser(
        access_token,
        refresh_token,
        storeToken,
        bff,
        resource,
        setUser
      );
      localStorage.setItem("resource", resource);
      setUser(user);
    })
    .catch((e) => {
      console.error(e);
    })
    .finally(() => {
      setLoading(false);
    });
}

async function resumeConnection(
  resource: string,
  storeToken: boolean,
  bff: string | undefined,
  setUser: Dispatch<SetStateAction<MiddlecatUser | undefined>>
) {
  const middlecat = localStorage.getItem(resource + "_middlecat") || "";

  // check server, because config might have changed
  let res;
  try {
    res = await axios.get(`${prepareURL(resource)}/config`, {
      timeout: 5000,
    });
  } catch (e) {
    console.error(e);
  }
  if (!res || res.status !== 200) {
    throw new Error("Could not get config from resource");
  }

  if (res.data.authorization === "no_auth") {
    setUser(createGuestUser(resource, setUser));
    return null;
  }

  const local_refresh_token =
    storeToken && !bff ? localStorage.getItem(resource + "_refresh") : "";

  try {
    const { access_token, refresh_token } = await refreshToken(
      middlecat,
      local_refresh_token || "",
      resource,
      bff
    );
    if (access_token) {
      const user = createMiddlecatUser(
        access_token,
        refresh_token,
        storeToken,
        bff,
        resource || "",
        setUser
      );
      setUser(user);
      return null;
    }
  } catch (e) {
    console.error(e);
    localStorage.removeItem(resource + "_refresh");
  }

  setUser(createGuestUser(resource, setUser));
}
