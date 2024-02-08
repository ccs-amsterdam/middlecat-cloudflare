"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { DefaultSession } from "next-auth";
import { FaUser } from "react-icons/fa";
import getResourceConfig from "@/functions/getResourceConfig";
import { useState } from "react";
import useCsrf from "@/query/useCsrf";
import { Loading } from "@/components/Loading";
import { z } from "zod";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ErrorMsg } from "@/components/ErrorMsg";
import SignIn from "@/components/SignIn";

export default function Authorize() {
  const { data: csrfToken, isLoading: csrfLoading } = useCsrf();
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  function SwitchComponent() {
    if (status === "loading") return <Loading />;
    if (status === "unauthenticated" || !session) return <SignIn />;
    return <ConfirmConnectRequest session={session} csrfToken={csrfToken} />;
  }

  return (
    <div className="Container">
      <style jsx>{`
        .Container {
          margin: auto;
          width: 100%;
          max-width: 500px;
          padding: 0rem 1rem;
          backdrop-filter: blur(3px);
          border-radius: 10px;
          position: relative;
          display: flex;
          flex-direction: column;
        }
      `}</style>

      <SwitchComponent />
    </div>
  );
}

interface ConfirmConnectRequestProps {
  session: DefaultSession;
  csrfToken: string | undefined;
}

function ConfirmConnectRequest({ session, csrfToken }: ConfirmConnectRequestProps) {
  const user = session.user;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  const client_id = searchParams.get("client_id");
  const redirect_uri = searchParams.get("redirect_uri");
  const state = searchParams.get("state");
  const code_challenge = searchParams.get("code_challenge");
  const resource = searchParams.get("resource");
  const scope = searchParams.get("scope") || "default";
  const session_type = searchParams.get("session_type") || "";
  const refresh_mode = searchParams.get("refresh_mode") || "";
  const expires_in = searchParams.has("expires_in_sec") ? Number(searchParams.get("expires_in_sec")) : null;

  if (!client_id) return <ErrorMsg>Client ID is missing</ErrorMsg>;
  if (!redirect_uri) return <ErrorMsg>Redirect URI is missing</ErrorMsg>;
  if (!state) return <ErrorMsg>State is missing</ErrorMsg>;
  if (!code_challenge) return <ErrorMsg>Code challenge is missing</ErrorMsg>;
  if (!resource) return <ErrorMsg>Resource is missing</ErrorMsg>;

  const clientURL = new URL(redirect_uri);
  const serverURL = new URL(resource);

  const type = session_type === "api_key" ? "apiKey" : "browser";
  const refresh_rotate = refresh_mode !== "static";

  const clientLabel = type === "browser" ? clientURL.host : client_id;
  const localhost = /^localhost/.test(clientURL.host);
  let clientNote = "";
  if (localhost) {
    clientNote = `This authorization request comes from your own device, so we cannot verify its legitimacy. Only authorize if you yourself initiated this authorization request.`;
  } else {
    clientNote = `${clientLabel} is an unregistered web application. Only authorize if you know and trust this website.`;
  }

  if (type === "browser") {
    if (!refresh_rotate) return <ErrorMsg>Browser sessions cannot disable refresh token rotation.</ErrorMsg>;
    if (expires_in) return <ErrorMsg>Browser sessions cannot set custom expire_in time</ErrorMsg>;
  }

  const acceptToken = () => {
    setLoading(true);
    createAmcatSession({
      clientId: client_id,
      redirectUri: redirect_uri,
      resource,
      state,
      codeChallenge: code_challenge,
      scope,
      type,
      refreshRotate: refresh_rotate,
      expiresIn: expires_in,
      csrfToken: csrfToken,
    })
      .then((response_url) => {
        router.push(response_url);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
        //router.reload(); // harmless and refreshes csrf token (which is often the problem)
      });
  };

  return (
    <div className="ConfirmConnection">
      <style jsx>{`
        .ConfirmConnection {
          display: flex;
          justify-content: space-evenly;
          flex-direction: column;
          padding: 1rem;
          color: white;
        }

        .ConnectionContainer {
          display: flex;
          flex-direction: column;
          font-size: 1.7rem;
          text-align: center;
          margin: 1rem 0;
        }

        .ConnectionDetails {
          padding: 1rem;
          text-align: center;
        }

        .ClientNote {
          font-size: 0.9rem;
        }

        .ConfirmMessage {
          margin-top: 2rem;
          font-size: 1rem;
          text-align: center;
        }

        .User {
          display: flex;
          justify-content: center;
          align-items: center;
          font-weight: 800;
          font-size: 1.7rem;
          color: var(--primary);
        }
        .UserName {
          display: flex;
          flex-direction: column;
        }

        .Image {
          height: 60px;
          width: 60px;
          border-radius: 10px;
          margin-right: 1rem;
          font-size: 2.7rem;
          background: var(--secondary);
          fill: white;
          border: 1px solid var(--secondary);
        }

        .MissingImage {
          height: 30px;
          width: 40px;
          margin-right: 1rem;
        }

        .Connection {
          /* border: 1px solid var(--secondary);
  border-radius: 20px; */
          margin: auto;
          width: 100%;
          transition: background-color 0.2s;
          background: var(--secondary);
          color: white;
          font-weight: 900;
          cursor: pointer;
          border: 1px solid black;
          border-radius: 10px;
          padding: 2rem 1rem;
        }

        .Connection:hover {
          transform: scale(1.02);
        }

        .ButtonGroup {
          height: 4rem;
          display: flex;
          gap: 1rem;
        }

        .ButtonGroup button {
          height: 100%;
          margin: 0px;
        }
      `}</style>
      <div className="ConnectionDetails">
        <div className="User">
          {user?.image ? (
            <img className="Image" src={user.image} referrer-policy="no-referrer" alt="Profile picture" />
          ) : (
            <FaUser className="MissingImage" />
          )}
          <div className="UserName">
            {user?.name || user?.email}
            {user?.name ? <span style={{ fontSize: "1.2rem" }}>{user?.email}</span> : null}
          </div>
        </div>
        <div className="ConfirmMessage">
          <b className="SecondaryColor">{clientLabel}</b>*
          <br /> <span style={{ color: "var(--primary)" }}>requests access to</span> <br />
          <b className="SecondaryColor">{serverURL.host + serverURL.pathname}</b>{" "}
        </div>
      </div>
      <div className="ConnectionContainer" onClick={acceptToken}>
        <div className={`Connection ${loading ? "Loading" : ""}`}>Authorize</div>
        <p className="ClientNote">* {clientNote}</p>
      </div>

      <div className="ButtonGroup">
        <button onClick={() => signOut()}>Change user</button>
        <button onClick={() => router.push("/")}>Manage connections</button>
      </div>
    </div>
  );
}

interface AmcatSessionParams {
  clientId: string;
  redirectUri: string;
  resource: string;
  state: string;
  codeChallenge: string;
  scope: string;
  type: string;
  refreshRotate: boolean;
  expiresIn: number | null;
  csrfToken: string | undefined;
}

const oauthAuthorizeSchema = z.object({
  authCode: z.string(),
  state: z.string(),
});

/**
 * Set up oauth2 + PKCE flow.
 */
async function createAmcatSession({
  clientId,
  redirectUri,
  resource,
  state,
  codeChallenge,
  scope,
  type,
  refreshRotate,
  expiresIn,
  csrfToken,
}: AmcatSessionParams): Promise<string> {
  const res = await fetch(`/api/newAmcatSession`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      clientId,
      resource,
      resourceConfig: await getResourceConfig(resource),
      state,
      codeChallenge,
      scope,
      type,
      refreshRotate,
      expiresIn,
      redirectUri,
      label: clientId,
      csrfToken,
    }),
  });

  if (!res.ok) {
    const body: any = await res.json();
    console.error(res.status, res.statusText);
    if (body.zod)
      console.error(
        "Invalid parameters passed to newAmcatSession route. This shouldn't happen (obviously). See issues to debug",
        body.zod.issues
      );
    throw new Error("Failed to create session");
  }

  const dataValidator = oauthAuthorizeSchema.safeParse(await res.json());
  if (!dataValidator.success) {
    console.error(dataValidator.error);
    throw new Error("Invalid response from server");
  }

  const url = new URL(redirectUri);
  url.searchParams.set("code", dataValidator.data.authCode);
  url.searchParams.set("state", dataValidator.data.state);
  return url.toString();
}
